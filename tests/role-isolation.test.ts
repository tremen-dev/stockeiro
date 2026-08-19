import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { users, notifications } from '@/db/schema';
import { registerUser } from '@/lib/auth/users';
import { recordBuy, portfolioSummary, listPositions } from '@/lib/portfolio/service';
import { watchSymbol, listWatched } from '@/lib/watchlist/service';
import { zoneStatusForUser } from '@/lib/watchlist/zone-status';
import { listNotificationsForUser, countUnread } from '@/lib/notifications/service';
import { canSee, visibleSections, type Role } from '@/lib/auth/sections';

/**
 * SPEC-034 CA-13 — el rol no relaja ni sustituye a RN-01, ni siquiera para `admin`
 * (ADR-021 pto. 9).
 *
 * La palabra "administrador" arrastra una expectativa —"puede verlo todo"— que aquí
 * es FALSA A PROPÓSITO. El rol responde a *¿qué secciones de LO TUYO se te enseñan?*,
 * nunca a *¿de quién son los datos que se te sirven?*. Esa segunda pregunta la
 * responde el aislamiento por usuario, que no depende del rol y no ha cambiado.
 *
 * Por eso el test recorre, para cada usuario, TODAS las secciones que su rol le abre
 * y comprueba las dos mitades: ve lo suyo entero y no ve ni una fila del otro. Es la
 * línea que más fácilmente se erosionará el día que alguien quiera depurar el
 * problema de un tester concreto, así que está escrita como test y no como intención.
 */

const PWD = 'clave-secreta-123';

interface Habitante {
  id: string;
  email: string;
  role: Role;
  ticker: string;
}

async function sembrarUsuario(
  db: TestDb,
  email: string,
  role: Role,
  ticker: string,
): Promise<Habitante> {
  const creado = await registerUser(db, email, PWD);
  await db.update(users).set({ role }).where(eq(users.id, creado.id));

  // Cartera: una compra propia.
  await recordBuy(db, creado.id, ticker, 'EUR', {
    quantity: new Decimal(10),
    price: new Decimal(100),
    gastos: null,
    occurredOn: '2026-01-02',
  });
  // Vigiladas: una acción con zonas propias.
  await watchSymbol(db, creado.id, ticker, 'EUR', {
    buyMin: new Decimal(90),
    buyMax: new Decimal(95),
  });
  // Avisos: uno propio, sin leer.
  await db.insert(notifications).values({
    userId: creado.id,
    kind: 'entry',
    payload: `secreto de ${email}`,
    channel: 'in_app',
    status: 'sent',
    asOf: new Date('2026-01-03T00:00:00.000Z'),
  });

  return { id: creado.id, email: creado.email, role, ticker };
}

describe('SPEC-034 CA-13: dos usuarios, uno admin, y ninguno ve nada del otro', () => {
  let db: TestDb;
  let admin: Habitante;
  let tester: Habitante;

  beforeEach(async () => {
    ({ db } = await makeTestDb());
    admin = await sembrarUsuario(db, 'operador@example.com', 'admin', 'ITX');
    tester = await sembrarUsuario(db, 'desconocido@example.com', 'tester', 'AAPL');
  });

  /** Todo lo que las secciones del rol le sirven a esta persona, en crudo. */
  async function loQueSeLeSirve(h: Habitante): Promise<string> {
    const piezas: unknown[] = [];
    // Panel y avisos los ve cualquier rol.
    piezas.push(await listNotificationsForUser(db, h.id), await countUnread(db, h.id));
    // Vigiladas, también.
    piezas.push(await listWatched(db, h.id), await zoneStatusForUser(db, h.id));
    // Cartera solo si su rol la abre; si no, ni se pide (la página no llega a ejecutarse).
    if (canSee(h.role, 'cartera')) {
      piezas.push(await listPositions(db, h.id), await portfolioSummary(db, h.id, {}));
    }
    return JSON.stringify(piezas);
  }

  it('el admin recorre TODAS sus secciones y no ve ni un dato del tester', async () => {
    // La premisa del test: el admin abre las seis secciones del catálogo.
    expect(visibleSections('admin')).toHaveLength(6);

    const servido = await loQueSeLeSirve(admin);
    expect(servido).not.toContain(tester.email);
    expect(servido).not.toContain(tester.ticker);
    expect(servido).not.toContain(`secreto de ${tester.email}`);
    expect(servido).not.toContain(tester.id);
  });

  it('y el tester tampoco ve nada del admin', async () => {
    const servido = await loQueSeLeSirve(tester);
    expect(servido).not.toContain(admin.email);
    expect(servido).not.toContain(admin.ticker);
    expect(servido).not.toContain(admin.id);
  });

  it('control positivo: cada uno SÍ ve lo suyo, entero', async () => {
    const delAdmin = await loQueSeLeSirve(admin);
    expect(delAdmin).toContain(admin.ticker);
    expect(delAdmin).toContain(`secreto de ${admin.email}`);

    const delTester = await loQueSeLeSirve(tester);
    expect(delTester).toContain(tester.ticker);
    expect(delTester).toContain(`secreto de ${tester.email}`);
  });

  it('la cartera del admin no crece por ser admin: sigue siendo la de una persona', async () => {
    const posiciones = await listPositions(db, admin.id);
    expect(posiciones).toHaveLength(1);
    expect(posiciones[0].ticker).toBe(admin.ticker);
  });

  it('ni las vigiladas ni los avisos del admin incluyen los ajenos', async () => {
    expect(await listWatched(db, admin.id)).toHaveLength(1);
    expect(await listNotificationsForUser(db, admin.id)).toHaveLength(1);
    expect(await countUnread(db, admin.id)).toBe(1);
    // Y en la base hay el doble de todo: el aislamiento es lo que filtra, no la escasez.
    expect(await db.select().from(notifications)).toHaveLength(2);
  });

  it('promover al tester a admin no le abre ni una fila del otro (el rol no es un permiso sobre datos)', async () => {
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, tester.id));
    const servido = await loQueSeLeSirve({ ...tester, role: 'admin' });
    expect(servido).not.toContain(admin.email);
    expect(servido).not.toContain(admin.ticker);
    expect(await listPositions(db, tester.id)).toHaveLength(1);
  });
});
