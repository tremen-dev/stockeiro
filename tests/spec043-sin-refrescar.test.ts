import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { recordBuy, portfolioSummary } from '@/lib/portfolio/service';
import { quotes } from '@/db/schema';
import { refreshQuotes, symbolUniverse } from '@/lib/market/refresh';
import { getPriceMap, getQuoteViews, upsertQuote } from '@/lib/market/quotes';
import { zoneStatusForUser } from '@/lib/watchlist/zone-status';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';
import {
  HORAS_POR_CICLO,
  CICLOS_HASTA_SIN_REFRESCAR,
  UMBRAL_SIN_REFRESCAR_HORAS,
  UMBRAL_SIN_REFRESCAR_MS,
  estaSinRefrescar,
  marcaSinRefrescar,
} from '@/lib/market/sin-refrescar';

/**
 * SPEC-043 · bloque B — **la cotización que dejó de refrescarse**.
 *
 * Del 19 al 21 de agosto de 2026 el producto enseñó el mismo precio con cara de
 * vigente. La base tenía el diagnóstico desde el primer minuto y ninguna pantalla lo
 * decía, porque el aviso de SPEC-016 está condicionado a que **no haya precio**.
 *
 * ## Lo que estos tests defienden por encima de todo: `updated_at`, nunca `as_of`
 *
 * Está razonado en tres sitios (CA-7, RN-16, la fila de `dominio.md`) y hay medición
 * detrás. Si un día parece más natural medir por `as_of`, esta suite es la que
 * explica por qué no lo es.
 */

const H = 3_600_000;
const AHORA = new Date('2026-08-21T09:00:00.000Z');
const haceHoras = (h: number) => new Date(AHORA.getTime() - h * H);

let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
});

/** Fuerza el `updated_at` de la fila: es lo que el ciclo escribe y lo que se mide. */
async function ponerUpdatedAt(symbolId: string, updatedAt: Date) {
  await db.update(quotes).set({ updatedAt }).where(eq(quotes.symbolId, symbolId));
}

describe('SPEC-043 CA-7: qué es una cotización sin refrescar', () => {
  it('el umbral son 36 h, y se dice en CICLOS de la cadencia declarada (CA-12)', () => {
    expect(HORAS_POR_CICLO).toBe(24); // un ciclo al día (ADR-004 pto. 1)
    expect(CICLOS_HASTA_SIN_REFRESCAR).toBe(1.5); // un ciclo perdido + medio día de holgura
    expect(UMBRAL_SIN_REFRESCAR_HORAS).toBe(36); // RN-16
    expect(UMBRAL_SIN_REFRESCAR_MS).toBe(36 * H);
  });

  it('por encima de 36 h está sin refrescar; por debajo, no', () => {
    expect(estaSinRefrescar(haceHoras(37), AHORA)).toBe(true);
    expect(estaSinRefrescar(haceHoras(36.5), AHORA)).toBe(true);
    expect(estaSinRefrescar(haceHoras(35), AHORA)).toBe(false);
    expect(estaSinRefrescar(haceHoras(1), AHORA)).toBe(false);
  });

  it('un cron que llega unas horas tarde NO dispara la marca (por eso 36 y no 24)', () => {
    // El ciclo de anoche entró a las 22:00 UTC; a las 09:00 del día siguiente han pasado
    // 11 h. Con umbral de 24 h bastaría un retraso de 13 h para mentir en pantalla.
    expect(estaSinRefrescar(haceHoras(11), AHORA)).toBe(false);
    expect(estaSinRefrescar(haceHoras(26), AHORA)).toBe(false); // se saltó un rato, no un ciclo
  });

  it('dos ciclos perdidos SÍ se marcan: 48 h toleraría dos días mintiendo', () => {
    expect(estaSinRefrescar(haceHoras(47), AHORA)).toBe(true);
  });

  it('sin cotización NO es «sin refrescar»: es otra cosa y ya la dice SPEC-016', () => {
    expect(estaSinRefrescar(null, AHORA)).toBe(false);
    expect(estaSinRefrescar(undefined, AHORA)).toBe(false);
  });

  it('EL CONTRAPOSITIVO: un fin de semana no vuelve vieja una cotización', async () => {
    // Sábado. El ciclo de anoche corrió con éxito y REESCRIBIÓ la fila aunque el precio
    // fuera el mismo del cierre del viernes: `as_of` se queda en el viernes —es legítimo,
    // no hubo sesión— y `updated_at` se mueve igual.
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, { micCode: 'BMEX', exchange: 'BME' });
    const [u] = await symbolUniverse(db);
    await upsertQuote(db, u.symbolId, {
      price: '59.10',
      currency: 'EUR',
      asOf: '2026-08-14T00:00:00.000Z', // viernes: el último cierre que hubo
    });
    await ponerUpdatedAt(u.symbolId, haceHoras(11)); // ciclo de anoche, con éxito

    const [vista] = await getQuoteViews(db, ['ITX']);

    expect(estaSinRefrescar(vista.updatedAt, AHORA)).toBe(false);
    // Y la mitad que importa: medido por `as_of` habría sido un FALSO POSITIVO. Este
    // `expect` es el que hay que releer antes de "simplificar" la medida.
    expect(AHORA.getTime() - vista.asOf.getTime()).toBeGreaterThan(UMBRAL_SIN_REFRESCAR_MS);
  });

  it('y el retraso DESIGUAL de publicación del proveedor tampoco (medido 2026-08-21)', () => {
    // `APP` traía `date` 2026-08-19 mientras `AAPL` e `ITX` ya traían 2026-08-20, en la
    // MISMA llamada. Por `as_of`, `APP` saldría marcado refrescándose perfectamente.
    const asOfRezagado = new Date('2026-08-19T00:00:00.000Z');
    expect(AHORA.getTime() - asOfRezagado.getTime()).toBeGreaterThan(UMBRAL_SIN_REFRESCAR_MS);
    expect(estaSinRefrescar(haceHoras(11), AHORA)).toBe(false);
  });

  it('la premisa del umbral está viva: el cron declarado corre TODOS los días', () => {
    // CA-7 lo dice explícitamente y no es un detalle: 36 h presuponen un ciclo diario sin
    // saltos. El día que alguien restrinja el cron a días hábiles, 72 h de hueco de
    // viernes a lunes marcarían TODO el universo (F-SPEC-043-2). Esta guardia es la que
    // obliga a que las dos cosas entren en la misma entrega.
    const { crons } = JSON.parse(readFileSync('vercel.json', 'utf8'));
    const refresco = crons.find((c: { path: string }) => c.path.includes('/cron/refresh'));
    expect(refresco, 'no hay cron de refresco declarado').toBeTruthy();
    const [, , diaDelMes, mes, diaSemana] = refresco.schedule.split(/\s+/);
    expect([diaDelMes, mes, diaSemana], `cadencia con saltos: revisa el umbral de RN-16`).toEqual([
      '*',
      '*',
      '*',
    ]);
  });
});

describe('SPEC-043 CA-12: una sola definición, y las dos pantallas la comparten', () => {
  const fuente = (...ruta: string[]) => readFileSync(ruta.join('/'), 'utf8');

  /*
    ── RE-ENCUADRE DE SPEC-054 (dónde MIRA CA-12, no qué exige) ────────────────────

    SPEC-054 / ADR-034 §3 partió cada pantalla en dos ficheros: la **descripción de
    columnas**, de la que salen las DOS representaciones —la tabla y la lista de
    tarjetas—, y el componente o la página, que sigue cargando los datos. La marca de
    «sin refrescar» se pinta en una celda, así que se fue con la descripción.

    Lo que CA-12 vigila no cambia: **una sola definición del umbral y una sola redacción
    de la marca**, compartidas por las dos pantallas. Lo que cambia es dónde está escrito,
    así que la guardia mira **la superficie entera** de cada pantalla en vez de un solo
    fichero — y de paso mide más de lo que medía: si el número reapareciera en la
    descripción de columnas, antes no lo habría visto nadie. No se afloja nada.
  */
  const PANTALLA_VIGILADAS = [
    ['src', 'app', 'vigiladas', 'watched-table.tsx'],
    ['src', 'app', 'vigiladas', 'columnas-vigiladas.tsx'],
  ];
  const PANTALLA_CARTERA = [
    ['src', 'app', 'cartera', 'page.tsx'],
    ['src', 'app', 'cartera', 'columnas-cartera.tsx'],
  ];
  const superficie = (ficheros: string[][]) => ficheros.map((r) => fuente(...r)).join('\n');

  it('el umbral vive en UN solo sitio: nadie más escribe el número', () => {
    const consumidores = [
      fuente('src', 'lib', 'watchlist', 'zone-status.ts'),
      ...PANTALLA_VIGILADAS.map((r) => fuente(...r)),
      ...PANTALLA_CARTERA.map((r) => fuente(...r)),
    ];
    for (const texto of consumidores) {
      // Ni el 36 ni la aritmética que lo reconstruye. Un segundo literal es la forma más
      // barata de acabar con dos definiciones y una equivocada.
      expect(texto).not.toMatch(/\b36\b/);
      expect(texto).not.toMatch(/3_?600_?000|86_?400_?000/);
    }
  });

  it('las dos pantallas llaman a la MISMA función del mismo módulo', () => {
    const zona = fuente('src', 'lib', 'watchlist', 'zone-status.ts');
    const cartera = fuente('src', 'app', 'cartera', 'page.tsx');
    for (const texto of [zona, cartera]) {
      expect(texto).toMatch(/from\s+'@\/lib\/market\/sin-refrescar'/);
      expect(texto).toMatch(/estaSinRefrescar/);
    }
  });

  it('y dicen lo mismo: la marca sale de una sola función, no de dos redacciones', () => {
    const desde = new Date('2026-08-18T23:43:00.000Z');
    expect(marcaSinRefrescar(desde, null)).toBe(marcaSinRefrescar(desde, null));
    expect(marcaSinRefrescar(desde, null)).toMatch(/no se est[áa] actualizando/i);
    expect(marcaSinRefrescar(desde, null)).toContain('2026-08-18');
    expect(superficie(PANTALLA_VIGILADAS)).toMatch(/marcaSinRefrescar/);
    expect(superficie(PANTALLA_CARTERA)).toMatch(/marcaSinRefrescar/);
  });

  it('el módulo es el que RN-16 describe en prosa: código y regla apuntan al mismo número', () => {
    const regla = fuente('docs', 'fundacion', 'reglas.md');
    const bloque = regla.slice(regla.indexOf('**RN-16**'), regla.indexOf('**RN-16**') + 1400);
    expect(bloque).toContain(`${UMBRAL_SIN_REFRESCAR_HORAS} h`);
    expect(fuente('src', 'lib', 'market', 'sin-refrescar.ts')).toContain('RN-16');
  });
});

describe('SPEC-043 CA-10: sin diagnóstico se dice lo que se sabe y no se inventa el resto', () => {
  it('sin motivo: se dice el HECHO y se calla la causa', () => {
    const marca = marcaSinRefrescar(new Date('2026-08-18T23:43:00.000Z'), null);

    expect(marca).toMatch(/no se est[áa] actualizando desde/i);
    expect(marca).toContain('2026-08-18'); // su fecha, la de la última escritura del ciclo
    // Ni «el proveedor no respondió» ni ninguna otra causa inventada.
    expect(marca).not.toMatch(/proveedor|cuota|s[ií]mbolo|mercado|deslistad/i);
  });

  it('con motivo: el hecho MÁS el porqué, que es el que sí se conoce', () => {
    const marca = marcaSinRefrescar(new Date('2026-08-18T23:43:00.000Z'), 'cuota_agotada');

    expect(marca).toMatch(/no se est[áa] actualizando desde/i);
    expect(marca).toMatch(/cuota/i);
  });
});

describe('SPEC-043 CA-13: RN-06 y RN-11 intactos — marcar no es borrar', () => {
  it('el estado de zona se sigue calculando sobre la cotización sin refrescar', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 50, buyMax: 60 }, { micCode: 'BMEX', exchange: 'BME' });
    const [u] = await symbolUniverse(db);
    await upsertQuote(db, u.symbolId, { price: '55', currency: 'EUR', asOf: '2026-08-18T23:43:00.000Z' });
    await ponerUpdatedAt(u.symbolId, haceHoras(60)); // dos ciclos y medio sin escribirse

    const [fila] = await zoneStatusForUser(db, userA);

    expect(fila.sinRefrescar).toBe(true);
    // RN-11 intacta: sigue en zona de compra, con su precio y su color de fondo.
    expect(fila.state).toBe('buy');
    expect(fila.price).toBe('55');
    expect(fila.state).not.toBe('none'); // no pasa a «sin dato»: eso sería perder información
  });

  it('el P/L actual se sigue calculando sobre ella: no pasa a «—»', async () => {
    await recordBuy(db, userA, 'ITX', 'EUR', { quantity: 10, price: 50, occurredOn: '2026-01-02' }, { micCode: 'BMEX' });
    const [u] = await symbolUniverse(db);
    await upsertQuote(db, u.symbolId, { price: '55', currency: 'EUR', asOf: '2026-08-18T23:43:00.000Z' });
    await ponerUpdatedAt(u.symbolId, haceHoras(60));

    const resumen = await portfolioSummary(db, userA, await getPriceMap(db));
    const [pos] = resumen.positions;
    const [vista] = await getQuoteViews(db, ['ITX']);

    expect(estaSinRefrescar(vista.updatedAt, AHORA)).toBe(true);
    expect(pos.plActual).not.toBeNull(); // RN-06 intacta
    expect(Number(pos.plActual)).toBeCloseTo(50, 2); // (55 - 50) × 10
  });
});

describe('SPEC-043 CA-11: la marca desaparece sola al volver la normalidad', () => {
  it('un ciclo posterior que SÍ la actualiza mueve `updated_at` y borra la marca', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, { micCode: 'BMEX', exchange: 'BME' });
    const [u] = await symbolUniverse(db);
    await upsertQuote(db, u.symbolId, { price: '55', currency: 'EUR', asOf: '2026-08-18T23:43:00.000Z' });
    await ponerUpdatedAt(u.symbolId, haceHoras(60));

    const [antes] = await zoneStatusForUser(db, userA);
    expect(antes.sinRefrescar).toBe(true);

    // El ciclo vuelve a funcionar. Sin intervención de nadie.
    await refreshQuotes(
      db,
      new FakeMarketDataProvider({ 'ITX:BMEX': { price: '59.10', currency: 'EUR', asOf: '2026-08-20T00:00:00.000Z' } }),
    );

    const [despues] = await zoneStatusForUser(db, userA);
    expect(despues.sinRefrescar).toBe(false);
    expect(despues.failReason).toBeNull(); // ni avisos fantasma (hermano de SPEC-016 CA-8)
  });

  it('y lo mueve AUNQUE el precio no haya cambiado: es lo que hace innecesario el calendario', async () => {
    // Es la propiedad de la que cuelga todo CA-7. Si el upsert no reescribiera
    // `updated_at` con el mismo precio, el fin de semana daría falsos positivos y haría
    // falta el calendario de sesiones que esta spec evita.
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, { micCode: 'BMEX', exchange: 'BME' });
    const [u] = await symbolUniverse(db);
    await upsertQuote(db, u.symbolId, { price: '55', currency: 'EUR', asOf: '2026-08-14T00:00:00.000Z' });
    await ponerUpdatedAt(u.symbolId, haceHoras(60));

    // MISMO precio y MISMO asOf: el sábado no hubo sesión y el cierre sigue siendo el del viernes.
    await refreshQuotes(
      db,
      new FakeMarketDataProvider({ 'ITX:BMEX': { price: '55', currency: 'EUR', asOf: '2026-08-14T00:00:00.000Z' } }),
    );

    const [vista] = await getQuoteViews(db, ['ITX']);
    expect(vista.price).toBe('55'); // nada cambió para el usuario…
    expect(estaSinRefrescar(vista.updatedAt)).toBe(false); // …y aun así la fila se reescribió
  });
});
