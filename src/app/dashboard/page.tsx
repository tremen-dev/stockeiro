import Link from 'next/link';
import { auth } from '@/lib/auth/config';
import { db } from '@/db/client';
import { countUnread } from '@/lib/notifications/service';
import { AppNav } from '../app-nav';

// Panel principal (ruta protegida por middleware, CA-5 SPEC-001). Reformado en
// SPEC-007 con navegación compartida y accesos a las secciones.
export default async function DashboardPage() {
  const session = await auth();
  const unread = session?.user?.id ? await countUnread(db, session.user.id) : 0;

  return (
    <>
      <AppNav active="panel" />
      <main className="page">
        <div className="page-head">
          <span className="eyebrow">Panel</span>
          <h1 className="headline">Tu vigilancia</h1>
          <p className="sub">
            Sesión iniciada como <strong>{session?.user?.email ?? 'usuario'}</strong>. Vigila tus
            zonas, revisa tu cartera y no pierdas una entrada.
          </p>
        </div>

        <div className="cards">
          <div className="card">
            <span className="num">01 / cartera</span>
            <h3>Cartera y P/L</h3>
            <p>Posiciones, precio medio y beneficio/pérdida actual y realizado.</p>
            <Link className="link" href="/cartera">
              Abrir cartera
            </Link>
          </div>
          <div className="card">
            <span className="num">02 / vigiladas</span>
            <h3>Acciones vigiladas</h3>
            <p>Tus zonas de compra y venta, y qué acciones están en zona ahora mismo.</p>
            <Link className="link" href="/vigiladas">
              Ver vigiladas
            </Link>
          </div>
          <div className="card">
            <span className="num">03 / avisos</span>
            <h3>Avisos {unread > 0 ? `(${unread} sin leer)` : ''}</h3>
            <p>Cuando una acción entra en zona te avisamos. Aquí revisas el historial.</p>
            <Link className="link" href="/avisos">
              Ver avisos
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
