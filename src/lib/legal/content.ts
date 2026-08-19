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

/**
 * Una categoría de dato personal tal y como se le explica a una persona, atada a la
 * tabla que la guarda. `tabla` es el nombre REAL en Postgres: es lo que permite a
 * CA-5 comparar esta lista con `src/db/schema.ts` y ponerse rojo si divergen.
 */
export type CategoriaDeDato = {
  /** Nombre de la tabla en la base de datos. La bisagra entre el texto y el esquema. */
  tabla: string;
  /** Cómo se llama esto en castellano, para quien lee la página. */
  titulo: string;
  /** Qué se guarda exactamente, sin eufemismos ni omisiones. */
  descripcion: string;
};

/**
 * Lo que Stockeiro guarda de una persona. La lista NO se escribe de memoria: cada
 * entrada corresponde a una tabla del esquema, y `tests/legal-datos-y-esquema.test.ts`
 * comprueba que los dos conjuntos son el mismo en los dos sentidos.
 */
export const CATEGORIAS_DE_DATO: CategoriaDeDato[] = [
  {
    tabla: 'users',
    titulo: 'Cuenta',
    descripcion:
      'Tu dirección de correo electrónico, la huella criptográfica (hash) de tu contraseña ' +
      '—nunca la contraseña en claro—, la fecha en que la cambiaste por última vez, el nivel ' +
      'de acceso de tu cuenta y la fecha de alta.',
  },
  {
    tabla: 'password_reset_tokens',
    titulo: 'Enlaces de recuperación de contraseña',
    descripcion:
      'Cuando pides recuperar el acceso se guarda la huella del enlace enviado, su fecha de ' +
      'caducidad y si ya se usó. El enlace en sí no se almacena en ningún momento.',
  },
  {
    tabla: 'transactions',
    titulo: 'Operaciones de tu cartera',
    descripcion:
      'Las compras, ventas, splits y dividendos que registras o importas desde el extracto de ' +
      'tu bróker: valor, fecha, cantidad, precio, gastos e importe. Son datos financieros tuyos.',
  },
  {
    tabla: 'watched_symbols',
    titulo: 'Acciones vigiladas y sus zonas',
    descripcion:
      'Los valores que sigues y los rangos de precio de compra y de venta que tú defines para ' +
      'cada uno. Las zonas las pones tú; Stockeiro no las calcula ni las sugiere.',
  },
  {
    tabla: 'zone_triggers',
    titulo: 'Episodios de entrada en zona',
    descripcion:
      'El registro interno de cuándo un valor que vigilas entró en una de tus zonas y cuándo ' +
      'salió, con el precio y su fecha de referencia. Es lo que evita avisarte dos veces de lo mismo.',
  },
  {
    tabla: 'notifications',
    titulo: 'Avisos que se te han enviado',
    descripcion:
      'El histórico de avisos generados para ti, con su texto, el canal por el que salieron, si ' +
      'el envío tuvo éxito y si los has marcado como leídos.',
  },
  {
    tabla: 'symbol_aliases',
    titulo: 'Equivalencias aprendidas al importar',
    descripcion:
      'Cuando resuelves a mano a qué valor corresponde una fila del extracto de tu bróker, esa ' +
      'equivalencia se recuerda para no volver a preguntártela. Es tuya y no la reutiliza nadie más.',
  },
];
