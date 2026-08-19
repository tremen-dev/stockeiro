/**
 * Contenido de las páginas legales (SPEC-035, CE-4).
 *
 * Módulo **puro**: no importa Next, ni Auth.js, ni la base de datos. Esa pureza no
 * es aseo, es el CA-14: las páginas que explican quién opera el servicio y a quién
 * reclamar tienen que responder **con la base caída**, porque ese es exactamente el
 * momento en que alguien las busca. Un `import` inocente aquí rompería esa promesa,
 * y por eso el grafo de imports está bajo test (`tests/legal-import-graph.test.ts`).
 *
 * Que el texto viva en un módulo y no incrustado en el JSX tiene una segunda razón:
 * CA-5 ata la lista de datos guardados al esquema de `src/db/schema.ts` con un test
 * que **fallará a propósito** el día que alguien añada una tabla con `userId`. Para
 * comparar hay que poder leer la lista sin renderizar una página.
 */

/** Las cuatro rutas públicas que esta spec añade (CA-1). Orden de presentación. */
export const RUTAS_LEGALES = [
  '/legal',
  '/legal/aviso-legal',
  '/legal/privacidad',
  '/legal/terminos',
] as const;
