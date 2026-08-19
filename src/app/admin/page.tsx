import type { Metadata } from 'next';
import { db } from '@/db/client';
import { requireSectionUser } from '@/lib/auth/session';
import { readOperationSnapshot } from '@/lib/ops/snapshot';
import { readRegistrationAudit } from '@/lib/registration/service';
import { REGISTRO_CERRADO_MOTIVO } from '@/lib/registration/messages';
import { AppNav } from '../app-nav';
import { GateForm } from './gate-form';

export const metadata: Metadata = {
  title: 'Operación · Stockeiro',
  description: 'El estado del registro y del ciclo diario.',
};

/**
 * `/admin` — la pantalla de operación (SPEC-037, CE-7).
 *
 * **No es un mecanismo de acceso nuevo**: es la sección `operacion` del catálogo de
 * SPEC-034 (ADR-021 pto. 5, ADR-023 pto. 9), protegida por la misma `requireSectionUser`
 * que Cartera e Importar. Ni lista de emails, ni variable de entorno, ni segunda
 * condición: en toda la app hay UN solo sitio donde se decide quién entra a dónde.
 * Como el rol se relee en cada petición (ADR-021 pto. 4), degradar al operador le
 * cierra esta pantalla en su siguiente clic, con la misma cookie (CA-12).
 *
 * **Cuenta filas, no lista personas** (RN-01, CA-22). Todo lo que se pinta sale de
 * `readOperationSnapshot`, que no sabe traer un email ni un ticker de nadie. La
 * omisión no depende de que quien escriba esta página se acuerde: el dato no llega.
 *
 * **Registra y muestra, nunca alerta** (ADR-023 pto. 15, CA-19). Aquí se ve el
 * resultado del último ciclo y se acaba la historia: no hay correo, no hay aviso y no
 * hay a quién despertar. Y hay un residual asumido que esta pantalla dice en voz alta
 * en vez de disimular (F-SPEC-037-4): el ciclo que Vercel nunca llegó a invocar **no
 * deja fila**, igual que si el despliegue estuviera caído. Por eso se rotula como lo
 * que es —«última ejecución registrada»— y es el operador quien juzga si esa fecha es
 * vieja. Cerrarlo del todo exigiría una alerta, que está fuera de alcance.
 *
 * `force-dynamic` por lo mismo que `/register`: sin él, los números y el estado del
 * grifo quedarían congelados en el build (CA-7).
 */
export const dynamic = 'force-dynamic';

const fecha = (d: Date) =>
  new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(d);

export default async function AdminPage() {
  await requireSectionUser('operacion');
  const s = await readOperationSnapshot(db);
  const audit = await readRegistrationAudit(db);
  const { settings, state } = s.registration;

  return (
    <>
      <AppNav active="operacion" />
      <main className="page">
        <div className="page-head">
          <span className="eyebrow">Operación</span>
          {/*
            El rótulo grande NO repite la palabra de la sección: dice lo que la pantalla
            es. El nombre «Operación» ya está arriba, en el menú y en la línea de encima.
          */}
          <h1 className="headline">El estado del servicio</h1>
          <p className="sub">
            En números, y solo en números: aquí no hay ningún dato de ninguna persona. Se cuentan
            filas, no se listan cuentas.
          </p>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* El grifo del registro (CE-6)                                      */}
        {/* ---------------------------------------------------------------- */}
        <section className="ops-bloque" data-testid="grifo">
          <h2>El registro</h2>

          <p
            className={`ops-estado ${state.open ? 'is-abierto' : 'is-cerrado'}`}
            data-testid="grifo-estado"
            data-abierto={state.open ? 'si' : 'no'}
            data-motivo={state.open ? '' : state.reason}
          >
            {state.open
              ? 'Abierto: se pueden crear cuentas nuevas.'
              : `Cerrado: ${REGISTRO_CERRADO_MOTIVO[state.reason]}`}
          </p>

          <p className="ops-nota" data-testid="grifo-aforo">
            {settings.capacity === null
              ? `${s.accounts} cuentas, sin cupo.`
              : `${s.accounts} de ${settings.capacity} plazas ocupadas.`}
          </p>

          <GateForm openManually={settings.openManually} capacity={settings.capacity} />

          {audit ? (
            <p className="ops-nota" data-testid="grifo-cuando">
              Último cambio guardado: {fecha(audit.updatedAt)} (UTC).
            </p>
          ) : null}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Los cuatro contadores (CE-7)                                       */}
        {/* ---------------------------------------------------------------- */}
        <section className="ops-bloque" data-testid="contadores">
          <h2>Cuánto hay</h2>
          <div className="ops-cifras">
            <div className="ops-cifra" data-testid="cifra-cuentas">
              <span className="ops-cifra-n">{s.accounts}</span>
              <span className="ops-cifra-t">Cuentas</span>
            </div>
            <div className="ops-cifra" data-testid="cifra-vigiladas">
              <span className="ops-cifra-n">{s.watchedSymbols}</span>
              <span className="ops-cifra-t">Acciones vigiladas</span>
            </div>
            <div className="ops-cifra" data-testid="cifra-simbolos">
              <span className="ops-cifra-n">{s.cycleSymbols}</span>
              <span className="ops-cifra-t">Símbolos en el ciclo</span>
            </div>
            <div className="ops-cifra" data-testid="cifra-sin-precio">
              <span className="ops-cifra-n">{s.symbolsWithoutPrice.total}</span>
              <span className="ops-cifra-t">Símbolos sin precio</span>
            </div>
          </div>

          {s.symbolsWithoutPrice.total > 0 ? (
            <ul className="ops-motivos" data-testid="motivos-sin-precio">
              {/*
                Con su motivo y no como un número mudo (CA-13): el defecto de cobertura
                de EPIC-FIX pasó semanas sin verse porque el único síntoma era la
                ausencia de precio, que se parece a todo.
              */}
              {s.symbolsWithoutPrice.byReason.map((m) => (
                <li key={m.reason} data-motivo={m.reason}>
                  <strong>{m.count}</strong> {m.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="ops-nota">Ningún símbolo se quedó sin precio.</p>
          )}
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* El último ciclo (CE-7, CA-18)                                      */}
        {/* ---------------------------------------------------------------- */}
        <section className="ops-bloque" data-testid="ultimo-ciclo">
          <h2>El ciclo diario</h2>

          {s.lastCycle === null ? (
            <p className="ops-estado is-cerrado" data-testid="ciclo-nunca">
              El ciclo no ha corrido nunca: no hay ninguna ejecución registrada.
            </p>
          ) : (
            <>
              <p
                className={`ops-estado ${
                  s.lastCycle.outcome === 'success' ? 'is-abierto' : 'is-cerrado'
                }`}
                data-testid="ciclo-estado"
                data-outcome={s.lastCycle.outcome ?? 'en-curso'}
              >
                {s.lastCycle.finishedAt === null
                  ? 'La última ejecución registrada empezó y no volvió: quedó a medias.'
                  : s.lastCycle.outcome === 'success'
                    ? 'La última ejecución registrada terminó bien.'
                    : 'La última ejecución registrada terminó con error.'}
              </p>

              <dl className="ops-datos" data-testid="ciclo-datos">
                <div>
                  <dt>Empezó</dt>
                  <dd data-testid="ciclo-empezo">{fecha(s.lastCycle.startedAt)} (UTC)</dd>
                </div>
                <div>
                  <dt>Terminó</dt>
                  <dd data-testid="ciclo-termino">
                    {s.lastCycle.finishedAt ? `${fecha(s.lastCycle.finishedAt)} (UTC)` : 'No terminó'}
                  </dd>
                </div>
                <div>
                  <dt>Símbolos pedidos</dt>
                  <dd data-testid="ciclo-requested">{s.lastCycle.requested ?? '—'}</dd>
                </div>
                <div>
                  <dt>Actualizados</dt>
                  <dd data-testid="ciclo-updated">{s.lastCycle.updated ?? '—'}</dd>
                </div>
                <div>
                  <dt>Sin precio</dt>
                  <dd data-testid="ciclo-skipped">{s.lastCycle.skipped ?? '—'}</dd>
                </div>
                <div>
                  <dt>Zonas abiertas / cerradas</dt>
                  <dd data-testid="ciclo-triggers">
                    {s.lastCycle.triggersOpened ?? '—'} / {s.lastCycle.triggersClosed ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt>Avisos individuales / agregados</dt>
                  <dd data-testid="ciclo-avisos">
                    {s.lastCycle.notificationsEntries ?? '—'} /{' '}
                    {s.lastCycle.notificationsDigests ?? '—'}
                  </dd>
                </div>
              </dl>

              {s.lastCycle.error ? (
                <p className="ops-error" data-testid="ciclo-error">
                  {s.lastCycle.error}
                </p>
              ) : null}
            </>
          )}

          <p className="ops-nota" data-testid="ciclo-residual">
            Esta pantalla dice lo que sabe. Un ciclo que nunca llegó a dispararse no deja fila
            ninguna, así que juzgar si la fecha de arriba es vieja te toca a ti: aquí no se avisa
            a nadie.
          </p>
        </section>
      </main>
    </>
  );
}
