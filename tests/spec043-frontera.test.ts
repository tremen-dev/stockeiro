import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { notifications, quotes } from '@/db/schema';
import { runCronCycle } from '@/lib/triggers/cycle';
import { MarketstackProvider } from '@/lib/market/marketstack-provider';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';
import { symbolUniverse } from '@/lib/market/refresh';
import { upsertQuote } from '@/lib/market/quotes';
import { zoneStatusForUser } from '@/lib/watchlist/zone-status';

/**
 * SPEC-043 CA-14 — **la frontera que esta spec no cruza**.
 *
 * La pregunta obvia ante un ciclo que lleva tres días sin actualizar nada es *«¿por qué
 * no avisar al operador?»*, y tiene respuesta escrita: **ADR-023 pto. 15** deja la
 * alerta proactiva fuera **por decisión del humano** —*el ciclo se registra y se
 * muestra; nunca alerta*—. Que ahora sea fácil no la mete en alcance: `cron_runs` no es
 * la puerta de atrás por la que se cuela, y esta spec tampoco.
 *
 * El arreglo legítimo dentro de la constitución del proyecto es **decir la verdad en
 * las pantallas que el usuario ya abre**, que es además donde se produce el daño.
 */

const SECRET = 'test-cron-secret';
const CUERPO_429 = { error: { code: 'usage_limit_reached', message: 'Your monthly usage limit has been reached.' } };

let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
});

const fetch429 = (() => async () =>
  ({ ok: false, status: 429, json: async () => CUERPO_429 })) as unknown as () => typeof fetch;

describe('SPEC-043 CA-14: no se alerta a nadie (ADR-023 pto. 15)', () => {
  it('cuota agotada + cotización sin refrescar: ni un correo, ni una fila en `notifications`', async () => {
    // El escenario completo de esta spec, corriendo entero: una vigilada con precio
    // congelado del 18 de agosto y un ciclo que se estrella contra la cuota.
    //
    // La zona se pone FUERA del precio a propósito. Con el precio dentro, el motor de
    // disparo abriría su episodio y emitiría el aviso de entrada de **RN-13** — que es
    // comportamiento de SPEC-005/SPEC-006 y **no** algo que esta spec introduzca. Lo que
    // CA-14 afirma es que la cuota agotada y la cotización sin refrescar **no añaden
    // ningún aviso nuevo**; mezclarlo con RN-13 haría el test verde o rojo por motivos
    // ajenos. (Que RN-14 siga diciendo «sigue en zona» sobre un precio congelado está
    // levantado como **F-SPEC-043-1** y está **fuera de alcance** por escrito: tocar el
    // motor de disparo o el contenido de los avisos es cambiar el producto.)
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 10, buyMax: 20 }, { micCode: 'BMEX', exchange: 'BME' });
    const [u] = await symbolUniverse(db);
    await upsertQuote(db, u.symbolId, { price: '55', currency: 'EUR', asOf: '2026-08-18T23:43:00.000Z' });
    await db
      .update(quotes)
      .set({ updatedAt: new Date(Date.now() - 60 * 3_600_000) })
      .where(eq(quotes.symbolId, u.symbolId));

    const sender = new FakeNotificationSender();
    const outcome = await runCronCycle({
      authHeader: `Bearer ${SECRET}`,
      secret: SECRET,
      db,
      provider: new MarketstackProvider('key', fetch429()),
      sender,
    });

    expect(outcome.status).toBe(200);
    // La cotización sin refrescar es OBSERVABLE en pantalla…
    const [fila] = await zoneStatusForUser(db, userA);
    expect(fila.sinRefrescar).toBe(true);
    // …y no despierta a nadie. Ni correo…
    expect(sender.sent, 'esta spec no envía correo a nadie').toHaveLength(0);
    // …ni aviso in-app: `notifications` es el canal de RN-13/RN-14 y no se toca.
    expect(await db.select().from(notifications), 'esta spec no escribe en notifications').toHaveLength(0);
  });

  it('un ciclo que NO corrió tampoco despierta a nadie: no hay nada que lo dispare', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 10, buyMax: 20 }, { micCode: 'BMEX', exchange: 'BME' });
    const [u] = await symbolUniverse(db);
    await upsertQuote(db, u.symbolId, { price: '55', currency: 'EUR', asOf: '2026-08-18T23:43:00.000Z' });
    await db
      .update(quotes)
      .set({ updatedAt: new Date(Date.now() - 96 * 3_600_000) })
      .where(eq(quotes.symbolId, u.symbolId));

    // Nadie invoca el cron: el hueco de F-SPEC-037-4. La marca aparece SOLA al mirar.
    const [fila] = await zoneStatusForUser(db, userA);

    expect(fila.sinRefrescar).toBe(true);
    expect(fila.failReason).toBeNull(); // sin diagnóstico: no hay causa que contar (CA-10)
    expect(await db.select().from(notifications)).toHaveLength(0);
  });

  it('el código nuevo no conoce el canal de avisos: ni un import', () => {
    // Lo anterior comprueba que hoy no se envía nada. Esto comprueba que no se PUEDE:
    // los tres ficheros de esta spec no tienen forma de llegar al canal proactivo.
    const nuevos = [
      'src/lib/market/sin-refrescar.ts',
      'src/app/vigiladas/watched-table.tsx',
      'src/app/cartera/page.tsx',
    ];
    for (const ruta of nuevos) {
      const fuente = readFileSync(ruta, 'utf8');
      expect(fuente, `${ruta} alcanza el canal de avisos`).not.toMatch(/lib\/notifications/);
      expect(fuente, `${ruta} manda correo`).not.toMatch(/resend|sendMail|nodemailer/i);
    }
  });

  it('y no introduce ninguna tabla ni ninguna migración: el dato ya estaba en la fila', () => {
    // ADR-004: se conserva SOLO el último estado, como `quotes` y `quote_diagnostics`.
    // «Cotización sin refrescar» es una lectura de `quotes.updated_at`, no una entidad.
    const esquema = readFileSync('src/db/schema.ts', 'utf8');
    expect(esquema).not.toMatch(/stale|sin_refrescar|rancidez/i);
    expect(readFileSync('src/lib/market/sin-refrescar.ts', 'utf8')).not.toMatch(/pgTable|drizzle/);
  });
});
