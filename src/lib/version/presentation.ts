import { UNKNOWN, type DeploymentIdentity } from '@/lib/version/identity';

/**
 * SPEC-038 / ADR-024 — la identidad del despliegue, dicha para personas.
 *
 * ## Por qué existe este módulo, y por qué está SEPARADO de `identity.ts`
 *
 * La flecha de dependencia va en un solo sentido: **la presentación importa la
 * identidad, y la identidad no importa la presentación** (ADR-024 pto. 7). Eso no
 * es higiene: es lo que mantiene el grafo de imports de `/api/version` tan pequeño
 * como lo dejó SPEC-031, y por tanto lo que hace cumplible **RI-02** —el endpoint
 * tiene que poder responder con la base de datos caída, que es justo cuando más
 * falta hace—. Meter el formato dentro de `identity.ts` arrastraría mañana medio
 * proyecto a ese grafo sin que nadie se diera cuenta.
 * `tests/version-import-graph.test.ts` lo vigila en las dos direcciones.
 *
 * ## Una sola fuente, dos consumidores (CA-5)
 *
 * Todo lo que se enseña sale del argumento —una `DeploymentIdentity` ya resuelta—.
 * Aquí no se lee el entorno del proceso, no se nombran las variables del canal de
 * build y no se abre `package.json`. Que el pie y `/api/version` coincidan es una
 * propiedad **por construcción** y no un acuerdo entre dos lectores: no hay dos
 * lectores.
 *
 * ## Qué se enseña, y en qué orden (CA-2, CA-10)
 *
 *   `v0.2.0 · preview · a1b2c3d · 2026-08-19 21:30 UTC`
 *
 * El **semver primero**, porque es lo que un tester copia en un hilo de foro —un
 * sha de siete caracteres se copia mal y convierte el reporte en ruido—. El
 * **entorno** justo detrás y solo cuando NO es producción: es el aviso de que eso
 * que estás mirando es un preview, y llegar tarde a ese aviso es lo que hace que
 * alguien reporte un fallo desde una URL de Vercel creyendo que es la app real. El
 * **commit** después, porque es el que precisa: dos despliegues comparten semver y
 * nunca comparten commit (ADR-024 pto. 11). Y la **fecha**, en UTC y sin locale,
 * para que diga lo mismo en el servidor que en la pantalla de quien la lee.
 *
 * ## Lo desconocido se dice (CA-9)
 *
 * Nada sale vacío y nada se inventa. La sentinela `unknown` es un valor de máquina
 * —a una persona no le dice nada y encima parece un identificador válido—, así que
 * se traduce a una frase. Que se VEA es la alarma de SPEC-031 hecha visible para
 * cualquiera; hoy, sin integración Git en Vercel, el commit va a salir así.
 */

/** Lo que separa las piezas. Un punto medio: no es coma, no es guion, no estorba. */
export const SEPARADOR = ' · ';

/**
 * Cuántos caracteres de sha se enseñan. Siete es el corto de git: suficiente para
 * identificar y corto para no comerse el renglón en un móvil. Lo que importa de
 * verdad es que sea **prefijo exacto** del commit completo (CA-4).
 */
export const LARGO_DEL_COMMIT_CORTO = 7;

/** Cómo se dice cada cosa cuando este despliegue no la sabe. */
const DESCONOCIDO = {
  version: 'versión desconocida',
  entorno: 'entorno desconocido',
  commit: 'commit desconocido',
  construido: 'fecha de construcción desconocida',
} as const;

export type EtiquetaDeVersion = {
  /** `v0.2.0`, o la frase de desconocido. Nunca vacío. */
  version: string;
  /** El entorno cuando NO es producción; `null` cuando lo es (CA-10). */
  entorno: string | null;
  /** El commit abreviado, prefijo exacto del completo. Nunca vacío. */
  commit: string;
  /** La fecha legible, en UTC. Nunca vacío. */
  construido: string;
  /** El instante exacto tal y como vino, para comparar sin depender del formato. */
  construidoISO: string | null;
  /** Las piezas juntas, en orden. Es lo que se lee y lo que se copia. */
  texto: string;
};

/** `2026-08-19T21:30:00.000Z` -> `2026-08-19 21:30 UTC`. */
function fechaLegible(iso: string): string {
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return DESCONOCIDO.construido;

  const dosDigitos = (n: number) => String(n).padStart(2, '0');
  return (
    `${instante.getUTCFullYear()}-${dosDigitos(instante.getUTCMonth() + 1)}-` +
    `${dosDigitos(instante.getUTCDate())} ${dosDigitos(instante.getUTCHours())}:` +
    `${dosDigitos(instante.getUTCMinutes())} UTC`
  );
}

/**
 * La identidad de un despliegue, lista para pintarse en el pie.
 *
 * Pura y total: con cualquier `DeploymentIdentity` —incluida una con las cuatro
 * claves en `unknown`— devuelve texto, y no lanza (CA-11).
 */
export function etiquetaDeVersion(identidad: DeploymentIdentity): EtiquetaDeVersion {
  const version =
    identidad.version === UNKNOWN ? DESCONOCIDO.version : `v${identidad.version}`;

  // En producción no se añade ruido; en cualquier otro caso —incluido el que no se
  // sabe— se dice, porque lo que hay que evitar es confundir un preview con la app
  // real, y un entorno que no se sabe tampoco es "la app real" demostrada.
  const entorno =
    identidad.environment === 'production'
      ? null
      : identidad.environment === UNKNOWN
        ? DESCONOCIDO.entorno
        : identidad.environment;

  const commit =
    identidad.commit === UNKNOWN
      ? DESCONOCIDO.commit
      : identidad.commit.slice(0, LARGO_DEL_COMMIT_CORTO);

  const conocemosLaFecha = identidad.builtAt !== UNKNOWN;
  const construido = conocemosLaFecha ? fechaLegible(identidad.builtAt) : DESCONOCIDO.construido;

  return {
    version,
    entorno,
    commit,
    construido,
    construidoISO: conocemosLaFecha ? identidad.builtAt : null,
    // `filter` y no un `join` con huecos: dos separadores seguidos son exactamente
    // el "hueco" que CA-9 prohíbe.
    texto: [version, entorno, commit, construido].filter((p) => p !== null).join(SEPARADOR),
  };
}
