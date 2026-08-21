import { failReasonText } from './fail-reason-text';
import type { QuoteFailureReason } from './provider';

/**
 * **Cotización sin refrescar** (SPEC-043, **RN-16**, `docs/fundacion/dominio.md`).
 *
 * Este fichero es **el único sitio** donde el proyecto decide si un precio se ha
 * quedado atrás, y el único donde vive el umbral (CA-12). Las dos pantallas que lo
 * enseñan —`/vigiladas` y `/cartera`— llaman aquí; ninguna de las dos escribe el
 * número. Un segundo literal es la forma más barata de acabar con dos definiciones y
 * una equivocada, y este proyecto ya sabe lo que cuesta: **ADR-026** existe porque
 * cuatro guardias de geometría se copiaron entre sí y dos perdieron la medida buena.
 *
 * ## El problema que resuelve
 *
 * Del **2026-08-19 al 21** el ciclo diario no actualizó ni un precio. La base tenía
 * los trece diagnósticos desde el primer minuto y **ninguna pantalla lo dijo**, porque
 * el aviso de SPEC-016 estaba condicionado a que **no hubiera precio** — y aquí había
 * precio: uno de hace tres días, con la misma tipografía que uno de anoche. **D-2**
 * (*«jamás dar falsa sensación de tiempo real»*) se cumplía en la letra —el `asOf`
 * estaba ahí, en gris— y se incumplía en el fin. El usuario lo cazó **a ojo**.
 *
 * SPEC-016 cerró el silencio del símbolo que **nunca** tuvo precio. Esto cierra el del
 * símbolo que **dejó** de tenerlo.
 *
 * ## Se mide por `updated_at`, y NUNCA por `as_of` (CA-7)
 *
 * Es la decisión central de la spec, está razonada en tres sitios y tiene medición
 * detrás. Si algún día parece más natural medir por `as_of`, esto es lo que hay que
 * releer antes de tocar nada:
 *
 *  - `as_of` es la fecha **de mercado** del precio. Se queda legítimamente en el
 *    viernes durante todo el fin de semana, y en el martes durante un festivo. Medir
 *    por ahí marcaría el universo entero cada sábado.
 *  - `updated_at` es **el momento en que el ciclo escribió la fila**, y se mueve en
 *    **todo ciclo con éxito** —festivo incluido— porque el upsert reescribe la fila
 *    aunque el precio no haya cambiado. Por eso **no hace falta un calendario de
 *    sesiones por mercado**, que la app no tiene y que esta spec se niega a introducir.
 *  - Y un tercer motivo, **medido el 2026-08-21 en una sola llamada**: el proveedor
 *    publica el EOD con **retraso desigual por símbolo** (`APP` traía `date`
 *    `2026-08-19` mientras `AAPL` e `ITX` ya traían `2026-08-20`). Por `as_of` habría
 *    falsos positivos **incluso con calendario**, sobre símbolos que se están
 *    refrescando perfectamente.
 *
 * ## Marcar no es borrar (CA-13)
 *
 * Una cotización sin refrescar **se sigue usando**: el P/L actual (RN-06) y el estado
 * de zona (RN-11) se calculan sobre ella exactamente como antes. Lo único que cambia
 * es que **deja de presentarse como vigente**. Ocultarla sería sustituir una mentira
 * por una pérdida de información.
 */

/**
 * Horas por ciclo de la **cadencia declarada**: uno al día, después del cierre
 * (ADR-004 pto. 1; el cron de `vercel.json` es `0 22 * * *`, todos los días).
 */
export const HORAS_POR_CICLO = 24;

/**
 * El umbral, dicho **en ciclos** y no en horas sueltas (CA-12): **un ciclo perdido**
 * más **medio día de holgura** para un cron que llegue tarde.
 *
 * Por qué 1,5 y no otra cosa, con el precio de cada alternativa (gate del 2026-08-21):
 *  - **1 ciclo (24 h)**: pinta la marca cada vez que el cron se retrasa unas horas.
 *    Demasiado nervioso, y un aviso que se equivoca deja de leerse.
 *  - **1,5 ciclos (36 h)**: dice la verdad —*«anoche no se actualizó»*— a la mañana
 *    siguiente, y con la cadencia diaria declarada da **cero falsos positivos** por
 *    calendario de mercado.
 *  - **2 ciclos (48 h)**: tolera **dos** ciclos perdidos, o sea **dos días mintiendo**.
 *    En el incidente real habría avisado el día 21, el mismo día que el usuario lo cazó
 *    a ojo. No habría servido de nada.
 *
 * **PREMISA, y no es un detalle**: esto supone un **ciclo diario sin saltos**. El día
 * que el ciclo deje de correr algún día de la semana —la idea de saltar los fines de
 * semana, **F-SPEC-043-2**— habrá **72 h de hueco de viernes a lunes** contra un umbral
 * de 36 y la app marcará de golpe **todo** el universo. Quien meta el salto **toca este
 * número en la misma entrega**, o rompe CA-7 el primer sábado. `tests/spec043-sin-
 * refrescar.test.ts` vigila que el cron declarado siga corriendo todos los días.
 */
export const CICLOS_HASTA_SIN_REFRESCAR = 1.5;

/** El umbral de **RN-16**, en horas: 36. Derivado, nunca tecleado dos veces. */
export const UMBRAL_SIN_REFRESCAR_HORAS = HORAS_POR_CICLO * CICLOS_HASTA_SIN_REFRESCAR;

/** El mismo umbral en milisegundos, que es como se compara. */
export const UMBRAL_SIN_REFRESCAR_MS = UMBRAL_SIN_REFRESCAR_HORAS * 60 * 60 * 1000;

/**
 * ¿Está esa cotización **sin refrescar**? (RN-16, CA-7)
 *
 * @param updatedAt cuándo **escribió el ciclo** la fila. `null`/`undefined` = no hay
 *   cotización, que **no** es lo mismo: eso es «sin cotización» y lo dice SPEC-016 con
 *   su propio aviso. Un símbolo que nunca tuvo precio no *dejó* de refrescarse.
 * @param ahora inyectable para que los tests no dependan del reloj.
 */
export function estaSinRefrescar(
  updatedAt: Date | null | undefined,
  ahora: Date = new Date(),
): boolean {
  if (!updatedAt) return false;
  return ahora.getTime() - updatedAt.getTime() > UMBRAL_SIN_REFRESCAR_MS;
}

/** La fecha de la marca, en el mismo formato ISO corto que la columna «A fecha». */
const fecha = (d: Date) => d.toISOString().slice(0, 10);

/**
 * **Lo que el usuario lee**, idéntico en las dos pantallas (CA-12). Vive aquí y no en
 * cada `.tsx` porque dos redacciones parecidas acaban diciendo cosas distintas sobre
 * el mismo hecho.
 *
 * Y cumple **CA-10**: si no hay diagnóstico vigente **no se inventa la causa**. Se dice
 * el hecho —desde cuándo no se escribe esta fila— y se calla lo que no se sabe. Ese
 * caso existe de verdad: es el del ciclo que **nunca llegó a invocarse**, el hueco que
 * `F-SPEC-037-4` dejó declarado y aceptado, y en el que no hay a quién echarle la
 * culpa porque nadie llegó a preguntarle nada al proveedor.
 */
export function marcaSinRefrescar(
  desde: Date,
  reason: QuoteFailureReason | null | undefined,
): string {
  const hecho = `⚠ No se está actualizando desde el ${fecha(desde)}`;
  return reason ? `${hecho} · ${failReasonText(reason)}` : hecho;
}
