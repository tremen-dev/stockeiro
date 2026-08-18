#!/usr/bin/env node
/**
 * check-alive.mjs — ¿está VIVO el código que creo que está vivo?
 *
 * SPEC-031 / ADR-018 D-6. Interroga `/api/version` en un origen y compara su
 * identidad con la esperada. Sustituye al truco del runbook —`curl … | grep -o
 * "forgot-password"`—, que funcionaba una vez, para una spec, si a alguien se le
 * ocurría una cadena que solo existiera tras ese cambio.
 *
 *   node scripts/check-alive.mjs --url <origen> [--commit <sha>] [--timeout <s>] [--interval <s>]
 *
 *   --url <origen>      OBLIGATORIO. Origen de la app (p. ej. https://stockeiro.tremen.dev).
 *   --commit <sha>      Sha que el despliegue debe contener. Sin él, modo *smoke*:
 *                       basta con que la identidad sea legible y no sea `unknown`.
 *   --timeout <s>       Segundos que se espera a que llegue el sha. Por defecto 120.
 *   --interval <s>      Segundos entre intentos. Por defecto 5.
 *   --help              Imprime este contrato.
 *
 * CÓDIGOS DE SALIDA — son parte del contrato, no un detalle de implementación.
 * SPEC-028 tendrá que distinguir "aún no ha llegado" de "este despliegue no sabe
 * de dónde viene", y esa distinción no se puede reconstruir después leyendo un log:
 *
 *   0  El despliegue coincide (o, en modo smoke, sabe de dónde viene).
 *   1  No coincide, o se agotó el plazo esperándolo.
 *   2  El despliegue responde `unknown`: NO sabe de qué commit viene. No es un
 *      desacuerdo de shas — es que ahí no hay metadatos de git que comparar.
 *   3  Uso incorrecto, o respuesta ininteligible (no es JSON, o no es el contrato).
 *
 * PROPIEDADES QUE HAY QUE CONSERVAR (las prueba tests/check-alive.test.ts):
 *   - Solo importa de la biblioteca estándar de Node. Debe poder ejecutarse en un
 *     runner con el repositorio clonado y nada instalado (ADR-018 D-4.1).
 *   - No lee NI UNA variable de entorno y no acepta credenciales: solo habla HTTP
 *     con un endpoint público. Por eso SPEC-028 podrá llamarlo desde un paso sin
 *     secretos.
 *   - Un fallo de red no es un veredicto: reintenta hasta agotar el plazo, porque
 *     un despliegue tarda en propagarse.
 */

const CONTRATO = ['builtAt', 'commit', 'environment'];
const UNKNOWN = 'unknown';

const SALIDA = { COINCIDE: 0, NO_LLEGA: 1, DESCONOCIDO: 2, USO: 3 };

const USO = `check-alive.mjs — comprueba qué código está vivo en un despliegue (SPEC-031).

  node scripts/check-alive.mjs --url <origen> [--commit <sha>] [--timeout <s>] [--interval <s>]

  --url <origen>    OBLIGATORIO. Origen de la app; se consulta <origen>/api/version.
  --commit <sha>    Sha que el despliegue debe contener. Sin él: modo smoke.
  --timeout <s>     Segundos de espera total. Por defecto 120.
  --interval <s>    Segundos entre intentos. Por defecto 5.
  --help            Esto.

Códigos de salida:
  0  coincide (o, sin --commit, la identidad es legible y no es ${UNKNOWN})
  1  no coincide, o se agotó el plazo
  2  el despliegue responde ${UNKNOWN}: no sabe de qué commit viene
  3  uso incorrecto o respuesta ininteligible`;

function fallarPorUso(mensaje) {
  console.error(`[check-alive] ${mensaje}\n\n${USO}`);
  process.exit(SALIDA.USO);
}

function parseArgs(argv) {
  const opciones = { url: null, commit: null, timeout: 120, interval: 5 };

  for (let i = 0; i < argv.length; i += 1) {
    const bandera = argv[i];
    if (bandera === '--help' || bandera === '-h') {
      console.log(USO);
      process.exit(SALIDA.COINCIDE);
    }
    const valor = argv[i + 1];
    switch (bandera) {
      case '--url':
      case '--commit': {
        if (valor === undefined || valor.startsWith('--')) fallarPorUso(`${bandera} necesita un valor.`);
        opciones[bandera.slice(2)] = valor;
        i += 1;
        break;
      }
      case '--timeout':
      case '--interval': {
        const segundos = Number(valor);
        if (!Number.isFinite(segundos) || segundos <= 0) {
          fallarPorUso(`${bandera} necesita un número de segundos mayor que 0 (recibido: ${valor}).`);
        }
        opciones[bandera.slice(2)] = segundos;
        i += 1;
        break;
      }
      default:
        fallarPorUso(`Bandera desconocida: ${bandera}.`);
    }
  }

  if (opciones.url === null) fallarPorUso('Falta --url, que es obligatorio.');
  return opciones;
}

function endpointDe(origen) {
  const limpio = origen.replace(/\/+$/, '');
  return limpio.endsWith('/api/version') ? limpio : `${limpio}/api/version`;
}

/** Un intento. Devuelve el resultado, nunca lanza. */
async function sondear(endpoint, milisegundos) {
  let respuesta;
  try {
    respuesta = await fetch(endpoint, {
      headers: { accept: 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(milisegundos),
    });
  } catch (error) {
    return { tipo: 'red', motivo: error instanceof Error ? error.message : String(error) };
  }

  const cuerpo = await respuesta.text().catch(() => '');
  if (respuesta.status !== 200) {
    return { tipo: 'red', motivo: `HTTP ${respuesta.status}` };
  }

  let json;
  try {
    json = JSON.parse(cuerpo);
  } catch {
    return { tipo: 'ininteligible', motivo: 'la respuesta no es JSON' };
  }

  if (json === null || typeof json !== 'object' || Array.isArray(json)) {
    return { tipo: 'ininteligible', motivo: 'la respuesta no es un objeto JSON' };
  }
  const claves = Object.keys(json).sort();
  if (claves.join(',') !== CONTRATO.join(',') || claves.some((k) => typeof json[k] !== 'string')) {
    return {
      tipo: 'ininteligible',
      motivo: `el cuerpo no es el contrato {${CONTRATO.join(', ')}} (recibido: {${claves.join(', ')}})`,
    };
  }

  return { tipo: 'identidad', identidad: json };
}

function describir(identidad) {
  return `commit=${identidad.commit} environment=${identidad.environment} builtAt=${identidad.builtAt}`;
}

function dormir(milisegundos) {
  return new Promise((listo) => setTimeout(listo, milisegundos));
}

async function main() {
  const { url, commit, timeout, interval } = parseArgs(process.argv.slice(2));
  const endpoint = endpointDe(url);
  const esperado = commit === null ? null : commit.trim().toLowerCase();
  const limite = Date.now() + timeout * 1000;
  const intervalo = interval * 1000;

  let ultimoVisto = null;
  let ultimoMotivo = 'ninguna respuesta';

  for (;;) {
    const restante = Math.max(0, limite - Date.now());
    const resultado = await sondear(endpoint, Math.max(1000, Math.min(intervalo, restante || intervalo)));

    if (resultado.tipo === 'ininteligible') {
      // Reintentar no arregla un contrato roto: eso no es propagación, es otro
      // servicio respondiendo, o el endpoint cambiado sin avisar.
      console.error(`[check-alive] ${endpoint}: ${resultado.motivo}.`);
      process.exit(SALIDA.USO);
    }

    if (resultado.tipo === 'identidad') {
      const { identidad } = resultado;

      if (identidad.commit === UNKNOWN) {
        console.error(
          `[check-alive] ${endpoint}: el despliegue NO sabe de qué commit viene ` +
            `(commit=${UNKNOWN}). No es que el sha discrepe: es que ahí no hay ` +
            'metadatos de git que comparar.\n' +
            `[check-alive] identidad: ${describir(identidad)}`,
        );
        process.exit(SALIDA.DESCONOCIDO);
      }

      if (esperado === null || identidad.commit.trim().toLowerCase() === esperado) {
        console.log(`[check-alive] VIVO en ${endpoint}`);
        console.log(`[check-alive] ${describir(identidad)}`);
        process.exit(SALIDA.COINCIDE);
      }

      ultimoVisto = identidad.commit;
      ultimoMotivo = `el despliegue lleva ${identidad.commit}`;
    } else {
      ultimoMotivo = resultado.motivo;
    }

    const queda = limite - Date.now();
    if (queda <= 0) break;
    await dormir(Math.min(intervalo, queda));
  }

  console.error(
    `[check-alive] Se agotó el plazo (${timeout}s) esperando a ${endpoint}.\n` +
      `[check-alive] esperado:     ${esperado ?? '(cualquier identidad conocida)'}\n` +
      `[check-alive] último visto: ${ultimoVisto ?? '(ninguna identidad legible)'}\n` +
      `[check-alive] último motivo: ${ultimoMotivo}`,
  );
  process.exit(SALIDA.NO_LLEGA);
}

await main();
