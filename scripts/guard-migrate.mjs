#!/usr/bin/env node
/**
 * guard-migrate.mjs — ¿tiene ESTE build permiso para migrar?
 *
 * SPEC-032 / ADR-018 D-2. Va delante de `db:migrate` en el `buildCommand` de
 * `vercel.json`:
 *
 *   node scripts/guard-migrate.mjs && npm run db:migrate && npm run build
 *
 * `db:migrate` se queda DENTRO del build a propósito: si la migración falla, el
 * `&&` corta, el build falla y no se despliega — se queda la versión anterior.
 * Lo que esta guardia añade es la pregunta que hoy no se hace nadie: no "contra
 * qué base migro" (eso lo responde la separación de bases, ADR-018 D-3), sino
 * "¿tengo permiso para migrar aquí?".
 *
 * La propiedad, en una línea (ADR-018 D-2):
 *
 *   Un build que no sea de producción no migra, salvo que el entorno donde corre
 *   lo autorice de forma explícita. Por omisión, NO migra: falla.
 *
 * No acepta argumentos: decide leyendo SOLO el entorno.
 *
 *   node scripts/guard-migrate.mjs
 *   node scripts/guard-migrate.mjs --help
 *
 * ENTORNO QUE LEE:
 *   VERCEL_ENV     Lo inyecta Vercel: `production`, `preview`, `development`…
 *                  Su AUSENCIA es un rechazo, no un "no sé, adelante".
 *   ALLOW_MIGRATE  El permiso explícito. Autoriza con el valor literal `1`
 *                  (comparado tras recortar espacios). `true`, `yes` o `0` NO
 *                  autorizan.
 *   DATABASE_URL   Solo para DECIRLA en el log: host y nombre de base, nunca
 *                  usuario, contraseña ni parámetros. No se abre jamás.
 *
 * CÓDIGOS DE SALIDA — son el contrato, no un detalle de implementación.
 * Cualquier valor distinto de 0 corta el `&&` del `buildCommand`, que es el
 * mecanismo entero:
 *
 *   0  autoriza la migración.
 *   1  la rechaza: este entorno no tiene permiso. La base NO se ha tocado.
 *   2  uso incorrecto (un argumento que esta guardia no conoce).
 *
 * PROPIEDADES QUE HAY QUE CONSERVAR (las prueba tests/guard-migrate.test.ts):
 *   - Solo importa de la biblioteca estándar de Node. Corre en la primera línea
 *     del build, antes de que nada garantice que `node_modules` sirva para algo.
 *   - NUNCA abre la base ni sale a la red (CA-5). La tentación evidente —"ya que
 *     leo la DATABASE_URL, compruebo que responde"— convertiría un fallo de red
 *     en un despliegue no hecho.
 *   - No imprime credenciales (CA-3). El host en el log es lo único que deja
 *     rastro escrito de contra qué base migró este build: no previene, delata.
 */

import { argv, env as entornoDelProceso, exit, stderr, stdout } from 'node:process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Códigos de salida. Contrato público: los consume el `&&` del buildCommand. */
export const SALIDA = { AUTORIZA: 0, RECHAZA: 1, USO: 2 };

/** El permiso explícito que fija SPEC-032 (ADR-018 delega el nombre en la spec). */
export const VARIABLE = 'ALLOW_MIGRATE';

/** Y su único valor que autoriza. Literal, comparado tras recortar espacios. */
export const VALOR_QUE_AUTORIZA = '1';

const USO = `guard-migrate.mjs — decide si ESTE build puede migrar (SPEC-032 / ADR-018 D-2).

  node scripts/guard-migrate.mjs
  node scripts/guard-migrate.mjs --help

No acepta argumentos: decide leyendo solo el entorno.

  VERCEL_ENV     entorno de Vercel. \`production\` autoriza siempre. Su AUSENCIA
                 es un rechazo, no un "no sé, adelante".
  ${VARIABLE}  permiso explícito del entorno. Autoriza con el valor literal
                 \`${VALOR_QUE_AUTORIZA}\` (tras recortar espacios). \`true\`, \`yes\` o \`0\` NO autorizan.
  DATABASE_URL   solo se usa para nombrar host y base en el log. Nunca se abre.

Tabla de decisión:

  VERCEL_ENV=production   cualquier ${VARIABLE}        autoriza
  VERCEL_ENV=<otro>       ${VARIABLE}=${VALOR_QUE_AUTORIZA}              autoriza
  VERCEL_ENV=<otro>       cualquier otra cosa         rechaza
  VERCEL_ENV ausente      ${VARIABLE}=${VALOR_QUE_AUTORIZA}              autoriza
  VERCEL_ENV ausente      cualquier otra cosa         rechaza

Códigos de salida:
  0  autoriza la migración
  1  la rechaza: este entorno no tiene permiso; la base no se ha tocado
  2  uso incorrecto`;

const SIN_ENTORNO = '(ausente)';

/**
 * La decisión, pura: solo mira el objeto de entorno que se le pase.
 *
 * @param {Record<string, string | undefined>} variables
 * @returns {{ autoriza: boolean, entorno: string, motivo: string }}
 */
export function decidir(variables) {
  const vercelEnv = typeof variables.VERCEL_ENV === 'string' ? variables.VERCEL_ENV : null;
  const bruto = variables[VARIABLE];
  const permiso = typeof bruto === 'string' ? bruto.trim() : '';

  if (vercelEnv === 'production') {
    return { autoriza: true, entorno: vercelEnv, motivo: 'es el entorno de producción' };
  }
  if (permiso === VALOR_QUE_AUTORIZA) {
    return {
      autoriza: true,
      entorno: vercelEnv ?? SIN_ENTORNO,
      motivo: `el entorno lo autoriza explícitamente (${VARIABLE}=${VALOR_QUE_AUTORIZA})`,
    };
  }
  return {
    autoriza: false,
    entorno: vercelEnv ?? SIN_ENTORNO,
    motivo:
      vercelEnv === null
        ? 'no hay VERCEL_ENV: no se sabe dónde corre este build'
        : 'este entorno no declara permiso para migrar',
  };
}

/**
 * Host y nombre de base de una cadena de conexión, y NADA más de ella.
 *
 * @param {string | undefined} url
 * @returns {string}
 */
export function describirDestino(url) {
  if (typeof url !== 'string' || url.trim() === '') return 'DATABASE_URL: (ausente)';
  let analizada;
  try {
    analizada = new URL(url);
  } catch {
    return 'DATABASE_URL: (ilegible)';
  }
  const host = analizada.port === '' ? analizada.hostname : `${analizada.hostname}:${analizada.port}`;
  const base = analizada.pathname.replace(/^\/+/, '');
  return `DATABASE_URL: host=${host || '(sin host)'} base=${base || '(sin base)'}`;
}

/** @param {string[]} args */
function main(args) {
  if (args.includes('--help') || args.includes('-h')) {
    stdout.write(`${USO}\n`);
    return SALIDA.AUTORIZA;
  }
  if (args.length > 0) {
    stderr.write(`[guard-migrate] No acepto argumentos (recibido: ${args.join(' ')}).\n\n${USO}\n`);
    return SALIDA.USO;
  }

  const decision = decidir(entornoDelProceso);
  const destino = describirDestino(entornoDelProceso.DATABASE_URL);

  if (decision.autoriza) {
    stdout.write(
      `[guard-migrate] AUTORIZADO: VERCEL_ENV=${decision.entorno} — ${decision.motivo}.\n` +
        `[guard-migrate] ${destino}\n`,
    );
    return SALIDA.AUTORIZA;
  }

  stderr.write(
    `[guard-migrate] RECHAZADO: VERCEL_ENV=${decision.entorno} — ${decision.motivo}.\n` +
      `[guard-migrate] Para autorizarlo, este entorno debe declarar ${VARIABLE}=${VALOR_QUE_AUTORIZA} ` +
      `(valor literal; \`true\`, \`yes\` o \`0\` no valen).\n` +
      '[guard-migrate] La base no se ha tocado: la migración no ha llegado a ejecutarse.\n',
  );
  return SALIDA.RECHAZA;
}

const invocadoDirectamente =
  typeof argv[1] === 'string' && resolve(argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invocadoDirectamente) exit(main(argv.slice(2)));
