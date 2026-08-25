/**
 * SPEC-056 — la paleta y la tipografía del correo.
 *
 * Los valores están escritos como **literales** y no como `var(--algo)` porque las
 * variables CSS no sobreviven a la mayoría de clientes de correo: Outlook usa el motor
 * de Word y Gmail poda lo que no entiende. Un correo que dependiera de `var()` se vería
 * sin color en la mitad de las bandejas.
 *
 * Que estén tecleados aquí NO los deja sueltos: `tests/spec056-plantillas.test.ts` deriva
 * los seis tokens de `design/tremen-ds/colors_and_type.css` **en cada ejecución** (CA-11)
 * y exige que todo literal de color que aparezca en los tres HTML pertenezca a ese
 * conjunto. El día que la marca cambie de naranja, el test se pone rojo y dice dónde.
 * Misma lectura que hacen `tests/tarjeta-imagen.test.ts` (SPEC-051) y
 * `tests/icono-fichero.test.ts` (SPEC-047).
 *
 * Módulo **puro**: no importa nada. Vive sobre el puerto (ADR-036 pto. 4).
 */

/** Los seis colores del correo, y el token de `.v-tremendo` del que sale cada uno. */
export const COLOR = {
  /** `--bg` — el lienzo, a sangre, detrás de la tarjeta. */
  lienzo: '#111110',
  /** `--bg-elev` — la tarjeta de 600 px. */
  tarjeta: '#1A1815',
  /** `--bone` — el texto principal y el wordmark. */
  hueso: '#F5F1EA',
  /** `--accent` (→ `--ember`) — el punto del wordmark, el botón, el dato destacado. */
  acento: '#FF6B00',
  /** `--fg-muted` — el pie, el `asOf`, la letra pequeña. */
  apagado: 'rgba(245, 241, 234, 0.66)',
  /** `--line` — el filete entre cabecera, cuerpo y pie. */
  filete: '#2A2620',
} as const;

/**
 * D-8 — **la misma cadena de reserva de `--font-sans`, sin la primera familia**.
 *
 * La app usa Geist y la sirve desde su propio origen con `next/font`. En correo no hay
 * forma honesta de tener Geist: exigiría pedirle la fuente a un host, que es exactamente
 * lo que D-7 prohíbe y lo que SPEC-035 CA-12 quitó de la web. Se pierde la letra exacta;
 * se gana que el correo no pida nada. El intercambio queda escrito para que nadie lo
 * «arregle» más adelante, y un test lo deriva del CSS para que no se quede atrás.
 */
export const PILA_DE_FUENTES = `ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', sans-serif`;

/**
 * El ancho máximo de la tarjeta. 600 px es lo que cabe en el panel de lectura de Outlook
 * sin scroll horizontal; por debajo de eso el contenedor es fluido (`width:100%`), que es
 * lo que hace que el correo se lea en un teléfono sin necesitar una sola regla `@media`.
 */
export const ANCHO_MAXIMO = 600;
