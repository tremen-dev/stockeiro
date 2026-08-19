import { describe, it, expect } from 'vitest';
import {
  SEED_REGISTRATION_SETTINGS,
  parseCapacity,
  registrationState,
  type RegistrationSettings,
} from '@/lib/registration/gate';

/**
 * SPEC-037 CA-2 — la decisión del grifo es una función PURA y EXHAUSTIVA
 * (ADR-023 ptos. 3 y 4).
 *
 * Mismo patrón que `isPublicPath` (SPEC-001), `isSessionEpochCurrent` (ADR-016
 * pto. 7) y `canSee` (SPEC-034): la decisión vive en un módulo que no importa nada
 * —ni la base, ni Next— y se prueba caso a caso sin levantar absolutamente nada.
 *
 * Se recorre la MATRIZ COMPLETA que pide el CA:
 *   (open_manually verdadero/falso) × (capacity nulo / > cuentas / == cuentas / < cuentas)
 *
 * El caso frontera es `cuentas == capacity`, y está CERRADO: con 50 cuentas y cupo 50
 * el aforo está lleno. Escribirlo al revés («cabe uno más si son iguales») es el
 * defecto clásico de este tipo de comparación, y por eso tiene su propio caso.
 */

const abierto = (capacity: number | null): RegistrationSettings => ({
  openManually: true,
  capacity,
});
const cerradoAMano = (capacity: number | null): RegistrationSettings => ({
  openManually: false,
  capacity,
});

describe('SPEC-037 CA-2: la matriz completa de la decisión', () => {
  it('el módulo de la decisión no importa nada: es puro de verdad', async () => {
    // La propiedad que hace que todo lo demás se pueda probar sin arnés. Si mañana
    // alguien mete aquí `@/db/client`, esta comprobación se pone roja antes de que
    // la decisión se vuelva imposible de probar en aislamiento.
    const { readFileSync } = await import('node:fs');
    const { dirname, resolve } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const fuente = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'registration', 'gate.ts'),
      'utf8',
    );
    expect(fuente).not.toMatch(/^\s*import\s/m);
  });

  // --- open_manually = true -------------------------------------------------

  it('abierto a mano y SIN cupo: abierto siempre, cuente lo que cuente', () => {
    for (const cuentas of [0, 1, 50, 1_000_000]) {
      expect(registrationState(abierto(null), cuentas)).toEqual({ open: true });
    }
  });

  it('abierto a mano y cupo MAYOR que las cuentas: abierto', () => {
    expect(registrationState(abierto(50), 49)).toEqual({ open: true });
    expect(registrationState(abierto(1), 0)).toEqual({ open: true });
  });

  it('abierto a mano y cupo IGUAL a las cuentas: CERRADO por cupo (la frontera)', () => {
    expect(registrationState(abierto(50), 50)).toEqual({ open: false, reason: 'capacity' });
    expect(registrationState(abierto(0), 0)).toEqual({ open: false, reason: 'capacity' });
  });

  it('abierto a mano y cupo MENOR que las cuentas: cerrado por cupo', () => {
    expect(registrationState(abierto(50), 51)).toEqual({ open: false, reason: 'capacity' });
    expect(registrationState(abierto(1), 999)).toEqual({ open: false, reason: 'capacity' });
  });

  // --- open_manually = false ------------------------------------------------

  it('cerrado a mano: cerrado por MANUAL en las cuatro columnas de la matriz', () => {
    // El motivo manual manda: quien cerró el grifo a propósito no quiere leer que el
    // registro está cerrado «porque se ha llenado».
    expect(registrationState(cerradoAMano(null), 0)).toEqual({ open: false, reason: 'manual' });
    expect(registrationState(cerradoAMano(50), 49)).toEqual({ open: false, reason: 'manual' });
    expect(registrationState(cerradoAMano(50), 50)).toEqual({ open: false, reason: 'manual' });
    expect(registrationState(cerradoAMano(50), 51)).toEqual({ open: false, reason: 'manual' });
  });

  it('la semilla del proyecto es abierta y con cupo 50 (ADR-023 pto. 7)', () => {
    expect(SEED_REGISTRATION_SETTINGS).toEqual({ openManually: true, capacity: 50 });
    // Y con la semilla, una app recién desplegada acepta altas.
    expect(registrationState(SEED_REGISTRATION_SETTINGS, 0)).toEqual({ open: true });
    expect(registrationState(SEED_REGISTRATION_SETTINGS, 49)).toEqual({ open: true });
    expect(registrationState(SEED_REGISTRATION_SETTINGS, 50)).toEqual({
      open: false,
      reason: 'capacity',
    });
  });
});

/**
 * CA-21 (la mitad pura): un cupo inválido se rechaza. La validación vive junto a la
 * decisión y no dentro de la server action, para que no haga falta levantar Next
 * para saber qué se acepta.
 */
describe('SPEC-037 CA-21: qué es un cupo válido', () => {
  it('vacío o ausente significa SIN cupo, que es un valor legítimo', () => {
    expect(parseCapacity('')).toEqual({ ok: true, value: null });
    expect(parseCapacity('   ')).toEqual({ ok: true, value: null });
    expect(parseCapacity(null)).toEqual({ ok: true, value: null });
    expect(parseCapacity(undefined)).toEqual({ ok: true, value: null });
  });

  it('un entero no negativo se acepta', () => {
    expect(parseCapacity('50')).toEqual({ ok: true, value: 50 });
    expect(parseCapacity(' 120 ')).toEqual({ ok: true, value: 120 });
    expect(parseCapacity('0')).toEqual({ ok: true, value: 0 });
    expect(parseCapacity(7)).toEqual({ ok: true, value: 7 });
  });

  it('negativo, no entero o no numérico se rechazan', () => {
    for (const malo of ['-1', '-50', '2.5', '1e3', 'cincuenta', '50 plazas', '', ' 3,5', NaN, {}]) {
      if (malo === '') continue; // el vacío tiene su propio caso: significa «sin cupo»
      expect(parseCapacity(malo as unknown), `debería rechazar ${String(malo)}`).toEqual({
        ok: false,
      });
    }
  });
});
