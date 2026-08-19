import Link from 'next/link';
import { auth } from '@/lib/auth/config';
import { db } from '@/db/client';
import { countUnread } from '@/lib/notifications/service';
import { canSee, isRole, DEFAULT_ROLE, type Section } from '@/lib/auth/sections';
import { logoutAction } from './(auth)/actions';

/**
 * Sección activa. Es un subconjunto del catálogo: aquí solo se pinta lo navegable.
 *
 * `'cuenta'` NO es una `Section` y por eso va fuera de la unión del catálogo
 * (SPEC-036): `/cuenta` no está sujeta al rol, se alcanza con los tres, y meterla en
 * `SECTIONS` la habría metido en la tabla de visibilidad de ADR-021 pto. 5 — que es
 * justo lo que la spec dice que no es.
 */
type Activa = Extract<Section, 'panel' | 'cartera' | 'vigiladas' | 'avisos'> | 'cuenta';

/**
 * Navegación compartida de la app (SPEC-007) — la primera del proyecto. Aloja el
 * acceso a las secciones y el contador de avisos NO leídos (CA-10), calculado por
 * usuario (RN-01). Se incluye al principio de cada página autenticada.
 *
 * SPEC-034 CA-5: qué enlaces se pintan lo decide el CATÁLOGO (`canSee`), no una
 * lista propia de este componente. Es lo que hace imposible que el menú ofrezca lo
 * que la ruta niega —o al revés— sin que un test lo cace: los dos preguntan a la
 * misma función. El rol viene de la sesión, que la frontera de Node acaba de
 * revalidar contra la base, así que un cambio de rol se ve en este mismo render
 * (ADR-021 pto. 4).
 *
 * Lo que esta spec NO pinta es el enlace a la pantalla de operación: esa ruta
 * todavía no existe (es SPEC-037) y un enlace roto es peor que ninguno. La sección
 * ya está en el catálogo; el enlace lo entrega su spec leyendo el mismo sitio.
 */
export async function AppNav({ active }: { active?: Activa }) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = isRole(session?.user?.role) ? session.user.role : DEFAULT_ROLE;
  const unread = userId ? await countUnread(db, userId) : 0;
  const cls = (k: Activa) => (active === k ? 'active' : undefined);

  return (
    <nav className="app-nav" aria-label="Principal">
      <Link href="/dashboard" className="brand">
        Stockeiro<span className="dot">.</span>
      </Link>
      <div className="app-nav-links">
        <Link href="/dashboard" className={cls('panel')}>
          Panel
        </Link>
        {canSee(role, 'cartera') && (
          <Link href="/cartera" className={cls('cartera')}>
            Cartera
          </Link>
        )}
        <Link href="/vigiladas" className={cls('vigiladas')}>
          Vigiladas
        </Link>
        <Link href="/avisos" className={cls('avisos')}>
          Avisos
          {unread > 0 && (
            <span className="nav-count" aria-label={`${unread} sin leer`}>
              {unread}
            </span>
          )}
        </Link>
      </div>
      {/*
        SPEC-036 CA-1 — el camino visible hasta `/cuenta`, sin teclear la URL. Va
        aquí y sin preguntar por el rol, y las dos cosas son deliberadas: no es una
        sección del catálogo (no está en `SECTIONS`), así que no pasa por `canSee`;
        y se pinta para los tres roles porque irse es un derecho, no un nivel.
      */}
      <div className="app-nav-user">
        <Link href="/cuenta" className={cls('cuenta')}>
          Cuenta
        </Link>
        <form action={logoutAction}>
          <button className="btn-sm" type="submit">
            Cerrar sesión
          </button>
        </form>
      </div>
    </nav>
  );
}
