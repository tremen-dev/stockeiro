/**
 * **El conjunto de rutas que la guardia de geometría mide.**
 *
 * ## Por qué vive aquí y no dentro de la guardia
 *
 * Porque hay que poder **afirmarlo sin arrancar el navegador**. SPEC-054 CA-11 mete
 * `/cartera` en el conjunto, y una lista escrita dentro de un `.spec.ts` de Playwright no
 * se puede importar desde un test unitario sin ejecutar de paso todos sus `test()`. Así
 * que la lista se saca a un módulo sin dependencias de Playwright: la guardia la importa
 * para recorrerla y `tests/spec054-breakpoint-y-rutas.test.ts` la importa para exigir que
 * `/cartera` siga en ella. **Retirar una ruta se ve en rojo, no en silencio.**
 *
 * ## Lo que este fichero NO resuelve, y conviene no confundir
 *
 * **CE-2 de EPIC-007 pide más que esto**: que el conjunto de rutas que la guardia mide sea
 * el conjunto de rutas que el usuario puede alcanzar, **derivado por un test y no
 * mantenido a mano**. Esto sigue siendo una lista mantenida a mano; lo único que cambia es
 * que ahora está en un sitio donde un test la puede leer. Con `/cartera` dentro son
 * **diez** rutas medidas de dieciséis. Cerrar CE-2 entero es la tercera spec de EPIC-007
 * (SPEC-054, nota 8 del gate): que nadie lea CA-11 como si lo saldara.
 */

/** Lo primero que ve alguien que llega del foro. Sin cookie de sesión. */
export const RUTAS_PUBLICAS = ['/', '/ayuda', '/legal', '/login', '/register'] as const;

/** Lo que alcanza un tester una vez dentro (CE-2 de EPIC-004: ni Cartera ni Importar). */
export const RUTAS_CON_SESION = ['/dashboard', '/vigiladas', '/avisos', '/cuenta'] as const;

/**
 * Lo que **sólo** alcanza un usuario completo, y que por eso no cabía en la lista de
 * arriba: la cuenta con la que se mide `RUTAS_CON_SESION` es de rol `tester`.
 *
 * `/cartera` entra aquí por **SPEC-054 CA-11 / ADR-034 §9**. No es un CA suelto: es la
 * corrección de un agujero de la misma familia que el hueco 700–760 que descubrió
 * SPEC-040, sólo que más grande. Una de las dos tablas del producto **no se medía a ningún
 * ancho** —y llevaba así desde SPEC-002— no por un hueco entre dos anchos, sino por
 * ausencia de la superficie entera.
 *
 * Y se mide **con posiciones**: `/cartera` sin operaciones pinta el estado vacío, que es
 * una pantalla distinta y no tiene tabla dentro. Medir la vacía sería medir el caso en el
 * que el defecto no puede existir (ADR-030 §4 aplicado a una ruta).
 */
export const RUTAS_CON_POSICIONES = ['/cartera'] as const;

/** Todas las rutas que la guardia recorre hoy, sea cual sea la sesión que necesiten. */
export const RUTAS_MEDIDAS = [
  ...RUTAS_PUBLICAS,
  ...RUTAS_CON_SESION,
  ...RUTAS_CON_POSICIONES,
] as const;
