/**
 * SPEC-035 CA-8 — la lista CERRADA y VERSIONADA de lo que las páginas legales no
 * pueden decir. Vive junto a su test a propósito, y cada entrada lleva su motivo
 * escrito para que quien venga dentro de un año entienda qué protege antes de
 * "mejorarla".
 *
 * ## Qué protege esto
 *
 * El gate de EPIC-004 (2026-08-19) decidió **publicar con el free tier de
 * Marketstack**, asumiendo **R-1** a conciencia: ese plan **no concede derechos de
 * uso comercial ni de redistribución** (ADR-012, ratificado como F-EPIC-004-1 en el
 * roadmap). Los precios que Stockeiro enseña **no son suyos**.
 *
 * Por eso este CA es contraintuitivo: **prohíbe escribir cosas**. Lo normal al
 * redactar unos términos es blindarse —"todos los derechos reservados sobre los
 * contenidos"— y aquí eso sería exactamente el error: una frase de más crea una
 * obligación que la app no puede cumplir, o se atribuye un derecho que no tiene.
 *
 * La otra mitad es simétrica: **ninguna garantía** sobre la exactitud, continuidad
 * o disponibilidad de las cotizaciones. La app no controla al proveedor y no puede
 * responder por él.
 *
 * ## Cómo está escrita
 *
 * Los patrones prohíben la **raíz** de la palabra, no una frase concreta, porque
 * una frase concreta se esquiva sin querer con un sinónimo. En particular `garant`:
 * el texto no dice "no garantizamos" sino **"sin compromiso de exactitud,
 * continuidad ni disponibilidad"**. Es deliberado — un patrón que tuviera que
 * distinguir "garantizamos" de "no garantizamos" sería frágil justo donde no puede
 * permitírselo, y la forma negativa dice lo mismo sin usar la palabra.
 *
 * Si añades una entrada, escribe el motivo. Si quitas una, que sea porque cambió el
 * plan de Marketstack (F-EPIC-004-1), no porque estorbaba al redactar.
 */
export type AfirmacionProhibida = { patron: RegExp; motivo: string };

export const AFIRMACIONES_PROHIBIDAS: AfirmacionProhibida[] = [
  {
    patron: /derechos?\s+reservad/i,
    motivo:
      'Reservarse derechos sobre unos contenidos que incluyen cotizaciones ajenas es ' +
      'atribuirse lo que el free tier de Marketstack no concede (R-1, ADR-012).',
  },
  {
    patron: /todos\s+los\s+derechos/i,
    motivo: 'Misma reserva por la puerta de atrás, con otra fórmula igual de habitual.',
  },
  {
    patron: /licenci/i,
    motivo:
      'Licencia, licenciamos, sublicencia: cualquier declaración de licencia sobre los ' +
      'precios afirma un derecho que el plan gratuito no da (R-1).',
  },
  {
    patron: /redistribu/i,
    motivo:
      'La redistribución es justo lo que el free tier de Marketstack NO permite. Ni para ' +
      'concederla ni para prohibirla: hablar de ella ya insinúa que se tiene el derecho.',
  },
  {
    patron: /distribu/i,
    motivo:
      'Igual que la anterior sin el prefijo. "Distribuimos datos de mercado" es una ' +
      'afirmación de derecho que no se sostiene.',
  },
  {
    patron: /(uso|explotaci[oó]n)\s+comercial/i,
    motivo: 'El plan gratuito excluye el uso comercial (ADR-012). No se afirma lo contrario.',
  },
  {
    patron: /exclusiv/i,
    motivo:
      'No hay exclusividad de ningún tipo sobre unos datos que sirve un tercero a quien ' +
      'cualquiera puede pedírselos.',
  },
  {
    patron: /titularidad/i,
    motivo:
      'La titularidad sobre las cotizaciones no es del operador del servicio. Sí se usa ' +
      '"titular" para la PERSONA que responde del servicio (CA-3/CA-4): eso es otra cosa.',
  },
  {
    patron: /propiedad\s+intelectual/i,
    motivo:
      'Invocar propiedad intelectual sobre lo que se muestra mete en el mismo saco el ' +
      'producto y unos precios que no son suyos.',
  },
  {
    patron: /garant/i,
    motivo:
      'Ninguna garantía sobre exactitud, continuidad o disponibilidad: el servicio depende ' +
      'de un proveedor externo y no puede responder por él. El descargo se escribe en ' +
      'negativo —"sin compromiso de…"— precisamente para no necesitar la palabra.',
  },
  {
    patron: /(cedemos|cesi[oó]n\s+de\s+derechos|sublicenci)/i,
    motivo: 'Ceder un derecho exige tenerlo. No se tiene (R-1).',
  },
  {
    patron: /(revender|reventa)/i,
    motivo: 'Vender los datos de mercado a terceros está fuera del plan contratado (ADR-012).',
  },
  {
    patron: /(nos\s+pertenecen|son\s+de\s+nuestra\s+propiedad|propiedad\s+de\s+Stockeiro)/i,
    motivo: 'Las cotizaciones no pertenecen a Stockeiro ni a quien lo opera.',
  },
  {
    patron: /con\s+antelaci[oó]n/i,
    motivo:
      'Prometer aviso ANTICIPADO de algo —del cierre del servicio, de una migración, de ' +
      'lo que sea— es asumir una obligación de continuidad que nadie ha decidido asumir y ' +
      'que un proyecto personal en pruebas no puede sostener: si el servicio se cae del ' +
      'todo, no hay quien mande el correo. Es la misma familia que `garant`, por el otro ' +
      'lado: allí se prometía exactitud, aquí permanencia. La sección de disponibilidad ' +
      'DESCRIBE ("puede caerse, puede cambiar de un día para otro"); no promete.',
  },
  {
    patron: /aviso\s+previo/i,
    motivo: 'La fórmula habitual de la anterior. Prometerlo o negarlo por escrito: ninguna.',
  },
  {
    patron: /se\s+avisar[ií]a/i,
    motivo:
      'La misma promesa en condicional, que es como se cuela: suena a cortesía y es un ' +
      'compromiso. Ojo: no prohíbe "se avisa" a secas (los cambios de estos términos sí ' +
      'se comunican cuando ocurren) — lo que no se compromete es un aviso ANTES.',
  },
];

/**
 * SPEC-035 CA-3 — texto de relleno que no puede sobrevivir a la publicación.
 *
 * Un marcador de posición en una página legal no es un `TODO` pendiente: es publicar
 * mintiendo sobre quién responde del servicio. Se comprueba en el texto RENDERIZADO,
 * que es lo que lee la persona.
 */
export const MARCADORES_DE_POSICION: AfirmacionProhibida[] = [
  { patron: /\bTODO\b/, motivo: 'Marcador de tarea sin resolver.' },
  { patron: /\bTBD\b|\bFIXME\b|\bXXX\b/, motivo: 'Marcadores de tarea sin resolver.' },
  { patron: /\bPENDIENTE\b/i, motivo: 'Un dato pendiente no se publica, se resuelve.' },
  { patron: /ejemplo@|example\.com|correo@/i, motivo: 'Dirección de contacto de relleno.' },
  { patron: /lorem\s+ipsum/i, motivo: 'Texto de relleno.' },
  { patron: /[<[]\s*(nombre|direcci[oó]n|domicilio|email|correo|titular)\s*[>\]]/i, motivo: 'Hueco sin rellenar.' },
  { patron: /\bpor\s+determinar\b|\bpor\s+definir\b/i, motivo: 'Un dato por determinar no se publica.' },
];
