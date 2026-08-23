import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { tieneSesion } from '@/lib/auth/public-session';
import { CADENCIA_LINEA, QUE_HACE, QUE_NO_HACE } from '@/lib/help/content';

/*
 * La descripción es `QUE_HACE`, la MISMA constante que se renderiza abajo, y no una
 * paráfrasis escrita al lado. Antes decía además con qué cadencia se refrescan los
 * precios, con sus propias palabras: eso era un segundo literal de la frase cuya gracia
 * entera es ser una sola constante en tres pantallas (SPEC-039 CA-3), y es el modo de
 * fallo que `F-SPEC-039-3` dejó anotado — envejece en silencio. SPEC-050 CA-11 lo
 * prohíbe explícitamente y `tests/primera-pantalla-fuente.test.ts` lo mide.
 */
export const metadata: Metadata = {
  title: 'Stockeiro — vigila tus zonas de compra y venta',
  description: QUE_HACE,
};

/**
 * La primera pantalla (SPEC-039 CA-2, CE-1; reordenada por SPEC-050).
 *
 * ## Por qué esta página existe
 *
 * Hasta SPEC-039 la raíz hacía `redirect('/dashboard')` y el middleware mandaba a
 * `/login` a quien no tuviera sesión. Es decir: **la primera pantalla de Stockeiro
 * era una caja para el email y otra para la contraseña**, sin una línea que dijera
 * qué es esto. CE-1 dice literalmente *"entiende **en la primera pantalla** qué hace
 * la app y con qué cadencia"*, así que sin tocar esto CE-1 era inalcanzable.
 *
 * ## Qué cambió con SPEC-050, y por qué
 *
 * La app se publicó en un foro de bolsa y el humano miró esta pantalla con ojos de
 * desconocido: *«hay mucha información y poca útil; me gustaría que fuese más
 * sencilla, que estuviera presente el logo y los botones de login o crear cuenta»*.
 * Medido: **diez enlaces**, tres de ellos la llamada a la acción; **63 palabras de
 * negaciones** frente a **21 de propuesta de valor**; y la marca sin poder aparecer
 * porque su tipografía vivía dentro del selector del menú, que esta página no monta.
 *
 * El orden de arriba abajo ES el contrato (CA-5), y se lee así: quién soy (la marca),
 * qué prometo (el titular y `QUE_HACE`), por dónde entras (un botón que domina), qué
 * te cuesta (nada), y solo entonces lo que esto no es. Ni una palabra se ha perdido
 * por el camino: lo que cambia es el sitio y el peso, no el texto.
 *
 * **`CADENCIA_LINEA` sigue entera y sigue siendo la MISMA constante** que la ayuda y
 * que el estado vacío de `/vigiladas` (SPEC-039 CA-3, **D-2 locked**). Lo único que
 * pierde es el cromo de alarma con el que estaba pintada: el ámbar de este sistema
 * significa *aviso*, y aquí no hay nada que avisar — hay algo que explicar. La
 * redundancia entre las tres pantallas es el punto: **R-4** dice que si no se dice
 * alto, el feedback que vuelva del foro será «no actualiza» y se habrá gastado la
 * publicación.
 *
 * La marca es el wordmark que YA existía en la barra de navegación —`Stockeiro` más el
 * punto de acento—, el mismo del que salió el favicon de SPEC-047. No hay símbolo
 * nuevo ni tipografía nueva: SPEC-050 D-1 lo sacó de `.app-nav` a una clase `.brand`
 * reutilizable, y aquí se consume. **No es un enlace** (D-2): esta página es el destino
 * al que llevaría.
 *
 * ## Lo que NO cambia
 *
 * Quien tiene sesión sigue aterrizando en el panel, exactamente como antes. La
 * comprobación la hace `tieneSesion()`, que solo decodifica la cookie: esta página
 * no consulta la base de datos ni carga nada de fuera (SPEC-039 CA-14), porque un
 * desconocido que llega de un foro merece poder leerla aunque el resto esté caído.
 *
 * El descargo de no asesoramiento, los enlaces legales y la marca «un proyecto de
 * tremen.dev» siguen idénticos en el pie compartido (SPEC-035 CA-9, CA-10, CA-11):
 * los tres valen para un desconocido y los tres son obligación.
 */
export default async function Home() {
  if (await tieneSesion()) redirect('/dashboard');

  return (
    <main className="landing" data-testid="primera-pantalla">
      <p className="landing-marca brand" data-testid="landing-marca">
        Stockeiro<span className="dot">.</span>
      </p>

      <h1 className="landing-title">Tú pones la zona. Nosotros miramos todos los días.</h1>

      <p className="landing-lede" data-testid="landing-que-hace">
        {QUE_HACE}
      </p>

      <div className="landing-acciones">
        <Link className="btn primary" href="/register">
          Crear cuenta
        </Link>
        <Link className="btn" href="/login">
          Entrar
        </Link>
      </div>

      <p className="landing-gratis" data-testid="landing-gratis">
        Proyecto personal en pruebas, gratis y sin publicidad.
      </p>

      <p className="landing-cadencia" data-testid="landing-cadencia">
        {CADENCIA_LINEA}
      </p>

      <p className="landing-limites" data-testid="landing-que-no-hace">
        {QUE_NO_HACE}
      </p>

      <p className="landing-mas">
        <Link className="landing-ayuda" href="/ayuda">
          Cómo funciona, con detalle
        </Link>
      </p>

      <p className="landing-pie" data-testid="landing-legal">
        Quién lo opera y qué se guarda de ti está en <Link href="/legal">información legal</Link>.
      </p>
    </main>
  );
}
