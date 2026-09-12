import { readFileSync, readdirSync } from 'node:fs';
import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { zoneStatusForUser } from '@/lib/watchlist/zone-status';

/**
 * SPEC-041 CA-1 — **el nombre del activo llega a la vista, y no cuesta ni una
 * migración**.
 *
 * El dato ya estaba: `symbols.name` es el *instrument_name* del proveedor y
 * `getOrCreateSymbol` lo guarda al crear el símbolo desde el buscador. Lo que faltaba
 * es que `zoneStatusForUser` **lo seleccionara**: el usuario veía el nombre al dar de
 * alta y lo perdía al día siguiente.
 *
 * Por eso este fichero prueba **dos cosas a la vez**, y la segunda no es decorativa:
 * que el nombre viaja, y que **no ha entrado esquema nuevo por la puerta de atrás**.
 * CE-M3 de EPIC-MEJORA dice que una mejora que necesita migración deja de ser una
 * mejora; CA-1 lo escribe como criterio comprobable.
 */

let db: TestDb;
let userA: string;
let userB: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
  userB = (await registerUser(db, 'b@example.com', 'clave')).id;
});

const mercado = (name: string | null) => ({
  micCode: 'BMEX',
  exchange: 'BME',
  name,
  instrumentType: 'Common Stock',
});

describe('SPEC-041 CA-1: la vista trae el nombre del activo', () => {
  it('la fila devuelta incluye el nombre en un campo propio de ZoneStatusView', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 20, buyMax: 25 }, mercado('Industria de Diseño Textil SA'));

    const [fila] = await zoneStatusForUser(db, userA);
    expect(fila.ticker).toBe('ITX');
    expect(fila.name).toBe('Industria de Diseño Textil SA');
  });

  it('un símbolo sin nombre conocido llega con `name` null — no con el ticker repetido ni con un hueco inventado (CA-3)', async () => {
    await watchSymbol(db, userA, 'BBVA', 'EUR', {}, mercado(null));

    const [fila] = await zoneStatusForUser(db, userA);
    expect(fila.ticker).toBe('BBVA');
    expect(fila.name).toBeNull();
  });

  it('el orden por defecto sigue siendo `orderBy(symbols.ticker)`: es la base de CA-6 y del desempate de CA-9', async () => {
    await watchSymbol(db, userA, 'TEF', 'EUR', {}, mercado('Telefónica SA'));
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, mercado('Industria de Diseño Textil SA'));
    await watchSymbol(db, userA, 'SAN', 'EUR', {}, mercado('Banco Santander SA'));

    const filas = await zoneStatusForUser(db, userA);
    expect(filas.map((f) => f.ticker)).toEqual(['ITX', 'SAN', 'TEF']);
  });

  it('el aislamiento por usuario no se relaja al añadir el nombre (RN-01, CA-20)', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, mercado('Industria de Diseño Textil SA'));
    await watchSymbol(db, userB, 'MSFT', 'USD', {}, { ...mercado('Microsoft Corp'), micCode: 'XNAS' });

    expect((await zoneStatusForUser(db, userA)).map((f) => f.ticker)).toEqual(['ITX']);
    expect((await zoneStatusForUser(db, userB)).map((f) => f.ticker)).toEqual(['MSFT']);
  });
});

describe('SPEC-041 CA-1: y sin tocar el esquema — CE-M3', () => {
  /*
    RE-ENCUADRE declarado (SPEC-063; ADR-037, FOUNDATION 3.er corolario).

    ANTES congelaba **la última migración del árbol** en `0010_registration_gate_and_cron_runs`
    para demostrar que SPEC-041 no había traído esquema. Funcionaba el día de su entrega y
    caducaba con la primera spec posterior que migrase —caducó con SPEC-063, que sí tiene
    épica de producto y sí puede migrar—, poniendo rojo a quien no había tocado SPEC-041.

    AHORA afirma la propiedad que CE-M3 pedía, y que sigue siendo verdad para siempre: **el
    nombre del activo vive en una columna que ya existía ANTES de SPEC-041**, así que esta
    spec no necesitó esquema. Se comprueba buscando la migración que creó `symbols.name` y
    exigiendo que sea **anterior** a la entrega de SPEC-041; y el diario y el directorio se
    siguen comparando entre sí, que es una medida contra otra medida y no contra una foto.
  */
  /** Lo último que había en `drizzle/` cuando SPEC-041 entró. Es historia, no un tope. */
  const ANTES_DE_SPEC_041 = '0010_registration_gate_and_cron_runs';

  it('el nombre del activo ya estaba en el esquema: esta spec no trajo migración (CE-M3)', () => {
    const diario = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as {
      entries: { tag: string }[];
    };

    const conNombre = readdirSync('drizzle')
      .filter((n) => n.endsWith('.sql'))
      .sort()
      .filter((n) => /add column[^;]*"name"|"name" text/i.test(readFileSync(`drizzle/${n}`, 'utf8')));

    expect(conNombre.length, 'ninguna migración crea `symbols.name`: el barrido mira mal').toBeGreaterThan(0);
    expect(
      conNombre[0] <= `${ANTES_DE_SPEC_041}.sql`,
      `la columna del nombre aparece en «${conNombre[0]}», posterior a la entrega de ` +
        `SPEC-041: si el nombre necesitó esquema, esta spec dejó de ser una mejora (CE-M3)`,
    ).toBe(true);

    expect(
      readdirSync('drizzle').filter((n) => n.endsWith('.sql')).length,
      'apareció un fichero .sql de migración que el diario no lista, o al revés',
    ).toBe(diario.entries.length);
  });

  it('`symbols.name` sigue siendo la columna de siempre, y sigue siendo NULLABLE', () => {
    const esquema = readFileSync('src/db/schema.ts', 'utf8');
    expect(esquema).toContain("name: text('name')");
    expect(
      esquema,
      '`symbols.name` se ha vuelto NOT NULL: un símbolo sin nombre conocido NO TIENE ' +
        'nombre, y CA-3 depende de que eso se pueda representar',
    ).not.toMatch(/name: text\('name'\)[^,\n]*notNull/);
  });
});
