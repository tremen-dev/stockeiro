import Link from 'next/link';
import { DESCARGO_BREVE, MARCA } from '@/lib/legal/content';
import { ETIQUETA_FEEDBACK, construirMailtoDeFeedback } from '@/lib/feedback/channel';
import { deploymentIdentity } from '@/lib/version/identity';
import { SEPARADOR, etiquetaDeVersion } from '@/lib/version/presentation';

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
 * Aloja cinco cosas y solo cinco:
 *   - el descargo de no asesoramiento, con enlace al texto completo (SPEC-035 CA-9);
 *   - los enlaces a las páginas legales (SPEC-035 CA-10);
 *   - el canal de feedback (SPEC-039 CA-12), con la versión del despliegue puesta;
 *   - la versión del despliegue, legible y copiable (SPEC-038 CA-1 y CA-2);
 *   - la marca «Stockeiro, un proyecto de tremen.dev», con enlace (SPEC-035 CA-11).
 *
 * La versión va AQUÍ y no en una pantalla propia por lo mismo que el descargo: el
 * pie está en el layout raíz, así que se lee desde cualquier página y **también sin
 * sesión** (RN-03: es un dato del artefacto, no del usuario). Es texto normal, no
 * una imagen ni un tooltip, porque lo que tiene que poder hacer un tester con ella
 * es **copiarla y pegarla** en un hilo (CA-2). El semver va primero por eso mismo;
 * el commit abreviado y la fecha van detrás, para el operador que lee el reporte.
 * El formato lo pone `src/lib/version/presentation.ts`; aquí solo se coloca.
 *
 * El feedback vive AQUÍ y no en una pantalla propia por lo mismo que el descargo: el
 * pie va en el layout raíz, así que el camino está a un clic desde **cualquier**
 * pantalla —también desde `/ayuda`, que se lee sin sesión—, sin añadir una entrada
 * más al menú ni una ruta más al mapa. CE-8 pide un camino visible, no una sección.
 *
 * Que sea un `mailto:` y no un formulario lo decidió la épica: *"el canal de feedback
 * es un enlace, no una bandeja"*. Lo que el enlace añade por su cuenta es la versión
 * del despliegue prefijada (CA-13), leída de `deploymentIdentity` — la misma fuente
 * que responde `/api/version`. Cuando entre SPEC-038 y el pie enseñe el semver, será
 * ese mismo dato: ninguna de las dos specs depende de la otra.
 *
 * Sigue sin leer la sesión y sin tocar la base (CA-10 de SPEC-035, CA-14 de esta):
 * `deploymentIdentity` se resuelve del canal de build al cargar el módulo, y
 * `tests/legal-import-graph.test.ts` lo vigila.
 *
 * El enlace del descargo apunta al ancla de la sección (`#no-asesoramiento`) y no a
 * la página pelada: quien pincha en "leer el descargo completo" quiere el descargo,
 * no el principio de los términos.
 */
export function AppFooter() {
  // Se compone aquí, en el servidor, a partir de la MISMA constante que responde
  // `/api/version`: la coincidencia que exige CE-3 es por construcción, no un
  // acuerdo entre dos lectores (SPEC-038 CA-5).
  const version = etiquetaDeVersion(deploymentIdentity);

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

      <p className="app-footer-feedback" data-testid="feedback">
        ¿Algo que no funciona o que echas de menos?{' '}
        <a href={construirMailtoDeFeedback(deploymentIdentity)} data-testid="feedback-enlace">
          {ETIQUETA_FEEDBACK}
        </a>
      </p>

      <p className="app-footer-version" data-testid="version">
        <span data-testid="version-semver">{version.version}</span>
        {version.entorno !== null && (
          <>
            <span aria-hidden="true">{SEPARADOR}</span>
            <span className="app-footer-version-entorno" data-testid="version-entorno">
              {version.entorno}
            </span>
          </>
        )}
        <span aria-hidden="true">{SEPARADOR}</span>
        <span data-testid="version-commit">{version.commit}</span>
        <span aria-hidden="true">{SEPARADOR}</span>
        {version.construidoISO === null ? (
          <span data-testid="version-construido">{version.construido}</span>
        ) : (
          <time dateTime={version.construidoISO} data-testid="version-construido">
            {version.construido}
          </time>
        )}
      </p>

      <p className="app-footer-marca">
        Stockeiro, un proyecto de{' '}
        <a href={MARCA.url} target="_blank" rel="noreferrer">
          {MARCA.nombre}
        </a>
      </p>
    </footer>
  );
}
