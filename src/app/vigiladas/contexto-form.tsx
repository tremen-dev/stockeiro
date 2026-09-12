'use client';

import { useActionState, useState } from 'react';
import {
  LIMITE_ENLACES_POR_SIMBOLO,
  LIMITE_ETIQUETA_CARACTERES,
  LIMITE_NOTA_CARACTERES,
  LIMITE_URL_CARACTERES,
} from '@/lib/config/limites-contexto';
import { rotuloDeEnlace } from '@/lib/contexto/enlace';
import { textoDeContexto } from '@/lib/contexto/senal';
import { tieneContexto, type ContextoDeSimbolo } from '@/lib/contexto/service';
import { anadirEnlaceAction, guardarNotaAction, quitarEnlaceAction } from './actions';

/**
 * SPEC-063 — **la nota y los enlaces, dentro del panel que ya abre la fila**.
 *
 * ## Por qué vive aquí dentro y no en una pantalla propia
 *
 * Porque la pregunta que contesta —*¿por qué vigilo yo esto?*— se hace **mirando la
 * fila**, no navegando a otro sitio. ADR-030 ya decidió que lo que abre una fila vive
 * anclado a la ventana; esto se limita a ocupar un sitio más dentro de esa capa, debajo de
 * las zonas. El panel no se rediseña: se le añade un bloque.
 *
 * ## Dos formularios, y no uno
 *
 * La nota y los enlaces se guardan **por separado** a propósito (CA-6): vaciar la nota no
 * puede borrar los enlaces ni al revés, y un fallo al validar una URL no puede hacer que
 * el usuario pierda el párrafo que acaba de escribir. Un solo formulario con todo dentro
 * ataría las dos cosas al mismo envío y al mismo error.
 *
 * ## El texto es TEXTO (CA-12)
 *
 * La nota se pinta como contenido de un elemento —`{nota}`—, que React escapa. Aquí no hay
 * ni habrá `dangerouslySetInnerHTML`: lo que el usuario escriba se **ve**, no se ejecuta.
 * Y los enlaces salen con `rel="noopener noreferrer"`, de modo que la página de destino no
 * recibe referencia a esta ventana ni al sitio desde el que se abrió.
 */
export function ContextoForm({
  watchedId,
  contexto,
}: {
  watchedId: string;
  contexto: ContextoDeSimbolo;
}) {
  const [estadoNota, guardarNota, guardandoNota] = useActionState(guardarNotaAction, undefined);
  const [estadoEnlace, anadirEnlace, anadiendoEnlace] = useActionState(
    anadirEnlaceAction,
    undefined,
  );
  const [nota, setNota] = useState(contexto.note ?? '');

  /*
    **Lo que trae el servidor gana, cuando CAMBIA.**

    El `textarea` es controlado y su estado nace del `contexto` del montaje. Sin esto, un
    panel que se reabre antes de que la revalidación haya llegado se queda enseñando el
    valor viejo **para siempre** —el estado ya está sembrado y las props nuevas no lo
    tocan—, y el usuario ve su nota en blanco después de haberla guardado. Pasó, y lo cazó
    la guardia de CA-5 antes que ningún usuario.

    Se compara contra lo ÚLTIMO que se vio del servidor, no contra lo que hay escrito: así
    la sincronización sólo ocurre cuando el servidor cambia de opinión, y nunca pisa lo que
    alguien está tecleando. Es el ajuste de estado en render que documenta React, no un
    efecto: se aplica antes de pintar y no provoca un parpadeo.
  */
  const [ultimoDelServidor, setUltimoDelServidor] = useState(contexto.note ?? '');
  if (ultimoDelServidor !== (contexto.note ?? '')) {
    setUltimoDelServidor(contexto.note ?? '');
    setNota(contexto.note ?? '');
  }

  const restantes = LIMITE_NOTA_CARACTERES - nota.length;
  const lleno = contexto.enlaces.length >= LIMITE_ENLACES_POR_SIMBOLO;

  return (
    /*
      **Plegado por defecto, y no por gusto.**

      La capa está anclada a la ventana y ADR-030 §1 le exige dejar a la vista la parte
      alta de la lista: es la devolución de contexto que se pagó al sacar el formulario del
      flujo, y SPEC-046 CA-6(f) la mide. Con este bloque desplegado, el panel crecía hasta
      tapar la tabla entera —la guardia de la vecina se puso roja y tenía razón—.

      Plegar **siempre**, y no «sólo cuando está vacío», es lo que hace que la propiedad se
      cumpla también para quien tenga nota y cinco enlaces. Un desplegado condicional habría
      pasado la guardia de hoy y roto la promesa justo para el usuario que más contexto
      tiene, sin que nada lo cazara.

      El resumen dice lo que hay dentro, así que plegado **no es esconder**: se lee lo mismo
      que en la señal de la fila (`textoDeContexto`, un solo sitio).
    */
    <details className="contexto-bloque" data-testid="contexto-bloque">
      <summary className="contexto-resumen" data-testid="contexto-resumen">
        <span className="contexto-titulo">Tu contexto</span>{' '}
        <span className="contexto-cuenta">
          {tieneContexto(contexto) ? textoDeContexto(contexto).toLowerCase() : 'nota y enlaces'}
        </span>
      </summary>
      <p className="contexto-ayuda">
        Es tuyo y privado: Stockeiro lo guarda y te lo enseña, pero no lo usa para nada — ni
        avisa por él, ni abre tus enlaces.
      </p>

      <form action={guardarNota} className="contexto-nota-form">
        <input type="hidden" name="watchedId" value={watchedId} />
        <label htmlFor="contexto-nota">Nota</label>
        <textarea
          id="contexto-nota"
          name="nota"
          rows={4}
          maxLength={LIMITE_NOTA_CARACTERES}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          data-testid="contexto-nota"
          placeholder="Por qué la vigilas, de dónde salen tus zonas, qué esperas de ella…"
        />
        {/*
          CA-14 — el tope se cuenta ANTES de chocar con él, no después. El `maxLength` de
          arriba es cortesía del navegador; el límite de verdad lo aplica el servidor,
          porque esta acción se alcanza sin pasar por este formulario.
        */}
        <p className="contexto-cuenta" data-testid="contexto-nota-cuenta">
          {restantes >= 0
            ? `Te quedan ${restantes} de ${LIMITE_NOTA_CARACTERES} caracteres`
            : `Te has pasado en ${-restantes} caracteres`}
        </p>
        {estadoNota && 'error' in estadoNota && (
          <p className="form-error" role="alert" data-testid="contexto-nota-error">
            {estadoNota.error}
          </p>
        )}
        {/*
          Acuse de recibo, en el sitio donde se hizo el gesto. Sin él, guardar una nota no
          se distingue de no guardarla —el `textarea` tiene el mismo aspecto antes y
          después— y el usuario cierra el panel sin saber si lo suyo está a salvo. Es el
          mismo criterio con el que SPEC-046 puso la confirmación de las zonas DENTRO de la
          capa (CA-13) en vez de al final del documento.
        */}
        {estadoNota && 'ok' in estadoNota && (
          <p className="contexto-guardada" role="status" data-testid="contexto-nota-guardada">
            Nota guardada
          </p>
        )}
        <button className="btn-sm" type="submit" disabled={guardandoNota} data-testid="contexto-nota-guardar">
          {guardandoNota ? 'Guardando…' : 'Guardar nota'}
        </button>
      </form>

      <div className="contexto-enlaces">
        <h4 className="contexto-subtitulo">
          Enlaces{' '}
          <span className="contexto-cuenta">
            ({contexto.enlaces.length} de {LIMITE_ENLACES_POR_SIMBOLO})
          </span>
        </h4>

        {contexto.enlaces.length > 0 && (
          <ul className="contexto-lista" data-testid="contexto-lista-enlaces">
            {contexto.enlaces.map((enlace) => (
              <li key={enlace.id} className="contexto-enlace">
                {/*
                  `target="_blank"` con `rel="noopener noreferrer"`: la pestaña de destino
                  no puede tocar ésta ni saber de dónde viene. Sin etiqueta, el rótulo es
                  su DOMINIO (CA-15) — dato suyo, no un nombre inventado.
                */}
                <a
                  href={enlace.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={enlace.url}
                  data-testid="contexto-enlace"
                >
                  {rotuloDeEnlace(enlace)}
                </a>
                <form action={quitarEnlaceAction}>
                  <input type="hidden" name="enlaceId" value={enlace.id} />
                  <button className="btn-sm" type="submit" data-testid="contexto-enlace-quitar">
                    Quitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={anadirEnlace} className="contexto-enlace-form">
          <input type="hidden" name="watchedId" value={watchedId} />
          <label htmlFor="contexto-url">Dirección</label>
          <input
            id="contexto-url"
            name="url"
            type="text"
            inputMode="url"
            maxLength={LIMITE_URL_CARACTERES}
            placeholder="https://…"
            data-testid="contexto-url"
            disabled={lleno}
          />
          <label htmlFor="contexto-etiqueta">Etiqueta (opcional)</label>
          <input
            id="contexto-etiqueta"
            name="etiqueta"
            type="text"
            maxLength={LIMITE_ETIQUETA_CARACTERES}
            placeholder="TradingView, el hilo del foro…"
            data-testid="contexto-etiqueta"
            disabled={lleno}
          />
          {estadoEnlace && 'error' in estadoEnlace && (
            <p className="form-error" role="alert" data-testid="contexto-enlace-error">
              {estadoEnlace.error}
            </p>
          )}
          {lleno ? (
            <p className="contexto-cuenta" data-testid="contexto-enlaces-lleno">
              Ya tienes {LIMITE_ENLACES_POR_SIMBOLO} enlaces en esta acción; quita uno para
              añadir otro.
            </p>
          ) : (
            <button
              className="btn-sm"
              type="submit"
              disabled={anadiendoEnlace}
              data-testid="contexto-enlace-anadir"
            >
              {anadiendoEnlace ? 'Añadiendo…' : 'Añadir enlace'}
            </button>
          )}
        </form>
      </div>
    </details>
  );
}
