'use client';

import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { createPortal } from 'react-dom';
import { dominioDeEnlace, enlacesAbribles } from '@/lib/contexto/abribles';
import { rotuloDeEnlace } from '@/lib/contexto/enlace';
import {
  destinoDeEnlace,
  nombreDeSenalDeEnlaces,
  tituloDeCapaDeEnlaces,
} from '@/lib/contexto/senal';

/**
 * SPEC-067 — **la señal de enlaces: un control, no una imagen**.
 *
 * - **Con 1 enlace abrible, la señal ES el enlace** (CA-3): un `<a target="_blank"
 *   rel="noopener noreferrer">`. Un gesto.
 * - **Con 2 o más, abre la lista en una capa** (CA-5): el mismo vehículo que la capa de
 *   edición —`<dialog>` nativo con `showModal()`, anclado al borde inferior de la ventana
 *   (ADR-030 §1–§2)—, con el número de enlaces a la vista antes de pulsar.
 * - **Con 0 abribles, no hay señal** (CA-10): ni hueco, ni texto muerto.
 *
 * ## Por qué vive en `_components` y no junto a la tabla
 *
 * `/cartera` heredará esta señal en la segunda spec de EPIC-009. El componente no sabe
 * nada de `/vigiladas`: recibe los enlaces, el nombre del activo y su asa de prueba.
 *
 * ## Por qué la capa se monta en `<body>` (portal)
 *
 * La señal vive dentro de la celda «Activo», en un `<span>` dentro de un `<td>` dentro de
 * `.table-scroll`. Un `<dialog>` ahí sería marcado inválido (un bloque dentro de contenido
 * de frase) y quedaría en el subárbol de un contenedor desplazable, donde M1 deja de medir
 * (ADR-030 §1, §5). En `<body>` es hermano de la capa de edición, que es lo que ADR-030
 * pide de todo lo que se abre desde una fila.
 *
 * El portal tiene una trampa conocida: los eventos de React **atraviesan** el portal y
 * suben por el árbol de componentes, no por el del DOM. Así que un clic dentro de la capa
 * llegaría a un manejador de la fila si algún día lo hay. Por eso la señal y la capa
 * cortan la propagación (CA-9).
 *
 * ## Por qué cerrar pasa siempre por `dialog.close()` y el evento `close`
 *
 * Activar un enlace de la lista **cierra la capa** (Decisión, pto. 4). Si se desmontara el
 * `<a>` en el mismo clic, el navegador ya no lo seguiría: un enlace desconectado del
 * documento «no puede navegar». `close()` sólo oculta el `<dialog>`, y el evento `close`
 * llega en una tarea posterior, **después** de que se haya abierto la pestaña. Ahí se
 * desmonta y se devuelve el foco. Escape, el botón *Cerrar* y el clic fuera siguen el
 * mismo camino, así que el foco vuelve a la señal **por cualquier vía** (CA-6).
 *
 * Y no se visita nada (CA-11): ni icono del dominio, ni prefetch, ni previsualización.
 */

export interface EnlaceParaAbrir {
  url: string;
  label: string | null;
}

/** El glifo de enlace. SVG en `currentColor`, no emoji: el emoji cambia de color y de
 *  métrica según el sistema, y un control necesita un contraste que se pueda medir. */
function GlifoEnlace() {
  return (
    <svg
      className="enlaces-glifo"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-.9.9M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.9-.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Corta la subida del evento de React desde la capa, que atraviesa el portal (CA-9). */
const noSubir = (e: SyntheticEvent) => e.stopPropagation();

export function EnlacesSenal({
  enlaces,
  activo,
  testid,
}: {
  enlaces: readonly EnlaceParaAbrir[];
  /** Ticker y mercado, p. ej. «QFIN · NASDAQ». Da nombre a la señal y a la capa. */
  activo: string;
  /** El `data-testid` de la señal en la forma que se está pintando (tabla o tarjeta). */
  testid: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const disparador = useRef<HTMLButtonElement>(null);
  const directo = useRef<HTMLAnchorElement>(null);
  const capa = useRef<HTMLDialogElement>(null);
  const primero = useRef<HTMLAnchorElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const d = capa.current;
    if (!abierta || !d || d.open) return;
    d.showModal();
    // `showModal()` enfoca el primer control de la capa, que depende del orden del
    // marcado. Lo que se pide es el primer ENLACE (CA-8), así que se dice.
    primero.current?.focus();
  }, [abierta]);

  const abribles = enlacesAbribles(enlaces);
  const cuantos = abribles.length;

  /*
    CA-9 — **el gesto sobre la señal no llega a la fila**. Se corta con un escuchador
    NATIVO en la propia señal y no con el `onClick` de React, a propósito: React escucha en
    la raíz del documento, así que su `stopPropagation()` llega tarde para un manejador
    nativo puesto en el `<tr>` o en la tarjeta —el evento ya ha pasado por ellos—. Cortado
    aquí, en el destino, no lo ve nadie de arriba: ni un escuchador nativo ni uno de React.
    La acción por omisión del enlace (abrir la pestaña) no depende de la propagación y
    sigue ocurriendo.
  */
  useEffect(() => {
    const control = cuantos === 1 ? directo.current : disparador.current;
    if (!control) return;
    const alPulsar = (e: Event) => {
      e.stopPropagation();
      if (control.tagName === 'BUTTON') setAbierta(true);
    };
    control.addEventListener('click', alPulsar);
    return () => control.removeEventListener('click', alPulsar);
  }, [cuantos]);

  if (cuantos === 0) return null;

  if (cuantos === 1) {
    const [unico] = abribles;
    const destino = destinoDeEnlace(unico);
    return (
      <a
        ref={directo}
        className="enlaces-senal"
        data-testid={testid}
        data-enlaces={1}
        href={unico.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={destino}
        title={destino}
      >
        <GlifoEnlace />
      </a>
    );
  }

  const nombre = nombreDeSenalDeEnlaces(cuantos, activo);
  const titulo = tituloDeCapaDeEnlaces(activo);

  /** Cualquier cierre acaba aquí, por el evento `close` del `<dialog>`. */
  function alCerrar() {
    setAbierta(false);
    disparador.current?.focus();
  }

  const cerrar = () => capa.current?.close();

  return (
    <>
      <button
        ref={disparador}
        type="button"
        className="enlaces-senal"
        data-testid={testid}
        data-enlaces={cuantos}
        aria-haspopup="dialog"
        aria-label={nombre}
        title={nombre}
      >
        <GlifoEnlace />
        <span className="enlaces-cuenta" aria-hidden="true">
          {cuantos}
        </span>
      </button>
      {abierta &&
        createPortal(
          <dialog
            ref={capa}
            className="enlaces-capa"
            data-testid="enlaces-capa"
            aria-labelledby={tituloId}
            onClose={alCerrar}
            onClick={noSubir}
            onKeyDown={noSubir}
          >
            <div className="enlaces-capa-cabecera">
              <h2 className="enlaces-capa-titulo" id={tituloId}>
                {titulo}
              </h2>
              <button
                type="button"
                className="btn-sm"
                data-testid="enlaces-capa-cerrar"
                onClick={cerrar}
              >
                Cerrar
              </button>
            </div>
            <ul className="enlaces-capa-lista">
              {abribles.map((e, i) => {
                const rotulo = rotuloDeEnlace(e);
                const dominio = dominioDeEnlace(e.href);
                return (
                  <li key={`${i}-${e.href}`}>
                    <a
                      ref={i === 0 ? primero : undefined}
                      className="enlaces-capa-enlace"
                      data-testid="enlaces-capa-enlace"
                      href={e.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={destinoDeEnlace(e)}
                      onClick={cerrar}
                    >
                      <span className="enlaces-capa-rotulo" data-testid="enlaces-capa-rotulo">
                        {rotulo}
                      </span>
                      {/* Sin etiqueta el rótulo YA es el dominio: repetirlo debajo sería
                          ruido, no información (CA-4). */}
                      {rotulo.toLowerCase() !== dominio.toLowerCase() && (
                        <span className="enlaces-capa-dominio" data-testid="enlaces-capa-dominio">
                          {dominio}
                        </span>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          </dialog>,
          document.body,
        )}
    </>
  );
}
