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
 * El TITULAR: la persona física que responde del servicio (CA-3, CA-4).
 *
 * Aquí no hay marcadores de posición. Publicar una app en un foro de bolsa con un
 * hueco sin rellenar en el aviso legal es publicar mintiendo sobre quién responde,
 * así que `tests/e2e/legal.spec.ts` falla si aparece texto de relleno en la página.
 *
 * Que sea una PERSONA y no la marca es la distinción que CA-4 blinda: `tremen.dev`
 * es un nombre de dominio y una marca, y una marca no es sujeto de derecho. Si
 * figurase como responsable se le estarían atribuyendo obligaciones legales a algo
 * que no puede tenerlas.
 */
export const TITULAR = {
  nombre: 'Alberto Fojo Eiras',
  forma: 'persona física',
  domicilio: 'Estrada de Viveiro 62, 15337 Porto do Barqueiro, Mañón, A Coruña',
  contacto: 'hola@tremen.dev',
  dominio: 'stockeiro.tremen.dev',
} as const;

/**
 * La MARCA (CA-11). Paraguas del que Stockeiro es un proyecto — y nada más: nunca
 * titular, nunca responsable, nunca sujeto de una obligación legal.
 */
export const MARCA = {
  nombre: 'tremen.dev',
  url: 'https://tremen.dev',
  linea: 'Stockeiro, un proyecto de tremen.dev',
} as const;

/** El proveedor del que salen los precios (CA-7). Se nombra; no se dice nada más. */
export const FUENTE_DE_PRECIOS = 'Marketstack';

/**
 * El descargo de no asesoramiento, en una línea (CA-9). Va en el pie de TODAS las
 * páginas —públicas y de dentro— porque un descargo que solo vive en la página de
 * términos es un descargo que nadie lee, y quien mira estas pantallas toma
 * decisiones con dinero.
 */
export const DESCARGO_BREVE =
  'Stockeiro no presta asesoramiento financiero ni recomienda operaciones.';

/** El texto completo del descargo (CA-9), coherente con D-1 y D-4 de FOUNDATION. */
export const DESCARGO_COMPLETO: string[] = [
  'Stockeiro no presta asesoramiento financiero, de inversión ni fiscal, y no recomienda ' +
    'operaciones. Nada de lo que muestra —precios, zonas, avisos, resultados de la cartera— ' +
    'es una recomendación de compra o de venta.',
  'La app avisa, no opera. No ejecuta órdenes, no está conectada a ningún bróker y no mueve ' +
    'dinero. Cuando un valor que sigues entra en uno de tus rangos, te lo dice; ahí termina ' +
    'su trabajo.',
  'Las zonas las pones tú. Stockeiro no calcula ni recomienda zonas de compra o de venta: se ' +
    'limita a comparar el último precio conocido con los rangos que has escrito, y a avisarte ' +
    'cuando coinciden.',
  'Las decisiones de inversión son tuyas, y sus consecuencias también. Si necesitas criterio, ' +
    'búscalo en un profesional habilitado para darlo.',
];

/**
 * Qué son los precios que enseña la app (CA-7) y —tan importante— qué NO se dice de
 * ellos (CA-8): se declara la fuente y el carácter informativo del dato, y se para.
 *
 * El porqué de ese "y se para" cambió, aunque el texto no. Nació de R-1: el gate de
 * EPIC-004 decidió publicar con el free tier de Marketstack, que no concedía derechos
 * de uso comercial ni de redistribución. Desde el **2026-08-23 el plan es de pago**
 * —Basic, 10.000/mes— y **sí** los concede (**ADR-032**), así que R-1 quedó disuelto
 * y aun así **aquí no se toca una palabra**. Deliberado: un plan de pago compra
 * **cupo, no exactitud**. Estas tres frases eran correctas cuando el motivo era la
 * licencia y siguen siéndolo ahora que el motivo es la prudencia.
 *
 * El compromiso se escribe en negativo —"sin compromiso de exactitud, continuidad ni
 * disponibilidad"— y no con la palabra que todo el mundo usaría: el motivo está en
 * `tests/legal-afirmaciones-prohibidas.ts`.
 */
export const DATOS_DE_MERCADO: string[] = [
  `Los precios que ves proceden de ${FUENTE_DE_PRECIOS}, un proveedor externo de datos de ` +
    'mercado. Twelve Data interviene solo en la búsqueda de valores por nombre o ticker, no ' +
    'en los precios.',
  'Son precios de cierre diferidos: la última cotización de cierre disponible en el ciclo de ' +
    'actualización, no precios en tiempo real. Cada precio se muestra junto a su fecha de ' +
    'referencia, y esa fecha es la que manda: si es de ayer, el dato es de ayer.',
  'Se ofrecen con carácter meramente informativo. No sustituyen a la información oficial del ' +
    'mercado ni a la de tu bróker, y se sirven sin compromiso de exactitud, continuidad ni ' +
    'disponibilidad.',
];

/**
 * Un tercero que interviene en la prestación del servicio, y para qué (CA-6). La
 * lista sale de la arquitectura —ADR-001 (Vercel/Neon), ADR-006 (Resend), ADR-012
 * (Marketstack), ADR-002/ADR-007 (Twelve Data)— y del runbook de despliegue, no de
 * la memoria de nadie. `id` es por donde el test localiza la fila en la página.
 */
export type Encargado = { id: string; nombre: string; para: string; ve: string };

export const ENCARGADOS: Encargado[] = [
  {
    id: 'vercel',
    nombre: 'Vercel',
    para: 'Alojamiento del sitio y ejecución del código de servidor.',
    ve: 'Los datos técnicos de cada petición (dirección IP, navegador) y lo que viaja en ella.',
  },
  {
    id: 'neon',
    nombre: 'Neon',
    para: 'Base de datos donde se guarda todo lo anterior.',
    ve: 'Todo lo que aparece en la lista de arriba, que es lo que la base de datos almacena.',
  },
  {
    id: 'resend',
    nombre: 'Resend',
    para: 'Envío del correo de avisos y del correo con el enlace de recuperación de contraseña.',
    ve: 'Tu dirección de correo y el contenido del mensaje que se te envía.',
  },
  {
    id: 'marketstack',
    nombre: FUENTE_DE_PRECIOS,
    para: 'Cotizaciones de los valores.',
    ve: 'Nada tuyo: se le piden precios por valor, sin decirle de quién son.',
  },
  {
    id: 'twelve-data',
    nombre: 'Twelve Data',
    para: 'Búsqueda de valores por nombre o ticker.',
    ve: 'El texto que tecleas al buscar un valor. Ni quién eres, ni qué haces después.',
  },
];

/**
 * Los derechos, y el residual honesto (CA-16). La página ENUNCIA la supresión y
 * nombra la ruta; el enlace y la pantalla los entrega SPEC-036. Esa frontera está
 * declarada y hay un test que la vigila: si aquí apareciera un enlace a `/cuenta`
 * antes de que exista la pantalla, sería un enlace roto en una página legal.
 *
 * El residual sale de F-ADR-022-1: el correo ya entregado no vuelve, y decirlo es
 * más útil que prometer un borrado que llega más lejos de donde llega.
 */
export const DERECHOS: string[] = [
  'Puedes acceder a tus datos, corregirlos y borrarlos. Para lo primero no hace falta pedir ' +
    'nada: todo lo que Stockeiro sabe de ti está a la vista en la propia app.',
  'Puedes borrar tu cuenta y todos tus datos desde la propia app, en la pantalla de cuenta ' +
    '(/cuenta). Es inmediato: no hace falta escribir a nadie ni esperar respuesta.',
  'Hay un límite que conviene conocer antes de borrar: los correos que Stockeiro ya te haya ' +
    'enviado no vuelven. Un correo ya entregado vive en el buzón del destinatario y en los ' +
    'registros del proveedor de envío, fuera del alcance de esta app. Borrar tu cuenta borra ' +
    'lo que hay aquí, no lo que ya salió de aquí.',
  `Para cualquier otra cuestión sobre tus datos, escribe a ${TITULAR.contacto}.`,
];

/**
 * Cuánto tiempo se conserva cada cosa (`/legal/privacidad`).
 *
 * El plazo de los enlaces de recuperación es un NÚMERO, y los números de una página
 * legal se copian del código o no se escriben. Decía «caducan solos y a las pocas
 * horas ya no sirven» cuando la ventana real son **30 minutos**
 * (`RESET_TOKEN_TTL_MINUTES` en `src/lib/auth/reset-tokens.ts`, ADR-015 pto. 4). No
 * era falso —a las pocas horas, en efecto, ya no sirven—, pero describía una
 * exposición mayor que la real, y eso en un texto legal juega contra quien lo firma.
 *
 * El número no se importa de allí: este módulo es puro por CA-14 y no puede tener ni
 * un `import`. Se copia, y `tests/legal-textos-veraces.test.ts` comprueba que la
 * copia sigue coincidiendo — el día que cambie la constante, ese test se pone rojo y
 * dice qué frase hay que tocar.
 */
export const CONSERVACION: string[] = [
  'Mientras tengas la cuenta abierta. Los enlaces de recuperación de contraseña son la ' +
    'excepción: caducan solos a los 30 minutos de emitirse y a partir de ahí no sirven, ni ' +
    'aunque alguien los tenga.',
];

/**
 * Qué esperar del servicio (`/legal/terminos`). Aquí se DESCRIBE; no se promete.
 *
 * Este apartado llegó a decir: *«Si el servicio se fuera a interrumpir de forma
 * definitiva, se avisaría por correo con antelación suficiente para que puedas
 * quedarte con lo tuyo»*. Era el único punto de las cuatro páginas donde se prometía
 * algo en vez de describirlo; no lo pedía ningún CA; contradecía al párrafo de al
 * lado («no hay compromiso de servicio»); y comprometía al titular a una obligación
 * que nadie decidió asumir y que además es la más difícil de cumplir justo cuando
 * toca —si el servicio se cae del todo, no queda quien mande el correo—.
 *
 * `tests/legal-afirmaciones-prohibidas.ts` incorpora ahora esa familia de promesas
 * (`con antelación`, `aviso previo`, `se avisaría`) por la misma razón por la que ya
 * prohibía `garant`: allí se prometía exactitud, aquí permanencia.
 */
export const DISPONIBILIDAD: string[] = [
  'Esto es un proyecto personal en fase de pruebas. Puede caerse, puede tardar en actualizar ' +
    'los precios y puede cambiar de un día para otro. No hay compromiso de servicio, ni ' +
    'horario de atención, ni plazo de respuesta.',
  'Tampoco hay compromiso de permanencia: el servicio puede dejar de prestarse, y no hay ' +
    'plazo comprometido para anunciarlo.',
];

/**
 * Cookies y analítica (CA-13). Lo que la página promete se comprueba en la misma
 * prueba que la lee: un navegador anónimo recorre `/legal` y `/login` y se cuentan
 * las cookies que le quedan.
 */
export const COOKIES_Y_ANALITICA: string[] = [
  'Stockeiro no usa analítica de terceros, ni píxeles de seguimiento, ni publicidad. Nadie ' +
    'más se entera de que has estado aquí.',
  'La única cookie que se te fija es la estrictamente necesaria para mantener tu sesión ' +
    'iniciada. Sin ella no podrías entrar, así que no hay consentimiento que pedir ni banner ' +
    'que enseñar.',
  'Las páginas legales no cargan nada de fuera: ni tipografías, ni scripts, ni imágenes de ' +
    'otros servidores. Se pueden leer sin que nadie más se entere.',
];

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
