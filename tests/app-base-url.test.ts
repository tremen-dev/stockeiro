import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { passwordResetTokens, users } from '@/db/schema';
import { requestPasswordReset } from '@/lib/auth/password-reset';
import type { NotificationSender } from '@/lib/notifications/sender';
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
 * CA-5 — los DOS valores VIVOS se LEEN de sus fuentes; el tercero se escribe aquí.
 *
 * `FOUNDATION.md` §Cómo se trabaja aquí: *un test de frontera fija una propiedad, no un
 * estado del árbol*. La propiedad es «lo que CI y el e2e usan de verdad sigue pasando la
 * guardia»; si mañana alguien cambia el valor de CI por algo que la guardia rechaza, el
 * rojo sale aquí y no en un despliegue. Leer esos dos ficheros no es tocarlos: ninguno de
 * los dos se modifica en esta entrega, y ninguno es de otra spec en vuelo.
 *
 * **D-7 (spec, §Decisiones): leer un fichero ajeno y aseverar sobre su contenido acopla
 * igual que escribirlo.** Por eso aquí se lee lo que un proceso real CONSUME —CI construye
 * con su valor, el e2e sirve con el suyo— y no documentación de otra spec. Ver la nota
 * junto al caso del origen `https`, que por eso va escrito y no leído.
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

  // Éste va ESCRITO aquí, y los dos de arriba leídos, por **D-7** de la spec: se lee lo que
  // un proceso real consume —CI construye con su `APP_BASE_URL`, el e2e sirve con el suyo—,
  // y leer eso compra anticipación: si mañana uno cambia a algo que la guardia rechaza, el
  // rojo sale aquí antes que en CI o en un despliegue, y lo paga el mismo que lo cobra.
  // Un origen `https` de producción no tiene fichero VIVO del que salir: el que hubo aquí se
  // sacaba de `.env.example`, que no lo lee ningún proceso —es documentación para humanos— y
  // encima es territorio de SPEC-052, que ahora mismo cambia ese literal a
  // `http://localhost:3000`. Aseverar sobre él acoplaba igual que escribirlo: dejaba un rojo
  // garantizado bajo la spec hermana, con la cara de un cambio legítimo suyo. Así que el
  // valor va escrito: es el mismo literal que CA-6 ya exige dentro del mensaje, con lo que no
  // entra ningún valor nuevo al fichero. Si alguien quiere la guardia de que el ejemplo de
  // `.env.example` pasa `appBaseUrl()` —propiedad legítima—, vive con el dueño del fichero:
  // queda pedida a SPEC-052 en `D-SPEC-055-1`. NO la traigas de vuelta aquí.
  it('y el origen https de producción, escrito aquí y no leído de ningún fichero (D-7)', () => {
    const v = 'https://stockeiro.tremen.dev';
    expect(appBaseUrl(entorno(v))).toBe(v);
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

// ---------------------------------------------------------------------------
// CA-8 — el oráculo de enumeración, cerrado por construcción
// ---------------------------------------------------------------------------

/**
 * Un doble de `db` que **registra cualquier acceso**. No emula Postgres: emula lo justo
 * para que `requestPasswordReset` recorra su camino —una consulta de usuario, una cuenta
 * de tokens recientes, el `update` que invalida los vivos y el `insert` del nuevo— y deja
 * anotado cada paso. Lo que se mide aquí no es el resultado de ninguna consulta: es
 * **cuántas** hubo, que es lo que distingue una cuenta que existe de una que no.
 *
 * Es a mano y no PGlite a propósito: con una base de verdad, «cero accesos» sería un
 * `SELECT count(*)` sobre tablas vacías, o sea otra afirmación. Aquí es una lista vacía.
 */
type Acceso = { op: 'select' | 'update' | 'insert'; tabla: string };

function crearDobleDeDb(usuario: { id: string; email: string } | null) {
  const accesos: Acceso[] = [];
  const nombreDeTabla = (t: unknown): string => {
    if (t === users) return 'users';
    if (t === passwordResetTokens) return 'passwordResetTokens';
    return 'desconocida';
  };

  const cadena = (op: Acceso['op'], tablaInicial?: unknown) => {
    let tabla = tablaInicial;
    const filas = (): unknown[] => {
      accesos.push({ op, tabla: nombreDeTabla(tabla) });
      if (op !== 'select') return [];
      if (tabla === users) return usuario === null ? [] : [usuario];
      return [{ n: 0 }]; // la cuenta de tokens recientes: por debajo del límite
    };
    const api: Record<string, unknown> = {
      from: (t: unknown) => {
        tabla = t;
        return api;
      },
      where: () => api,
      limit: () => api,
      set: () => api,
      values: () => api,
      returning: () => api,
      then: (res: (v: unknown[]) => unknown, rej: (e: unknown) => unknown) =>
        Promise.resolve().then(filas).then(res, rej),
    };
    return api;
  };

  const db = {
    select: () => cadena('select'),
    update: (t: unknown) => cadena('update', t),
    insert: (t: unknown) => cadena('insert', t),
  };
  return { db: db as unknown as Parameters<typeof requestPasswordReset>[0], accesos };
}

/** Un sender que nunca se invoca en estos casos; está para completar la firma. */
const senderMudo: NotificationSender = { send: async () => ({ ok: true }) };

const USUARIO = { id: 'u-1', email: 'existe@example.com' };
const NO_EXISTE = 'noexiste@example.com';

/**
 * El camino de recuperación tal y como lo escribe `src/app/(auth)/actions.ts:128`: el
 * origen se compone **como argumento**, o sea ANTES de entrar en `requestPasswordReset`.
 * Ese orden es todo el arreglo, y por eso se reproduce aquí en vez de describirse.
 */
async function caminoDeRecuperacion(
  db: Parameters<typeof requestPasswordReset>[0],
  email: string,
  componerOrigen: (env: NodeJS.ProcessEnv) => string,
  env: NodeJS.ProcessEnv,
) {
  return requestPasswordReset(db, senderMudo, email, { baseUrl: componerOrigen(env) });
}

/** Lo que le pasó a una llamada: o devolvió el acuse, o lanzó. */
type Desenlace = { tipo: 'acuse' } | { tipo: 'lanza'; mensaje: string };

async function ejecutar(
  usuario: { id: string; email: string } | null,
  email: string,
  componerOrigen: (env: NodeJS.ProcessEnv) => string,
): Promise<{ desenlace: Desenlace; accesos: Acceso[] }> {
  const { db, accesos } = crearDobleDeDb(usuario);
  try {
    await caminoDeRecuperacion(db, email, componerOrigen, entorno('[SENSITIVE]'));
    return { desenlace: { tipo: 'acuse' }, accesos };
  } catch (e) {
    return { desenlace: { tipo: 'lanza', mensaje: (e as Error).message }, accesos };
  }
}

describe('SPEC-055 CA-8 — con la clave envenenada, recuperación falla igual para todos', () => {
  it('el DESPUÉS: cuenta que existe y cuenta que no fallan idéntico y sin tocar la BD', async () => {
    const existe = await ejecutar(USUARIO, USUARIO.email, appBaseUrl);
    const noExiste = await ejecutar(null, NO_EXISTE, appBaseUrl);

    expect(existe.desenlace.tipo).toBe('lanza');
    expect(noExiste.desenlace.tipo).toBe('lanza');
    // El MISMO error para las dos direcciones: nada en la respuesta distingue las ramas.
    expect(existe.desenlace).toStrictEqual(noExiste.desenlace);
    // Y cero accesos: ni consulta, ni `update` sobre `passwordResetTokens`, ni `insert`.
    expect(existe.accesos).toStrictEqual([]);
    expect(noExiste.accesos).toStrictEqual([]);
  });

  it('el ANTES, medido aquí mismo: 200 si no existe, 500 si existe, y el enlace vivo quemado', async () => {
    // Esta mitad no describe el defecto: lo ejecuta, con la `appBaseUrl()` anterior
    // componiendo el origen. Si alguien afloja la guardia nueva, la mitad de arriba se
    // parecerá a ésta y el fichero se pondrá rojo.
    const existe = await ejecutar(USUARIO, USUARIO.email, appBaseUrlAnterior);
    const noExiste = await ejecutar(null, NO_EXISTE, appBaseUrlAnterior);

    // La cuenta que NO existe sale por la primera salida temprana: acuse normal, 200.
    expect(noExiste.desenlace.tipo).toBe('acuse');
    // La que SÍ existe estalla, y estalla DESPUÉS de haber escrito dos veces.
    expect(existe.desenlace.tipo).toBe('lanza');
    if (existe.desenlace.tipo === 'lanza') {
      expect(existe.desenlace.mensaje).toMatch(/Invalid URL/);
      // Y sin decir de qué clave venía: ese es el otro medio defecto.
      expect(existe.desenlace.mensaje).not.toContain('APP_BASE_URL');
    }

    // La asimetría se CALCULA, no se afirma.
    expect(existe.desenlace.tipo).not.toBe(noExiste.desenlace.tipo);

    // El daño colateral: `invalidateLiveTokens` corrió antes del estallido, así que el
    // usuario legítimo perdió su enlace vivo y el sustituto nunca salió.
    const ops = existe.accesos.map((a) => `${a.op}:${a.tabla}`);
    expect(ops).toContain('update:passwordResetTokens');
    expect(ops).toContain('insert:passwordResetTokens');
    // La cuenta inexistente no llegó a ninguna de las dos: ahí está el oráculo.
    const opsNoExiste = noExiste.accesos.map((a) => `${a.op}:${a.tabla}`);
    expect(opsNoExiste).not.toContain('update:passwordResetTokens');
    expect(opsNoExiste).not.toContain('insert:passwordResetTokens');
    expect(existe.accesos.length).toBeGreaterThan(noExiste.accesos.length);
  });

  it('`src/lib/auth/password-reset.ts` no participa del arreglo: sigue como estaba', () => {
    // El arreglo es que el valor envenenado ya no puede llegar hasta él. Si algún día
    // alguien mete aquí una segunda guardia, serían dos puertas que pueden divergir (D-2).
    const src = fuente('src/lib/auth/password-reset.ts');
    expect(src).toContain('const user = await getUserByEmail(db, email);');
    expect(src).toContain('if (!user) return nothing;');
    expect(src).not.toContain('appBaseUrl');
  });
});

// ---------------------------------------------------------------------------
// CA-9, CA-10 y CA-13 — una sola fuente, cero claves nuevas y el porqué escrito al lado
// ---------------------------------------------------------------------------

const srcDir = join(rootDir, 'src');

/** Todos los fuentes bajo un directorio. Mismo recorrido que `tests/tarjeta-frontera.test.ts`. */
function ficheros(dir: string): string[] {
  const out: string[] = [];
  for (const entrada of readdirSync(dir).sort()) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) out.push(...ficheros(ruta));
    else if (/\.tsx?$/.test(entrada)) out.push(ruta);
  }
  return out;
}

const rel = (f: string) => relative(rootDir, f).split(sep).join('/');

/** Lo que se audita es lo que se ejecuta, no lo que se explica. */
const sinComentarios = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Las invocaciones de una función, con sus argumentos y los paréntesis balanceados. */
function invocaciones(codigo: string, nombre: string): string[] {
  const out: string[] = [];
  const aguja = `${nombre}(`;
  for (let i = codigo.indexOf(aguja); i !== -1; i = codigo.indexOf(aguja, i + 1)) {
    // La declaración no es una invocación.
    if (/\bfunction\s+$/.test(codigo.slice(Math.max(0, i - 30), i))) continue;
    let profundidad = 0;
    for (let k = i + nombre.length; k < codigo.length; k++) {
      if (codigo[k] === '(') profundidad++;
      else if (codigo[k] === ')') {
        profundidad--;
        if (profundidad === 0) {
          out.push(codigo.slice(i, k + 1));
          break;
        }
      }
    }
  }
  return out;
}

describe('SPEC-055 CA-9 — la única fuente del origen absoluto sigue siendo `appBaseUrl()`', () => {
  const fuentes = ficheros(srcDir).map((f) => ({ ruta: rel(f), codigo: sinComentarios(readFileSync(f, 'utf8')) }));

  it('el `baseUrl` que va a `requestPasswordReset` sale siempre de `appBaseUrl()`', () => {
    const puntos: { ruta: string; llamada: string }[] = [];
    for (const { ruta, codigo } of fuentes) {
      for (const llamada of invocaciones(codigo, 'requestPasswordReset')) {
        puntos.push({ ruta, llamada: llamada.replace(/\s+/g, ' ') });
      }
    }
    // Centinela: una guardia que no ve ningún punto de uso no está verde, está vacía.
    expect(
      puntos.length,
      'no se encontró ninguna llamada a requestPasswordReset en src/: la guardia está ciega',
    ).toBeGreaterThan(0);
    for (const { ruta, llamada } of puntos) {
      expect(llamada, `${ruta} compone su propio baseUrl: ${llamada}`).toMatch(
        /baseUrl:\s*appBaseUrl\(\)/,
      );
    }
  });

  it('el argumento del origen de la tarjeta sale siempre de `appBaseUrl()`', () => {
    const puntos: { ruta: string; linea: string }[] = [];
    for (const { ruta, codigo } of fuentes) {
      for (const m of codigo.matchAll(/metadataBase:\s*([^,\n]+)/g)) {
        puntos.push({ ruta, linea: m[1].trim() });
      }
    }
    // Mismo centinela: si el origen de la tarjeta desapareciera de `src/`, esto tiene que
    // ponerse rojo en vez de aprobar una lista vacía.
    //
    // Nota para quien edite este fichero: la spec que introdujo esa tarjeta NO se nombra
    // por su identificador en ninguna parte de `tests/`, y no es descuido.
    // `tests/tarjeta-guardias-ampliadas.test.ts:119` mantiene una lista cerrada de los
    // ficheros de `tests/` que la mencionan —su forma de detectar que alguien re-encuadró
    // una guardia ajena sin pasar por el gate—, y este fichero no es uno de ellos: lo cita
    // por su ruta, que además es lo accionable.
    expect(
      puntos.length,
      'no se encontró ningún origen de tarjeta en src/: la guardia está ciega',
    ).toBeGreaterThan(0);
    for (const { ruta, linea } of puntos) {
      expect(linea, `${ruta} declara el origen de la tarjeta por su cuenta`).toBe(
        'new URL(appBaseUrl())',
      );
    }
  });
});

describe('SPEC-055 CA-10 — no se añade ninguna clave de entorno', () => {
  it('`appBaseUrl()` sigue leyendo `APP_BASE_URL` y ninguna otra clave', () => {
    // La lista de `.env.example` está cerrada en once y `tests/spec-031-frontera.test.ts`
    // lo afirma con su propio contador. Este caso no la duplica: vigila que la guardia
    // NUEVA no haya traído una clave por la puerta de atrás —un `APP_BASE_URL_STRICT`,
    // un `VERCEL_URL` de reserva— que habría que ir a declarar allí.
    const codigo = sinComentarios(fuente('src/lib/config/app-url.ts'));
    const claves = new Set<string>();
    for (const m of codigo.matchAll(/\benv\.([A-Z][A-Z0-9_]*)/g)) claves.add(m[1]);
    expect(claves.size, 'la función no lee ninguna clave: la guardia está ciega').toBeGreaterThan(0);
    for (const clave of claves) expect(clave).toBe('APP_BASE_URL');
  });
});

describe('SPEC-055 CA-13 — el comentario del punto de estallido dice la otra mitad', () => {
  const LA_OTRA_MITAD = 'lanza si falta o si el valor no es un origen absoluto `http`/`https`';
  const llano = (src: string) => src.replace(/\s+/g, ' ');

  it('la cabecera de `src/lib/config/app-url.ts`', () => {
    const cabecera = llano(fuente('src/lib/config/app-url.ts'));
    expect(cabecera.toLowerCase()).toContain(LA_OTRA_MITAD.toLowerCase());
    expect(cabecera).toContain('[SENSITIVE]');
    expect(cabecera).toContain('vercel env pull');
    expect(cabecera).toContain('.env.production.local');
  });

  it('el comentario del bloque `metadata` de `src/app/layout.tsx`', () => {
    const layout = fuente('src/app/layout.tsx');
    const llanoLayout = llano(layout);
    expect(llanoLayout.toLowerCase()).toContain(LA_OTRA_MITAD.toLowerCase());
    expect(llanoLayout).toContain('[SENSITIVE]');
    expect(llanoLayout).toContain('vercel env pull');

    // Y es SÓLO comentario: la expresión no se toca, y `tests/tarjeta-frontera.test.ts:75`
    // —que exige literalmente esta forma— sigue verde.
    expect(layout).toMatch(/metadataBase:\s*new URL\(appBaseUrl\(\)\)/);
    expect(layout).toMatch(/from\s+'@\/lib\/config\/app-url'/);
  });
});
