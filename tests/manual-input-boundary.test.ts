import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol, listWatched, InvalidZoneError } from '@/lib/watchlist/service';
import { recordBuy, listPositions } from '@/lib/portfolio/service';
import {
  readDecimalField,
  normalizeDecimalInput,
  InvalidNumberError,
  NUMERIC_FIELD_LABELS,
  type NumericField,
} from '@/lib/format/decimal-input';

// SPEC-030 — CA-13 (una sola puerta, sin puerta trasera), CA-14 (min > max sobre valores
// ya normalizados) y CA-15 (el parser del import no se toca y el normalizador no se cuela
// donde no le toca).

const VIGILADAS = 'src/app/vigiladas/actions.ts';
const CARTERA = 'src/app/cartera/actions.ts';
const fuente = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

const ZONE_FIELDS: NumericField[] = ['buyMin', 'buyMax', 'sellMin', 'sellMax'];
const TRADE_FIELDS: NumericField[] = ['quantity', 'price', 'gastos'];
const ALL_FIELDS: NumericField[] = [...ZONE_FIELDS, ...TRADE_FIELDS];

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

describe('CA-13: los tres puntos de entrada manual, por una sola puerta', () => {
  it.each(ALL_FIELDS)('el campo "%s" acepta la coma decimal', (name) => {
    const valor = readDecimalField(form({ [name]: '12,5' }), name);
    expect(valor?.toString()).toBe('12.5');
  });

  it('todos los campos numéricos del alta manual tienen etiqueta en español', () => {
    for (const name of ALL_FIELDS) {
      expect(NUMERIC_FIELD_LABELS[name]).toBeTruthy();
      expect(NUMERIC_FIELD_LABELS[name]).not.toBe(name);
    }
  });

  it('cada campo numérico se lee SOLO por readDecimalField, sin puerta trasera', () => {
    const src = `${fuente(VIGILADAS)}\n${fuente(CARTERA)}`;
    for (const name of ALL_FIELDS) {
      expect(src).toContain(`readDecimalField(formData, '${name}')`);
      // La puerta trasera: leer el campo crudo del FormData saltándose la normalización.
      expect(src).not.toContain(`formData.get('${name}')`);
    }
  });

  it('las server actions no construyen Decimal a mano ni dicen «Datos inválidos.»', () => {
    for (const rel of [VIGILADAS, CARTERA]) {
      const src = fuente(rel);
      expect(src).not.toContain('new Decimal(');
      expect(src).not.toContain('Datos inválidos');
    }
  });
});

describe('CA-14: min > max se compara sobre los valores YA normalizados', () => {
  let db: TestDb;
  let userA: string;

  beforeEach(async () => {
    ({ db } = await makeTestDb());
    userA = (await registerUser(db, 'a@example.com', 'clave')).id;
  });

  const zonas = (fd: FormData) => ({
    buyMin: readDecimalField(fd, 'buyMin'),
    buyMax: readDecimalField(fd, 'buyMax'),
  });

  it('"12,5" / "13" es una zona VÁLIDA y se guarda como 12.5 – 13', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', zonas(form({ buyMin: '12,5', buyMax: '13' })));
    const [fila] = await listWatched(db, userA);
    expect(fila.buyMin).toBe('12.5');
    expect(fila.buyMax).toBe('13');
  });

  it('"13" / "12,5" es INVÁLIDA: sale InvalidZoneError, no el mensaje genérico', async () => {
    const fd = form({ buyMin: '13', buyMax: '12,5' });
    await expect(watchSymbol(db, userA, 'ITX', 'EUR', zonas(fd))).rejects.toThrow(
      InvalidZoneError,
    );
  });

  it('par incompleto con coma sigue siendo InvalidZoneError (RN-10)', async () => {
    const fd = form({ buyMin: '12,5', buyMax: '' });
    await expect(watchSymbol(db, userA, 'ITX', 'EUR', zonas(fd))).rejects.toThrow(
      InvalidZoneError,
    );
  });

  it('la compra con coma llega al ledger con el valor normalizado (RN-04)', async () => {
    const fd = form({ quantity: '1,5', price: '12,5', gastos: '0,95' });
    await recordBuy(db, userA, 'ITX', 'EUR', {
      quantity: readDecimalField(fd, 'quantity')!,
      price: readDecimalField(fd, 'price')!,
      gastos: readDecimalField(fd, 'gastos'),
      occurredOn: '2026-01-02',
    });
    const [pos] = await listPositions(db, userA);
    // 1,5 × 12,5 + 0,95 = 19,70 de coste base → coste medio 19,70 / 1,5 = 13,13 (RN-04).
    expect(pos.cantidadViva).toBe('1.5');
    expect(pos.costeMedio).toBe('13.13');
  });
});

describe('CA-15: el parser del import no se toca y el normalizador no se cuela', () => {
  it('ing-xls-reader sigue tratando la coma como separador de MILES (en-US)', () => {
    const src = fuente('src/lib/import/ing-xls-reader.ts');
    expect(src).toContain(".replace(/,/g, '')");
    expect(src).not.toContain('decimal-input');
  });

  it('ni src/lib/import ni src/lib/market importan el normalizador del alta manual', () => {
    const ficheros = [
      ...tsFilesIn('src/lib/import'),
      ...tsFilesIn('src/lib/market'),
      ...tsFilesIn('src/lib/portfolio'),
      ...tsFilesIn('src/lib/watchlist'),
    ];
    expect(ficheros.length).toBeGreaterThan(0);
    for (const f of ficheros) {
      expect(readFileSync(f, 'utf8'), f).not.toContain('format/decimal-input');
    }
  });

  it('los literales en-US vivos seguirían rechazados por CA-6: no cruzan el normalizador', () => {
    // '11.984' y '3.615' (quote-provider-factory), '12.852', '280.093'… son datos de
    // MÁQUINA en formato en-US, no texto de una persona. Si alguien colase el normalizador
    // ahí, CA-6 los rechazaría y su suite se pondría roja. Este test fija el porqué.
    for (const literal of ['11.984', '3.615', '12.852', '280.093']) {
      expect(() => normalizeDecimalInput(literal, 'Precio')).toThrow(InvalidNumberError);
    }
  });
});

/** Todos los `.ts`/`.tsx` bajo `rel`, recursivo. */
function tsFilesIn(rel: string): string[] {
  const base = join(process.cwd(), rel);
  const out: string[] = [];
  for (const entry of readdirSync(base)) {
    const full = join(base, entry);
    if (statSync(full).isDirectory()) out.push(...tsFilesIn(join(rel, entry)));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}
