import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { requireUser } from '@/lib/auth/session';
import { LOGIN_PATH } from '@/lib/auth/guard';
import { readAccountProfile } from '@/lib/account/profile';
import {
  ACCOUNT_DELETION_COVERAGE,
  SHARED_LABELS,
  SHARED_TABLES,
  canDeleteAccount,
} from '@/lib/account/deletion';
import { ADMIN_NO_SE_BORRA } from '@/lib/account/messages';
import { AppNav } from '../app-nav';
import { DeleteAccountForm } from './delete-account-form';

export const metadata: Metadata = {
  title: 'Tu cuenta · Stockeiro',
  description: 'Tus datos de cuenta y el borrado definitivo de la cuenta y de todo lo tuyo.',
};

/**
 * SPEC-036 — la pantalla de cuenta. Autenticada (RN-03) y **no** sujeta al catálogo
 * de secciones de SPEC-034: `/cuenta` no está en `SECTIONS` y se alcanza con
 * cualquiera de los tres roles. Poder irse no es una funcionalidad que se conceda por
 * nivel; es un derecho, y `/legal/privacidad` lo promete a todo el mundo.
 *
 * La única diferencia por rol es el botón (CA-11): un `admin` no ve el formulario y
 * ve por qué. Pero la puerta no la cierra esta pantalla —eso sería taparla— sino
 * `deleteMyAccount`, que relee el rol de la base (ADR-021 pto. 3).
 *
 * Las dos listas de "qué se borra" y "qué no" **no están escritas aquí**: salen de
 * `ACCOUNT_DELETION_COVERAGE` y de `SHARED_TABLES`, que son las mismas estructuras
 * que ejecutan el borrado y que `tests/account-deletion-coverage.test.ts` compara
 * contra `src/db/schema.ts`. Es lo que hace que CA-2 no pueda envejecer: quien añada
 * mañana una tabla con `user_id` tendrá que declararla, y al declararla aparecerá
 * aquí sin tocar esta página.
 */
export default async function CuentaPage() {
  const user = await requireUser(); // SPEC-023 CA-13: sesión revocada -> login
  const perfil = await readAccountProfile(db, user.id);
  // La fila puede haber desaparecido entre la frontera de sesión y esta consulta
  // (alguien acaba de borrarse en otra pestaña). Sin fila no hay pantalla que pintar.
  if (!perfil) redirect(LOGIN_PATH);

  const puedeBorrar = canDeleteAccount(perfil.role);
  const alta = perfil.createdAt.toISOString().slice(0, 10);

  return (
    <>
      <AppNav active="cuenta" />
      <main className="page">
        <div className="page-head">
          <span className="eyebrow">Cuenta</span>
          <h1 className="headline">Tu cuenta</h1>
          {/*
            Se nombra lo que la app sabe de ti como PERSONA, y no se enumeran secciones:
            cuáles ves depende de tu rol (SPEC-034), y una pantalla que se alcanza con
            los tres no puede mandarte a una puerta que la tuya no abre.
          */}
          <p className="sub">
            Esto es todo lo que Stockeiro sabe de ti como persona. Lo demás que ves en la app
            lo has metido tú, y también se va con esta cuenta.
          </p>
        </div>

        <dl className="account-facts" data-testid="datos-de-cuenta">
          <div>
            <dt>Correo</dt>
            <dd>{perfil.email}</dd>
          </div>
          <div>
            {/*
              SPEC-040 CA-9 (cierra F-SPEC-036-9 por la vía (b) de ADR-025 pto. 3).
              Decía «Tipo de cuenta» y el glosario dice «Rol de cuenta» (fila que entró
              con SPEC-034 desde ADR-021). Un rótulo que contradice al glosario en la
              pantalla que va a ver un tester externo no espera compañía.

              `data-termino` no es decoración: nombra DE QUÉ fila del glosario sale este
              rótulo, y es lo que permite a `tests/e2e/rotulo-glosario.spec.ts` comparar
              lo que pinta la app con `docs/fundacion/dominio.md`. Así salta tanto si el
              rótulo se desvía como si el término se renombra ahí.
            */}
            <dt data-termino="rol-de-cuenta">Rol de cuenta</dt>
            <dd>{perfil.role}</dd>
          </div>
          <div>
            <dt>Alta</dt>
            <dd>{alta}</dd>
          </div>
        </dl>

        <section className="danger-zone" data-testid="zona-de-borrado">
          <h2>Borrar mi cuenta</h2>

          <p className="danger-lead">
            Es <strong>irreversible y no hay vuelta atrás</strong>: no hay copia, no hay
            papelera y no hay periodo de arrepentimiento. En cuanto lo confirmes, lo tuyo deja
            de existir aquí y tu sesión se cierra en todos los navegadores donde la tuvieras
            abierta.
          </p>

          <div className="danger-listas">
            <div data-testid="que-se-borra">
              <h3>Qué se borra</h3>
              <ul>
                {ACCOUNT_DELETION_COVERAGE.map((c) => (
                  <li key={c.table}>{c.label}</li>
                ))}
              </ul>
            </div>

            <div data-testid="que-no-se-borra">
              <h3>Qué no se borra</h3>
              <ul>
                {SHARED_TABLES.map((t) => (
                  <li key={t}>{SHARED_LABELS[t]}</li>
                ))}
              </ul>
              <p className="danger-nota">
                Nada de eso es tuyo: son datos <strong>compartidos</strong> por todos los
                usuarios y hechos de mercado. Borrarlos contigo rompería la cartera y la
                vigilancia de los demás, así que se quedan.
              </p>
            </div>
          </div>

          <p className="danger-nota" data-testid="residual-correo">
            Un límite honesto: los correos que Stockeiro ya te haya enviado no vuelven. Un
            correo entregado vive en tu buzón y en los registros del proveedor de envío, fuera
            del alcance de esta app. Está contado en la{' '}
            <Link href="/legal/privacidad">política de privacidad</Link>.
          </p>

          {puedeBorrar ? (
            <DeleteAccountForm />
          ) : (
            <p className="danger-bloqueado" data-testid="borrado-no-disponible">
              {ADMIN_NO_SE_BORRA}
            </p>
          )}
        </section>
      </main>
    </>
  );
}
