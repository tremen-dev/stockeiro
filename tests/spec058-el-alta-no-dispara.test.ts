import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { notifications, zoneTriggers } from '@/db/schema';
import { zoneStatusForUser } from '@/lib/watchlist/zone-status';
import { runRefreshCycle } from '@/lib/triggers/cycle';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';

/**
 * SPEC-058 **CA-10** — *un alta no dispara y no avisa, ni cuando el precio cae dentro de
 * la zona*.
 *
 * Es el límite que la spec no cruza, y el que **ADR-038 pto. 3** fija como gemelo exacto
 * de **ADR-028 pto. 3**: el refresco bajo demanda ingiere y punto. La evaluación de la
 * entrada (RN-11 → RN-13, ADR-005) y la emisión del aviso (RN-14, ADR-006) **siguen
 * siendo del ciclo**, que es la lectura de **D-2** que ADR-038 pto. 1 escribió.
 *
 * ## Por qué el control positivo es obligatorio y va en el mismo test
 *
 * «No hay episodios y no hay avisos» es una afirmación que **el motor roto también
 * cumple**. Sin el control positivo, este CA seguiría verde el día que alguien rompiera
 * `evaluateTriggers` o `notifyCycle`, y estaría certificando lo contrario de lo que la
 * spec quiere: que el aviso **llega**, solo que en el ciclo. Por eso el mismo test, sobre
 * el mismo estado, ejecuta el ciclo a continuación y exige **exactamente un** episodio y
 * **exactamente un** aviso.
 *
 * La consecuencia que el usuario ve —la pantalla dice «En compra» y el correo llega esta
 * noche— es el desacompasamiento de R-3 de la épica, y **CA-11** existe para que se lea
 * en la pantalla en vez de descubrirse.
 */

const contexto: {
  db: unknown;
  sesion: { user?: { id: string; email: string } } | null;
  provider: FakeMarketDataProvider;
} = { db: null, sesion: null, provider: new FakeMarketDataProvider({}) };

vi.mock('@/db/client', () => ({
  get db() {
    return contexto.db;
  },
}));

vi.mock('@/lib/auth/config', () => ({
  auth: async () => contexto.sesion,
  signIn: async () => undefined,
  signOut: async () => undefined,
  handlers: {},
}));

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

vi.mock('@/lib/market/quote-provider-factory', () => ({
  quoteProvider: () => contexto.provider,
}));

const { watchAction } = await import('@/app/vigiladas/actions');

const ASOF = '2026-08-24T00:00:00.000Z';
const EMAIL = 'a@example.com';

let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  contexto.db = db;
  const u = await registerUser(db, EMAIL, 'clave');
  userA = u.id;
  contexto.sesion = { user: { id: u.id, email: EMAIL } };
  // El precio CAE DENTRO de la zona de compra que se va a escribir: el escenario en el
  // que la tentación de avisar al momento es máxima.
  contexto.provider = new FakeMarketDataProvider({
    'ITX:BMEX': { price: '53.72', currency: 'EUR', asOf: ASOF },
  });
});

/** El código sin su prosa: fuera los bloques de comentario y las líneas de doble barra. */
const sinComentarios = (fuente: string) =>
  fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function altaEnZona(): FormData {
  const fd = new FormData();
  fd.set('ticker', 'ITX');
  fd.set('micCode', 'BMEX');
  fd.set('currency', 'EUR');
  fd.set('exchange', 'BME');
  fd.set('name', 'Inditex');
  fd.set('instrumentType', 'stock');
  fd.set('buyMin', '50');
  fd.set('buyMax', '60');
  return fd;
}

describe('SPEC-058 CA-10: el alta pinta la zona, y no dispara ni avisa', () => {
  it('cero episodios, cero avisos y cero envíos — y el ciclo siguiente SÍ abre uno y SÍ emite uno', async () => {
    const sender = new FakeNotificationSender();

    await watchAction(undefined, altaEnZona());

    // La pantalla la pinta EN ZONA DE COMPRA: el estado se computa en render sobre la
    // cotización que el alta acaba de persistir (RN-11, SPEC-007).
    const [fila] = await zoneStatusForUser(db, userA);
    expect(fila.state).toBe('buy');
    expect(fila.inBuy).toBe(true);

    // Y a la vez, nada del motor se ha movido (ADR-038 pto. 3).
    expect(await db.select().from(zoneTriggers), 'el alta abrió un episodio').toHaveLength(0);
    expect(await db.select().from(notifications), 'el alta registró un aviso').toHaveLength(0);
    expect(sender.sent, 'el alta mandó algo por el canal').toHaveLength(0);

    // ── Control positivo, sobre ESE MISMO estado ────────────────────────────────────
    // Sin esto, lo de arriba pasaría igual con el motor roto.
    const ciclo = await runRefreshCycle(db, contexto.provider, sender);

    expect(ciclo.triggers.opened, 'el ciclo tenía que ver la entrada').toHaveLength(1);
    expect(await db.select().from(zoneTriggers), 'exactamente un episodio').toHaveLength(1);

    // Exactamente **un aviso de entrada** (RN-13). El ciclo emite además el agregado de
    // permanencia del día (RN-14), que es comportamiento de SPEC-006 y no algo que esta
    // spec introduzca: se cuenta aparte para no confundir «el ciclo avisa» con «el ciclo
    // avisa una sola vez de todo».
    const avisos = await db.select().from(notifications);
    expect(avisos.filter((a) => a.kind === 'entry')).toHaveLength(1);
    expect(sender.to(EMAIL).length, 'y el correo sale, que es lo que el alta no hace')
      .toBeGreaterThanOrEqual(1);
    expect(sender.sent).toHaveLength(avisos.length); // todo lo registrado se intentó enviar
  });

  it('la action del alta no conoce el motor ni el canal de avisos: ni un import', () => {
    // Lo de arriba mide que hoy no dispara. Esto mide que **no puede** empezar a hacerlo
    // por descuido: el camino del alta no tiene forma de llegar al motor ni al canal.
    //
    // Se mira el CÓDIGO y no el fichero entero: los dos módulos explican en prosa por qué
    // NO llaman a `evaluateTriggers()`, y una guardia que confundiera la explicación con
    // la infracción obligaría a borrar justo el comentario que impide la recaída.
    for (const ruta of ['src/app/vigiladas/actions.ts', 'src/lib/market/refresh.ts']) {
      const codigo = sinComentarios(readFileSync(ruta, 'utf8'));
      expect(codigo, `${ruta} alcanza el motor de disparo`).not.toMatch(
        /from '@\/lib\/triggers|evaluateTriggers/,
      );
      expect(codigo, `${ruta} alcanza el canal de avisos`).not.toMatch(
        /from '@\/lib\/notifications|notifyCycle/,
      );
    }
  });
});
