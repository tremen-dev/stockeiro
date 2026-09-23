import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { MIN_FORM_FILL_MS } from '@/lib/registration/activation-rules';
import { caughtByHoneypot, isSealOldEnough, sealFormRender } from '@/lib/registration/form-guard';
import { handleSignup } from '@/lib/registration/signup-flow';
import {
  FakeNotificationSender,
  SECRETO,
  depsDeAlta,
  formularioDeAlta,
  recuento,
  selloDeHace,
} from './spec066-arnes';

/**
 * SPEC-066 capa 1 — CA-1 (campo trampa) y CA-3 (tiempo mínimo firmado).
 *
 * Se mide sobre el camino entero del alta (`handleSignup`) contra PGlite: que una función
 * pura diga «bot» no prueba nada; que no haya fila en `users`, ni token, ni correo, sí.
 */

let db: TestDb;
let sender: FakeNotificationSender;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  sender = new FakeNotificationSender();
});

const NADA = { cuentas: 0, tokens: 0, correos: 0 };

describe('SPEC-066 CA-1: el campo trampa delata y no se nota', () => {
  it.each([
    ['una letra', 'x'],
    ['un espacio', ' '],
    ['una URL', 'https://spam.example.net/oferta'],
  ])('con %s en el campo trampa: respuesta neutra y NO crea nada', async (_n, valor) => {
    const ahora = Date.now();
    const r = await handleSignup(
      depsDeAlta(db, sender, { now: ahora }),
      formularioDeAlta({ email: 'bot@example.com', trampa: valor, ahora }),
    );
    expect(r.kind).toBe('neutral');
    if (r.kind === 'neutral') await r.delivery;
    expect(await recuento(db, sender)).toEqual(NADA);
  });

  it.each([
    ['vacío', ''],
    ['ausente', null],
  ])('con el campo trampa %s el alta sigue su camino y crea la cuenta', async (_n, valor) => {
    const ahora = Date.now();
    const r = await handleSignup(
      depsDeAlta(db, sender, { now: ahora }),
      formularioDeAlta({ email: 'persona@example.com', trampa: valor, ahora }),
    );
    expect(r.kind).toBe('neutral');
    if (r.kind === 'neutral') await r.delivery;
    expect(await recuento(db, sender)).toEqual({ cuentas: 1, tokens: 1, correos: 1 });
  });

  it('la función pura, en los dos sentidos (especímenes mínimos de la spec)', () => {
    for (const caza of ['x', ' ', 'https://spam.example.net']) expect(caughtByHoneypot(caza)).toBe(true);
    for (const noCaza of ['', null, undefined]) expect(caughtByHoneypot(noCaza)).toBe(false);
  });
});

describe('SPEC-066 CA-3: menos de 2 s, o un sello que no es nuestro, es un automatismo', () => {
  const casosQueCazan: Array<[string, (ahora: number) => string | null]> = [
    ['falta', () => null],
    ['está manipulado (instante cambiado, firma vieja)', (ahora) => {
      const bueno = selloDeHace(MIN_FORM_FILL_MS + 500, ahora);
      const [, firma] = bueno.split('.');
      return `${ahora - 60_000}.${firma}`;
    }],
    ['está manipulado (un carácter de la firma)', (ahora) => {
      const bueno = selloDeHace(MIN_FORM_FILL_MS + 500, ahora);
      const ultimo = bueno.at(-1) === 'A' ? 'B' : 'A';
      return bueno.slice(0, -1) + ultimo;
    }],
    ['está firmado con OTRA clave', (ahora) =>
      selloDeHace(MIN_FORM_FILL_MS + 500, ahora, 'otra-clave-que-no-es-la-nuestra-000000')],
    ['tiene menos de 2 s', (ahora) => selloDeHace(MIN_FORM_FILL_MS - 1, ahora)],
    ['es basura', () => 'no-soy-un-sello'],
  ];

  it.each(casosQueCazan)('si el sello %s: respuesta neutra y NO crea nada', async (_n, fabricar) => {
    const ahora = Date.now();
    const r = await handleSignup(
      depsDeAlta(db, sender, { now: ahora }),
      formularioDeAlta({ email: 'rapido@example.com', sello: fabricar(ahora), ahora }),
    );
    expect(r.kind).toBe('neutral');
    if (r.kind === 'neutral') await r.delivery;
    expect(await recuento(db, sender)).toEqual(NADA);
  });

  it.each([
    ['justo el mínimo', MIN_FORM_FILL_MS],
    ['de hace un día (sin cota superior)', 24 * 3_600_000],
  ])('con un sello propio de %s, el alta sigue', async (_n, hace) => {
    const ahora = Date.now();
    const r = await handleSignup(
      depsDeAlta(db, sender, { now: ahora }),
      formularioDeAlta({ email: `lento-${hace}@example.com`, sello: selloDeHace(hace, ahora), ahora }),
    );
    if (r.kind === 'neutral') await r.delivery;
    expect(await recuento(db, sender)).toEqual({ cuentas: 1, tokens: 1, correos: 1 });
  });

  it('el reloj es el del SERVIDOR en los dos extremos: adelantar el del cliente no cambia nada', async () => {
    // El servidor pintó hace medio segundo. El "cliente" declara por su cuenta que pintó
    // hace una hora, por los dos sitios por donde podría intentarlo: un campo inventado y
    // su propio reloj adelantado. El veredicto no se mueve, porque ninguno se lee.
    const ahoraDelServidor = Date.now();
    const fd = formularioDeAlta({
      email: 'reloj@example.com',
      sello: selloDeHace(500, ahoraDelServidor),
      ahora: ahoraDelServidor,
    });
    fd.set('renderedAt', String(ahoraDelServidor - 3_600_000));
    vi.useFakeTimers({ now: ahoraDelServidor + 3_600_000, toFake: ['Date'] });
    try {
      const r = await handleSignup(depsDeAlta(db, sender, { now: ahoraDelServidor }), fd);
      if (r.kind === 'neutral') await r.delivery;
    } finally {
      vi.useRealTimers();
    }
    expect(await recuento(db, sender)).toEqual(NADA);
  });

  it('el sello no contiene AUTH_SECRET ni ninguna codificación suya', () => {
    const sello = sealFormRender(Date.now(), SECRETO);
    for (const forma of [
      SECRETO,
      Buffer.from(SECRETO).toString('base64'),
      Buffer.from(SECRETO).toString('base64url'),
      Buffer.from(SECRETO).toString('hex'),
    ]) {
      expect(sello).not.toContain(forma);
    }
    // Y sólo lleva un instante y una firma de 256 bits: no hay sitio para nada más.
    expect(sello).toMatch(/^\d+\.[A-Za-z0-9_-]{43}$/);
  });

  it('la función pura, en los dos sentidos', () => {
    const ahora = Date.now();
    expect(isSealOldEnough(selloDeHace(MIN_FORM_FILL_MS, ahora), ahora, SECRETO)).toBe(true);
    expect(isSealOldEnough(selloDeHace(MIN_FORM_FILL_MS - 1, ahora), ahora, SECRETO)).toBe(false);
    expect(isSealOldEnough(null, ahora, SECRETO)).toBe(false);
  });
});
