import type { Metadata } from 'next';
import Link from 'next/link';
import {
  DATOS_DE_MERCADO,
  DESCARGO_COMPLETO,
  DISPONIBILIDAD,
  TITULAR,
} from '@/lib/legal/content';

export const metadata: Metadata = {
  title: 'Términos de uso · Stockeiro',
  description: 'Qué hace Stockeiro, qué no hace y de dónde salen los precios.',
};

/**
 * Términos de uso (SPEC-035 CA-7, CA-8, CA-9). Pública.
 *
 * Aquí vive el texto completo del descargo de no asesoramiento, al que apunta el pie
 * de todas las páginas. Lleva `id="no-asesoramiento"` porque ese enlace es un ancla:
 * quien pincha en "leer el descargo completo" quiere el descargo, no el principio de
 * la página.
 *
 * Y aquí es donde CA-8 muerde. Lo natural al redactar unos términos es blindarse
 * —"todos los derechos reservados sobre los contenidos"—, y eso sería justamente el
 * error: los precios no son nuestros y el plan que los sirve no concede
 * redistribución (R-1, ADR-012). Así que esta página declara la fuente del dato y su
 * carácter informativo, y se para ahí. La lista cerrada de lo que no puede decir está
 * en `tests/legal-afirmaciones-prohibidas.ts`, con el motivo de cada entrada.
 */
export default function TerminosPage() {
  return (
    <main className="legal">
      <h1 className="legal-title">Términos de uso</h1>

      <p className="legal-lede">
        Stockeiro está en pruebas y se ofrece tal cual, sin coste. Usarlo implica aceptar lo
        que sigue. Si algo no te encaja, no lo uses: es así de simple.
      </p>

      <section className="legal-seccion" id="no-asesoramiento" data-testid="no-asesoramiento">
        <h2>Esto no es asesoramiento financiero</h2>
        {DESCARGO_COMPLETO.map((parrafo) => (
          <p key={parrafo.slice(0, 24)}>{parrafo}</p>
        ))}
      </section>

      <section className="legal-seccion" data-testid="datos-de-mercado">
        <h2>De dónde salen los precios</h2>
        {DATOS_DE_MERCADO.map((parrafo) => (
          <p key={parrafo.slice(0, 24)}>{parrafo}</p>
        ))}
      </section>

      <section className="legal-seccion">
        <h2>Qué hace la app y qué no</h2>
        <p>
          Hace tres cosas: guarda los valores que quieres seguir con los rangos de precio que
          tú escribes, actualiza una vez al día el último precio de cierre de cada uno, y te
          avisa cuando alguno entra en tus rangos. También lleva la cuenta de tu cartera con
          las operaciones que tú registras o importas.
        </p>
        <p>
          No hace ninguna otra: no analiza, no predice, no puntúa valores, no ejecuta nada y
          no está conectada a tu bróker. Si esperabas eso, esta no es la herramienta.
        </p>
      </section>

      <section className="legal-seccion">
        <h2>Tu cuenta</h2>
        <p>
          Eres responsable de tu contraseña y de lo que se haga desde tu cuenta. Los datos que
          metes son tuyos y solo tú los ves: ninguna otra cuenta puede leerlos. Puedes borrarla
          entera cuando quieras — cómo, y hasta dónde llega el borrado, está en la{' '}
          <Link href="/legal/privacidad">política de privacidad</Link>.
        </p>
      </section>

      <section className="legal-seccion" data-testid="disponibilidad">
        <h2>Disponibilidad</h2>
        {DISPONIBILIDAD.map((parrafo) => (
          <p key={parrafo.slice(0, 24)}>{parrafo}</p>
        ))}
      </section>

      <section className="legal-seccion">
        <h2>Cambios en estos términos</h2>
        <p>
          Si cambian de forma relevante, se avisa en la app o por correo. Esta es la primera
          versión y no hay historial anterior que consultar.
        </p>
      </section>

      <section className="legal-seccion">
        <h2>Contacto</h2>
        <p>
          Para cualquier cuestión sobre estos términos, escribe a{' '}
          <a href={`mailto:${TITULAR.contacto}`}>{TITULAR.contacto}</a>. Quién opera el
          servicio y desde dónde está en el{' '}
          <Link href="/legal/aviso-legal">aviso legal</Link>.
        </p>
      </section>
    </main>
  );
}
