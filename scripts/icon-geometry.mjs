/**
 * icon-geometry.mjs — SPEC-047. La FUENTE del icono de Stockeiro.
 *
 * Aquí vive el dibujo entero: los tres colores (leídos del sistema de diseño, no
 * tecleados), la geometría sobre la rejilla de 32, el trazado de la S y un
 * rasterizador propio. De este fichero salen los DOS formatos que se entregan
 * —`src/app/icon.svg` y `src/app/favicon.ico`— y salen del mismo sitio a propósito:
 * dos ficheros distintos que representan la misma marca divergen en cuanto alguien
 * retoca uno, porque cada navegador enseña sólo uno de los dos (CA-15).
 *
 * SIN DEPENDENCIAS (CA-17). No hay librería de imagen: sólo `node:*`. Una librería
 * para dibujar tres formas es exactamente lo que CE-M3 llama «no es una mejora», y un
 * binario que nadie sabe regenerar es un callejón sin salida el día que haya que mover
 * el punto medio píxel (R-5).
 *
 * ── El dibujo ──────────────────────────────────────────────────────────────────
 *
 * La S son DOS SECTORES DE ANILLO ELÍPTICO tangentes. El de arriba abre a la derecha,
 * el de abajo a la izquierda, y se encuentran en el centro con la tangente horizontal
 * en los dos —de ahí que la unión no tenga pico. Cada cuenco se emite como una
 * POLILÍNEA CERRADA y no como arcos `A`, por dos razones que pesan más que la
 * elegancia del `d`:
 *
 *   1. Lo que rasteriza este fichero y lo que pinta el navegador son entonces la
 *      MISMA lista de vértices, no dos aproximaciones distintas de una curva. CA-15
 *      compara los dos rasterizados: conviene que la única diferencia sea el
 *      antialiasing, no la geometría.
 *   2. La suite mide el `d` del fichero committeado (CA-9). Con una polilínea la
 *      medida es exacta y el parser cabe en diez líneas; con arcos habría que
 *      reimplementar la conversión extremo→centro de SVG dentro de un test, que es
 *      justo el sitio donde un error se disfraza de verde.
 *
 * El error de cuerda con `PASOS_ARCO` es de 0,01 unidades de rejilla: a 512 px eso es
 * 0,16 px. No hay tamaño al que se vean las facetas.
 *
 * ── Por qué estos números y no otros ───────────────────────────────────────────
 *
 * Las proporciones salen de la tabla de la spec (altura de mayúscula 18–22, trazo ≥ 4,
 * ojos ≥ 3, punto 5–7, separación ≥ 2, margen ≥ 2), pero DENTRO de ese margen los
 * valores están elegidos midiendo el rasterizado a 16 px, que es donde se decide si un
 * favicon funciona:
 *
 *   - `TRAZO = 5` es casi el máximo compatible con un ojo de 3 (con altura 22, el ojo
 *     mide 2·(B − TRAZO) = 3,5). Un trazo más fino sobrevive al papel y no al píxel:
 *     a 16 px sólo cuentan como hueso los píxeles que el antialiasing deja casi puros,
 *     y con trazo 4 la tinta se queda por debajo del 15 % que exige CA-14.
 *   - La S es ancha (`SEMI_X = 9,5` frente a `B = 6,75`) porque el ojo de un anillo
 *     elíptico es tan ancho como `2·(SEMI_X − TRAZO)`: es lo que mantiene los dos ojos
 *     abiertos a 16 px (CA-13) con un trazo tan gordo.
 *   - El punto tiene el diámetro máximo (7) y su centro cae en el CENTRO HORIZONTAL de
 *     un píxel y en el BORDE VERTICAL de otro (x = 26,5 → 13,25 px; y = 23 → 11,5 px).
 *     No es superstición: a 16 px el punto mide 3,5 px, y de cómo caiga sobre la
 *     rejilla depende que queden 4 o 7 píxeles de acento puros. CA-12 pide 6.
 */

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { codificarPng } from './png.mjs';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** El lienzo. 32 porque 16 y 32 son los tamaños que se ven de verdad. */
export const REJILLA = 32;

/** El radio de la teselá (D-1). Entre 5 y 7 por contrato; ≈ 3 px a 16. */
export const RADIO_TESELA = 6;

/** Altura de mayúscula de la S y grosor del trazo. */
const ALTURA = 22;
const TRAZO = 5;

/** Semiejes del anillo exterior. `B` sale de la altura: ALTURA = 4·B − TRAZO. */
const B = (ALTURA + TRAZO) / 4;
const SEMI_X = 9.5;

/** Centro horizontal de la S y centro vertical del cuenco superior. */
const EJE_X = 11.5;
const CENTRO_ARRIBA = 11.75;
/** El cuenco inferior es el superior girado 180° sobre la unión: por eso 2·B − TRAZO. */
const CENTRO_ABAJO = CENTRO_ARRIBA + 2 * B - TRAZO;

/**
 * Barrido de cada cuenco, en grados. 295° deja una apertura de 65° — la que convierte
 * un anillo en una S. Con menos barrido la letra se abre y deja de leerse; con más se
 * cierra y se parece a un 8.
 */
const BARRIDO = 295;
/** El cuenco de arriba arranca en su punto más bajo (la unión) y gira hasta el remate. */
const ARRANQUE_ARRIBA = 90;
const ARRANQUE_ABAJO = 270;

/** El punto de la marca: mismo papel que en el wordmark, a la derecha y en la base. */
export const PUNTO = { cx: 26.5, cy: 23, r: 3.5 };

/** Vértices por arco. 0,01 unidades de error de cuerda con los radios de aquí. */
const PASOS_ARCO = 96;

export const GEOMETRIA = {
  altura: ALTURA,
  trazo: TRAZO,
  semiX: SEMI_X,
  semiY: B,
  ejeX: EJE_X,
  centroArriba: CENTRO_ARRIBA,
  centroAbajo: CENTRO_ABAJO,
  barrido: BARRIDO,
  punto: PUNTO,
  radioTesela: RADIO_TESELA,
};

// ---------------------------------------------------------------------------
// Colores: se leen del sistema de diseño (CA-5). Aquí no hay ni un hexadecimal.
// ---------------------------------------------------------------------------

export const CSS_DE_MARCA = join(RAIZ, 'design', 'tremen-ds', 'colors_and_type.css');

/** Resuelve una custom property de un selector, siguiendo los `var(--alias)`. */
function propiedad(css, selector, nombre) {
  const desde = css.indexOf(`${selector} {`);
  if (desde < 0) throw new Error(`no hay bloque "${selector}" en el sistema de diseño`);
  const bloque = css.slice(desde, css.indexOf('}', desde));
  const m = new RegExp(`--${nombre}\\s*:\\s*([^;]+);`).exec(bloque);
  if (!m) throw new Error(`no hay --${nombre} en "${selector}"`);
  const valor = m[1].trim();
  const alias = /^var\(\s*--([\w-]+)\s*\)$/.exec(valor);
  return alias ? propiedad(css, ':root', alias[1]) : valor;
}

/** `--bg` y `--accent` de `.v-tremendo`, `--bone` de `:root`. */
export function tokensDeMarca(rutaCss = CSS_DE_MARCA) {
  const css = readFileSync(rutaCss, 'utf8');
  return {
    fondo: propiedad(css, '.v-tremendo', 'bg'),
    hueso: propiedad(css, ':root', 'bone'),
    acento: propiedad(css, '.v-tremendo', 'accent'),
  };
}

// ---------------------------------------------------------------------------
// Geometría
// ---------------------------------------------------------------------------

const grados = (d) => (d * Math.PI) / 180;

const enElipse = (cx, cy, a, b, th) => [
  cx + a * Math.cos(grados(th)),
  cy + b * Math.sin(grados(th)),
];

/**
 * Un cuenco como polígono cerrado: el arco exterior de ida y el interior de vuelta.
 * Los dos remates son los segmentos rectos que unen los extremos, y el de la unión
 * (el que cierra la figura) cae justo sobre el remate del otro cuenco.
 */
function cuenco(cy, arranque) {
  const pts = [];
  for (let i = 0; i <= PASOS_ARCO; i++) {
    pts.push(enElipse(EJE_X, cy, SEMI_X, B, arranque + (BARRIDO * i) / PASOS_ARCO));
  }
  for (let i = PASOS_ARCO; i >= 0; i--) {
    pts.push(
      enElipse(EJE_X, cy, SEMI_X - TRAZO, B - TRAZO, arranque + (BARRIDO * i) / PASOS_ARCO),
    );
  }
  return pts;
}

/** Los dos cuencos de la S, como listas de vértices sobre la rejilla de 32. */
export function cuencosDeLaS() {
  return [cuenco(CENTRO_ARRIBA, ARRANQUE_ARRIBA), cuenco(CENTRO_ABAJO, ARRANQUE_ABAJO)];
}

/** Redondeo a 3 decimales sin ceros de relleno: 2 → "2", 11.7503 → "11.75". */
const coord = (v) => String(Math.round(v * 1000) / 1000);

/** El atributo `d` de la S: una subruta `M … L … Z` por cuenco. */
export function trazadoDeLaS() {
  return cuencosDeLaS()
    .map((pts) => {
      const [x0, y0] = pts[0];
      const resto = pts.slice(1).map(([x, y]) => `${coord(x)} ${coord(y)}`);
      return `M${coord(x0)} ${coord(y0)}L${resto.join(' ')}Z`;
    })
    .join('');
}

/** La teselá redondeada, como polígono (sólo para rasterizar; el SVG usa <rect>). */
function poligonoTesela() {
  const r = RADIO_TESELA;
  const esquinas = [
    [r, r, 180],
    [REJILLA - r, r, 270],
    [REJILLA - r, REJILLA - r, 0],
    [r, REJILLA - r, 90],
  ];
  const pts = [];
  for (const [cx, cy, desde] of esquinas) {
    for (let i = 0; i <= 24; i++) {
      pts.push(enElipse(cx, cy, r, r, desde + (90 * i) / 24));
    }
  }
  return pts;
}

/** El punto, como polígono (sólo para rasterizar; el SVG usa <circle>). */
function poligonoPunto() {
  return Array.from({ length: 192 }, (_, i) =>
    enElipse(PUNTO.cx, PUNTO.cy, PUNTO.r, PUNTO.r, (360 * i) / 192),
  );
}

// ---------------------------------------------------------------------------
// El SVG
// ---------------------------------------------------------------------------

/**
 * `src/app/icon.svg`. Tres formas y nada más (CA-10): la teselá, la S y el punto.
 * Ni `<text>`, ni `font-family`, ni `currentColor`, ni `prefers-color-scheme`: el
 * icono tiene que verse igual en la máquina de cualquiera y no puede pedir nada fuera
 * (CA-1, CA-2). El `<title>` es metadato de accesibilidad, no texto pintado.
 */
export function svgDelIcono(colores = tokensDeMarca()) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${REJILLA} ${REJILLA}" width="${REJILLA}" height="${REJILLA}">`,
    `<title>Stockeiro</title>`,
    `<rect x="0" y="0" width="${REJILLA}" height="${REJILLA}" rx="${RADIO_TESELA}" fill="${colores.fondo}"/>`,
    `<path d="${trazadoDeLaS()}" fill="${colores.hueso}"/>`,
    `<circle cx="${PUNTO.cx}" cy="${PUNTO.cy}" r="${PUNTO.r}" fill="${colores.acento}"/>`,
    `</svg>`,
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Rasterizador
// ---------------------------------------------------------------------------

/** Submuestras por eje. 8 → 64 muestras por píxel: suficiente para que el borde no
 *  dependa de dónde caiga la rejilla de muestreo. */
const SUBMUESTRAS = 8;

/** Los cruces de un polígono con la horizontal `y`, ordenados. */
function cruces(poly, y) {
  const xs = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y) xs.push(xi + ((xj - xi) * (y - yi)) / (yj - yi));
  }
  return xs.sort((a, b) => a - b);
}

/** Máscara booleana de una fila de submuestras: par-impar sobre los cruces. */
function mascara(polys, y, columnas, paso, desplazamiento) {
  const dentro = new Uint8Array(columnas);
  for (const poly of polys) {
    const xs = cruces(poly, y);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const desde = Math.ceil((xs[k] - desplazamiento) / paso);
      const hasta = Math.floor((xs[k + 1] - desplazamiento) / paso);
      for (let c = Math.max(0, desde); c <= Math.min(columnas - 1, hasta); c++) dentro[c] = 1;
    }
  }
  return dentro;
}

const canal = (hex, i) => parseInt(hex.replace('#', '').slice(i * 2, i * 2 + 2), 16);

/**
 * Rasteriza el icono a `lado`×`lado` en RGBA (fila a fila desde arriba, alfa recta).
 *
 * Pinta por submuestra y no por capa: para cada punto se decide QUÉ forma manda
 * (punto > S > teselá) y se acumula su color. Así el borde entre dos formas contiguas
 * sale de la mezcla real de las dos y no de superponer dos bordes ya suavizados, que
 * es como aparecen las costuras claras entre figuras adyacentes.
 */
export function rasterizar(lado, colores = tokensDeMarca()) {
  const data = new Uint8ClampedArray(lado * lado * 4);
  const escala = lado / REJILLA;
  const paso = 1 / (escala * SUBMUESTRAS);
  const desplazamiento = paso / 2;
  const columnas = lado * SUBMUESTRAS;

  const capas = [
    { polys: [poligonoPunto()], color: colores.acento },
    { polys: cuencosDeLaS(), color: colores.hueso },
    { polys: [poligonoTesela()], color: colores.fondo },
  ];
  const rgb = capas.map((c) => [canal(c.color, 0), canal(c.color, 1), canal(c.color, 2)]);

  const acumulado = new Float64Array(lado * lado * 4);
  for (let fila = 0; fila < lado * SUBMUESTRAS; fila++) {
    const y = (fila + 0.5) * paso;
    const mascaras = capas.map((c) => mascara(c.polys, y, columnas, paso, desplazamiento));
    const py = Math.floor(fila / SUBMUESTRAS);
    for (let col = 0; col < columnas; col++) {
      const capa = mascaras.findIndex((m) => m[col]);
      if (capa < 0) continue;
      const p = (py * lado + Math.floor(col / SUBMUESTRAS)) * 4;
      acumulado[p] += rgb[capa][0];
      acumulado[p + 1] += rgb[capa][1];
      acumulado[p + 2] += rgb[capa][2];
      acumulado[p + 3] += 1;
    }
  }

  const muestras = SUBMUESTRAS * SUBMUESTRAS;
  for (let i = 0; i < lado * lado; i++) {
    const cobertura = acumulado[i * 4 + 3];
    if (!cobertura) continue;
    data[i * 4] = Math.round(acumulado[i * 4] / cobertura);
    data[i * 4 + 1] = Math.round(acumulado[i * 4 + 1] / cobertura);
    data[i * 4 + 2] = Math.round(acumulado[i * 4 + 2] / cobertura);
    data[i * 4 + 3] = Math.round((255 * cobertura) / muestras);
  }
  return { size: lado, data };
}

// ---------------------------------------------------------------------------
// El .ico
// ---------------------------------------------------------------------------

/** Los tres tamaños que declara la spec. El 16 no sale de reescalar el 32: se
 *  rasteriza desde el vector, que es donde el reescalado automático suele fallar. */
export const TAMANOS_ICO = [16, 32, 48];

/**
 * Empaqueta los rasterizados en un `.ico`: ICONDIR + una entrada por tamaño +
 * BITMAPINFOHEADER de 32 bpp (BGRA de abajo arriba) con su máscara AND a cero — con
 * canal alfa la máscara sobra, pero el formato la exige y omitirla rompe lectores
 * viejos.
 */
export function codificarIco(rasters) {
  const cuerpos = rasters.map(({ size, data }) => {
    const filaMascara = Math.ceil(size / 32) * 4;
    const dib = Buffer.alloc(40 + size * size * 4 + filaMascara * size);
    dib.writeUInt32LE(40, 0); // biSize
    dib.writeInt32LE(size, 4); // biWidth
    dib.writeInt32LE(size * 2, 8); // biHeight: XOR + AND
    dib.writeUInt16LE(1, 12); // biPlanes
    dib.writeUInt16LE(32, 14); // biBitCount
    dib.writeUInt32LE(0, 16); // biCompression = BI_RGB
    dib.writeUInt32LE(size * size * 4 + filaMascara * size, 20); // biSizeImage
    for (let y = 0; y < size; y++) {
      const origen = size - 1 - y; // el DIB se guarda de abajo arriba
      for (let x = 0; x < size; x++) {
        const s = (origen * size + x) * 4;
        const d = 40 + (y * size + x) * 4;
        dib[d] = data[s + 2];
        dib[d + 1] = data[s + 1];
        dib[d + 2] = data[s];
        dib[d + 3] = data[s + 3];
      }
    }
    return { size, dib };
  });

  const cabecera = Buffer.alloc(6 + cuerpos.length * 16);
  cabecera.writeUInt16LE(0, 0); // reservado
  cabecera.writeUInt16LE(1, 2); // tipo: icono
  cabecera.writeUInt16LE(cuerpos.length, 4);
  let offset = cabecera.length;
  cuerpos.forEach(({ size, dib }, i) => {
    const o = 6 + i * 16;
    cabecera[o] = size === 256 ? 0 : size;
    cabecera[o + 1] = size === 256 ? 0 : size;
    cabecera[o + 2] = 0; // paleta
    cabecera[o + 3] = 0; // reservado
    cabecera.writeUInt16LE(1, o + 4); // planos
    cabecera.writeUInt16LE(32, o + 6); // bits
    cabecera.writeUInt32LE(dib.length, o + 8);
    cabecera.writeUInt32LE(offset, o + 12);
    offset += dib.length;
  });

  return Buffer.concat([cabecera, ...cuerpos.map((c) => c.dib)]);
}

/** El `.ico` completo, con sus tres tamaños rasterizados desde el vector. */
export function icoDelIcono(colores = tokensDeMarca()) {
  return codificarIco(TAMANOS_ICO.map((lado) => rasterizar(lado, colores)));
}

// ---------------------------------------------------------------------------
// La tarjeta social — SPEC-051
// ---------------------------------------------------------------------------

/**
 * El lienzo de la vista previa del enlace, y la escala a la que se lleva la rejilla de
 * 32 del icono.
 *
 * 1200×630 es la medida que piden Open Graph y `summary_large_image`. `escala: 13` sale
 * de dos contratos a la vez (§Geometría de la spec): la altura de mayúscula de la S son
 * 22 unidades de rejilla, así que 22·13 = 286 px, dentro del 35–50 % de 630 que fija la
 * tabla; y la marca entera —28 unidades de ancho— ocupa 364 px, que caben con holgura en
 * el cuadrado central de 630 con sus 60 px de aire (D-6: las plataformas recortan, y una
 * tarjeta que sólo se ve entera en Facebook es media tarjeta).
 *
 * NO se dibuja ninguna forma nueva (D-2): son `cuencosDeLaS()` y el mismo círculo del
 * punto, escalados. Y NO va la teselá (D-3): la tarjeta ocupa el lienzo entero y es su
 * propio suelo, así que el rectángulo redondeado del icono no tendría aquí contra qué
 * recortarse — el motivo por el que el icono lo lleva (el cromo del navegador es claro u
 * oscuro según el sistema de quien mira) no existe en una vista previa.
 */
export const TARJETA = { ancho: 1200, alto: 630, escala: 13 };

/**
 * La rejilla del icono llevada al lienzo de la tarjeta: el centro de la rejilla cae en el
 * centro del lienzo. Que eso baste para centrar la marca no es suerte: la caja envolvente
 * del wordmark sobre la rejilla de 32 va de 2 a 30 en x y de 5 a 27 en y, o sea que su
 * centro ES (16, 16). Centrar la rejilla centra la marca, y exacto.
 */
function aLienzo(poly, escala, cx, cy) {
  return poly.map(([x, y]) => [cx + (x - REJILLA / 2) * escala, cy + (y - REJILLA / 2) * escala]);
}

/**
 * Rasteriza la tarjeta a RGBA (fila a fila desde arriba, TODO opaco — CA-7).
 *
 * Mismo criterio de muestreo que `rasterizar()`: se decide por submuestra qué forma manda
 * (punto > S > lienzo) y se promedia, para que el borde entre dos formas salga de la
 * mezcla real y no de superponer dos bordes ya suavizados. Lo que cambia es que el suelo
 * no es una figura sino el fondo del lienzo, y que sólo se recorre la banda que ocupa la
 * marca: el resto ya está pintado, y barrerlo entero serían 48 millones de submuestras
 * para no cambiar un píxel.
 */
export function rasterizarTarjeta(colores = tokensDeMarca()) {
  const { ancho, alto, escala } = TARJETA;
  const fondo = [canal(colores.fondo, 0), canal(colores.fondo, 1), canal(colores.fondo, 2)];

  const data = new Uint8ClampedArray(ancho * alto * 4);
  for (let i = 0; i < ancho * alto; i++) {
    data[i * 4] = fondo[0];
    data[i * 4 + 1] = fondo[1];
    data[i * 4 + 2] = fondo[2];
    data[i * 4 + 3] = 255;
  }

  const capas = [
    { polys: [poligonoPunto()], color: colores.acento },
    { polys: cuencosDeLaS(), color: colores.hueso },
  ].map((c) => ({
    polys: c.polys.map((p) => aLienzo(p, escala, ancho / 2, alto / 2)),
    rgb: [canal(c.color, 0), canal(c.color, 1), canal(c.color, 2)],
  }));

  const vertices = capas.flatMap((c) => c.polys.flat());
  const x0 = Math.max(0, Math.floor(Math.min(...vertices.map((p) => p[0]))) - 1);
  const x1 = Math.min(ancho - 1, Math.ceil(Math.max(...vertices.map((p) => p[0]))) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(...vertices.map((p) => p[1]))) - 1);
  const y1 = Math.min(alto - 1, Math.ceil(Math.max(...vertices.map((p) => p[1]))) + 1);

  const paso = 1 / SUBMUESTRAS;
  const anchoBanda = x1 - x0 + 1;
  const columnas = anchoBanda * SUBMUESTRAS;
  const muestras = SUBMUESTRAS * SUBMUESTRAS;
  const acumulado = new Float64Array(anchoBanda * (y1 - y0 + 1) * 4);

  for (let sub = y0 * SUBMUESTRAS; sub < (y1 + 1) * SUBMUESTRAS; sub++) {
    const y = (sub + 0.5) * paso;
    const mascaras = capas.map((c) => mascara(c.polys, y, columnas, paso, x0 + paso / 2));
    const fila = Math.floor(sub / SUBMUESTRAS) - y0;
    for (let col = 0; col < columnas; col++) {
      let capa = -1;
      for (let k = 0; k < mascaras.length; k++) {
        if (mascaras[k][col]) {
          capa = k;
          break;
        }
      }
      if (capa < 0) continue;
      const p = (fila * anchoBanda + Math.floor(col / SUBMUESTRAS)) * 4;
      acumulado[p] += capas[capa].rgb[0];
      acumulado[p + 1] += capas[capa].rgb[1];
      acumulado[p + 2] += capas[capa].rgb[2];
      acumulado[p + 3] += 1;
    }
  }

  for (let fila = 0; fila <= y1 - y0; fila++) {
    for (let col = 0; col < anchoBanda; col++) {
      const p = (fila * anchoBanda + col) * 4;
      const cobertura = acumulado[p + 3];
      if (!cobertura) continue;
      // Las submuestras que no cubre ninguna forma son lienzo, y entran en el promedio
      // con el color del fondo. Así un píxel interior sale EXACTO —sus 64 muestras son
      // del mismo color— y sólo el borde queda como mezcla, que es lo que CA-8 admite y
      // acota en el 12 %.
      const destino = ((fila + y0) * ancho + col + x0) * 4;
      for (let k = 0; k < 3; k++) {
        data[destino + k] = Math.round(
          (acumulado[p + k] + (muestras - cobertura) * fondo[k]) / muestras,
        );
      }
      data[destino + 3] = 255;
    }
  }

  return { ancho, alto, data };
}

/** La tarjeta ya codificada: los bytes de `src/app/opengraph-image.png`. */
export function pngDeLaTarjeta(colores = tokensDeMarca()) {
  const { ancho, alto, data } = rasterizarTarjeta(colores);
  return codificarPng(ancho, alto, data);
}
