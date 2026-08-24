import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { appBaseUrl, buildResetUrl } from '@/lib/config/app-url';

/**
 * SPEC-055 — **`APP_BASE_URL` envenenada**: `appBaseUrl()` valida el valor y no sólo su
 * presencia.
 *
 * `appBaseUrl()` no tenía ningún test propio. Lo protegía una sola línea —`if (!raw)
 * throw`— que cubre la clave AUSENTE y deja pasar cualquier cadena no vacía. Con
 * `APP_BASE_URL="[SENSITIVE]"` —el marcador que `vercel env pull` escribe en
 * `.env.production.local` cuando la variable está marcada como *Sensitive* en Vercel— el
 * valor atraviesa la función y estalla río abajo: en `metadataBase` como un `Invalid URL`
 * sin sujeto durante el build, y en el enlace de recuperación **después** de las dos
 * salidas tempranas de `password-reset.ts`, que es donde se convierte en un oráculo de
 * enumeración (CA-8).
 *
 * Este fichero es la batería entera. Su disciplina, que es la de D-6 de la spec: **cada
 * fila rechazada no AFIRMA que el valor era malo, lo DEMUESTRA** — evalúa en el propio
 * test las dos expresiones que rompían (`new URL(v)` del layout y
 * `new URL('/reset-password/…', v + '/')` del correo) y contrasta con una
 * reimplementación de la `appBaseUrl()` anterior. Si mañana alguien afloja la guardia, el
 * contraste se pone rojo en vez de quedarse callado.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ESTE_FICHERO = fileURLToPath(import.meta.url);
const fuente = (ruta: string) => readFileSync(join(rootDir, ruta), 'utf8');

/**
 * Un entorno de mentira con —o sin— la clave. El doble `as` es necesario porque los tipos
 * de Next declaran `NODE_ENV` obligatoria en `ProcessEnv`, y aquí el sujeto de la prueba
 * es exactamente lo que vale `APP_BASE_URL` y nada más.
 */
const entorno = (valor?: string): NodeJS.ProcessEnv =>
  (valor === undefined ? {} : { APP_BASE_URL: valor }) as unknown as NodeJS.ProcessEnv;

/**
 * El recorte que el mensaje aplica al valor. **120 caracteres, decidido en el gate del
 * 2026-08-24**: `APP_BASE_URL` es un origen público y no un secreto, así que el recorte
 * es por legibilidad y no por confidencialidad. Se recalcula aquí a mano —`slice` + `…`—
 * para que el test no le pregunte a la implementación cuál es su propia respuesta.
 */
const MAX_VALOR_EN_MENSAJE = 120;
const recorteEsperado = (v: string) =>
  v.length > MAX_VALOR_EN_MENSAJE ? `${v.slice(0, MAX_VALOR_EN_MENSAJE)}…` : v;

/**
 * **La `appBaseUrl()` anterior, tal y como estaba en `src/lib/config/app-url.ts:13` hasta
 * el 2026-08-24**: `trim`, `if (!raw) throw` y recorte de barras finales. Tres líneas.
 *
 * Está aquí por ADR-026 §7 —*una guardia nueva demuestra que caza el defecto*— y no como
 * arqueología: es el espécimen contra el que se mide la guardia. Cada valor que la tabla
 * declara rechazado tiene que ATRAVESAR esta versión (CA-11); si algún día uno deja de
 * atravesarla, o la guardia nueva deja de detenerlo, el contraste falla y alguien tiene
 * que mirar por qué. Sin este contraste, la tabla sería una lista de literales que nadie
 * vuelve a comprobar, que es justo lo que `F-SPEC-048-2` describe.
 */
function appBaseUrlAnterior(env: NodeJS.ProcessEnv): string {
  const raw = env.APP_BASE_URL?.trim();
  if (!raw) throw new Error('APP_BASE_URL no definida (ver .env.example): sin ella no hay enlaces válidos.');
  return raw.replace(/\/+$/, '');
}

/** Las tres familias de rechazo. El centinela de CA-11 exige un representante de cada una. */
const FAMILIAS = ['no-parsea', 'protocolo', 'forma'] as const;
type Familia = (typeof FAMILIAS)[number];

type Fila = {
  /** Rótulo corto para el título del caso; el sujeto de la prueba es `valor`. */
  nombre: string;
  valor: string;
  familia: Familia;
  /** Por qué está aquí. Se lee, no se ejecuta: el test mide, no cree. */
  porque: string;
};

/**
 * **La tabla de valores rechazados.** Crece añadiendo filas y nada más: ninguna aserción
 * de este fichero fija su longitud ni la compara con una lista literal, y CA-12 lo
 * comprueba leyendo esta misma fuente. Es la lección de `F-SPEC-048-2`: una guardia que
 * congela una lista que crece caduca sola.
 */
const NOMBRE_DE_LA_TABLA = 'VALORES_RECHAZADOS';
const VALORES_RECHAZADOS: Fila[] = [
  {
    nombre: '[SENSITIVE]',
    valor: '[SENSITIVE]',
    familia: 'no-parsea',
    porque: 'el marcador que deja `vercel env pull`; es el caso real que motiva la spec',
  },
  {
    nombre: '[REDACTED]',
    valor: '[REDACTED]',
    familia: 'no-parsea',
    porque: 'marcador parecido pero distinto: prueba que no hay lista cerrada decidiendo (CA-7)',
  },
  {
    nombre: 'sin esquema',
    valor: 'stockeiro.tremen.dev',
    familia: 'no-parsea',
    porque: 'el dominio a secas parece una URL y no lo es',
  },
  {
    nombre: 'relativa al protocolo',
    valor: '//evil.com',
    familia: 'no-parsea',
    porque: 'sin base no hay origen que sacar',
  },
  {
    nombre: 'con las comillas dentro del valor',
    valor: '"https://a.com"',
    familia: 'no-parsea',
    porque: 'copiar la línea de un `.env` con sus comillas es un error de dedo real',
  },
  {
    nombre: 'ftp:',
    valor: 'ftp://x.com',
    familia: 'protocolo',
    porque: 'parsea y llega VIVO hasta el enlace del correo; que parsee no basta',
  },
  {
    nombre: 'file:',
    valor: 'file:///etc/passwd',
    familia: 'protocolo',
    porque: 'parsea, tiene `origin` null y también llega al correo',
  },
  {
    nombre: 'javascript:',
    valor: 'javascript:alert(1)',
    familia: 'protocolo',
    porque: 'parsea en el layout y estalla en el correo: los dos consumidores discrepan',
  },
  {
    nombre: 'con ruta',
    valor: 'https://a.com/es',
    familia: 'forma',
    porque: '`metadataBase` conserva la ruta y el enlace del correo la tira (CA-4)',
  },
  {
    nombre: 'con query',
    valor: 'https://a.com?x=1',
    familia: 'forma',
    porque: 'un origen no lleva query; el correo la perdería sin decirlo',
  },
  {
    nombre: 'con fragmento',
    valor: 'https://a.com#f',
    familia: 'forma',
    porque: 'un origen no lleva fragmento',
  },
  {
    nombre: 'con credenciales',
    valor: 'https://u:p@a.com',
    familia: 'forma',
    porque: 'unas credenciales en el origen viajarían dentro de cada enlace enviado',
  },
  {
    nombre: 'una ruta larguísima (300 caracteres)',
    valor: `https://a.com/${'x'.repeat(300)}`,
    familia: 'forma',
    porque: 'el valor entra recortado en el mensaje (CA-7), y aquí se ve',
  },
];

const deFamilia = (familia: Familia) => VALORES_RECHAZADOS.filter((f) => f.familia === familia);

/** El mensaje con el que `appBaseUrl()` rechaza un valor. Si no rechaza, el caso falla. */
function mensajeDeRechazo(valor: string): string {
  let devuelto: string | undefined;
  try {
    devuelto = appBaseUrl(entorno(valor));
  } catch (e) {
    return (e as Error).message;
  }
  return expect.fail(`appBaseUrl() no rechazó «${valor}»: devolvió «${devuelto}»`);
}

type RioAbajo = { tipo: 'llega'; enlace: string } | { tipo: 'estalla'; mensaje: string };

/**
 * Qué le pasaba a un valor **después** de atravesar la `appBaseUrl()` anterior: o llegaba
 * vivo al enlace que sale por correo, o estallaba allí sin decir de qué clave venía. Se
 * MIDE ejecutando la expresión real de `buildResetUrl`, que es la del correo.
 */
function medirRioAbajo(vivo: string): RioAbajo {
  try {
    return { tipo: 'llega', enlace: buildResetUrl(vivo, 'tok') };
  } catch (e) {
    return { tipo: 'estalla', mensaje: (e as Error).message };
  }
}

describe('SPEC-055 CA-1 — la rama que hoy funciona no se toca', () => {
  // El literal `APP_BASE_URL no definida` y la firma `appBaseUrl(env)` son CONTRATO CON
  // SPEC-052 CA-14, que los congela en su propio `tests/entornos-de-despliegue.test.ts`.
  // Cambiar cualquiera de los dos pone RED a esa spec sin tocar ninguno de sus ficheros.
  // No se cambian sin avisar a quien la gobierne.
  it('sin la clave, lanza con el mensaje de siempre', () => {
    expect(() => appBaseUrl(entorno())).toThrow(/APP_BASE_URL no definida/);
  });

  it('con sólo espacios, lanza con el mensaje de siempre', () => {
    expect(() => appBaseUrl(entorno('   '))).toThrow(/APP_BASE_URL no definida/);
  });

  it('la firma sigue siendo `appBaseUrl(env: NodeJS.ProcessEnv = process.env)`', () => {
    expect(fuente('src/lib/config/app-url.ts')).toContain(
      'export function appBaseUrl(env: NodeJS.ProcessEnv = process.env): string {',
    );
    // Un parámetro con valor por defecto no cuenta en `.length`: la aridad declarada sigue
    // siendo la misma que SPEC-052 espera poder invocar con un `env` de mentira.
    expect(appBaseUrl.length).toBe(0);
  });
});

describe('SPEC-055 CA-2 — un valor que no parsea se rechaza con diagnóstico', () => {
  it('la familia tiene filas (centinela: una tabla vacía no está verde, está vacía)', () => {
    expect(deFamilia('no-parsea').length).toBeGreaterThan(0);
  });

  it.each(deFamilia('no-parsea'))('$nombre — $valor', ({ valor }) => {
    // El ANTES, evaluado y no afirmado: `new URL()` lo rechaza, y su mensaje no nombra ni
    // la clave ni el fichero. Eso es exactamente lo que el desarrollador ve hoy.
    let mensajeDeNewUrl = '';
    try {
      new URL(valor);
      expect.fail(`«${valor}» ya no rompe new URL(): la fila está caduca`);
    } catch (e) {
      mensajeDeNewUrl = (e as Error).message;
    }
    expect(mensajeDeNewUrl).toMatch(/Invalid URL/);
    expect(mensajeDeNewUrl).not.toContain('APP_BASE_URL');

    // El DESPUÉS: la guardia lo detiene, y lo dice.
    expect(mensajeDeRechazo(valor)).toContain('APP_BASE_URL');
  });
});

describe('SPEC-055 CA-3 — un protocolo que no es http/https se rechaza', () => {
  it('la familia tiene filas (centinela)', () => {
    expect(deFamilia('protocolo').length).toBeGreaterThan(0);
  });

  it.each(deFamilia('protocolo'))('$nombre — $valor', ({ valor }) => {
    // El ANTES: parsea, atraviesa la función de ayer y llega hasta el correo —o estalla
    // allí, sin sujeto—. Las dos mitades se MIDEN.
    const url = new URL(valor);
    expect(['http:', 'https:']).not.toContain(url.protocol);

    const vivo = appBaseUrlAnterior(entorno(valor));
    const rioAbajo = medirRioAbajo(vivo);
    if (rioAbajo.tipo === 'llega') {
      expect(new URL(rioAbajo.enlace).protocol).toBe(url.protocol);
      expect(rioAbajo.enlace).toContain('/reset-password/');
    } else {
      expect(rioAbajo.mensaje).toMatch(/Invalid URL/);
      expect(rioAbajo.mensaje).not.toContain('APP_BASE_URL');
    }

    // El DESPUÉS: la guardia lo detiene, nombra el protocolo recibido y dice cuáles valen.
    const mensaje = mensajeDeRechazo(valor);
    expect(mensaje).toContain(url.protocol);
    expect(mensaje).toContain('http:');
    expect(mensaje).toContain('https:');
  });
});

describe('SPEC-055 CA-4 — ruta, query, fragmento y credenciales se rechazan', () => {
  it('la familia tiene filas (centinela)', () => {
    expect(deFamilia('forma').length).toBeGreaterThan(0);
  });

  it.each(deFamilia('forma'))('$nombre — $familia', ({ valor }) => {
    expect(['http:', 'https:']).toContain(new URL(valor).protocol);
    expect(mensajeDeRechazo(valor)).toContain('APP_BASE_URL');
  });

  it('con ruta los dos consumidores significan cosas distintas — calculado, no afirmado', () => {
    const valor = 'https://a.com/es';
    // Lo que hace `src/app/layout.tsx:57`.
    const enMetadataBase = new URL(valor);
    // Lo que hace `buildResetUrl`, que es lo que va dentro del correo.
    const enElCorreo = new URL('/reset-password/tok', `${valor}/`);

    expect(enMetadataBase.pathname).toBe('/es');
    expect(enElCorreo.pathname).toBe('/reset-password/tok');
    expect(enElCorreo.pathname.startsWith('/es')).toBe(false);
    // La discrepancia queda demostrada; ahora el valor se rechaza en vez de dejar que cada
    // consumidor entienda una cosa.
    expect(() => appBaseUrl(entorno(valor))).toThrow();
  });

  it('la barra final se sigue tolerando y se recorta, igual que hoy', () => {
    expect(appBaseUrl(entorno('https://a.com/'))).toBe('https://a.com');
    expect(appBaseUrl(entorno('https://a.com'))).toBe('https://a.com');
    // Y varias barras también, porque el recorte de ayer era `/\/+$/` y no una sola.
    expect(appBaseUrl(entorno('https://a.com//'))).toBe('https://a.com');
  });
});

/**
 * CA-5 — los valores vivos se LEEN de sus fuentes, no se escriben aquí.
 *
 * `FOUNDATION.md` §Cómo se trabaja aquí: *un test de frontera fija una propiedad, no un
 * estado del árbol*. La propiedad es «lo que CI y el e2e usan de verdad sigue pasando la
 * guardia»; si mañana alguien cambia el valor de CI por algo que la guardia rechaza, el
 * rojo sale aquí y no en un despliegue. Leer estos ficheros no es tocarlos: ninguno de
 * los tres se modifica en esta entrega.
 */
function valoresDeCi(): string[] {
  const ci = parseYaml(fuente('.github/workflows/ci.yml')) as unknown;
  const encontrados: string[] = [];
  const recorrer = (nodo: unknown): void => {
    if (Array.isArray(nodo)) {
      for (const hijo of nodo) recorrer(hijo);
      return;
    }
    if (nodo === null || typeof nodo !== 'object') return;
    for (const [clave, valor] of Object.entries(nodo as Record<string, unknown>)) {
      if (clave === 'APP_BASE_URL' && typeof valor === 'string') encontrados.push(valor);
      else recorrer(valor);
    }
  };
  recorrer(ci);
  return encontrados;
}

/** El del launcher del e2e, con su `${APP_PORT}` resuelto desde la constante del fichero. */
function valorDelE2e(): string {
  const src = fuente('tests/e2e/server.mjs');
  const m = /APP_BASE_URL:\s*`([^`]+)`/.exec(src);
  expect(m, 'no se encontró APP_BASE_URL en tests/e2e/server.mjs: centinela').not.toBeNull();
  const constantes = new Map<string, string>();
  for (const c of src.matchAll(/const\s+([A-Z_][A-Z0-9_]*)\s*=\s*([^;\n]+);/g)) {
    constantes.set(c[1], c[2].trim().replace(/^['"`]|['"`]$/g, ''));
  }
  return m![1].replace(/\$\{([^}]+)\}/g, (_, nombre: string) => constantes.get(nombre.trim()) ?? '');
}

/**
 * El de `.env.example`. Las comillas se quitan A PROPÓSITO y con nombre: el fichero las
 * lleva porque es formato `dotenv`, y el valor que la variable acaba teniendo no las
 * incluye. Copiarlas con comillas es precisamente una de las filas rechazadas.
 */
function valorDeEnvExample(): string {
  const m = /^APP_BASE_URL=(.+)$/m.exec(fuente('.env.example'));
  expect(m, 'no se encontró APP_BASE_URL en .env.example: centinela').not.toBeNull();
  return m![1].trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
}

describe('SPEC-055 CA-5 — los valores que hoy funcionan de verdad siguen funcionando', () => {
  it('el de CI, leído de .github/workflows/ci.yml', () => {
    const valores = valoresDeCi();
    expect(valores.length, 'ci.yml no declara ningún APP_BASE_URL: centinela').toBeGreaterThan(0);
    for (const v of valores) {
      expect(v.trim()).not.toBe('');
      expect(appBaseUrl(entorno(v))).toBe(v.replace(/\/+$/, ''));
    }
  });

  it('el del e2e, leído de tests/e2e/server.mjs', () => {
    const v = valorDelE2e();
    expect(v).not.toContain('${');
    expect(v.trim()).not.toBe('');
    expect(appBaseUrl(entorno(v))).toBe(v.replace(/\/+$/, ''));
  });

  it('y el origen https de producción, leído de .env.example', () => {
    const v = valorDeEnvExample();
    expect(v.startsWith('https://'), `.env.example declara «${v}», que no es https`).toBe(true);
    expect(appBaseUrl(entorno(v))).toBe(v.replace(/\/+$/, ''));
  });

  it('http y localhost valen sin excepción ni «sólo en desarrollo»', () => {
    expect(appBaseUrl(entorno('http://localhost:3200'))).toBe('http://localhost:3200');
    expect(appBaseUrl(entorno('http://127.0.0.1:3000'))).toBe('http://127.0.0.1:3000');
  });
});

describe('SPEC-055 CA-6 — el mensaje nombra la clave, el valor y dónde buscarlo', () => {
  it('la tabla no está vacía (centinela)', () => {
    expect(VALORES_RECHAZADOS.length).toBeGreaterThan(0);
  });

  // Los cuatro asertos, sobre TODAS las filas de las tres familias: no sobre una de
  // muestra. Un mensaje que sólo diagnostica el caso que alguien recordó es otro build
  // rojo mudo para el resto (D-4, la doctrina de SPEC-016 y SPEC-043).
  it.each(VALORES_RECHAZADOS)('$familia — $nombre', ({ valor }) => {
    const mensaje = mensajeDeRechazo(valor);
    expect(mensaje, '(a) la clave culpable').toContain('APP_BASE_URL');
    expect(mensaje, '(b) el valor recibido, delimitado').toContain(`«${recorteEsperado(valor)}»`);
    expect(mensaje, '(c) la forma esperada, con ejemplo').toContain('http://localhost:3200');
    expect(mensaje, '(c) la forma esperada, con ejemplo').toContain('https://stockeiro.tremen.dev');
    expect(mensaje, '(d) dónde mirar').toContain('.env.production.local');
    expect(mensaje, '(d) y que manda sobre `.env`').toMatch(/manda sobre[^.]*`\.env`/);
  });
});

describe('SPEC-055 CA-7 — `[SENSITIVE]` lleva pista, y la pista es aditiva', () => {
  it('el marcador de Vercel añade su pista sin perder nada de CA-6', () => {
    const mensaje = mensajeDeRechazo('[SENSITIVE]');
    expect(mensaje).toContain('vercel env pull');
    expect(mensaje).toContain('Sensitive');
    expect(mensaje).toContain('.env.production.local');
    expect(mensaje).toContain('APP_BASE_URL');
    expect(mensaje).toContain('«[SENSITIVE]»');
  });

  it('un marcador parecido pero distinto se rechaza IGUAL, y sin la pista', () => {
    // Éste es el caso que prueba que la pista es aditiva y no la rama que decide (D-5):
    // si mañana Vercel escribe otro marcador, se pierde la pista y NO el rechazo. Es la
    // lección de `F-SPEC-048-2`: un literal reconocido, cero listas cerradas.
    const mensaje = mensajeDeRechazo('[REDACTED]');
    expect(mensaje).toContain('APP_BASE_URL');
    expect(mensaje).toContain('«[REDACTED]»');
    expect(mensaje).not.toContain('vercel env pull');
  });

  it('un valor larguísimo entra recortado en el mensaje', () => {
    const largo = `https://a.com/${'x'.repeat(300)}`;
    const mensaje = mensajeDeRechazo(largo);
    expect(mensaje).not.toContain(largo);
    expect(mensaje).toContain(`«${largo.slice(0, MAX_VALOR_EN_MENSAJE)}…»`);
  });
});

describe('SPEC-055 CA-11 — la guardia demuestra que caza el defecto (ADR-026 §7)', () => {
  it('la tabla no está vacía y tiene un representante de cada familia (centinela)', () => {
    expect(VALORES_RECHAZADOS.length).toBeGreaterThan(0);
    for (const familia of FAMILIAS) {
      expect(
        VALORES_RECHAZADOS.some((f) => f.familia === familia),
        `la tabla no tiene ningún representante de la familia «${familia}»`,
      ).toBe(true);
    }
  });

  it.each(VALORES_RECHAZADOS)('$familia — $nombre atravesaba la anterior', ({ valor }) => {
    // 1. El espécimen: la `appBaseUrl()` de ayer lo dejaba salir vivo, sin una palabra.
    expect(() => appBaseUrlAnterior(entorno(valor))).not.toThrow();
    const vivo = appBaseUrlAnterior(entorno(valor));

    // 2. Río abajo: o llegaba al enlace del correo, o estallaba allí SIN diagnóstico.
    const rioAbajo = medirRioAbajo(vivo);
    if (rioAbajo.tipo === 'estalla') {
      expect(rioAbajo.mensaje).toMatch(/Invalid URL/);
      expect(rioAbajo.mensaje).not.toContain('APP_BASE_URL');
    } else {
      expect(rioAbajo.enlace).toContain('/reset-password/');
    }

    // 3. La guardia nueva lo detiene, y su mensaje sí tiene sujeto.
    expect(mensajeDeRechazo(valor)).toContain('APP_BASE_URL');
  });
});

describe('SPEC-055 CA-12 — la batería crece sin tocar ninguna aserción', () => {
  it('ninguna aserción congela la tabla en un número ni en una lista literal', () => {
    // `F-SPEC-048-2`: la familia de guardias que congelan una lista que crece. Añadir una
    // fila mañana no puede obligar a actualizar un contador escrito a mano; si obligara,
    // la siguiente persona con prisa aflojaría el contador en vez de mirar la fila.
    const src = readFileSync(ESTE_FICHERO, 'utf8');
    const congelantes = src.match(/(?:toHaveLength\(|toEqual\(\[)[^\n]*/g) ?? [];
    for (const uso of congelantes) {
      expect(uso, `esta aserción congela la tabla: ${uso}`).not.toContain(NOMBRE_DE_LA_TABLA);
    }
    // Centinela del propio recorrido: si la constante cambiara de nombre, este caso se
    // quedaría mirando a un fantasma y pasaría de vacío.
    expect(src).toContain(`const ${NOMBRE_DE_LA_TABLA}: Fila[] = [`);
  });
});
