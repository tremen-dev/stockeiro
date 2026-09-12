import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { zoneStatusForUser } from '@/lib/watchlist/zone-status';
import { symbolUniverse } from '@/lib/market/refresh';
import { upsertQuote } from '@/lib/market/quotes';
import { quotes } from '@/db/schema';
import { UMBRAL_SIN_REFRESCAR_MS } from '@/lib/market/sin-refrescar';
import { ESCALA_ACERCAMIENTO_PCT } from '@/lib/config/escala-acercamiento';
import { ZONAS } from '@/lib/help/content';
import { porcentajeVisible } from '@/lib/watchlist/acercamiento';
import { afirmacionesProhibidasEn } from './ayuda-afirmaciones-prohibidas';

/**
 * SPEC-062 — **el acercamiento llega a la vista** (CA-6), **hereda la vejez del precio**
 * (CA-14), y el **vocabulario está escrito antes que la pantalla** (CA-16/CA-17).
 *
 * El test de la vista corre contra PGlite con el esquema de las migraciones reales
 * (ADR-019): es la única forma de comprobar a la vez que el dato viaja **y** que no ha
 * entrado esquema nuevo por la puerta de atrás, que es lo que CE-M3 de EPIC-MEJORA exige
 * a cualquier mejora.
 */

let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
});

const mercado = { micCode: 'BMEX', exchange: 'BME' };

const sembrarPrecio = async (price: string) => {
  const [u] = await symbolUniverse(db);
  await upsertQuote(db, u.symbolId, { price, currency: 'EUR', asOf: '2026-09-11T21:00:00.000Z' });
  return u.symbolId;
};

const DOMINIO = () => readFileSync('docs/fundacion/dominio.md', 'utf8');
const REGLAS = () => readFileSync('docs/fundacion/reglas.md', 'utf8');
const seccionZonas = () => [ZONAS.titulo, ...ZONAS.parrafos].join('\n');

/* ────────────────────────────────────────────────────────────────────────────
   CA-6 — El dato llega a la fila, y sin esquema nuevo
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-062 CA-6: la vista trae el acercamiento ya resuelto', () => {
  it('una vigilada fuera de zona llega con su distancia, su sentido y su zona', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 3.8, buyMax: 3.99 }, mercado);
    await sembrarPrecio('4.12');

    const [f] = await zoneStatusForUser(db, userA);
    expect(f.state).toBe('out');
    expect(f.acercamiento).toMatchObject({ zona: 'compra', dentro: false, sentido: 'bajar' });
    expect(porcentajeVisible(f.acercamiento!)).toBe('3,2%');
  });

  it('una vigilada en zona llega con distancia cero, y su estado sigue siendo el de siempre', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 3.8, buyMax: 3.99 }, mercado);
    await sembrarPrecio('3.90');

    const [f] = await zoneStatusForUser(db, userA);
    expect(f.state).toBe('buy'); // SPEC-007 intacto
    expect(f.acercamiento).toMatchObject({ zona: 'compra', dentro: true, porcentaje: '0' });
  });

  it('sin cotización no hay acercamiento — y sigue sin haberlo aunque tenga zonas', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 3.8, buyMax: 3.99 }, mercado);

    const [f] = await zoneStatusForUser(db, userA);
    expect(f.state).toBe('none');
    expect(f.acercamiento).toBeNull();
  });

  it('con precio pero sin zonas tampoco: no es un cero, es una ausencia', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, mercado);
    await sembrarPrecio('4.12');

    const [f] = await zoneStatusForUser(db, userA);
    expect(f.hasQuote).toBe(true);
    expect(f.acercamiento).toBeNull();
  });

  it('cero columnas nuevas: esto es presentación, no esquema (CE-M3 de EPIC-MEJORA)', () => {
    const esquema = readFileSync('src/db/schema.ts', 'utf8');
    expect(esquema).not.toMatch(/acercamiento/i);
    expect(esquema).not.toMatch(/distancia/i);

    // Y ninguna migración nueva la pide: el módulo que mide no habla con la base.
    const medida = readFileSync('src/lib/watchlist/acercamiento.ts', 'utf8');
    expect(medida).not.toMatch(/drizzle-orm|@\/db\//);
  });

  it('el aislamiento por usuario no cambia: cada uno ve el acercamiento de lo suyo', async () => {
    const userB = (await registerUser(db, 'b@example.com', 'clave')).id;
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 3.8, buyMax: 3.99 }, mercado);
    await sembrarPrecio('4.12');

    expect(await zoneStatusForUser(db, userB)).toEqual([]);
    expect((await zoneStatusForUser(db, userA))[0].acercamiento).not.toBeNull();
  });

  it('dos usuarios con el MISMO símbolo y zonas distintas ven acercamientos distintos', async () => {
    const userB = (await registerUser(db, 'b@example.com', 'clave')).id;
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 3.8, buyMax: 3.99 }, mercado);
    await watchSymbol(db, userB, 'ITX', 'EUR', { sellMin: 4.2, sellMax: 4.5 }, mercado);
    await sembrarPrecio('4.12');

    const [a] = await zoneStatusForUser(db, userA);
    const [b] = await zoneStatusForUser(db, userB);
    expect(a.acercamiento!.zona).toBe('compra');
    expect(b.acercamiento!.zona).toBe('venta');
    expect(a.acercamiento!.sentido).toBe('bajar');
    expect(b.acercamiento!.sentido).toBe('subir');
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-14 — La medida hereda la vejez de su precio
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-062 CA-14: sobre una cotización sin refrescar, el acercamiento va marcado', () => {
  const envejecer = async (symbolId: string) => {
    const viejo = new Date(Date.now() - UMBRAL_SIN_REFRESCAR_MS - 3_600_000);
    await db.update(quotes).set({ updatedAt: viejo }).where(eq(quotes.symbolId, symbolId));
  };

  it('la fila vigente NO lleva marca, y la que dejó de refrescarse SÍ — con su número intacto', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 3.8, buyMax: 3.99 }, mercado);
    const symbolId = await sembrarPrecio('4.12');

    const [vigente] = await zoneStatusForUser(db, userA);
    expect(vigente.sinRefrescar).toBe(false);
    expect(vigente.acercamiento).not.toBeNull();

    await envejecer(symbolId);

    const [vieja] = await zoneStatusForUser(db, userA);
    expect(vieja.sinRefrescar).toBe(true);
    // Marcar no es borrar (RN-16): la medida sigue ahí, y es la misma.
    expect(vieja.acercamiento).toEqual(vigente.acercamiento);
  });

  it('la marca la decide la función de siempre y su único umbral: esta spec no estrena otro', () => {
    const medida = readFileSync('src/lib/watchlist/acercamiento.ts', 'utf8');
    expect(medida).not.toMatch(/sinRefrescar|UMBRAL_SIN_REFRESCAR/);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-16 / CA-17 — El vocabulario y la ayuda
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-062 CA-16: el término y la regla existen, y los escribió el arquitecto en el gate', () => {
  it('«Acercamiento a zona» está en el glosario del dominio', () => {
    expect(DOMINIO()).toMatch(/\|\s*Acercamiento a zona\s*\|/);
  });

  it('RN-18 está en reglas, define la medida y dice lo que NO hace', () => {
    // El documento envuelve a 90 columnas, así que se compara sobre el texto con los
    // espacios normalizados: lo que se afirma es lo que dice, no cómo está sangrado.
    const bruto = REGLAS().split('- **RN-18**')[1]?.split('\n## ')[0] ?? '';
    const rn18 = bruto.replace(/\s+/g, ' ');
    expect(rn18).not.toBe('');
    expect(rn18).toMatch(/borde más cercano/i);
    expect(rn18).toMatch(/dividida por el precio/i);
    expect(rn18).toMatch(/no dispara/i);
    expect(rn18).toMatch(/D-4/);
  });

  it('el rótulo de la UI se COPIA del dominio: la implementación no inventa un sinónimo', () => {
    // El término del glosario es «Acercamiento a zona»; el código lo usa como tal.
    expect(readFileSync('src/lib/watchlist/acercamiento.ts', 'utf8')).toMatch(/Acercamiento/);
    expect(readFileSync('src/app/vigiladas/columnas-vigiladas.tsx', 'utf8')).toMatch(/acercamiento/);
  });
});

describe('SPEC-062 CA-17: la ayuda cuenta la barra, y no puede envejecer en silencio', () => {
  it('explica la barra y DERIVA el tramo de la constante que la pinta', () => {
    expect(seccionZonas()).toContain(`${ESCALA_ACERCAMIENTO_PCT}%`);
  });

  it('el contenido no teclea el número: lo interpola desde su único hogar', () => {
    const contenido = readFileSync('src/lib/help/content.ts', 'utf8');
    expect(contenido).toMatch(/ESCALA_ACERCAMIENTO_PCT/);
    expect(contenido).toMatch(/from '@\/lib\/config\/escala-acercamiento'/);
  });

  it('dice que no es una señal ni cambia el aviso, y avisa del split', () => {
    const texto = seccionZonas();
    expect(texto).toMatch(/no es una señal de nada/i);
    expect(texto).toMatch(/no adelanta ni cambia cuándo se avisa/i);
    expect(texto).toMatch(/split/i);
  });

  it('y sigue sin decir nada que D-1, D-2 o D-4 prohíban', () => {
    expect(afirmacionesProhibidasEn(seccionZonas())).toEqual([]);
  });
});
