import { auth } from '@/lib/auth/config';
import { db } from '@/db/client';
import { listNotificationsForUser } from '@/lib/notifications/service';
import { AppNav } from '../app-nav';
import { markReadAction, markAllReadAction } from './actions';

// Bandeja de avisos (SPEC-007): historial in-app de los avisos del usuario (SPEC-006)
// con leído/no-leído. Complementa el email; solo presenta, no genera avisos.
const KIND: Record<string, string> = {
  entry: 'Entrada en zona',
  digest: 'Resumen de permanencia',
};

export default async function AvisosPage() {
  const session = await auth();
  const avisos = await listNotificationsForUser(db, session!.user.id);
  const unread = avisos.filter((n) => !n.isRead).length;
  const fecha = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <>
      <AppNav active="avisos" />
      <main className="page">
        <div className="toolbar">
          <div className="page-head">
            <span className="eyebrow">Avisos</span>
            <h1 className="headline">Tus avisos</h1>
            <p className="sub">
              {unread > 0 ? `${unread} sin leer` : 'Todo al día'} · también los recibes por email.
            </p>
          </div>
          {unread > 0 && (
            <form action={markAllReadAction}>
              <button className="btn-sm" type="submit">
                Marcar todos como leídos
              </button>
            </form>
          )}
        </div>

        {avisos.length === 0 ? (
          <div className="empty">
            <span className="empty-title">Aún no tienes avisos</span>
            <p>
              Cuando una acción vigilada entre en su zona de compra o venta, te avisaremos aquí y por
              email.
            </p>
          </div>
        ) : (
          <ul className="notif-list">
            {avisos.map((n) => (
              <li key={n.id} className={`notif-item ${n.isRead ? 'read' : 'unread'}`}>
                <span className="notif-dot" aria-hidden="true" />
                <div className="notif-body">
                  <span className="notif-kind">{KIND[n.kind] ?? n.kind}</span>
                  <p className="notif-text">{n.payload}</p>
                  <div className="notif-meta">
                    <span>a fecha {fecha(n.asOf)}</span>
                    {n.status === 'failed' && <span className="failed">envío por email falló</span>}
                    {!n.isRead && <span>no leído</span>}
                  </div>
                </div>
                <div className="notif-actions">
                  {!n.isRead && (
                    <form action={markReadAction}>
                      <input type="hidden" name="id" value={n.id} />
                      <button className="btn-sm" type="submit">
                        Marcar leído
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
