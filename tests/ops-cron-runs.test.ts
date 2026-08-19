import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { cronRuns, notifications } from '@/db/schema';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { runCronCycle } from '@/lib/triggers/cycle';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';
import type { MarketDataProvider, QuoteRequest, QuotesResult } from '@/lib/market/provider';

/**
 * SPEC-037 CA-14 a CA-17, CA-19 y CA-20 — el ciclo diario deja constancia.
 *
 * Esta tabla existe porque **derivar** el estado del ciclo de `quotes.updated_at` y
 * `quote_diagnostics.attempted_at` —la propuesta que el humano rechazó el
 * 2026-08-19— deja sin responder las dos preguntas que más importan: un ciclo que
 * corre **sin cambiar nada** (CA-16) y uno que **revienta a mitad** (CA-15). Los dos
 * tienen su test aquí, y son la justificación entera de la tabla.
 *
 * Y con ellos va su frontera, escrita como CA NEGATIVO (CA-19): un ciclo que falla
 * **no avisa a nadie**. La alerta proactiva al operador está fuera del alcance de
 * EPIC-004 por decisión escrita; que ahora sea fácil no la mete dentro.
 */

const SECRET = 'test-cron-secret';
const PWD = 'clave-secreta-123';

let db: TestDb;

beforeEach(async () => {
  ({ db } = await makeTestDb());
});

const filas = () => db.select().from(cronRuns);

type Extras = { provider: MarketDataProvider; sender?: FakeNotificationSender };

const autorizado = (extra: Extras) => ({
  authHeader: `Bearer ${SECRET}`,
  secret: SECRET,
  db,
  ...extra,
});

/**
 * Un adaptador que hace REVENTAR LA INGESTA a mitad (CA-15).
 *
 * No basta con que `getQuotes` lance: `refreshQuotes` tiene una defensa en
 * profundidad (SPEC-020 CA-9) que degrada un adaptador roto a «el proveedor no
 * respondió», y con razón — sin refresco no hay disparos ni avisos para NADIE ese
 * día. Así que el fallo se provoca donde de verdad se provocaría en producción:
 * **persistiendo**. El adaptador devuelve una cotización sin precio y la escritura
 * revienta contra el `NOT NULL` de `quotes.price`, ya dentro de la ingesta y fuera
 * del alcance de aquella defensa.
 */
class IngestaQueRevienta implements MarketDataProvider {
  async getQuotes(reqs: QuoteRequest[]): Promise<QuotesResult> {
    return {
      quotes: reqs.map((r) => ({
        ticker: r.ticker,
        micCode: r.micCode,
        price: null as unknown as string, // NOT NULL: la escritura lanza
        currency: 'EUR',
        asOf: '2026-08-18T00:00:00.000Z',
      })),
      failures: [],
    };
  }
}

/**
 * Un proveedor que MIRA la tabla mientras el ciclo corre. Es la forma directa de
 * comprobar la propiedad de ADR-023 pto. 12 —`started_at` se escribe ANTES de
 * ingerir nada— sin depender de que dos relojes se distingan.
 */
class ProveedorFisgon implements MarketDataProvider {
  public visto: { total: number; abiertas: number } | null = null;
  constructor(private readonly interno: MarketDataProvider) {}
  async getQuotes(reqs: QuoteRequest[]): Promise<QuotesResult> {
    const todas = await db.select().from(cronRuns);
    this.visto = {
      total: todas.length,
      abiertas: todas.filter((f) => f.finishedAt === null).length,
    };
    return this.interno.getQuotes(reqs);
  }
}

describe('SPEC-037 CA-14: cada ejecución del ciclo deja UNA fila', () => {
  it('una fila con los contadores IGUALES a los del CycleResult devuelto', async () => {
    const usuario = (await registerUser(db, 'a@example.com', PWD)).id;
    await watchSymbol(db, usuario, 'ITX', 'EUR', { buyMin: '30', buyMax: '32' });
    const provider = new FakeMarketDataProvider({
      ITX: { price: '31', currency: 'EUR', asOf: '2026-08-18T00:00:00.000Z' },
    });
    const sender = new FakeNotificationSender();

    const outcome = await runCronCycle(autorizado({ provider, sender }));

    const todas = await filas();
    expect(todas).toHaveLength(1);
    const fila = todas[0];

    expect(outcome.status).toBe(200);
    const body = outcome.body as {
      refresh: { requested: string[]; updated: string[]; skipped: unknown[] };
      triggers: { opened: number; closed: number };
      notifications?: { entries: number; digests: number };
    };

    // «Lo que se registra es lo que el endpoint del cron ya devolvía»: una sola
    // definición de cada contador (ADR-023 pto. 13).
    expect(fila.requested).toBe(body.refresh.requested.length);
    expect(fila.updated).toBe(body.refresh.updated.length);
    expect(fila.skipped).toBe(body.refresh.skipped.length);
    expect(fila.triggersOpened).toBe(body.triggers.opened);
    expect(fila.triggersClosed).toBe(body.triggers.closed);
    expect(fila.notificationsEntries).toBe(body.notifications?.entries ?? 0);
    expect(fila.notificationsDigests).toBe(body.notifications?.digests ?? 0);

    expect(fila.outcome).toBe('success');
    expect(fila.error).toBeNull();
    expect(fila.finishedAt).not.toBeNull();
    expect(fila.startedAt.getTime()).toBeLessThan(fila.finishedAt!.getTime());
  });

  it('la fila se ABRE antes de ingerir nada: durante el ciclo ya existe, y sin cerrar', async () => {
    const usuario = (await registerUser(db, 'b@example.com', PWD)).id;
    await watchSymbol(db, usuario, 'ITX', 'EUR');
    const fisgon = new ProveedorFisgon(
      new FakeMarketDataProvider({
        ITX: { price: '31', currency: 'EUR', asOf: '2026-08-18T00:00:00.000Z' },
      }),
    );

    await runCronCycle(autorizado({ provider: fisgon }));

    expect(fisgon.visto).toEqual({ total: 1, abiertas: 1 });
  });

  it('dos ejecuciones dejan dos filas: una por ejecución, no una por día', async () => {
    const provider = new FakeMarketDataProvider({});
    await runCronCycle(autorizado({ provider }));
    await runCronCycle(autorizado({ provider }));
    expect(await filas()).toHaveLength(2);
  });
});

describe('SPEC-037 CA-15: un ciclo que revienta a mitad se NOTA', () => {
  it('deja su fila con el desenlace de fallo y el error, y VUELVE A LANZAR', async () => {
    const usuario = (await registerUser(db, 'c@example.com', PWD)).id;
    await watchSymbol(db, usuario, 'ITX', 'EUR');

    await expect(
      runCronCycle(autorizado({ provider: new IngestaQueRevienta() })),
    ).rejects.toThrow();

    const [fila] = await filas();
    expect(fila).toBeDefined();
    expect(fila.startedAt).toBeInstanceOf(Date);
    expect(fila.outcome).toBe('failure');
    // El error queda REGISTRADO, no perdido en los logs de Vercel.
    expect(fila.error).toBeTruthy();
    expect(fila.error!.length).toBeGreaterThan(0);
    // Y los contadores se quedan sin escribir: no hubo ciclo que contar.
    expect(fila.updated).toBeNull();
  });

  it('registrar NO se traga el fallo: el endpoint sigue comportándose como hoy', async () => {
    // Si la excepción se tragara, el cron respondería 200 y nadie se enteraría de
    // nada — que es peor que no tener la tabla.
    const usuario = (await registerUser(db, 'c2@example.com', PWD)).id;
    await watchSymbol(db, usuario, 'ITX', 'EUR');
    const promesa = runCronCycle(autorizado({ provider: new IngestaQueRevienta() }));
    await expect(promesa).rejects.toBeInstanceOf(Error);
  });
});

describe('SPEC-037 CA-16: un ciclo que no cambia nada TAMBIÉN deja constancia', () => {
  it('universo vacío: fila escrita, éxito, y cero actualizaciones', async () => {
    // Ni una vigilada ni una transacción: el ciclo no tiene nada que pedir.
    const outcome = await runCronCycle(autorizado({ provider: new FakeMarketDataProvider({}) }));

    expect(outcome.status).toBe(200);
    const [fila] = await filas();
    expect(fila.outcome).toBe('success');
    expect(fila.finishedAt).not.toBeNull();
    expect(fila).toMatchObject({ requested: 0, updated: 0, skipped: 0 });
    // ESTE es el caso que la derivación rechazada no podía ver: sin esta fila,
    // «corrió y no cambió nada» sería indistinguible de «no corrió».
  });

  it('mismos precios que ayer: también deja fila, y dice que corrió', async () => {
    const usuario = (await registerUser(db, 'd@example.com', PWD)).id;
    await watchSymbol(db, usuario, 'ITX', 'EUR');
    const provider = new FakeMarketDataProvider({
      ITX: { price: '31', currency: 'EUR', asOf: '2026-08-18T00:00:00.000Z' },
    });

    await runCronCycle(autorizado({ provider }));
    await runCronCycle(autorizado({ provider })); // idéntico: nada cambia en `quotes`

    const todas = await filas();
    expect(todas).toHaveLength(2);
    expect(todas.every((f) => f.outcome === 'success')).toBe(true);
  });
});

describe('SPEC-037 CA-17: una petición NO autorizada no escribe fila', () => {
  it('401 como hoy (SPEC-004 CA-7) y `cron_runs` sigue vacía', async () => {
    const provider = new FakeMarketDataProvider({});

    const outcome = await runCronCycle({
      authHeader: 'Bearer nope',
      secret: SECRET,
      db,
      provider,
    });

    expect(outcome.status).toBe(401);
    expect(outcome.body).toEqual({ error: 'unauthorized' });
    expect(await filas()).toHaveLength(0);
    expect(provider.calls).toHaveLength(0);
  });

  it('quien sondee el endpoint cien veces no llena la tabla', async () => {
    for (let i = 0; i < 25; i++) {
      await runCronCycle({
        authHeader: `Bearer intento-${i}`,
        secret: SECRET,
        db,
        provider: new FakeMarketDataProvider({}),
      });
    }
    expect(await filas()).toHaveLength(0);
  });
});

describe('SPEC-037 CA-19: registrar NO es alertar, y se prueba', () => {
  it('un ciclo que falla no manda NADA a nadie ni escribe en `notifications`', async () => {
    const usuario = (await registerUser(db, 'e@example.com', PWD)).id;
    await watchSymbol(db, usuario, 'ITX', 'EUR');
    const sender = new FakeNotificationSender();

    await expect(
      runCronCycle(autorizado({ provider: new IngestaQueRevienta(), sender })),
    ).rejects.toThrow();

    expect(sender.sent).toEqual([]);
    expect(await db.select().from(notifications)).toEqual([]);
  });

  it('un ciclo que SÍ avisa solo avisa de zonas, y a su dueño', async () => {
    const usuario = await registerUser(db, 'f@example.com', PWD);
    await watchSymbol(db, usuario.id, 'ITX', 'EUR', { buyMin: '30', buyMax: '32' });
    const sender = new FakeNotificationSender();

    await runCronCycle(
      autorizado({
        provider: new FakeMarketDataProvider({
          ITX: { price: '31', currency: 'EUR', asOf: '2026-08-18T00:00:00.000Z' },
        }),
        sender,
      }),
    );

    // Todo lo enviado va a un USUARIO por una zona suya. Ni un mensaje de operación.
    expect(sender.sent.length).toBeGreaterThan(0);
    for (const mensaje of sender.sent) {
      expect(mensaje.to).toBe(usuario.email);
    }
    const avisos = await db.select().from(notifications);
    expect(avisos.length).toBeGreaterThan(0);
    for (const aviso of avisos) {
      expect(aviso.userId).toBe(usuario.id);
      expect(['entry', 'digest']).toContain(aviso.kind);
    }
  });

  it('el módulo del registro no conoce ningún canal de aviso', async () => {
    // La frontera dicha en el grafo de importaciones, no solo en el comportamiento:
    // si mañana alguien mete un sender aquí, esto se pone rojo antes que nada.
    const { readFileSync } = await import('node:fs');
    const { dirname, resolve } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const fuente = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'ops', 'cron-runs.ts'),
      'utf8',
    );
    const imports = fuente
      .split(String.fromCharCode(10))
      .map((l) => l.trim())
      .filter((l) => l.startsWith('import '));
    expect(imports.length).toBeGreaterThan(0);
    for (const linea of imports) {
      for (const prohibido of ['notifications', 'sender', 'resend', 'mail']) {
        expect(linea.toLowerCase(), `cron-runs.ts importa "${prohibido}"`).not.toContain(prohibido);
      }
    }
    // Y no habla con el mundo exterior por su cuenta: ni HTTP ni webhooks.
    expect(fuente).not.toContain('fetch(');
  });
});

describe('SPEC-037 CA-20: la respuesta del cron NO cambia', () => {
  it('mismo cuerpo y mismo código que antes de existir la tabla', async () => {
    const usuario = (await registerUser(db, 'g@example.com', PWD)).id;
    await watchSymbol(db, usuario, 'ITX', 'EUR');
    const provider = new FakeMarketDataProvider({
      ITX: { price: '31', currency: 'EUR', asOf: '2026-08-18T00:00:00.000Z' },
    });

    const outcome = await runCronCycle(autorizado({ provider }));

    expect(outcome.status).toBe(200);
    // Las claves del cuerpo son exactamente las de `CycleResult`: la tabla es un
    // registro ADICIONAL, no un sustituto, y ningún consumidor se entera.
    expect(Object.keys(outcome.body as object).sort()).toEqual(['refresh', 'triggers']);
    expect(outcome.body).toEqual({
      refresh: {
        requested: ['ITX'],
        updated: ['ITX'],
        skipped: [],
        mismatched: [],
      },
      triggers: { opened: 0, closed: 0 },
    });
    // Y ni rastro del id de la fila ni de nada de `cron_runs` en la respuesta.
    expect(JSON.stringify(outcome.body)).not.toContain('cron');
  });
});
