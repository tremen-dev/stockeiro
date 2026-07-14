import Link from 'next/link';
import { auth } from '@/lib/auth/config';
import { db } from '@/db/client';
import { countUnread } from '@/lib/notifications/service';
import { logoutAction } from './(auth)/actions';

type Section = 'panel' | 'cartera' | 'vigiladas' | 'avisos';

/**
 * Navegación compartida de la app (SPEC-007) — la primera del proyecto. Aloja el
 * acceso a las secciones y el contador de avisos NO leídos (CA-10), calculado por
 * usuario (RN-01). Se incluye al principio de cada página autenticada.
 */
export async function AppNav({ active }: { active?: Section }) {
  const session = await auth();
  const userId = session?.user?.id;
  const unread = userId ? await countUnread(db, userId) : 0;
  const cls = (k: Section) => (active === k ? 'active' : undefined);

  return (
    <nav className="app-nav" aria-label="Principal">
      <Link href="/dashboard" className="brand">
        Stockeiro<span className="dot">.</span>
      </Link>
      <div className="app-nav-links">
        <Link href="/dashboard" className={cls('panel')}>
          Panel
        </Link>
        <Link href="/cartera" className={cls('cartera')}>
          Cartera
        </Link>
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
      <form action={logoutAction}>
        <button className="btn-sm" type="submit">
          Cerrar sesión
        </button>
      </form>
    </nav>
  );
}
