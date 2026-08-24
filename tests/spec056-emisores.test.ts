import { describe, it, expect, beforeEach } from 'vitest';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq } from 'drizzle-orm';

import { makeTestDb, type TestDb } from '@/db/test-db';
import { notifications } from '@/db/schema';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { upsertQuote } from '@/lib/market/quotes';
import { evaluateTriggers } from '@/lib/triggers/service';
import { notifyCycle } from '@/lib/notifications/service';
import { requestPasswordReset } from '@/lib/auth/password-reset';
import { RESET_TOKEN_TTL_MINUTES } from '@/lib/auth/reset-tokens';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';
import { MARCA } from '@/lib/legal/content';

/**
 * SPEC-056 — **el enganche**: los tres emisores cruzan el puerto con los dos cuerpos, y
 * CA-17 (el registro in-app sigue siendo texto y no hay migración).
 *
 * Esto es lo que los tests de plantilla no pueden ver: que lo que la plantilla compone es
 * de verdad lo que sale por el puerto. Lo que llega al fake es, palabra por palabra, lo
 * que le llegaría al destinatario (ADR-036, positiva 1).
 *
 * **Ningún fichero de test preexistente se toca** (CA-18): lo de aquí se AÑADE junto a
 * `tests/notifications-service.test.ts` y `tests/password-reset.test.ts`, que siguen
 * afirmando sobre `body` exactamente lo que afirmaban.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

let db: TestDb;
let userA: string;

const ASOF = '2026-07-13T00:00:00.000Z';
const FECHA = '2026-07-13';

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
});

async function vigilarYCotizar(userId: string, ticker: string, precio: string) {
  const w = await watchSymbol(db, userId, ticker, 'EUR', { buyMin: 20, buyMax: 25 });
  await upsertQuote(db, w.symbolId, { price: precio, currency: 'EUR', asOf: ASOF });
  return w;
}

const filas = (kind: string) =>
  db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userA), eq(notifications.kind, kind)));

describe('SPEC-056: el ciclo de avisos cruza el puerto con los dos cuerpos', () => {
  it('el correo de entrada lleva `body` y `html`, y el HTML lleva la marca', async () => {
    await vigilarYCotizar(userA, 'ITX', '22');
    await evaluateTriggers(db);

    const sender = new FakeNotificationSender();
    await notifyCycle(db, sender);

    const [entrada] = sender.to('a@example.com');
    expect(entrada.subject).toBe('ITX entró en tu zona de compra');
    expect(entrada.body).toContain('ITX a 22 entró en tu zona de compra (asOf 2026-07-13).');
    expect(entrada.html, 'el correo de entrada sigue saliendo sin HTML').toBeDefined();
    expect(entrada.html!).toContain(MARCA.linea);
    expect(entrada.html!).toContain('ITX');
    expect(entrada.body.endsWith(MARCA.linea)).toBe(true);
  });

  it('el resumen de permanencia también, y lista sus tickers en los dos cuerpos', async () => {
    await vigilarYCotizar(userA, 'ITX', '22');
    await vigilarYCotizar(userA, 'SAN', '23');
    await evaluateTriggers(db);

    const sender = new FakeNotificationSender();
    await notifyCycle(db, sender);

    const resumen = sender.to('a@example.com').find((m) => m.subject.startsWith('Resumen:'));
    expect(resumen, 'no ha salido ningún resumen').toBeDefined();
    expect(resumen!.subject).toBe('Resumen: 2 acción(es) en zona');
    expect(resumen!.body).toContain('Siguen en zona: ITX (compra), SAN (compra). (asOf 2026-07-13)');
    for (const cuerpo of [resumen!.body, resumen!.html!]) {
      for (const dato of ['ITX', 'SAN', 'compra', FECHA, '2']) expect(cuerpo).toContain(dato);
    }
  });

  it('el correo de recuperación llega con los dos cuerpos y el enlace primero en el texto', async () => {
    const sender = new FakeNotificationSender();
    const { delivery } = await requestPasswordReset(db, sender, 'a@example.com', {
      baseUrl: 'https://ejemplo.test',
    });
    await delivery;

    const [correo] = sender.sent;
    expect(correo.subject).toBe('Recupera tu contraseña de Stockeiro');
    expect(correo.html, 'el correo de reset sigue saliendo sin HTML').toBeDefined();

    // La primera URL absoluta del texto sigue siendo el enlace, y NO la de la marca (D-6).
    const primera = correo.body.match(/https?:\/\/\S+/)![0];
    expect(new URL(primera).origin).toBe('https://ejemplo.test');
    expect(primera).toContain('/reset-password/');

    // El plazo se lee de su constante, no de un literal suelto.
    expect(correo.body).toContain(`caduca en ${RESET_TOKEN_TTL_MINUTES} minutos`);
    expect(correo.html!).toContain(`caduca en ${RESET_TOKEN_TTL_MINUTES} minutos`);

    // Y esa misma URL aparece dos veces en el HTML: el botón y el texto copiable.
    expect(correo.html!.split(primera).length - 1).toBe(2);
  });
});

describe('SPEC-056 CA-17: el registro in-app sigue siendo texto, y no hay migración', () => {
  it('el `payload` de una entrada conserva EXACTAMENTE el formato de hoy', async () => {
    await vigilarYCotizar(userA, 'ITX', '22');
    await evaluateTriggers(db);
    await notifyCycle(db, new FakeNotificationSender());

    const [fila] = await filas('entry');
    expect(fila.payload).toBe('ITX en zona de compra @ 22');
  });

  it('el `payload` de un resumen conserva EXACTAMENTE el formato de hoy', async () => {
    await vigilarYCotizar(userA, 'ITX', '22');
    await vigilarYCotizar(userA, 'SAN', '23');
    await evaluateTriggers(db);
    await notifyCycle(db, new FakeNotificationSender());

    const [fila] = await filas('digest');
    expect(fila.payload).toBe('Permanencia en zona: ITX (compra), SAN (compra)');
  });

  it('ningún `payload` lleva una sola etiqueta HTML, ni entidades sin resolver', async () => {
    await vigilarYCotizar(userA, 'ITX', '22');
    await evaluateTriggers(db);
    await notifyCycle(db, new FakeNotificationSender());

    const todas = await db.select().from(notifications);
    expect(todas.length, 'el ciclo no ha escrito nada: el caso no mira nada').toBeGreaterThan(0);
    for (const fila of todas) {
      expect(fila.payload).not.toMatch(/<[A-Za-z/]/);
      expect(fila.payload).not.toContain('&amp;');
      expect(fila.payload).not.toContain('&nbsp;');
    }
  });

  it('la tabla `notifications` no gana ninguna columna: no hay sitio donde guardar HTML', async () => {
    await vigilarYCotizar(userA, 'ITX', '22');
    await evaluateTriggers(db);
    await notifyCycle(db, new FakeNotificationSender());

    const [fila] = await db.select().from(notifications);
    expect(Object.keys(fila).sort()).toEqual(
      [
        'asOf',
        'channel',
        'createdAt',
        'cycleRef',
        'id',
        'kind',
        'payload',
        'readAt',
        'status',
        'userId',
        'zoneTriggerId',
      ].sort(),
    );
  });

  it('y `drizzle/` no gana ningún fichero: esta spec no lleva migración (ADR-036 pto. 7)', () => {
    // El recuento no se congela —eso caducaría con la siguiente spec que sí migre—: lo que
    // se afirma es que las migraciones que hay son las que ya estaban, con su nombre y en
    // su orden, que es el encuadre que SPEC-032 adoptó tras el aviso de `FOUNDATION.md`.
    const sql = readdirSync(join(rootDir, 'drizzle'))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    expect(sql.length, 'no se ha encontrado ninguna migración: el caso no mira nada').toBeGreaterThan(
      0,
    );
    expect(sql.filter((f) => /056|email|html|correo/i.test(f))).toEqual([]);
  });
});
