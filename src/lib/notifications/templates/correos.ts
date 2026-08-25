import { COLOR, PILA_DE_FUENTES } from './paleta';
import { componer, escapar, fila, parrafo, type CorreoCompuesto } from './marco';

/**
 * SPEC-056 — **los tres correos**. Cada uno es una función de datos a
 * `{ subject, text, html }`: sin base de datos, sin Next y sin sesión (ADR-036 pto. 4).
 * Por eso «lleva la marca», «no pide recursos fuera» o «no usa flex» dejan de ser
 * adjetivos y pasan a ser aserciones de Vitest sobre una cadena.
 *
 * **Aquí no se inventa copy** (D-10, CE-M1). Los tres asuntos son byte-idénticos a los de
 * hoy (CA-16) y las frases del cuerpo son las que el correo ya decía; lo único que cambia
 * es cómo se ven. Donde el HTML destaca algo, destaca un **dato** —el ticker, el precio,
 * el `asOf`—, no una frase nueva.
 *
 * El `asOf` viaja y **se ve** en los dos cuerpos: es la decisión locked D-2 de
 * `FOUNDATION.md`, y un diseño que se lo comiera por estética estaría rompiendo un
 * no-negociable, no un detalle.
 */

const FUENTE = `font-family:${PILA_DE_FUENTES};`;

/** El dato que la frase destaca: mismo texto, otro peso. */
const dato = (valor: string, color: string = COLOR.hueso) =>
  `<span style="color:${color};font-weight:700;">${escapar(valor)}</span>`;

/** La línea del `asOf`, siempre en letra pequeña y siempre presente (D-2). */
const sello = (asOf: string) =>
  parrafo(`(asOf ${escapar(asOf)})`, { tamano: 14, color: COLOR.apagado, margenSuperior: 16 });

// ---------------------------------------------------------------------------
// 1. Entrada en zona — el correo que llega solo y llega en un buen momento.
// ---------------------------------------------------------------------------

export interface DatosDeEntradaEnZona {
  ticker: string;
  /** El precio tal y como lo guarda el disparo, sin reformatear. */
  precio: string;
  /** `compra` o `venta`, ya en español: lo traduce el servicio, como hasta ahora. */
  zona: string;
  /** `YYYY-MM-DD`. */
  asOf: string;
}

export function correoDeEntradaEnZona(d: DatosDeEntradaEnZona): CorreoCompuesto {
  const frase = `${d.ticker} a ${d.precio} entró en tu zona de ${d.zona}`;
  return componer({
    subject: `${d.ticker} entró en tu zona de ${d.zona}`,
    lineas: [`${frase} (asOf ${d.asOf}).`],
    filas: [
      fila(
        `<p style="margin:0;${FUENTE}font-size:22px;line-height:1.45;font-weight:400;` +
          `color:${COLOR.hueso};">${dato(d.ticker)} a ${dato(d.precio, COLOR.acento)} ` +
          `entró en tu zona de ${escapar(d.zona)}.</p>` +
          sello(d.asOf),
        '32px 28px 28px',
      ),
    ],
  });
}

// ---------------------------------------------------------------------------
// 2. Resumen de permanencia — el recordatorio agregado, uno por usuario y ciclo.
// ---------------------------------------------------------------------------

export interface PosicionEnZona {
  ticker: string;
  /** `compra` o `venta`. */
  zona: string;
}

export interface DatosDelResumen {
  posiciones: PosicionEnZona[];
  /** El `cycleRef` del ciclo, que es la fecha del dato más reciente. */
  asOf: string;
}

export function correoDeResumen(d: DatosDelResumen): CorreoCompuesto {
  const lista = d.posiciones.map((p) => `${p.ticker} (${p.zona})`).join(', ');
  const recuento = `Resumen: ${d.posiciones.length} acción(es) en zona`;

  /** Una fila por posición, con filete entre ellas. El ticker manda; la zona acompaña. */
  const renglones = d.posiciones
    .map(
      (p, i) =>
        `<tr><td style="padding:${i === 0 ? '0' : '10px'} 0 10px;${FUENTE}font-size:17px;` +
        `line-height:1.4;color:${COLOR.hueso};font-weight:700;` +
        `${i === 0 ? '' : `border-top:1px solid ${COLOR.filete};`}">${escapar(p.ticker)}</td>` +
        `<td align="right" style="padding:${i === 0 ? '0' : '10px'} 0 10px;${FUENTE}` +
        `font-size:15px;line-height:1.4;color:${COLOR.apagado};` +
        `${i === 0 ? '' : `border-top:1px solid ${COLOR.filete};`}">(${escapar(p.zona)})</td></tr>`,
    )
    .join('');

  return componer({
    subject: recuento,
    lineas: [`Siguen en zona: ${lista}. (asOf ${d.asOf})`, `${recuento}.`],
    filas: [
      fila(
        `<p style="margin:0;${FUENTE}font-size:22px;line-height:1.45;font-weight:400;` +
          `color:${COLOR.hueso};">${escapar(recuento)}</p>` +
          parrafo('Siguen en zona:', { tamano: 15, color: COLOR.apagado, margenSuperior: 6 }),
        '32px 28px 18px',
      ),
      fila(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ` +
          `style="width:100%;border-collapse:collapse;">${renglones}</table>` +
          sello(d.asOf),
        '0 28px 28px',
      ),
    ],
  });
}

// ---------------------------------------------------------------------------
// 3. Recuperación de contraseña — el caso crítico (R-1).
// ---------------------------------------------------------------------------

export interface DatosDeRecuperacion {
  /** El enlace completo, compuesto desde `APP_BASE_URL` (ADR-015 pto. 8). */
  url: string;
  /** Los minutos de validez, leídos de su constante y no tecleados. */
  minutosDeCaducidad: number;
}

/**
 * El único de los tres cuyo fallo **deja a alguien fuera de su cuenta** (R-1), y por eso
 * el que impone las restricciones más duras:
 *
 *   - En el **texto**, el enlace sigue siendo una URL desnuda y sigue siendo la PRIMERA
 *     URL absoluta del cuerpo (CA-15, D-6). La marca va al final, detrás de él.
 *   - En el **HTML**, esa misma URL aparece **dos veces**: como `href` del botón y como
 *     texto visible copiable, para quien no puede pinchar o cuyo cliente elimina el botón.
 *     Un enlace que solo vive dentro de un botón es un enlace que algunos no reciben.
 */
export function correoDeRecuperacion(d: DatosDeRecuperacion): CorreoCompuesto {
  const url = escapar(d.url);
  const rotuloDelBoton = 'Establecer una contraseña nueva';
  const caducidad = `El enlace caduca en ${d.minutosDeCaducidad} minutos y solo sirve una vez.`;
  const tranquilidad =
    'Si no has sido tú, no hace falta que hagas nada: nadie ha cambiado tu contraseña.';

  return componer({
    subject: 'Recupera tu contraseña de Stockeiro',
    lineas: [
      'Has pedido recuperar tu contraseña de Stockeiro.',
      '',
      'Abre este enlace para establecer una contraseña nueva:',
      d.url,
      '',
      caducidad,
      tranquilidad,
    ],
    filas: [
      fila(
        `<p style="margin:0;${FUENTE}font-size:22px;line-height:1.45;color:${COLOR.hueso};">` +
          `Has pedido recuperar tu contraseña de Stockeiro.</p>` +
          parrafo('Abre este enlace para establecer una contraseña nueva:', {
            margenSuperior: 14,
          }),
        '32px 28px 22px',
      ),
      // El botón: 14 + 20 + 14 = 48 px de alto, por encima del suelo táctil de 44 px
      // que ADR-034 fijó para la app en el teléfono.
      fila(
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
          `style="border-collapse:collapse;"><tr>` +
          `<td align="center" style="background-color:${COLOR.acento};border-radius:10px;">` +
          `<a href="${url}" style="display:inline-block;padding:14px 26px;${FUENTE}` +
          `font-size:16px;line-height:20px;font-weight:700;color:${COLOR.lienzo};` +
          `text-decoration:none;">${rotuloDelBoton}</a>` +
          `</td></tr></table>`,
        '0 28px 18px',
      ),
      // La misma URL, desnuda y copiable. `word-break` para que no desborde los 600 px.
      fila(
        `<p style="margin:0;${FUENTE}font-size:13px;line-height:1.5;color:${COLOR.apagado};` +
          `word-break:break-all;">${url}</p>`,
        '0 28px 22px',
      ),
      fila(
        parrafo(caducidad, { tamano: 14, color: COLOR.apagado }) +
          parrafo(tranquilidad, { tamano: 14, color: COLOR.apagado, margenSuperior: 8 }),
        '0 28px 28px',
      ),
    ],
  });
}
