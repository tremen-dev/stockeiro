import Link from 'next/link';
import { db } from '@/db/client';
import { resolveRegistrationState } from '@/lib/registration/service';
import {
  REGISTRO_CERRADO_MOTIVO,
  REGISTRO_CERRADO_QUE_HACER,
  REGISTRO_CERRADO_TITULO,
} from '@/lib/registration/messages';
import { RegisterForm } from './register-form';

/**
 * `/register` (SPEC-001) con el grifo delante (SPEC-037 CA-6, CA-7).
 *
 * La ruta NO cambia de naturaleza: sigue siendo **pública** (`PUBLIC_PREFIXES` no se
 * toca, RN-03) y sigue estando en el mismo sitio. Lo que cambia es su contenido según
 * el estado del grifo.
 *
 * `force-dynamic` es parte del CA-7, no una precaución: sin él, Next prerenderiza
 * esta página en el build y el estado del grifo quedaría congelado al momento de
 * construir — que es exactamente el «con redespliegue» que ADR-023 rechaza. Los
 * ajustes se leen EN LA PETICIÓN, así que la siguiente visita ve el cambio y punto.
 *
 * Y quien llega con la puerta cerrada lee POR QUÉ (R-7): dos textos distintos según
 * el motivo, con qué puede hacer. No hay 404, no hay error de Next y no hay
 * redirección muda — las tres cosas serían peor que la puerta cerrada.
 */
export const dynamic = 'force-dynamic';

export default async function RegisterPage() {
  const estado = await resolveRegistrationState(db);

  if (!estado.open) {
    return (
      <main className="auth-wrap">
        <h1 className="headline">{REGISTRO_CERRADO_TITULO}</h1>
        <div className="card registro-cerrado" data-testid="registro-cerrado">
          <p className="registro-cerrado-motivo" data-motivo={estado.reason}>
            {REGISTRO_CERRADO_MOTIVO[estado.reason]}
          </p>
          <p className="registro-cerrado-quehacer">{REGISTRO_CERRADO_QUE_HACER[estado.reason]}</p>
        </div>
        {/*
          Cerrar el grifo cierra las ALTAS, no la app (CA-8): quien ya tiene cuenta
          entra con normalidad, y conviene que lo lea aquí para no pensar que el
          servicio se ha caído.
        */}
        <p className="lede">
          ¿Ya tienes cuenta? <Link href="/login">Entra</Link>.
        </p>
        <p className="lede">
          Puedes leer de qué va esto en el <Link href="/legal">aviso legal y la privacidad</Link>.
        </p>
      </main>
    );
  }

  return (
    <main className="auth-wrap">
      <h1 className="headline">Crear cuenta</h1>
      <RegisterForm />
      <p className="lede">
        ¿Ya tienes cuenta? <Link href="/login">Entra</Link>.
      </p>
    </main>
  );
}
