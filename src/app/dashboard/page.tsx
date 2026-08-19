import Link from 'next/link';
import { requireUser, BOUNCE_PARAM } from '@/lib/auth/session';
import { db } from '@/db/client';
import { countUnread } from '@/lib/notifications/service';
import { canSee, SECTIONS, type Section } from '@/lib/auth/sections';
import { notaDeRebote } from '@/lib/auth/section-messages';
import { AppNav } from '../app-nav';

// Panel principal (ruta protegida por middleware, CA-5 SPEC-001). Reformado en
// SPEC-007 con navegación compartida y accesos a las secciones.
//
// SPEC-034 CA-9: el panel de un tester NO ofrece lo que no puede abrir. Un panel que
// enlaza a una puerta cerrada es peor que no tener panel — así que la tarjeta de
// Cartera no se pinta "deshabilitada", simplemente no está, y la rejilla se cierra
// sobre las que quedan. Llenar ese hueco con algo que enseñe es trabajo de SPEC-039.
//
// SPEC-034 CA-8: si se llega aquí REBOTADO desde una sección cerrada, se explica en
// una línea. La nota viene en la URL, así que aparece solo tras el rebote y no en
// cada visita al panel.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser(); // SPEC-023 CA-13: sesión revocada -> login
  const unread = await countUnread(db, user.id);

  const params = await searchParams;
  const rebotadoDe = leerRebote(params[BOUNCE_PARAM]);

  return (
    <>
      <AppNav active="panel" />
      <main className="page">
        <div className="page-head">
          <span className="eyebrow">Panel</span>
          <h1 className="headline">Tu vigilancia</h1>
          <p className="sub">
            Sesión iniciada como <strong>{user.email ?? 'usuario'}</strong>.{' '}
            {canSee(user.role, 'cartera')
              ? 'Vigila tus zonas, revisa tu cartera y no pierdas una entrada.'
              : 'Vigila tus zonas y no pierdas una entrada.'}
          </p>
        </div>

        {rebotadoDe ? (
          <p className="auth-note" role="status" data-testid="nota-sin-acceso">
            {notaDeRebote(rebotadoDe)}
          </p>
        ) : null}

        <div className="cards">
          {canSee(user.role, 'cartera') && (
            <div className="card">
              <span className="num">01 / cartera</span>
              <h3>Cartera y P/L</h3>
              <p>Posiciones, precio medio y beneficio/pérdida actual y realizado.</p>
              <Link className="link" href="/cartera">
                Abrir cartera
              </Link>
            </div>
          )}
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

/**
 * De qué sección viene el rebote. Se valida contra el catálogo a propósito: lo que
 * llega por la URL lo escribe cualquiera, y sin esto `/dashboard?sin-acceso=<texto>`
 * sería un hueco para pintar la frase que a uno le apetezca dentro de la app.
 */
function leerRebote(valor: string | string[] | undefined): Section | null {
  const crudo = Array.isArray(valor) ? valor[0] : valor;
  return SECTIONS.find((s) => s === crudo) ?? null;
}
