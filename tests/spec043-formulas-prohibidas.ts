import {
  violacionesDe,
  type AfirmacionProhibida,
  type Violacion,
} from './ayuda-afirmaciones-prohibidas';

/**
 * SPEC-043 CA-4 — la lista CERRADA y VERSIONADA de lo que el motivo **`cuota_agotada`**
 * no puede decir. Mismo mecanismo que `tests/legal-afirmaciones-prohibidas.ts`
 * (SPEC-035 CA-8) y `tests/ayuda-afirmaciones-prohibidas.ts` (SPEC-039 CA-7), y la
 * regla de la negación se importa de aquella en vez de copiarse.
 *
 * ## Qué protege esto, y por qué es un test y no una convención
 *
 * El defecto del **2026-08-19** no fue quedarse sin precios: fue **decirle al operador
 * una cosa distinta de la que pasaba**. Marketstack respondió `429
 * usage_limit_reached` —cuota mensual agotada— y el clasificador lo metió en
 * `proveedor_no_disponible`, cuyo texto de usuario promete literalmente *«se
 * reintentará en el próximo ciclo»*. Reintentar mañana **falló igual**, dos días
 * seguidos, porque la cuota es **terminal** hasta que renueve el mes o se cambie de
 * plan (**ADR-027** pto. 4).
 *
 * La acción correcta es **reponer**, no esperar. Un texto que insinúe espera manda al
 * operador al sitio equivocado, y eso es exactamente el motivo mentiroso que
 * **CE-F2** de EPIC-FIX vino a matar. El riesgo no es teórico: el texto que hay que
 * escribir se parece mucho al que ya existe, y la tentación de copiarlo y retocarlo es
 * máxima.
 *
 * ## El alcance es UN motivo, a propósito
 *
 * Estas fórmulas están **bien** en los otros motivos: `proveedor_no_disponible` es
 * transitorio y **debe** prometer el ciclo siguiente (ADR-027 pto. 4 le conserva su
 * contrato), y `aun_sin_datos` **es** literalmente «espera a mañana». Prohibirlas en
 * toda la app rompería textos verdaderos. La guardia se aplica **solo** a los textos
 * de `cuota_agotada`.
 *
 * ## La regla de la negación se hereda, y aquí también hace falta
 *
 * *«Reintentar no lo arregla»* es una frase **verdadera y útil** sobre este motivo, y
 * una prohibición de la raíz a secas la mataría. Por eso una raíz prohibida solo
 * cuenta como violación si **no** viene negada dentro de su misma frase
 * (`violacionesDe`, SPEC-039 CA-7).
 *
 * Si añades un patrón, añade sus dos ejemplos. Si quitas una entrada, que sea porque
 * un ADR posterior reinterpretó **ADR-027**, no porque estorbaba al redactar.
 */
export const FORMULAS_PROHIBIDAS_CUOTA: AfirmacionProhibida[] = [
  {
    patron: /\breintent\w*/gi,
    motivo:
      'ADR-027 pto. 4: la cuota agotada es TERMINAL hasta que renueve el mes o se cambie ' +
      'de plan. El reintento es literalmente lo que falló dos días seguidos en el ' +
      'incidente del 2026-08-19/20. Negarlo sí se puede: «reintentar no lo arregla» es ' +
      'verdad y es útil.',
  },
  {
    patron: /\b(pr[óo]ximo|siguiente)\s+ciclo\b|\bciclo\s+siguiente\b/gi,
    motivo:
      'La fórmula EXACTA del motivo impostor: «se reintentará en el próximo ciclo». ' +
      'Prometer el ciclo siguiente sobre una cuota agotada es prometer algo que el cron ' +
      'no puede cumplir, y es lo que dejó al operador esperando en vez de reponiendo.',
  },
  {
    patron: /\b(ma[ñn]ana|en\s+unas\s+horas|m[áa]s\s+tarde|dentro\s+de\s+un\s+rato)\b/gi,
    motivo:
      'Las formas coloquiales de «el próximo ciclo». Prohibir solo la culta deja la ' +
      'puerta abierta a decir lo mismo con otras palabras — el mismo razonamiento con ' +
      'el que SPEC-039 prohibió «en directo» además de «tiempo real».',
  },
  {
    patron: /\b(pasajer\w+|transitori\w+|temporalmente|puntualmente)\b/gi,
    motivo:
      'Es el contrato de `proveedor_no_disponible`, no el de este motivo. Calificar la ' +
      'cuota de pasajera es volver a meterla en el cajón del que ADR-027 la saca.',
  },
  {
    patron: /\b(espera\w*|aguarda\w*|paciencia)\b/gi,
    motivo:
      'La acción que este motivo pide es REPONER, no esperar (ADR-027 pto. 4). Mandar a ' +
      'esperar es mandar al operador al sitio equivocado, que es el daño concreto del ' +
      'incidente. «No hay nada que esperar» sí se puede decir: viene negado.',
  },
  {
    patron: /\b(deslistad\w+|suspendid\w+|dej[óo]\s+de\s+cotizar|no\s+reconoce\w*)\b/gi,
    motivo:
      'CA-4: el texto NO puede acusar al valor. El valor cotiza perfectamente; el que se ' +
      'ha quedado sin presupuesto es este producto. Acusar al valor sería fabricar el ' +
      'siguiente motivo mentiroso, y es también por lo que sdd-mercados descartó el ' +
      'nombre «cotización detenida».',
  },
  {
    // Sin `\b` de cierre a propósito: `\w` de JavaScript no incluye las vocales
    // acentuadas, así que un `\b` detrás de «cayó» o «respondió» no casa NUNCA y el
    // patrón entero quedaría muerto sin que nadie lo notara.
    patron: /\b(se\s+cay[óo]|ca[íi]da\s+del\s+proveedor|no\s+respondi[óo]|no\s+est[áa]\s+disponible)/gi,
    motivo:
      'El proveedor SÍ respondió: respondió un 429 diciéndonos que hemos consumido ' +
      'nuestro presupuesto. Contarlo como una caída es el disfraz que da nombre a esta ' +
      'spec.',
  },
];

/** Las fórmulas prohibidas que un texto contiene de verdad (con la regla de negación). */
export function formulasProhibidasEn(texto: string): Violacion[] {
  return violacionesDe(texto, FORMULAS_PROHIBIDAS_CUOTA);
}

/**
 * **La otra mitad de CA-4, y no es simétrica.** No basta con que el texto calle: tiene
 * que **atribuirse la causa y la acción**. «Se ha agotado la cuota» es gramaticalmente
 * impecable y deja al operador sin saber de quién es el problema; «hemos agotado
 * nuestra cuota» le dice quién tiene que moverse. Es la diferencia entre un motivo
 * mudo y un motivo útil.
 */
export const MARCAS_DE_PRIMERA_PERSONA =
  /\b(hemos|nuestr\w+|nos|repongamos|reponemos|estamos)\b/i;

/**
 * Frases que esta guardia TIENE que cazar. Son las que alguien escribiría de buena fe
 * al redactar el motivo nuevo mirando de reojo al viejo.
 */
export const EJEMPLOS_PROHIBIDOS: string[] = [
  'El proveedor no respondió; se reintentará en el próximo ciclo.',
  'Sin precio ahora mismo: lo intentamos otra vez en el ciclo siguiente.',
  'Vuelve mañana y lo normal es que ya esté resuelto.',
  'Es un problema pasajero del proveedor de precios.',
  'No hay precio: hay que esperar a que se resuelva.',
  'El proveedor no reconoce este símbolo, puede estar deslistado.',
  'Nuestro proveedor se cayó y por eso no hay precio.',
];

/**
 * Frases que esta guardia NO puede cazar, porque son exactamente las que CA-4 pide
 * escribir. Si un patrón nuevo rompe una de estas, el patrón está mal, no la frase.
 */
export const EJEMPLOS_PERMITIDOS: string[] = [
  'Hemos agotado la cuota de precios de nuestro proveedor; no se actualizará hasta que la repongamos.',
  'Esto no se arregla reintentando: el presupuesto está consumido hasta que lo repongamos nosotros.',
  'No hay nada que esperar; el trabajo es nuestro.',
  'El valor cotiza con normalidad y no está deslistado: el que se ha quedado sin cuota es este producto.',
  'El proveedor no se cayó, nos dijo que habíamos consumido nuestro presupuesto.',
];
