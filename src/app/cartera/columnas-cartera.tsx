import { failReasonText } from '@/lib/market/fail-reason-text';
import { marcaSinRefrescar } from '@/lib/market/sin-refrescar';
import type { PositionView } from '@/lib/portfolio/service';
import type { DiagnosticView } from '@/lib/market/quotes';
import { asa, type Columna } from '../columnas';

/**
 * SPEC-054 / ADR-034 §3 — **las cinco columnas de `/cartera`, descritas una sola vez**.
 *
 * Mismo patrón que `/vigiladas` y **el mismo motivo**: de aquí salen las dos
 * representaciones —la `<table>` de siempre y la lista de tarjetas de por debajo de
 * 720 px— para que no se puedan separar (ADR-034 §3, F-ADR-034-2).
 *
 * Dos diferencias con la tabla de nueve columnas, y las dos son de la pantalla, no del
 * patrón: aquí **no hay estado de zona** —la cartera no tiene zonas, así que la tarjeta no
 * tiene fondo de estado— y **las filas no tienen controles**, así que la tarjeta no tiene
 * pie. `Ticker` es la cabecera y los otros cuatro son pares, en el mismo orden que la
 * tabla.
 *
 * **El P/L actual y el realizado siguen siendo dos magnitudes distintas y así se leen**
 * (D-6, RN-05, RN-06): la tarjeta no los agrega ni los pone en la misma línea.
 */

/** Lo que la descripción necesita de la página para pintar la columna de P/L actual. */
export interface ContextoCartera {
  /** Motivo vigente por el que un símbolo no se puede cotizar, por `symbolId` (SPEC-016). */
  diagnosticos: Record<string, DiagnosticView>;
  /** Cuándo escribió el ciclo la cotización, si dejó de refrescarse (RN-16, SPEC-043). */
  escritaHace: Record<string, Date>;
}

// RN-06 / D-6: sin precio, el P/L actual sigue siendo "—". No se inventa un número.
const dash = (v: string | null) => (v === null ? '—' : v);

export function columnasDeCartera(ctx: ContextoCartera): Columna<PositionView>[] {
  return [
    {
      clave: 'ticker',
      rotulo: 'Ticker',
      sitio: 'cabecera',
      // La clase va en el `<span>` y no en el `<td>` para que el ancla de la fila se llame
      // igual en las dos formas: `.ticker` es lo que identifica una fila tanto en la tabla
      // como en la tarjeta, y una guardia que compare las dos secuencias necesita un solo
      // localizador. El aspecto no cambia: `.data-table .ticker` lo pinta igual.
      valor: (p) => <span className="ticker">{p.ticker}</span>,
    },
    {
      clave: 'cantidad-viva',
      rotulo: 'Cantidad viva',
      sitio: 'par',
      ordenEnLaTarjeta: 1,
      claseCelda: 'num',
      valor: (p) => p.cantidadViva,
    },
    {
      clave: 'coste-medio',
      rotulo: 'Coste medio',
      sitio: 'par',
      ordenEnLaTarjeta: 2,
      claseCelda: 'num',
      valor: (p) => dash(p.costeMedio),
    },
    {
      clave: 'pl-realizado',
      rotulo: 'P/L realizado',
      sitio: 'par',
      ordenEnLaTarjeta: 3,
      claseCelda: 'num',
      valor: (p) => p.realizadoPL,
    },
    {
      clave: 'pl-actual',
      rotulo: 'P/L actual',
      sitio: 'par',
      ordenEnLaTarjeta: 4,
      claseCelda: 'num',
      valor: (p, forma) => (
        <>
          {dash(p.plActual)}
          {/* SPEC-016: el P/L actual sigue siendo "—" cuando no hay precio (RN-06: no se
              inventa), pero deja de ser un guion MUDO — se acompaña del motivo si el
              símbolo no se puede cotizar. */}
          {p.plActual === null && ctx.diagnosticos[p.symbolId] && (
            <span
              className="quote-fail"
              data-testid={asa('fail-reason', forma)}
              data-reason={ctx.diagnosticos[p.symbolId].reason}
            >
              ⚠ {failReasonText(ctx.diagnosticos[p.symbolId].reason)}
            </span>
          )}
          {/* SPEC-043 CA-9 — la otra mitad del defecto. El motivo estaba condicionado a
              `p.plActual === null`, y con una cotización que dejó de refrescarse el P/L
              actual TIENE número: se calcula igual (RN-06 no cambia, CA-13) sobre un
              precio de hace días. La marca no depende de que el P/L falte — depende de
              que el precio no se esté actualizando. */}
          {ctx.escritaHace[p.symbolId] && (
            <span
              className="quote-stale"
              data-testid={asa('sin-refrescar', forma)}
              data-reason={ctx.diagnosticos[p.symbolId]?.reason}
            >
              {marcaSinRefrescar(ctx.escritaHace[p.symbolId], ctx.diagnosticos[p.symbolId]?.reason)}
            </span>
          )}
        </>
      ),
    },
  ];
}
