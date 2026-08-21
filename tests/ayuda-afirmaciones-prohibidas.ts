/**
 * SPEC-039 CA-7 — la lista CERRADA y VERSIONADA de lo que la ayuda y la primera
 * pantalla **no pueden decir**. Mismo mecanismo que `tests/legal-afirmaciones-prohibidas.ts`
 * (SPEC-035 CA-8), y por un motivo de la misma familia: hay frases que suenan mejor y
 * son falsas, y la tentación de escribirlas es máxima justo en la página que intenta
 * convencer a alguien de que se registre.
 *
 * ## Qué protege esto
 *
 * **D-2 es locked**: *"no es tiempo real; el disparo se evalúa en modo diferido/batch
 * dentro de un ciclo de refresco acordado"*. **D-1** también: *"la app avisa, no
 * opera"*. **D-4** también: *"la app no calcula ni recomienda zonas"*.
 *
 * Y **R-4** de EPIC-004 dice lo que está en juego: *"el público de un foro de bolsa
 * espera tiempo real […] si la ayuda y el primer pantallazo no lo dicen alto, el
 * feedback que se recoja será 'no actualiza' y se habrá gastado la publicación"*. La
 * peor forma de fallar aquí no es callarse la cadencia: es prometer la contraria.
 *
 * ## La regla de la negación, y por qué existe
 *
 * Aquí hay una diferencia real con SPEC-035 que conviene entender antes de tocar
 * nada. Allí la palabra prohibida (`garant`) **no hacía falta**: el texto legal dice
 * *"sin compromiso de exactitud"* y esquiva la raíz entera. Aquí es al revés — el
 * trabajo de esta spec es decir **"esto no es tiempo real"**, con esas palabras, en
 * la primera pantalla. Prohibir la raíz a secas prohibiría justo la frase que R-4
 * exige escribir.
 *
 * Así que lo que se prohíbe es la **afirmación**, no la palabra: una raíz prohibida
 * solo cuenta como violación si **no** viene negada dentro de su misma frase. La
 * ventana es corta (`VENTANA_DE_NEGACION`) y **no cruza puntuación fuerte** (`. ; :`
 * o salto de línea), para que un "no" de la oración anterior no exculpe a la
 * siguiente.
 *
 * `sin` NO está entre los negadores a propósito, aunque niega: *"sin retraso, con
 * precios en tiempo real"* se exculparía sola. Los negadores son los que introducen
 * una oración negativa, no los que preceden a un sustantivo.
 *
 * Una regla así se puede equivocar en los dos sentidos, y por eso **no se cree a sí
 * misma**: `EJEMPLOS_PROHIBIDOS` y `EJEMPLOS_PERMITIDOS` son la prueba de la prueba,
 * y `tests/ayuda-afirmaciones-prohibidas.test.ts` los ejercita antes de mirar ni una
 * línea de la ayuda. Si añades un patrón, añade sus dos ejemplos.
 *
 * Si quitas una entrada, que sea porque un ADR reinterpretó una decisión *locked*, no
 * porque estorbaba al redactar.
 */
export type AfirmacionProhibida = { patron: RegExp; motivo: string };

/** Cuántos caracteres hacia atrás se busca un negador. Una oración corta. */
export const VENTANA_DE_NEGACION = 60;

/** Lo que abre una oración negativa. `sin` queda fuera: ver la cabecera. */
const NEGADORES = /\b(no|ni|nunca|jam[áa]s|tampoco)\b/i;

/** Puntuación que corta la ventana: lo de antes es otra frase y no exculpa a esta. */
const FRONTERA = /[.;:\n]/;

export const AFIRMACIONES_PROHIBIDAS_AYUDA: AfirmacionProhibida[] = [
  {
    patron: /\btiempo\s+real\b/gi,
    motivo:
      'D-2 (locked): el disparo se evalúa en modo diferido dentro de un ciclo. Afirmar ' +
      'tiempo real es prometer un producto distinto del que se publica, y es EXACTAMENTE ' +
      'el malentendido que R-4 dice que puede gastar la publicación. Negarlo sí se puede: ' +
      '«esto no es tiempo real» es la frase que esta spec existe para escribir.',
  },
  {
    patron: /\bintrad[ií]a\b/gi,
    motivo:
      'No hay dato intradía en ninguna parte del sistema: el ciclo trae el cierre (RN-12). ' +
      'Insinuar lo contrario promete una granularidad que no existe.',
  },
  {
    patron: /\b(en\s+directo|en\s+vivo|streaming|cotizaci[oó]n\s+viva)\b/gi,
    motivo:
      'Las formas coloquiales de «tiempo real». Prohibir solo la culta deja la puerta ' +
      'abierta a decir lo mismo con otras palabras.',
  },
  {
    patron: /\b(al\s+instante|al\s+momento|instant[áa]ne\w*|inmediat\w*)\b/gi,
    motivo:
      'CA-7 nombra las «alertas instantáneas». Entre que un valor entra en zona y que ' +
      'llega el aviso puede pasar un día entero: el aviso sale del ciclo, no del tick.',
  },
  {
    patron: /\b(24\s*\/\s*7|las\s+24\s+horas|continuamente|permanentemente|minuto\s+a\s+minuto|cada\s+(segundo|minuto|hora))\b/gi,
    motivo:
      'Cadencias que no son la que hay. La que hay es una al día, después del cierre ' +
      '(ADR-004 pto. 1). Cualquier otra cifra en la ayuda es una promesa que el cron no ' +
      'cumple.',
  },
  {
    patron: /\b(ejecut\w+\s+(?:una\s+|la\s+|las\s+|tus\s+|[oó]rden)|env[ií]a\w*\s+[oó]rden|opera\s+por\s+ti|compra\s+por\s+ti|vende\s+por\s+ti)/gi,
    motivo:
      'D-1 (locked): la app avisa, no opera. Nunca ejecuta órdenes ni mueve dinero, y el ' +
      'descargo de no asesoramiento de SPEC-035 lo publica en el pie de todas las páginas.',
  },
  {
    patron: /\bconect\w+\s+(?:a|con)\s+(?:tu\s+|el\s+|ning[uú]n\s+)?br[oó]ker/gi,
    motivo:
      'D-1 otra vez, por el otro lado: no hay integración con ningún bróker y no la va a ' +
      'haber. Insinuarla es la promesa más cara de deshacer.',
  },
  {
    patron: /\b(recomend\w+|recomien\w+|sugerimos|te\s+decimos\s+cu[áa]ndo|se[ñn]al\s+de\s+(compra|venta)|predic\w+|pronostic\w+)\b/gi,
    motivo:
      'D-4 (locked): la app no calcula ni recomienda zonas — las aporta el usuario. La ' +
      'ayuda es donde más tienta cruzar esa línea, porque explicar cómo se pone una zona ' +
      'se parece mucho a aconsejar cuál poner.',
  },
  {
    patron: /\bgarantiz\w*/gi,
    motivo:
      'Misma razón que en SPEC-035 CA-8: el servicio depende de un proveedor externo y no ' +
      'puede responder por él. El compromiso se escribe en negativo o no se escribe.',
  },
];

export type Violacion = { patron: RegExp; motivo: string; fragmento: string };

/** El trozo de texto anterior a `pos` dentro de su misma frase, acotado a la ventana. */
function contextoPrevio(texto: string, pos: number): string {
  const desde = Math.max(0, pos - VENTANA_DE_NEGACION);
  const ventana = texto.slice(desde, pos);
  const corte = [...ventana].reduce(
    (ultimo, ch, i) => (FRONTERA.test(ch) ? i + 1 : ultimo),
    0,
  );
  return ventana.slice(corte);
}

/**
 * **El motor de la regla de la negación, para cualquier lista cerrada** (SPEC-043 CA-4).
 *
 * Vive aquí porque aquí nació (SPEC-039 CA-7) y aquí está documentado por qué la
 * ventana es corta y por qué `sin` no niega. Se exporta —en vez de copiarse— porque
 * este proyecto ya sabe lo que cuesta la otra opción: **ADR-026** existe porque cuatro
 * guardias de geometría se copiaron una de otra y la medida buena se perdió por el
 * camino en dos de las copias. Una lista nueva trae **sus patrones y sus ejemplos**;
 * **cómo se decide si una raíz viene negada** se decide en un solo sitio.
 */
export function violacionesDe(texto: string, lista: readonly AfirmacionProhibida[]): Violacion[] {
  const violaciones: Violacion[] = [];

  for (const { patron, motivo } of lista) {
    const rx = new RegExp(patron.source, patron.flags.includes('g') ? patron.flags : `${patron.flags}g`);
    for (const encontrado of texto.matchAll(rx)) {
      const pos = encontrado.index ?? 0;
      if (NEGADORES.test(contextoPrevio(texto, pos))) continue;
      const desde = Math.max(0, pos - 40);
      violaciones.push({
        patron,
        motivo,
        fragmento: `…${texto.slice(desde, pos + encontrado[0].length + 40).replace(/\s+/g, ' ')}…`,
      });
    }
  }
  return violaciones;
}

/**
 * Las afirmaciones prohibidas que un texto contiene DE VERDAD: cada aparición de una
 * raíz prohibida que no viene negada en su propia frase.
 */
export function afirmacionesProhibidasEn(texto: string): Violacion[] {
  return violacionesDe(texto, AFIRMACIONES_PROHIBIDAS_AYUDA);
}

/**
 * Frases que esta guardia TIENE que cazar. Son las que alguien escribiría de buena fe
 * al querer que la app suene mejor de lo que es.
 */
export const EJEMPLOS_PROHIBIDOS: string[] = [
  'Consulta las cotizaciones en tiempo real desde cualquier dispositivo.',
  'Sigue el intradía de tus valores favoritos.',
  'Los precios se ven en directo mientras el mercado está abierto.',
  'Te avisamos al instante en cuanto un valor entra en tu zona.',
  'Recibes una alerta inmediata en el móvil.',
  'Los datos se actualizan continuamente, las 24 horas.',
  'Comprobamos tus zonas cada minuto durante la sesión.',
  'Stockeiro ejecuta la orden por ti cuando se cumple tu zona.',
  'Conecta con tu bróker y opera sin salir de la app.',
  'Te recomendamos las mejores zonas de compra para cada valor.',
  'Garantizamos que ningún disparo se te escapa.',
];

/**
 * Frases que esta guardia NO puede cazar, porque son exactamente las que la spec
 * pide escribir. Si un patrón nuevo rompe una de estas, el patrón está mal, no la
 * frase.
 */
export const EJEMPLOS_PERMITIDOS: string[] = [
  'Esto no es tiempo real: los precios son de cierre.',
  'No hay datos intradía; lo que se compara es el cierre del día.',
  'No verás el precio en directo ni la sesión minuto a minuto.',
  'El aviso no es inmediato: sale del ciclo diario, no del momento en que ocurre.',
  'Stockeiro no ejecuta órdenes ni está conectada a ningún bróker.',
  'La app no calcula tus zonas y tampoco te recomienda ninguna.',
  'El servicio se ofrece sin compromiso de exactitud ni de continuidad.',
];
