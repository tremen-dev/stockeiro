import type { Metadata } from 'next';
import Link from 'next/link';
import { MARCA, TITULAR } from '@/lib/legal/content';

export const metadata: Metadata = {
  title: 'Aviso legal · Stockeiro',
  description: 'Quién opera Stockeiro y cómo ponerse en contacto.',
};

/**
 * Aviso legal (SPEC-035 CA-3, CA-4). Pública: se lee sin sesión.
 *
 * Dos cosas que no se pueden difuminar aquí:
 *
 * 1. **El titular es la persona física.** La frase que lo declara está marcada en el
 *    DOM (`data-testid="titular"`) para que un test pueda leerla sola y comprobar que
 *    su sujeto es el nombre — no la marca. Si un día `tremen.dev` se cuela en el sitio
 *    del titular, se le estarán atribuyendo obligaciones legales a un nombre de
 *    dominio, que no es sujeto de derecho.
 * 2. **Ni un marcador de posición.** Los datos son reales y confirmados por el titular
 *    el 2026-08-19 (cierra F-SPEC-035-5 y F-SPEC-035-6). Un `<nombre>` aquí no sería
 *    un pendiente: sería publicar mintiendo sobre quién responde.
 */
export default function AvisoLegalPage() {
  return (
    <main className="legal">
      <h1 className="legal-title">Aviso legal</h1>

      <section className="legal-seccion">
        <h2>Titular del servicio</h2>
        <p className="legal-destacado" data-testid="titular">
          {TITULAR.nombre}, {TITULAR.forma}, es el titular y responsable del servicio Stockeiro.
        </p>
        <dl className="legal-datos">
          <dt>Domicilio</dt>
          <dd>{TITULAR.domicilio}</dd>
          <dt>Contacto</dt>
          <dd>
            <a href={`mailto:${TITULAR.contacto}`}>{TITULAR.contacto}</a>
          </dd>
          <dt>Dominio desde el que se presta el servicio</dt>
          <dd>{TITULAR.dominio}</dd>
        </dl>
        <p>
          No hay ninguna sociedad detrás de Stockeiro. Lo opera una persona, a título
          particular, y esa persona es quien responde de lo que aquí se publica.
        </p>
      </section>

      <section className="legal-seccion">
        <h2>Marca y proyecto</h2>
        <p>
          Stockeiro es un proyecto de {MARCA.nombre}, la marca bajo la que {TITULAR.nombre}{' '}
          publica su trabajo.
        </p>
        <p>
          Conviene decirlo con precisión: {MARCA.nombre} es una marca y un nombre de dominio.
          No es una sociedad, no figura como titular de este servicio y no asume obligación
          alguna. Quien responde es la persona nombrada arriba.
        </p>
      </section>

      <section className="legal-seccion">
        <h2>Qué es esto</h2>
        <p>
          Stockeiro es una herramienta personal para vigilar valores de bolsa: tú defines
          rangos de precio y la app te avisa cuando un valor entra en ellos. Se comparte en
          fase de pruebas, con un número reducido de personas, y se ofrece tal cual.
        </p>
        <p>
          Lo que la app hace y lo que no, con detalle, está en los{' '}
          <Link href="/legal/terminos">términos de uso</Link>. Lo que guarda de ti, en la{' '}
          <Link href="/legal/privacidad">política de privacidad</Link>.
        </p>
      </section>

      <section className="legal-seccion">
        <h2>Reclamaciones</h2>
        <p>
          Cualquier duda, queja o petición sobre este servicio se atiende en{' '}
          <a href={`mailto:${TITULAR.contacto}`}>{TITULAR.contacto}</a>. Es la misma dirección
          para todo: no hay formularios ni números de expediente.
        </p>
      </section>
    </main>
  );
}
