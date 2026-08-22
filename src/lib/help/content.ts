import { OPERATING_MICS, type OperatingMic } from '@/lib/market/mic';
import { marketName } from '@/lib/market/market-name';
import { FAIL_REASON_TEXT } from '@/lib/market/fail-reason-text';
import type { QuoteFailureReason } from '@/lib/market/provider';

/**
 * Contenido de la ayuda (SPEC-039, CE-1). Hermano de `src/lib/legal/content.ts` y
 * con la misma división del trabajo: el texto vive en un módulo y la página solo lo
 * pinta, para que se pueda comparar con el código **sin renderizar nada**.
 *
 * Pero este módulo NO es puro como el legal, y la diferencia es el punto entero de
 * CA-6 y CA-8: la ayuda **deriva** del código lo que no puede permitirse escribir de
 * memoria — la lista de mercados sale de `OPERATING_MICS` y los motivos de «sin
 * cotización» de `QuoteFailureReason`. Un módulo puro habría exigido copiarlos, y
 * copiarlos es exactamente cómo la ayuda mintió durante semanas prometiendo mercados
 * que el proveedor no servía (EPIC-FIX, CE-F2).
 *
 * Lo que sí conserva de su hermano es la propiedad que CA-14 exige: **ni base de
 * datos ni sesión**. Los tres módulos de los que bebe (`mic`, `market-name`,
 * `fail-reason-text` → `provider`) son conocimiento de dominio sin un solo `import`
 * de infraestructura, y `tests/ayuda-import-graph.test.ts` lo vigila.
 */

/** La ruta de la ayuda. Se escribe una vez y se enlaza desde aquí. */
export const RUTA_AYUDA = '/ayuda';

export type Seccion = {
  /** Ancla y `data-testid` de la sección en la página. */
  id: string;
  titulo: string;
  parrafos: string[];
};

/**
 * **La frase de la cadencia (CA-3).** Una sola, literal, y las tres pantallas la
 * repiten: la primera pantalla, la ayuda y el estado vacío de `/vigiladas`.
 *
 * Que sea UNA constante y no tres textos parecidos es deliberado. **R-4** dice que
 * el público de un foro de bolsa espera otra cosa y que, si no se le dice alto, el
 * feedback que vuelva será «no actualiza» y se habrá gastado la publicación. Decirlo
 * una vez, en la ayuda, no sirve: nadie lee la ayuda antes de quejarse. Sí, es
 * redundante; la redundancia es el punto (nota 2 del gate).
 *
 * **D-2 es locked**: esto COMUNICA el diseño, no lo negocia. Ni un «próximamente».
 */
export const CADENCIA_LINEA =
  'Los precios son de cierre y se refrescan una vez al día, después del cierre de ' +
  'mercado. Esto no es tiempo real: cada precio lleva al lado la fecha a la que ' +
  'corresponde, y esa fecha es la que manda.';

/** Cuántos mercados dice la PROSA que hay. Ver `tests/ayuda-contenido.test.ts`. */
export const MERCADOS_EN_PROSA = { cifra: 7, palabra: 'siete' } as const;

export const CADENCIA: Seccion = {
  id: 'cadencia',
  titulo: 'Cada cuánto se mira el mercado',
  parrafos: [
    CADENCIA_LINEA,
    'Hay un solo ciclo diario: se piden los precios de todo lo que alguien vigila, se ' +
      'comparan con las zonas y se emiten los avisos que toquen. Entre ciclo y ciclo la ' +
      'pantalla enseña el mismo precio, porque es el último que se conoce.',
    'Consecuencia que conviene saber antes de usar esto: un valor que entra en tu zona a ' +
      'media sesión y sale antes del cierre puede no aparecer, porque lo que se compara es ' +
      'el cierre. Stockeiro está pensado para zonas anchas y plazos largos, no para seguir ' +
      'una sesión minuto a minuto.',
  ],
};

export const ZONAS: Seccion = {
  id: 'zonas',
  titulo: 'Qué es una zona',
  parrafos: [
    'Una zona es un rango de precio: un mínimo y un máximo. No es un valor puntual ni un ' +
      'umbral — escribes entre qué dos precios te interesa que te avisen, y el mínimo no ' +
      'puede ser mayor que el máximo.',
    'Cada acción vigilada puede tener zona de compra, zona de venta, las dos o ninguna. Son ' +
      'etiquetas independientes y opcionales: puedes seguir un valor sin ninguna zona solo ' +
      'para verlo en la lista, o poner solo una de las dos. Tampoco se exige que la de ' +
      'compra esté por debajo de la de venta; son tuyas y las ordenas tú.',
    'Se entra en zona cuando el precio del ciclo cae dentro del rango, con los extremos ' +
      'incluidos: si tu zona de compra es 20 – 25, un precio de 20 ya está dentro, y uno de ' +
      '25 también.',
    'Las zonas las pones tú. Stockeiro no las calcula, no las sugiere y no las recomienda: ' +
      'se limita a comparar el último precio conocido con los rangos que has escrito. Tráete ' +
      'los números de donde los saques; aquí solo se vigilan.',
  ],
};

export const AVISOS: Seccion = {
  id: 'avisos',
  titulo: 'Cuándo llega el aviso, y de qué tipo',
  parrafos: [
    'Hay dos tipos y no se confunden. El aviso de entrada es individual: se emite la vez ' +
      'que una acción entra en una de tus zonas, y no se repite mientras siga dentro. Si ' +
      'sale de la zona y vuelve a entrar más adelante, eso es una entrada nueva y sí se ' +
      'avisa otra vez.',
    'El aviso de permanencia es un resumen: uno al día por persona, con todo lo que sigue ' +
      'dentro de su zona. Sirve para acordarse de lo que lleva días esperando sin llenar el ' +
      'buzón con lo mismo cada mañana.',
    'La zona de compra y la de venta se evalúan por separado, así que una acción con las dos ' +
      'puede avisarte por una sin decir nada de la otra.',
    'Todo aviso queda registrado en tu bandeja de Avisos, aunque el correo no llegue a ' +
      'salir. La bandeja es la fuente de verdad; el correo es la comodidad de no tener que ' +
      'abrir la app. Si un envío falla, el aviso sigue ahí y la bandeja lo marca.',
  ],
};

export const PRECIOS: Seccion = {
  id: 'precios',
  titulo: 'Qué precio se compara',
  parrafos: [
    'El precio que ves —y contra el que se comparan tus zonas— es el último precio de ' +
      'cierre no ajustado del valor, con la fecha a la que corresponde escrita al lado.',
    'No ajustado quiere decir que la serie no se retoca por splits ni por dividendos. Es la ' +
      'misma base con la que tú miras un gráfico y escribes una zona, así que comparar una ' +
      'cosa con la otra tiene sentido. Si un valor hace un split, sus zonas se quedan donde ' +
      'estaban y te toca reescribirlas.',
    'Los precios los sirve un proveedor externo, con carácter informativo. No sustituyen a ' +
      'la información oficial del mercado ni a la de tu bróker.',
  ],
};

export type Mercado = { mic: OperatingMic; nombre: string };

/**
 * Los mercados que la ayuda nombra (CA-6). **Derivados** de `OPERATING_MICS` y
 * nombrados con `marketName`, que es el mismo par de módulos que alimenta la tabla
 * de `/vigiladas` y el buscador. Así es imposible que la ayuda ofrezca un mercado
 * que el producto no cubre, o que se olvide de uno que sí.
 */
export const MERCADOS: Mercado[] = OPERATING_MICS.map((mic) => ({
  mic,
  nombre: marketName(mic),
}));

export const MERCADOS_SECCION = {
  id: 'mercados',
  titulo: 'Qué mercados hay detrás',
  intro:
    `Estos ${MERCADOS_EN_PROSA.palabra} y solo estos. Si un valor cotiza en otra plaza, el ` +
    'buscador no te lo ofrece; y si te lo ofreciera, no habría precio que comparar con tu ' +
    'zona. Preferimos decirlo aquí antes de que lo descubras buscando.',
  cierre:
    'El mismo ticker en dos mercados distintos son dos valores distintos, cada uno con su ' +
    'divisa y su precio: por eso el buscador te hace elegir la plaza y la lista de vigiladas ' +
    'enseña una columna de mercado.',
} as const;

export type MotivoSinPrecio = {
  /** `QuoteFailureReason` para los cinco del dominio; `aun_sin_datos` para el sexto. */
  id: string;
  titulo: string;
  texto: string;
};

/**
 * Explicación de cada motivo de «sin cotización» (CA-8, SPEC-016).
 *
 * `Record<QuoteFailureReason, …>` a propósito: es un mapa **total**, así que añadir
 * un motivo al dominio sin explicarlo aquí **no compila**. El test lo ata además en
 * runtime, comparando contra las claves de `FAIL_REASON_TEXT`.
 *
 * El texto NO es el de `FAIL_REASON_TEXT`: aquel es la etiqueta corta que va en la
 * fila, escrita para quien ya está mirando su tabla; este es la explicación para
 * quien todavía no entiende qué le está pasando. Dicen lo mismo con distinto ancho.
 */
const EXPLICACION: Record<QuoteFailureReason, { titulo: string; texto: string }> = {
  mercado_no_cubierto: {
    titulo: 'El proveedor no cubre ese mercado',
    texto:
      'La plaza en la que cotiza el valor queda fuera de lo que el proveedor de precios ' +
      'sirve. No es un problema del valor ni de tu zona: sencillamente no hay precio que ' +
      'traer, y no lo va a haber por esperar.',
  },
  simbolo_desconocido: {
    titulo: 'El proveedor no reconoce el símbolo',
    texto:
      'Le pedimos ese valor y responde que no lo conoce. Suele pasar con valores que ' +
      'dejaron de cotizar o que cambiaron de ticker. Si crees que sigue vivo, quítalo y ' +
      'vuelve a añadirlo desde el buscador.',
  },
  sin_identidad_de_mercado: {
    titulo: 'Falta saber en qué mercado cotiza',
    texto:
      'Ese valor se guardó sin su plaza, y sin plaza no se puede pedir un precio sin ' +
      'adivinar cuál. Adivinar sería peor: el mismo ticker en otro mercado tiene otro ' +
      'precio y otra divisa. Quítalo y vuelve a añadirlo eligiéndolo del buscador.',
  },
  simbolo_no_admitido: {
    titulo: 'El proveedor responde, pero no nos sirve ese valor',
    texto:
      'El proveedor contesta y aun así no nos da el precio de ese valor en esa plaza, o nos ' +
      'devuelve el de otra. El valor no está deslistado y reintentar no lo arregla: el ' +
      'trabajo es nuestro y lo estamos revisando.',
  },
  // SPEC-043 CA-1/CA-4 — el motivo que antes se disfrazaba del de abajo. Su texto lo
  // vigila `tests/spec043-formulas-prohibidas.ts`: ni una fórmula de reintento, ni una
  // acusación al valor, y la causa y la acción escritas en primera persona.
  cuota_agotada: {
    titulo: 'Nos hemos quedado sin cuota de precios',
    texto:
      'Nuestro proveedor de precios nos vende un número de consultas al mes y las hemos ' +
      'consumido, así que ha dejado de darnos precios nuevos. No dice nada del valor, que ' +
      'cotiza con normalidad, ni de tu zona: el que se ha quedado corto es este producto. ' +
      'Tampoco lo arregla el tiempo — lo arreglamos nosotros reponiendo la cuota o ' +
      'cambiando de plan.',
  },
  proveedor_no_disponible: {
    titulo: 'El proveedor no respondió',
    // Ya NO menciona la cuota: dejó de ser el cajón donde caía (ADR-027 pto. 4). Lo que
    // sigue aquí es lo que de verdad es transitorio — la caída, el timeout y el tope de
    // cinco peticiones por segundo (SPEC-043 CA-2).
    texto:
      'Se cayó, tardó demasiado o nos frenó por pedirle varias cosas demasiado seguidas. Es ' +
      'pasajero y no dice nada del valor: se vuelve a intentar en el ciclo siguiente y lo ' +
      'normal es que al día siguiente esté resuelto.',
  },
};

/**
 * El sexto caso, que NO es un fallo y por eso no está en `QuoteFailureReason`: la
 * acción se acaba de añadir y el ciclo todavía no ha pasado por ella. `/vigiladas`
 * ya lo distingue del resto (SPEC-016) y la ayuda tiene que distinguirlo igual — si
 * no, quien acaba de crear su primera vigilada cree que algo está roto.
 */
export const MOTIVO_SIN_DATOS_AUN: MotivoSinPrecio = {
  id: 'aun_sin_datos',
  titulo: 'Aún no ha pasado el ciclo',
  texto:
    'Acabas de añadirla y todavía no le ha tocado. Se ingiere en el próximo ciclo diario y ' +
    'a partir de ahí tendrá precio como las demás. No hay nada que arreglar: hay que ' +
    'esperar a mañana.',
};

/** Los seis casos, en el orden en que se explican. El sexto va el primero: es el común. */
export const MOTIVOS_SIN_PRECIO: MotivoSinPrecio[] = [
  MOTIVO_SIN_DATOS_AUN,
  ...(Object.keys(FAIL_REASON_TEXT) as QuoteFailureReason[]).map((id) => ({
    id,
    ...EXPLICACION[id],
  })),
];

/**
 * **Cuántos motivos dice la PROSA que hay** (SPEC-043 CA-6). Hermana de
 * `MERCADOS_EN_PROSA` y por el mismo motivo: la lista se deriva y no puede desfasarse
 * sola, pero la frase que dice «uno de estos seis» sí — y de hecho **iba a desfasarse
 * hoy**, porque esta spec añade el séptimo.
 *
 * Ese es exactamente el defecto que `F-SPEC-039-3` dejó anotado: un literal suelto que
 * envejece **en silencio** el día que alguien amplía un tipo cerrado. `tests/spec043-
 * cuota-agotada.test.ts` lo ata al recuento real y se pone rojo el día del octavo.
 */
export const MOTIVOS_EN_PROSA = { cifra: 7, palabra: 'siete' } as const;

export const SIN_PRECIO_SECCION = {
  id: 'sin-precio',
  titulo: 'Cuando una acción aparece sin precio',
  intro:
    'Pasa, y la lista lo dice en vez de dejar la celda vacía. Estos son todos los motivos ' +
    `posibles: si ves uno, es uno de estos ${MOTIVOS_EN_PROSA.palabra}.`,
} as const;

/** Qué hace la app, en una línea. La primera pantalla y la ayuda arrancan con esto. */
export const QUE_HACE =
  'Stockeiro vigila los valores que le digas y te avisa cuando su precio entra en el rango ' +
  'que tú has escrito.';

/** Y qué NO hace (D-1). Va junto a lo anterior porque la mitad del valor está aquí. */
export const QUE_NO_HACE =
  'No ejecuta órdenes, no está conectada a ningún bróker y no mueve dinero. Tampoco analiza ' +
  'ni puntúa valores: las zonas las traes tú.';

/* ============================================================
   Estados vacíos que guían (CA-9, CA-10, CA-11)
   ============================================================

   El texto de las pantallas vacías vive AQUÍ y no incrustado en cada página por dos
   razones. La primera es CA-3: la frase de la cadencia tiene que ser LA MISMA en la
   primera pantalla, en la ayuda y en el estado vacío de `/vigiladas`, y la única
   forma de que no se desincronicen es que sea una sola constante. La segunda es que
   un estado vacío se prueba mejor comparando texto que renderizando tres páginas.

   El público de estas frases tiene rol `tester` (SPEC-034): ve Panel, Vigiladas y
   Avisos, y NO ve Cartera ni Importar. Ninguna de ellas le señala un camino que su
   rol no abre — enseñarle una puerta cerrada es peor que no decirle nada. */

export type Vacio = {
  titulo: string;
  /** El primer paso, en una línea. Uno solo: si hay dos, no hay ninguno. */
  primerPaso: string;
  /** Un ejemplo con números, porque «rango de precio» no le dice nada a nadie. */
  ejemplo?: string;
  /** Lo que hay que saber antes de esperar a que pase algo. */
  nota?: string;
};

/** `/vigiladas` sin ninguna acción vigilada (CA-9). */
export const VACIO_VIGILADAS: Vacio = {
  titulo: 'Aún no vigilas ninguna acción',
  primerPaso:
    'Empieza aquí abajo: busca el valor por su nombre o su ticker, elige su mercado y ' +
    'escribe entre qué dos precios quieres que te avisemos.',
  ejemplo:
    'Por ejemplo: si te interesa comprar Inditex entre 20 y 25 €, escribe 20 como mínimo y ' +
    '25 como máximo de la zona de compra. En cuanto el precio de cierre caiga dentro de ese ' +
    'rango —20 y 25 incluidos— recibes el aviso.',
};

/** `/avisos` sin ningún aviso (CA-10). */
export const VACIO_AVISOS: Vacio = {
  titulo: 'Aún no tienes avisos',
  primerPaso:
    'Aquí aparecerá el primero cuando una acción que vigilas entre en su zona de compra o ' +
    'de venta. También te llegará por correo.',
  nota:
    'Esa comprobación se hace una vez al día, con el precio de cierre. Que esto esté vacío ' +
    'no quiere decir que algo falle: quiere decir que todavía no ha entrado nada en tus ' +
    'rangos.',
};

/** El texto que se le añade a `/avisos` cuando además no vigila nada (CA-10). */
export const VACIO_AVISOS_SIN_VIGILADAS =
  'Todavía no vigilas ninguna acción, así que no hay nada de lo que avisarte. Ese es el ' +
  'primer paso.';

/** `/dashboard` de quien acaba de llegar: sin vigiladas y sin avisos (CA-11). */
export const VACIO_PANEL: Vacio = {
  titulo: 'Empieza por tu primera acción vigilada',
  primerPaso:
    'Elige un valor, escribe el rango de precio que te interesa y deja que Stockeiro lo ' +
    'mire por ti. Es lo único que hay que hacer para que esto sirva de algo.',
  nota:
    'Es un paso y no hay ningún otro pendiente: el resto de la pantalla se irá llenando ' +
    'solo a medida que el ciclo diario tenga algo que contarte.',
};
