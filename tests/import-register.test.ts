import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { transactions } from '@/db/schema';
import { getOrCreateSymbol } from '@/lib/portfolio/symbols';
import { computePosition, type LedgerEntry } from '@/lib/portfolio/position';
import type { OperacionImportada } from '@/lib/import/statement-reader';
import { previsualizarImport, confirmarImport, type OperacionResuelta } from '@/lib/import/register';

let db: TestDb;
let userA: string;
let userB: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
  userB = (await registerUser(db, 'b@example.com', 'clave')).id;
});

/** Crea un símbolo compartido y devuelve su id (identidad ticker,micCode). */
async function symbolId(ticker: string, currency: string, micCode = 'XMAD'): Promise<string> {
  const s = await getOrCreateSymbol(db, ticker, currency, { micCode, exchange: 'X', name: ticker });
  return s.id;
}

const op = (over: Partial<OperacionImportada> = {}): OperacionImportada => ({
  occurredOn: '2026-01-05',
  side: 'buy',
  nombreBroker: 'PHARMAMAR',
  etiquetaMercado: 'M.CONTINUO',
  cantidad: '100',
  precioOrigen: '68.5',
  importeEur: '6870',
  ...over,
});

const txnsOf = (userId: string) => db.select().from(transactions).where(eq(transactions.userId, userId));

describe('CA-1: mapeo a transacciones del ledger', () => {
  it('COMPRA→buy y VENTA→sell con userId, symbolId, occurredOn, quantity, price', async () => {
    const sid = await symbolId('PHM', 'EUR');
    const resueltas: OperacionResuelta[] = [
      { op: op({ side: 'buy', cantidad: '100', precioOrigen: '10', importeEur: '1000' }), symbolId: sid },
      { op: op({ side: 'sell', cantidad: '40', precioOrigen: '12', importeEur: '480', occurredOn: '2026-02-01' }), symbolId: sid },
    ];
    await confirmarImport(db, userA, resueltas);
    const rows = await txnsOf(userA);
    expect(rows.map((r) => r.type).sort()).toEqual(['buy', 'sell']);
    const buy = rows.find((r) => r.type === 'buy')!;
    expect(buy).toMatchObject({ symbolId: sid, occurredOn: '2026-01-05', quantity: '100', price: '10' });
  });
});

describe('CA-2: coste en mercados EUR; el importe cuadra (ADR-011/RN-04)', () => {
  it('gastos = |importe − price×cantidad| y el coste base reproduce el importe', async () => {
    const sid = await symbolId('PHM', 'EUR');
    await confirmarImport(db, userA, [
      { op: op({ cantidad: '200', precioOrigen: '68.5', importeEur: '13736.86' }), symbolId: sid },
    ]);
    const [row] = await txnsOf(userA);
    expect(row.gastos).toBe('36.86'); // 13736.86 − 200×68.5(=13700)
    expect(row.importeEur).toBe('13736.86');
    // El P/L cuadra: coste base (incl. gastos) = importe pagado.
    const entries: LedgerEntry[] = [{ type: 'buy', occurredOn: row.occurredOn, quantity: row.quantity, price: row.price, gastos: row.gastos }];
    expect(computePosition(entries).costeBaseTotal.toString()).toBe('13736.86');
  });
});

describe('CA-3: divisa nativa + gastos=0 en no-euro (ADR-011)', () => {
  it('símbolo USD: price=origen, gastos=0, importeEur como metadato', async () => {
    const sid = await symbolId('QFIN', 'USD', 'XNAS');
    await confirmarImport(db, userA, [
      { op: op({ nombreBroker: 'QFIN', etiquetaMercado: 'NASDAQ', cantidad: '100', precioOrigen: '12.7', importeEur: '1120' }), symbolId: sid },
    ]);
    const [row] = await txnsOf(userA);
    expect(row.price).toBe('12.7');
    expect(row.gastos).toBe('0');
    expect(row.importeEur).toBe('1120'); // metadato, no entra en coste base
  });
});

describe('CA-4: idempotencia (ADR-010)', () => {
  it('importar dos veces el mismo extracto deja la cartera idéntica', async () => {
    const sid = await symbolId('PHM', 'EUR');
    const resueltas = [{ op: op({ cantidad: '100', precioOrigen: '10', importeEur: '1000' }), symbolId: sid }];
    const r1 = await confirmarImport(db, userA, resueltas);
    const r2 = await confirmarImport(db, userA, resueltas);
    expect(r1.creadas).toBe(1);
    expect(r2.creadas).toBe(0); // 0 nuevas
    expect(r2.saltadas).toBe(1);
    expect(await txnsOf(userA)).toHaveLength(1);
  });
});

describe('CA-5: export incremental', () => {
  it('un extracto que solapa inserta solo lo nuevo', async () => {
    const sid = await symbolId('PHM', 'EUR');
    const a = { op: op({ occurredOn: '2026-01-05', cantidad: '100', precioOrigen: '10', importeEur: '1000' }), symbolId: sid };
    const b = { op: op({ occurredOn: '2026-02-05', cantidad: '50', precioOrigen: '11', importeEur: '550' }), symbolId: sid };
    await confirmarImport(db, userA, [a]);
    const r = await confirmarImport(db, userA, [a, b]); // solapa a, añade b
    expect(r.creadas).toBe(1);
    expect(r.saltadas).toBe(1);
    expect(await txnsOf(userA)).toHaveLength(2);
  });
});

describe('CA-6: idénticas el mismo día (ordinalIntradía)', () => {
  it('dos operaciones idénticas el mismo día se registran ambas y no se duplican al reimportar', async () => {
    const sid = await symbolId('PHM', 'EUR');
    const identica = { op: op({ occurredOn: '2026-03-03', cantidad: '10', precioOrigen: '5', importeEur: '50' }), symbolId: sid };
    const r1 = await confirmarImport(db, userA, [identica, { ...identica }]);
    expect(r1.creadas).toBe(2); // ambas, distinguidas por ordinal
    const r2 = await confirmarImport(db, userA, [identica, { ...identica }]);
    expect(r2.creadas).toBe(0); // re-import no duplica
    expect(await txnsOf(userA)).toHaveLength(2);
  });
});

describe('CA-7: previsualizar-y-confirmar', () => {
  it('la previsualización no escribe nada; solo confirmar escribe', async () => {
    const sid = await symbolId('PHM', 'EUR');
    const resueltas = [{ op: op({ cantidad: '100', precioOrigen: '10', importeEur: '1000' }), symbolId: sid }];
    const preview = await previsualizarImport(db, userA, resueltas, [op({ nombreBroker: 'PENDIENTE' })]);
    expect(preview.aCrear).toHaveLength(1);
    expect(preview.pendientes).toHaveLength(1);
    expect(await txnsOf(userA)).toHaveLength(0); // NADA escrito por previsualizar

    await confirmarImport(db, userA, resueltas);
    expect(await txnsOf(userA)).toHaveLength(1);
  });
});

describe('CA-8: historia incompleta / no sobreventa (RN-08)', () => {
  it('una venta que excede la cantidad viva se avisa y NO se escribe', async () => {
    const sid = await symbolId('PHM', 'EUR');
    const resueltas = [
      { op: op({ side: 'buy', occurredOn: '2026-01-01', cantidad: '50', precioOrigen: '10', importeEur: '500' }), symbolId: sid },
      { op: op({ side: 'sell', occurredOn: '2026-02-01', cantidad: '100', precioOrigen: '12', importeEur: '1200' }), symbolId: sid },
    ];
    const preview = await previsualizarImport(db, userA, resueltas);
    expect(preview.avisos.length).toBe(1);
    expect(preview.aCrear.map((c) => c.op.side)).toEqual(['buy']); // la venta imposible se excluye

    const r = await confirmarImport(db, userA, resueltas);
    expect(r.creadas).toBe(1); // solo la compra
    const rows = await txnsOf(userA);
    expect(rows.map((x) => x.type)).toEqual(['buy']);
  });
});

describe('CA-9: aislamiento por usuario (RN-01)', () => {
  it('el import escribe solo en la cartera del usuario que confirma', async () => {
    const sid = await symbolId('PHM', 'EUR');
    await confirmarImport(db, userA, [{ op: op({ cantidad: '10', precioOrigen: '5', importeEur: '50' }), symbolId: sid }]);
    expect(await txnsOf(userA)).toHaveLength(1);
    expect(await txnsOf(userB)).toHaveLength(0);
  });
});

describe('CA-10: pendientes no se escriben', () => {
  it('operaciones de valores sin resolver no se registran', async () => {
    const r = await confirmarImport(db, userA, [], [op({ nombreBroker: 'IRRESOLUBLE' }), op({ nombreBroker: 'OTRO' })]);
    expect(r.creadas).toBe(0);
    expect(r.pendientes).toBe(2);
    expect(await txnsOf(userA)).toHaveLength(0);
  });
});
