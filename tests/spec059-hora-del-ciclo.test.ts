import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  declaraUnaEjecucionDiariaAHoraFija,
  CADENCIAS_QUE_HAY_QUE_CAZAR,
  CADENCIAS_LEGITIMAS,
} from './spec059-hora-del-ciclo';

/**
 * SPEC-059 — **la hora del ciclo se declara una vez, y nada la contradice**.
 *
 * El defecto que trae esta spec no estaba en el código: el ciclo corría bien y traía
 * el cierre de **anteayer**, porque se disparaba a las `0 22 * * *`, antes de que
 * Marketstack publicara el EOD de la sesión. La corrección es **un número de cinco
 * campos** en `vercel.json` — `0 6 * * *`, decidido por el humano en el gate del
 * 2026-09-03 (**ADR-039**) — más todo lo que en el repositorio decía otra cosa.
 *
 * ## Qué puede probar esta suite, y qué no
 *
 * Puede probar **qué hora está declarada** y **que nada la contradiga**. **No** puede
 * probar que el proveedor ya hubiera publicado a esa hora: eso solo se ve en
 * producción, con `cron_runs` y el `as_of` de `quotes`, y es **CA-8** — observación
 * post-deploy escrita como tal en la spec, sin test que finja cubrirla.
 *
 * ## Dónde vive la hora, y quién la puede teclear
 *
 * **ADR-039 pto. 8**: `vercel.json` es el **único** sitio donde vive el valor; todo lo
 * demás o lo **deriva** de ahí o **nombra el fichero que lo posee**. La excepción son
 * las **guardias que congelan** el fichero entero —`tests/deploy-gate-workflow.test.ts`
 * (9.2), `tests/spec-031-frontera.test.ts` (CA-13.2) y
 * `tests/version-bump-gate.test.ts`—, que tienen que llevar el literal porque derivarlo
 * del propio `vercel.json` las dejaría verdes de vacío (CA-3 lo prohíbe con esas
 * palabras). Por eso **este fichero no añade un cuarto literal**: la comparación
 * estructural del fichero entero que CA-1 pide ya la hacen esas tres, y lo que se
 * comprueba aquí son las **propiedades** que sobreviven a que la hora se vuelva a mover
 * —cosa que **ADR-039 pto. 4** deja pactada sin ADR nuevo si CA-8 sale mal—.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** El `crons` que `vercel.json` declara. Único hogar del valor. */
function cronsDeclarados(): { path: string; schedule: string }[] {
  const { crons } = JSON.parse(readFileSync(join(rootDir, 'vercel.json'), 'utf8'));
  return crons;
}

/** La entrada del ciclo diario, con centinela: sin ella no hay nada que afirmar. */
function cronDelCiclo(): { path: string; schedule: string } {
  const encontrado = cronsDeclarados().find((c) => c.path.includes('/cron/refresh'));
  expect(encontrado, 'no hay cron de refresco declarado en vercel.json').toBeTruthy();
  return encontrado!;
}

describe('SPEC-059 CA-2: sigue siendo UNA ejecución al día a hora fija', () => {
  it('el detector caza las cadencias que disfrazan dos ejecuciones de una', () => {
    // Los especímenes están escritos en el CA, no elegidos aquí: `0,30 6 * * *` y
    // `0 */6 * * *`. La primera lista dos minutos; la segunda barre la hora cada seis.
    // Las dos cumplirían un `toContain('6')` y las dos rompen ADR-004 pto. 1.
    for (const schedule of CADENCIAS_QUE_HAY_QUE_CAZAR) {
      expect(declaraUnaEjecucionDiariaAHoraFija(schedule), schedule).toBe(false);
    }
  });

  it('y NO caza las horas fijas legítimas, que son distintas entre sí', () => {
    // La segunda dirección no es adorno (FOUNDATION, 2.º corolario): sin ella la
    // reparación barata es cazar de más. `30 11 * * *` está aquí a propósito: es
    // exactamente el destino que ADR-039 pto. 4 deja pactado si CA-8 sale mal, y este
    // detector no puede ser lo que lo impida.
    for (const schedule of CADENCIAS_LEGITIMAS) {
      expect(declaraUnaEjecucionDiariaAHoraFija(schedule), schedule).toBe(true);
    }
  });

  it('la cadencia declarada en vercel.json es una sola ejecución diaria a hora fija', () => {
    expect(declaraUnaEjecucionDiariaAHoraFija(cronDelCiclo().schedule)).toBe(true);
  });

  it('hay un solo cron: un ciclo, una hora UTC (ADR-039 pto. 9)', () => {
    expect(cronsDeclarados()).toHaveLength(1);
  });
});
