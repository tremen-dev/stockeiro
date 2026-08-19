import Link from 'next/link';
import { DESCARGO_BREVE, MARCA } from '@/lib/legal/content';

/**
 * Pie compartido de la app (SPEC-035). Hermano de `AppNav` (`src/app/app-nav.tsx`)
 * pero con una diferencia que es su propiedad principal: **no tiene sesión y no
 * tiene base de datos** (CA-10). `AppNav` pregunta quién eres para contar tus avisos;
 * este no pregunta nada, porque lo que dice vale igual para todo el mundo.
 *
 * Esa carencia es lo que le permite montarse en el layout raíz (`src/app/layout.tsx`)
 * y alcanzar así también a las páginas del grupo `(auth)` y a las de `/legal`, que
 * son públicas. Un pie que leyera la sesión obligaría a cada página pública a
 * resolver una sesión que no tiene, y tumbaría `/legal` con la base caída (CA-14).
 * `tests/legal-import-graph.test.ts` vigila que siga siendo verdad.
 *
 * Aloja tres cosas y solo tres:
 *   - el descargo de no asesoramiento, con enlace al texto completo (CA-9);
 *   - los enlaces a las páginas legales (CA-10);
 *   - la marca «Stockeiro, un proyecto de tremen.dev», con enlace (CA-11).
 *
 * Está pensado para crecer, pero **no aquí**: SPEC-038 le añadirá la versión visible
 * y SPEC-039 el enlace de feedback. Cada una trae su CA; esta spec lo crea y para.
 *
 * El enlace del descargo apunta al ancla de la sección (`#no-asesoramiento`) y no a
 * la página pelada: quien pincha en "leer el descargo completo" quiere el descargo,
 * no el principio de los términos.
 */
export function AppFooter() {
  return (
    <footer className="app-footer">
      <p className="app-footer-descargo" data-testid="descargo">
        {DESCARGO_BREVE}{' '}
        <Link href="/legal/terminos#no-asesoramiento">Leer el descargo completo</Link>
      </p>

      <nav className="app-footer-links" aria-label="Información legal">
        <Link href="/legal/aviso-legal">Aviso legal</Link>
        <Link href="/legal/privacidad">Privacidad</Link>
        <Link href="/legal/terminos">Términos</Link>
      </nav>

      <p className="app-footer-marca">
        Stockeiro, un proyecto de{' '}
        <a href={MARCA.url} target="_blank" rel="noreferrer">
          {MARCA.nombre}
        </a>
      </p>
    </footer>
  );
}
