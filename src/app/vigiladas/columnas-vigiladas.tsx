import { failReasonText } from '@/lib/market/fail-reason-text';
import { instrumentTypeText } from '@/lib/market/instrument-type-text';
import { marketName } from '@/lib/market/market-name';
import { marcaSinRefrescar } from '@/lib/market/sin-refrescar';
import {
  fraccionDeBarra,
  nombreAccesibleDeAcercamiento,
  textoDeAcercamiento,
} from '@/lib/watchlist/acercamiento';
import type { ZoneStatusView, ZoneState } from '@/lib/watchlist/zone-status';
import type { DireccionOrden } from '@/lib/watchlist/sort';
import { textoDeContexto } from '@/lib/contexto/senal';
import { tieneContexto, type ContextoDeSimbolo } from '@/lib/contexto/service';
import { asa, type Columna } from '../columnas';
import { removeAction } from './actions';

/**
 * SPEC-054 / ADR-034 §3 — **las nueve columnas de `/vigiladas`, descritas una sola vez**.
 *
 * De aquí salen **las dos** representaciones: la `<table>` de siempre y la lista de
 * tarjetas de por debajo de 720 px. Ni un rótulo ni un valor se escriben dos veces, que
 * es lo único que impide que las dos formas se separen cuando alguien añada una columna
 * (ADR-034 §3, F-ADR-034-2).
 *
 * **El orden de la tarjeta no es el de la tabla, y es a propósito**: el boceto que aprobó
 * el humano el 2026-08-24 lee `Precio → A fecha → Zona compra → Zona venta → Tipo →
 * Mercado`, porque en un teléfono lo primero que se busca es el precio y su fecha. Los
 * **rótulos** sí son literalmente los mismos que los `<th>` (ADR-034 §4), y SPEC-054 CA-6
 * lo comprueba dato a dato.
 */

const LABEL: Record<ZoneState, string> = {
  buy: 'En zona de compra',
  sell: 'En zona de venta',
  both: 'En compra y venta',
  out: 'Fuera de zona',
  none: 'Sin cotización',
};

// SPEC-016 (CE-F2): "sin cotización" ya no es mudo. Si el símbolo NO se puede cotizar, se
// dice y se explica por qué; si simplemente no ha corrido el ciclo, se dice eso otro. Antes
// ambos casos se veían igual — por eso el defecto de cobertura pasó semanas sin detectarse.
const SIN_DATO_AUN = 'Aún sin datos: se ingiere en el próximo ciclo diario';

const zona = (min: string | null, max: string | null) =>
  min !== null && max !== null ? `${min} – ${max}` : '—';

/** `aria-sort` del `<th>`: sólo la columna por la que se ordena AHORA lo declara. */
const ariaSort = (
  activa: boolean,
  direccion: DireccionOrden,
): 'ascending' | 'descending' | 'none' =>
  activa ? (direccion === 'asc' ? 'ascending' : 'descending') : 'none';

/** Lo que la descripción necesita saber del estado de la pantalla para pintarse. */
export interface ContextoVigiladas {
  /** Por qué columna se ordena ahora: marca su `<th>` con `aria-sort`. */
  activoOrdenado: boolean;
  estadoOrdenado: boolean;
  direccion: DireccionOrden;
  /** Abre la capa de edición desde el control de ESA fila (ADR-030 §2). */
  abrir: (id: string, boton: HTMLButtonElement) => void;
  /** SPEC-063 — el contexto de cada símbolo, por `symbolId`. De aquí sale la señal. */
  contextos?: Record<string, ContextoDeSimbolo>;
}

export function columnasDeVigiladas(ctx: ContextoVigiladas): Columna<ZoneStatusView>[] {
  return [
    /* SPEC-041 CA-2: el ticker sigue siendo el ancla y el nombre va DEBAJO, en la misma
       celda. Ninguna columna nueva: la tabla ya tiene nueve. La cabecera es «Activo» y no
       «Valor» (que junto a «Precio» se lee como *value*) ni «Acción» (mentira desde
       ADR-020: hay REIT, ADR y ETF). En la tarjeta, esta columna ES la cabecera. */
    {
      clave: 'activo',
      rotulo: 'Activo',
      sitio: 'cabecera',
      claseCabecera: 'col-activo',
      ariaSort: ariaSort(ctx.activoOrdenado, ctx.direccion),
      valor: (r, forma) => {
        // CA-3 de SPEC-041: sin nombre NO se inventa un nombre. Ni «—», ni «Sin nombre»,
        // ni el `exchange`, ni el ticker repetido: el elemento no se pinta.
        const nombre = (r.name ?? '').trim();
        const contexto = ctx.contextos?.[r.symbolId];
        return (
          <div className="activo-caja">
            <span className="ticker">
              {r.ticker}
              {/*
                SPEC-063 CA-9/CA-10 — **la señal de que esta acción lleva contexto**, en la
                celda que ya identifica la fila y NO en una columna nueva: la tabla de nueve
                columnas no cabe a 730–760 px (mismo motivo que la barra de SPEC-062).

                No la lleva el color ni la forma sola: es un `role="img"` con su frase
                entera, y el glifo va `aria-hidden` porque quien escucha no ve un clip.
              */}
              {contexto && tieneContexto(contexto) && (
                <span
                  className="contexto-senal"
                  data-testid={asa('contexto-senal', forma)}
                  data-nota={contexto.note !== null ? 'true' : undefined}
                  data-enlaces={contexto.enlaces.length}
                  role="img"
                  aria-label={textoDeContexto(contexto)}
                  title={textoDeContexto(contexto)}
                >
                  <span aria-hidden="true">✎</span>
                </span>
              )}
            </span>
            {nombre !== '' && (
              <span className="activo-nombre" data-testid={asa('row-name', forma)}>
                {nombre}
              </span>
            )}
          </div>
        );
      },
    },
    /* SPEC-029: tipo (CA-13) y mercado (CA-14). El mercado sale de `micCode` —la mitad de
       la identidad, ADR-012— y no de `exchange`, que es texto libre del proveedor: con el
       mismo ticker en dos mercados, esta celda es lo único que distingue las dos filas
       (cierra F-SPEC-024-1). Celda VACÍA cuando no se sabe: ni «—» ni un mercado
       inventado. Por eso mismo son pares OBLIGATORIOS de la tarjeta y no columnas
       prescindibles (ADR-034, alternativa rechazada de «esconder columnas»). */
    {
      clave: 'tipo',
      rotulo: 'Tipo',
      sitio: 'par',
      ordenEnLaTarjeta: 5,
      claseCelda: 'muted',
      valor: (r, forma) => (
        <span data-testid={asa('row-type', forma)}>{instrumentTypeText(r.instrumentType)}</span>
      ),
    },
    {
      clave: 'mercado',
      rotulo: 'Mercado',
      sitio: 'par',
      ordenEnLaTarjeta: 6,
      claseCelda: 'muted',
      valor: (r, forma) => (
        <span data-testid={asa('row-market', forma)}>{marketName(r.micCode)}</span>
      ),
    },
    /* SPEC-040 CA-4: la celda de estado deja de estirar la tabla. El culpable no era la
       etiqueta —la más larga, «En compra y venta», cabe en una línea— sino el párrafo del
       motivo de SPEC-016, que se extendía en vez de envolverse. En la tarjeta este valor
       va bajo la cabecera y **conserva su caja acotada de 34ch** (SPEC-054 CA-15): esta
       tabla ya se rompió una vez por esto y el formato tarjeta no es excusa para repetirlo. */
    {
      clave: 'estado',
      rotulo: 'Estado',
      sitio: 'estado',
      claseCabecera: 'col-estado',
      ariaSort: ariaSort(ctx.estadoOrdenado, ctx.direccion),
      valor: (r, forma) => (
        <div className="estado-caja">
          <span className={`zone-label is-${r.state}`} data-state={r.state}>
            <span className="dot" aria-hidden="true" />
            {LABEL[r.state]}
          </span>
          {/* SPEC-062 CA-6 — **lo que le falta al precio**, bajo la etiqueta que dice cómo
              está. Aquí y no en una columna propia: la tabla de nueve columnas ya no cabe a
              730–760 px, y esta celda responde la misma pregunta que la barra.

              El bloque entero es UNA imagen con su texto alternativo (CA-10): la barra es
              forma y la flecha es adorno, así que lo que se anuncia es la frase completa de
              `nombreAccesibleDeAcercamiento` y no «▼ 3,2% hasta compra» leído a trozos. El
              texto sigue VISIBLE, que es lo que impide que la información viaje sólo en la
              forma o sólo en el color.

              `data-porcentaje` lleva el valor EXACTO, sin redondear: es lo que permite que
              la guardia de geometría compare la fracción medida del relleno contra la que
              la función pura calcula para ese mismo dato — dos medidas, nunca una medida
              contra un número escrito a mano (ADR-035).

              Y `data-sin-refrescar` es CA-14: la medida es tan reciente como el precio del
              que sale, así que sobre una cotización que dejó de refrescarse (RN-16) la
              barra se apaga con él. No se borra — marcar no es borrar (SPEC-043). */}
          {r.acercamiento && (
            <div
              className="acercamiento"
              data-testid={asa('acercamiento', forma)}
              data-zona={r.acercamiento.zona}
              data-dentro={r.acercamiento.dentro ? 'true' : 'false'}
              data-sentido={r.acercamiento.sentido ?? undefined}
              data-porcentaje={r.acercamiento.porcentaje}
              data-sin-refrescar={r.sinRefrescar ? 'true' : undefined}
              role="img"
              aria-label={nombreAccesibleDeAcercamiento(r.acercamiento)}
            >
              <span
                className="acercamiento-carril"
                data-testid={asa('acercamiento-carril', forma)}
                aria-hidden="true"
              >
                <span
                  className="acercamiento-relleno"
                  data-testid={asa('acercamiento-relleno', forma)}
                  style={{ width: `${(fraccionDeBarra(r.acercamiento) * 100).toFixed(4)}%` }}
                />
              </span>
              {/* Dentro de zona no se escribe porcentaje: lo dice la etiqueta de arriba
                  (CA-7). Fuera, el número es el dato y nunca se acota, aunque la barra sí
                  (CA-8). */}
              {textoDeAcercamiento(r.acercamiento) !== '' && (
                <span
                  className="acercamiento-texto"
                  data-testid={asa('acercamiento-texto', forma)}
                  aria-hidden="true"
                >
                  {textoDeAcercamiento(r.acercamiento)}
                </span>
              )}
            </div>
          )}
          {r.state === 'none' && (
            <p
              className={r.failReason ? 'quote-fail' : 'quote-pending'}
              data-testid={asa(r.failReason ? 'fail-reason' : 'sin-datos-aun', forma)}
              data-reason={r.failReason ?? undefined}
            >
              {r.failReason ? `⚠ No se vigila: ${failReasonText(r.failReason)}` : SIN_DATO_AUN}
            </p>
          )}
          {/* SPEC-043 CA-8 — la marca es INDEPENDIENTE del estado de zona: una cotización
              que dejó de refrescarse SÍ tiene precio y SÍ tiene estado (RN-16, D-2). Y
              sigue siendo excluyente con el bloque de arriba sin decirlo: sin cotización
              no hay `updatedAt`, y sin `updatedAt` no se ha dejado de refrescar nada. */}
          {r.sinRefrescar && r.updatedAt && (
            <p
              className="quote-stale"
              data-testid={asa('sin-refrescar', forma)}
              data-reason={r.failReason ?? undefined}
            >
              {marcaSinRefrescar(r.updatedAt, r.failReason)}
            </p>
          )}
        </div>
      ),
    },
    {
      clave: 'precio',
      rotulo: 'Precio',
      sitio: 'par',
      ordenEnLaTarjeta: 1,
      claseCelda: 'num',
      valor: (r) => r.price ?? <span className="muted">—</span>,
    },
    /* RN-12 y el no-negociable D-2 de FOUNDATION («mostrar siempre el `asOf` / carácter
       diferido del dato»): «A fecha» es par OBLIGATORIO de la tarjeta. Es uno de los
       motivos por los que el patrón elegido no esconde columnas. */
    {
      clave: 'a-fecha',
      rotulo: 'A fecha',
      sitio: 'par',
      ordenEnLaTarjeta: 2,
      claseCelda: 'num muted',
      valor: (r) => (r.asOf ? r.asOf.toISOString().slice(0, 10) : '—'),
    },
    {
      clave: 'zona-compra',
      rotulo: 'Zona compra',
      sitio: 'par',
      ordenEnLaTarjeta: 3,
      claseCelda: 'num',
      valor: (r) => zona(r.buyMin, r.buyMax),
    },
    {
      clave: 'zona-venta',
      rotulo: 'Zona venta',
      sitio: 'par',
      ordenEnLaTarjeta: 4,
      claseCelda: 'num',
      valor: (r) => zona(r.sellMin, r.sellMax),
    },
    /* La columna sin rótulo. En la tarjeta es el PIE, con *Editar* y *Quitar* repartidos
       al 50 % en una sola fila (decisión del humano del 2026-08-24, ADR-034 §10): mantiene
       la tarjeta corta, que es lo que importa con cuarenta vigiladas. Cuando llegue la
       tercera acción (SPEC-045) la salida es APILAR, nunca encoger ni esconder. */
    {
      clave: 'acciones',
      rotulo: '',
      ariaLabel: 'acciones',
      sitio: 'acciones',
      valor: (r, forma) => (
        <div className={forma === 'tarjeta' ? 'fila-acciones tarjeta-pie' : 'fila-acciones'}>
          {/* SPEC-044 CA-19: el control de edición vive EN SU FILA y lleva el id de esa
              fila. Reordenar no lo afecta, por el mismo motivo que no afecta a «Quitar».
              SPEC-046 / ADR-030 §2: declara `aria-haspopup="dialog"` y NO `aria-expanded`;
              ya no es un desplegable en flujo. El elemento que se pasa a `abrir` es ESTE
              botón: es al que vuelve el foco al cerrar la capa. */}
          <button
            className="btn-sm"
            type="button"
            data-testid={asa('editar-zonas', forma)}
            data-watched-id={r.id}
            aria-haspopup="dialog"
            onClick={(e) => ctx.abrir(r.id, e.currentTarget)}
          >
            Editar
          </button>
          <form action={removeAction}>
            {/* SPEC-024: viaja el id de la ACCIÓN VIGILADA (el mismo que la fila usa como
                key), no el ticker: dos mercados del mismo ticker son dos vigiladas
                distintas (ADR-007). Y por eso reordenar no lo afecta (CA-18): lo que viaja
                es la identidad de SU fila, no su posición en la lista. */}
            <input type="hidden" name="watchedId" value={r.id} />
            <button className="btn-sm" type="submit">
              Quitar
            </button>
          </form>
        </div>
      ),
    },
  ];
}
