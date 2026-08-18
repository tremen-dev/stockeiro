/**
 * SPEC-031 / ADR-018 D-6 — identidad del despliegue.
 *
 * Función pura: recibe los valores CRUDOS del canal de build y devuelve el
 * contrato de `/api/version`. No lee `process.env` ni toca red, disco ni base de
 * datos, así que se puede probar caso a caso.
 *
 * La regla es mirar el CONTENIDO, no la presencia. Sin integración Git, Vercel
 * define su variable del sha y la deja **vacía** (verificado en ADR-018 el
 * 2026-08-17): un `??` devolvería `""` y el despliegue diría que sabe de dónde
 * viene cuando no lo sabe. El nombre de esa variable no aparece en ningún sitio
 * de `src/`: vive solo en `next.config.mjs`, que es quien la lee al construir.
 *
 * La sentinela es `unknown` por decisión del humano en el gate del 2026-08-18.
 * ADR-018 D-6 la escribe en español (`desconocido`), pero D-6 declara "mecanismo
 * libre, propiedades obligatorias": fija que exista un valor distinguible, no
 * cómo se llama. El ADR no se toca — es inmutable.
 */

/** *"Este despliegue no sabe de dónde viene."* Es la alarma, no un adorno. */
export const UNKNOWN = 'unknown';

export type DeploymentIdentity = {
  commit: string;
  environment: string;
  builtAt: string;
};

export type RawIdentity = {
  commit?: string | null;
  environment?: string | null;
  builtAt?: string | null;
};

/** Sha de git, completo o corto. Nada más se acepta como identidad de commit. */
const SHA = /^[0-9a-f]{7,40}$/;

/** Los tres entornos que Vercel nombra. Cualquier otra cosa es ruido. */
const ENVIRONMENTS = new Set(['production', 'preview', 'development']);

/** ISO-8601 con hora y zona: una fecha suelta no identifica un build. */
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function clean(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function accept(value: string | null | undefined, isValid: (v: string) => boolean): string {
  const candidate = clean(value);
  return candidate !== '' && isValid(candidate) ? candidate : UNKNOWN;
}

export function resolveIdentity(raw: RawIdentity): DeploymentIdentity {
  return {
    commit: accept(clean(raw.commit).toLowerCase(), (v) => SHA.test(v)),
    environment: accept(raw.environment, (v) => ENVIRONMENTS.has(v)),
    builtAt: accept(raw.builtAt, (v) => ISO_8601.test(v) && !Number.isNaN(Date.parse(v))),
  };
}

/**
 * La identidad de ESTE artefacto, resuelta UNA sola vez al cargar el módulo
 * (CA-2). Los tres valores llegan por el canal `env` de `next.config.mjs`, que
 * los sustituye por literales en tiempo de compilación: releerlos por petición
 * permitiría que cambiaran sin build, y entonces la comprobación mentiría.
 */
export const deploymentIdentity: DeploymentIdentity = resolveIdentity({
  commit: process.env.STOCKEIRO_COMMIT,
  environment: process.env.STOCKEIRO_ENVIRONMENT,
  builtAt: process.env.STOCKEIRO_BUILT_AT,
});
