---
id: SPEC-064
tipo: spec
epica: EPIC-FIX
estado: hecho
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-09-13, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-13, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-09-13, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-09-13, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-09-13, por: sdd-verificador}
---
# SPEC-064 — El bloque de contexto se pinta sobre el vacío: la capa no tiene fondo, y sólo la tarjeta de zonas lo tenía

## Problema

En producción, desde la 0.7.0: al desplegar **«Tu contexto»** dentro del panel de una
vigilada, **el texto se lee encima de la tabla**. La nota, los rótulos y los campos se
superponen con las filas de detrás, y no se distingue qué pertenece a qué.

Observado por el humano sobre la pantalla real el **2026-09-13**, con captura:

> *«se ve bastante mal, parece que tiene el fondo transparente y no se distingue bien»*

**Y tiene el fondo transparente.** La causa está escrita en el propio código desde
SPEC-046, y es correcta para lo que se diseñó entonces:

```css
/* …la capa va **sin relleno, sin borde y sin fondo**: lo que se ve es la tarjeta de
   siempre, y la capa y el formulario miden lo mismo. */
dialog.editar-vigilada { background: transparent; … }
```

El `<dialog>` **no pinta nada**: la superficie que se ve es la **tarjeta del formulario de
zonas** (`.card.auth-form`), que sí tiene `background: var(--bg-elev)` y su borde. Mientras
la capa contuvo **sólo** ese formulario, la decisión fue invisible y correcta.

**SPEC-063 metió un segundo bloque dentro de la capa y fuera de esa tarjeta.** Ese bloque
—`.contexto-bloque`— no declara superficie propia, así que se pinta sobre el `::backdrop`
translúcido y lo que hay detrás **se lee a través de él**. No es un problema de contraste
del texto: es que **no hay nada debajo**.

Dos cosas que conviene separar, porque la segunda es la que importa para que esto no
vuelva:

1. **El defecto concreto**: un bloque sin fondo. Se arregla dándole la superficie de la
   tarjeta.
2. **El agujero de método**: la batería medía **desborde** (M1/M2), **área táctil** (M5),
   **contraste del texto de la TABLA con el velo puesto** (SPEC-046 CA-6f) y **qué se ve
   por encima de la capa** — y ninguna de esas medidas mira si **lo que está DENTRO de la
   capa tiene algo debajo**. Por eso la suite entera pasó en verde, dos veces, sobre una
   pantalla que un humano describe como ilegible. El siguiente bloque que alguien añada a
   esa capa caería en lo mismo.

## Usuarios / roles afectados

- **Usuario final**: hoy, cualquiera que despliegue su contexto en `/vigiladas` ve una
  pantalla ilegible. Es la superficie que EPIC-004 puso delante de testers.
- **Sistema**: nada. Ni datos, ni cálculos, ni avisos: esto es puramente cómo se pinta.

## Criterios de aceptación

- **CA-1 (Todo lo que la capa muestra tiene superficie opaca debajo).**
  Con el panel abierto y **el bloque de contexto desplegado**, cada bloque de contenido de
  la capa tiene, en su cadena de ancestros **dentro de la capa**, un fondo **opaco**
  (alfa = 1). La medida es la que ya existe: recorrer ancestros componiendo colores hasta
  encontrar un fondo no translúcido, la misma técnica de SPEC-046 CA-6(f).
  **Enunciado como propiedad de la CAPA, no de este bloque**: se recorre lo que la capa
  contenga, de modo que el próximo bloque que alguien añada quede vigilado sin tocar la
  guardia.

- **CA-2 (La guardia se pone roja con el defecto de hoy).**
  La prueba de eficacia (ADR-026 §7): inyectado `background: transparent` en el bloque de
  contexto, **CA-1 falla**; retirado, pasa. Sin esto, CA-1 podría estar verde por mirar el
  sitio equivocado — que es exactamente lo que ha pasado hasta hoy con las otras cuatro
  medidas.

- **CA-3 (El texto de la capa se lee sobre su propia superficie).**
  El contraste del texto del bloque contra el fondo **compuesto** que tiene debajo cumple
  el mínimo que el producto ya exige en `/vigiladas` (el de SPEC-046 CA-6f, 4,5:1). Se
  afirma con el mismo cálculo, no con uno nuevo.

- **CA-4 (Lo que la capa ya prometía sigue en pie).**
  Con el arreglo puesto: la lista **se sigue viendo** por encima de la capa (ADR-030 §1,
  SPEC-046 CA-6f) —también con el bloque desplegado y lleno, que es la guardia que añadió
  SPEC-063—, el foco vuelve a su fila al cerrar, M1/M2/M3 siguen limpias a los ocho anchos
  y ningún control baja del suelo táctil.

- **CA-5 (Cero regresión).**
  Batería completa verde y ninguna guardia ajena aflojada ni borrada. Se verifica en el
  gate, no con una guardia congelada (ADR-031, ADR-037).

## Entidades y reglas afectadas

- **Sólo CSS.** Ni esquema, ni migración, ni dominio, ni reglas nuevas. El bloque de
  contexto recibe la **misma superficie** que la tarjeta de zonas —`var(--bg-elev)` y
  `var(--line)`, los tokens del sistema— y se presenta como continuación de la hoja, no
  como una tarjeta flotante aparte.
- **No se toca `dialog.editar-vigilada { background: transparent }`**: esa decisión es de
  SPEC-046 y sigue siendo correcta —la capa mide lo que mide su contenido—. Lo que faltaba
  era que **cada** bloque de contenido traiga la suya.

## Fuera de alcance

- Rediseñar el panel, cambiar su anclaje o su acotado (ADR-030, SPEC-063).
- Tocar el velo (`::backdrop`), que SPEC-046 midió y sigue cumpliendo.
- Cualquier retoque de espaciado o tipografía que no sea consecuencia directa de dar
  superficie al bloque.

## Notas para el gate humano

1. **Es un defecto de producción de la 0.7.0**, mergeada hace minutos. Entra por EPIC-FIX
   porque **SPEC-063 está en `hecho` y no se reabre** (ADR-025).
2. **Lo que de verdad se compra aquí es CA-1 + CA-2**, no el arreglo: el arreglo son tres
   líneas de CSS. Lo que costó dinero fue que **cuatro familias de medidas** dieran verde
   sobre una pantalla ilegible, y eso sólo se cierra con una guardia que mire **si hay algo
   debajo de lo que se pinta**.
3. **Firmado el 2026-09-13 con el arreglo ya visto en pantalla**, y con alcance completo
   —arreglo **y** guardia—. En la revisión visual apareció un segundo defecto de la misma
   familia, y entra aquí: **los enlaces salían en el azul por defecto del navegador**, no en
   el acento de la app. Es el mismo patrón —un bloque nuevo que no hereda lo que el producto
   ya tiene— y por eso no se va a otra spec.
