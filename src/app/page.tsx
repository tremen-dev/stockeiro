import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { tieneSesion } from '@/lib/auth/public-session';
import { CADENCIA_LINEA, QUE_HACE, QUE_NO_HACE } from '@/lib/help/content';

export const metadata: Metadata = {
  title: 'Stockeiro — vigila tus zonas de compra y venta',
  description:
    'Escribes el rango de precio que te interesa y Stockeiro te avisa cuando un valor entra ' +
    'en él. Precios de cierre, una vez al día.',
};

/**
 * La primera pantalla (SPEC-039 CA-2, CE-1).
 *
 * ## Por qué esta página existe
 *
 * Hasta ahora la raíz hacía `redirect('/dashboard')` y el middleware mandaba a
 * `/login` a quien no tuviera sesión. Es decir: **la primera pantalla de Stockeiro
 * era una caja para el email y otra para la contraseña**, sin una línea que dijera
 * qué es esto. CE-1 dice literalmente *"entiende **en la primera pantalla** qué hace
 * la app y con qué cadencia"*, así que sin tocar esto CE-1 era inalcanzable. El gate
 * humano del 2026-08-19 lo aprobó sabiéndolo (nota 1 de la spec).
 *
 * Es **mínima a propósito**: qué hace, con qué cadencia, qué no hace y por dónde se
 * entra. Ni una pantalla comercial — nada de capturas, testimonios ni precios, que
 * están fuera de alcance por escrito.
 *
 * ## Lo que NO cambia
 *
 * Quien tiene sesión sigue aterrizando en el panel, exactamente como antes. La
 * comprobación la hace `tieneSesion()`, que solo decodifica la cookie: esta página
 * no consulta la base de datos ni carga nada de fuera (CA-14), porque un desconocido
 * que llega de un foro merece poder leerla aunque el resto esté caído.
 *
 * La cadencia se dice con la MISMA frase que la ayuda y que el estado vacío de
 * `/vigiladas` (`CADENCIA_LINEA`, CA-3). La redundancia es el punto: **R-4** dice que
 * si no se dice alto, el feedback que vuelva del foro será «no actualiza» y se habrá
 * gastado la publicación.
 */
export default async function Home() {
  if (await tieneSesion()) redirect('/dashboard');

  return (
    <main className="landing" data-testid="primera-pantalla">
      <p className="landing-eyebrow">Stockeiro</p>

      <h1 className="landing-title">Tú pones la zona. Nosotros miramos todos los días.</h1>

      <p className="landing-lede" data-testid="landing-que-hace">
        {QUE_HACE}
      </p>

      <p className="landing-cadencia" data-testid="landing-cadencia">
        {CADENCIA_LINEA}
      </p>

      <p className="landing-limites" data-testid="landing-que-no-hace">
        {QUE_NO_HACE}
      </p>

      <div className="landing-acciones">
        <Link className="btn primary" href="/register">
          Crear cuenta
        </Link>
        <Link className="btn" href="/login">
          Entrar
        </Link>
        <Link className="landing-ayuda" href="/ayuda">
          Cómo funciona, con detalle
        </Link>
      </div>

      <p className="landing-pie">
        Proyecto personal en pruebas, gratis y sin publicidad. Quién lo opera y qué se guarda
        de ti está en <Link href="/legal">información legal</Link>.
      </p>
    </main>
  );
}
