import type { Metadata } from 'next';
import Link from 'next/link';
import { DESCARGO_BREVE, TITULAR } from '@/lib/legal/content';

export const metadata: Metadata = {
  title: 'Información legal · Stockeiro',
  description: 'Quién opera Stockeiro, qué datos guarda y en qué condiciones se usa.',
};

/**
 * Índice de las páginas legales (SPEC-035, CE-4). Pública: se lee sin sesión.
 *
 * Existe para que haya UN sitio al que apuntar cuando alguien pregunta "¿quién está
 * detrás de esto?" — la pregunta que se hace un desconocido que llega de un hilo de
 * un foro y está a punto de teclear su correo y una contraseña.
 */
export default function LegalIndexPage() {
  return (
    <main className="legal">
      <h1 className="legal-title">Información legal</h1>

      <p className="legal-lede">
        Stockeiro lo opera una persona, no una empresa. Aquí está quién es, qué guarda de ti
        y en qué condiciones se usa esto. Sin sesión y sin dar nada a cambio.
      </p>

      <p className="legal-aviso">{DESCARGO_BREVE}</p>

      <ul className="legal-indice">
        <li>
          <Link href="/legal/aviso-legal">Aviso legal</Link>
          <span>Quién opera el servicio, desde dónde y cómo escribirle.</span>
        </li>
        <li>
          <Link href="/legal/privacidad">Privacidad</Link>
          <span>Qué datos se guardan, para qué, quién más los ve y cómo borrarlos.</span>
        </li>
        <li>
          <Link href="/legal/terminos">Términos de uso</Link>
          <span>Qué hace la app, qué no hace y de dónde salen los precios.</span>
        </li>
      </ul>

      <p className="legal-contacto">
        ¿Algo que no encuentras aquí? Escribe a{' '}
        <a href={`mailto:${TITULAR.contacto}`}>{TITULAR.contacto}</a>.
      </p>
    </main>
  );
}
