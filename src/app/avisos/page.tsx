import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/db/client';
import { listNotificationsForUser } from '@/lib/notifications/service';
import { listWatched } from '@/lib/watchlist/service';
import { RUTA_AYUDA, VACIO_AVISOS, VACIO_AVISOS_SIN_VIGILADAS } from '@/lib/help/content';
import { AppNav } from '../app-nav';
import { markReadAction, markAllReadAction } from './actions';

// Bandeja de avisos (SPEC-007): historial in-app de los avisos del usuario (SPEC-006)
// con leído/no-leído. Complementa el email; solo presenta, no genera avisos.
const KIND: Record<string, string> = {
  entry: 'Entrada en zona',
  digest: 'Resumen de permanencia',
};

export default async function AvisosPage() {
  const user = await requireUser(); // SPEC-023 CA-13: sesión revocada -> login
  const avisos = await listNotificationsForUser(db, user.id);
  const unread = avisos.filter((n) => !n.isRead).length;
  /*
    SPEC-039 CA-10 — cuántas acciones vigila, y SOLO para redactar el estado vacío.
    Se consulta únicamente cuando no hay ni un aviso: quien ya tiene bandeja no paga
    esta lectura, y la bandeja llena sigue siendo exactamente la de SPEC-007.

    La distinción importa porque las dos situaciones se parecen en pantalla y no se
    parecen en nada: sin vigiladas no hay nada de lo que avisar y el primer paso está
    en otra pantalla; con vigiladas, lo que toca es esperar al ciclo. Decirle «espera»
    a quien no ha empezado sería dejarle esperando para siempre.
  */
  const vigiladas = avisos.length === 0 ? (await listWatched(db, user.id)).length : -1;
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
          <div className="empty" data-testid="avisos-vacio">
            <span className="empty-title">{VACIO_AVISOS.titulo}</span>
            <p>{VACIO_AVISOS.primerPaso}</p>
            <div className="empty-guia">
              <p data-testid="avisos-vacio-cadencia">{VACIO_AVISOS.nota}</p>
              {vigiladas === 0 ? (
                <p data-testid="avisos-vacio-sin-vigiladas">
                  {VACIO_AVISOS_SIN_VIGILADAS}{' '}
                  <Link href="/vigiladas">Vigilar tu primera acción</Link>.
                </p>
              ) : (
                <p data-testid="avisos-vacio-con-vigiladas">
                  Puedes revisar o ajustar tus rangos en{' '}
                  <Link href="/vigiladas">Vigiladas</Link>.
                </p>
              )}
              <p>
                <Link href={RUTA_AYUDA}>Cómo funciona Stockeiro</Link> — cuándo se emite cada
                tipo de aviso y por qué no se repite.
              </p>
            </div>
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
