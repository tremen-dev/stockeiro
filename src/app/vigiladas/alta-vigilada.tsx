'use client';

import { useRef, useState } from 'react';
import { WatchForm } from './watch-form';

/**
 * SPEC-041 CA-12 a CA-16 — **cuándo está a la vista el formulario de alta**.
 *
 * ## El reparto de territorio con SPEC-040, escrito donde se toca
 *
 * `WatchForm` tiene dos dueños y conviene no confundirlos:
 *
 *  - **SPEC-040 (EPIC-FIX) decide cuánto MIDE**: anchos, `min-width`, cómo encogen el
 *    buscador y los campos de zona, el módulo compartido de geometría. Este componente
 *    **no toca ni una** de esas líneas: monta el formulario tal cual, sin envolverlo en
 *    ninguna caja que le imponga un ancho.
 *  - **SPEC-041 decide cuándo está EN EL DOM**: aquí.
 *
 * El punto de contacto es un estado que **no existía** antes de esta spec —«lista con
 * filas + alta desplegada»— y lo cubre CA-22 en `tests/e2e/vigiladas-alta.spec.ts`:
 * hasta ahora el formulario estaba siempre en el DOM y la barrida de la guardia lo
 * alcanzaba sola; a partir de ahora hay un estado que sólo existe tras un clic, y una
 * medida que no diera ese clic dejaría de verlo. Crear ese punto ciego sería justo el
 * fallo silencioso que ADR-026 vino a matar.
 *
 * ## Las dos reglas, y por qué la primera no es negociable
 *
 *  - **Lista vacía → desplegado y sin control intermedio** (CA-12). No es preferencia
 *    estética: `VACIO_VIGILADAS.primerPaso` (SPEC-039, `src/lib/help/content.ts`) dice
 *    literalmente «**Empieza aquí abajo**…». Es una promesa de POSICIÓN. Un formulario
 *    plegado ahí —o un botón que haya que pulsar entre el texto y el formulario— deja a
 *    la app **mintiendo por escrito** a quien acaba de llegar.
 *  - **Con lista → plegado tras «+ Vigilar una acción»** (CA-13). El que gana sitio es
 *    quien ya tiene lista, que es quien lo pedía; el que llega con cero no ve ningún
 *    cambio respecto a antes.
 *
 * Se descartaron un panel lateral y un modal (la app no tiene hoy ninguno de los dos, y
 * el buscador ya abre su propio desplegable: sería un *popover* dentro de un *popover*),
 * una página aparte (rompe el flujo de dar de alta varias seguidas) y «formulario sólo
 * si la lista está vacía» (hace desaparecer el control justo cuando el usuario acaba de
 * aprender a usarlo).
 */
export function AltaVigilada({ listaVacia }: { listaVacia: boolean }) {
  /*
    Estado inicial = «desplegado si llegué con la lista vacía». Y se queda como estado
    del cliente a propósito: cuando el alta tiene éxito, el servidor revalida y la lista
    pasa de 0 a 1 (o de 1 a 2) filas, pero este componente NO se remonta, así que el
    formulario sigue desplegado y limpio, listo para la siguiente (CA-15). Un alta con
    éxito no es motivo para plegar; un error, tampoco — el mensaje quedaría escondido
    detrás de un panel cerrado.
  */
  const [abierto, setAbierto] = useState(listaVacia);
  const caja = useRef<HTMLDivElement>(null);

  if (listaVacia) {
    // Sin control intermedio: el texto de SPEC-039 apunta AQUÍ ABAJO y aquí abajo está.
    return <WatchForm />;
  }

  function alternar() {
    const siguiente = !abierto;
    setAbierto(siguiente);
    if (siguiente) {
      // El buscador recibe el foco al desplegar (CA-13c). Va tras el repintado porque el
      // campo aún no existe en el DOM cuando este manejador corre.
      requestAnimationFrame(() => {
        caja.current?.querySelector<HTMLInputElement>('.symbol-search-input')?.focus();
      });
    }
  }

  return (
    <div className="alta-vigilada" ref={caja}>
      <button
        type="button"
        className="btn alta-toggle"
        data-testid="alta-toggle"
        aria-expanded={abierto}
        aria-controls="alta-panel"
        onClick={alternar}
      >
        {abierto ? '− Cerrar' : '+ Vigilar una acción'}
      </button>
      {/*
        Plegar DESMONTA el formulario, no lo esconde (CA-16): al volver a desplegarlo
        aparece vacío, sin símbolo elegido y sin zonas. Plegar descarta, no guarda un
        borrador — la misma semántica que el reset tras un alta con éxito, dicha aquí
        para que no sea una sorpresa. Y desmontarlo es además lo que hace verdad el
        «no está en pantalla, ni sus campos ni el buscador» de CA-13(a).
      */}
      {abierto && (
        <div id="alta-panel">
          <WatchForm />
        </div>
      )}
    </div>
  );
}
