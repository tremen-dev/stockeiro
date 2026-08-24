import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MARCA } from '@/lib/legal/content';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';
import { OutboxFileSender } from '@/lib/notifications/outbox-file-sender';
import { REMITENTE_POR_DEFECTO, ResendSender } from '@/lib/notifications/resend-sender';
import type { NotificationMessage, NotificationSender } from '@/lib/notifications/sender';

/**
 * SPEC-056 — **la frontera y el remitente**: CA-1, CA-2, CA-19 y CA-20.
 *
 * Es lo primero que se escribió y lo primero que se cerró, por el orden que el ledger
 * recomienda: si el puerto se rompe, se rompe por el tipo y es barato de ver. Aquí no
 * hay ni una plantilla; el HTML es una cadena cualquiera.
 *
 * Dos cosas NO se teclean, y es a propósito (tercera convención de `FOUNDATION.md`):
 *
 *   - **El nombre visible del remitente** se compara contra `MARCA.nombre`, no contra
 *     «tremen.dev» escrito aquí. El día que la marca cambie de rótulo, este test dirá
 *     que el remitente se quedó atrás en vez de seguir en verde mintiendo.
 *   - **El valor del remitente** que `.env.example` y `docs/despliegue.md` proponen se
 *     compara contra el que exporta el código (CA-20: *«comparados entre sí, no contra
 *     un literal escrito en el test»*). Congelar la cadena aquí haría que los cuatro
 *     sitios pudieran envejecer a la vez sin que nadie se enterase.
 *
 * Lo único tecleado es la **dirección** (`stockeiro@tremen.dev`), y lo está porque D-11
 * razón 5 lo exige: el dominio de envío es configuración de despliegue —lo verificado en
 * Resend (`docs/despliegue.md` §0)—, no una etiqueta de marca. Derivarlo de `MARCA` haría
 * que retocar el rótulo cambiase en silencio desde dónde se manda el correo.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const leer = (ruta: string) => readFileSync(join(rootDir, ruta), 'utf8');

// ---------------------------------------------------------------------------
// CA-1 — el mensaje admite dos cuerpos, y el de texto sigue siendo obligatorio.
// ---------------------------------------------------------------------------

/**
 * Las tres aserciones de CA-1 que **no** son de ejecución sino de tipo. Viven aquí, en
 * un fichero de test, porque `npm run typecheck` cubre `tests/` y porque el
 * `@ts-expect-error` es lo que las hace guardias de verdad: si `body` dejara de ser
 * obligatorio, ese comentario se quedaría sin error que esperar y **tsc fallaría**.
 */
const CON_HTML: NotificationMessage = {
  to: 'ana@example.com',
  subject: 'asunto',
  body: 'texto',
  html: '<p>hola</p>',
};

const SIN_HTML: NotificationMessage = {
  to: 'ana@example.com',
  subject: 'asunto',
  body: 'texto',
};

// @ts-expect-error CA-1: `body` es OBLIGATORIO — un mensaje solo-HTML no existe.
const SIN_BODY: NotificationMessage = { to: 'ana@example.com', subject: 'asunto', html: '<p>x</p>' };

describe('SPEC-056 CA-1: el puerto admite dos cuerpos y el de texto no es opcional', () => {
  it('los tres implementadores del puerto siguen satisfaciendo `NotificationSender`', () => {
    // Asignarlos al tipo del puerto ES la comprobación (la ejerce `npm run typecheck`);
    // el `expect` de abajo solo impide que el caso quede sin aserción.
    const fake: NotificationSender = new FakeNotificationSender();
    const buzon: NotificationSender = new OutboxFileSender(join(tmpdir(), 'no-se-escribe.jsonl'));
    const resend: NotificationSender = new ResendSender('key-ficticia', undefined, async () =>
      new Response(null, { status: 200 }),
    );
    for (const adaptador of [fake, buzon, resend]) {
      expect(typeof adaptador.send).toBe('function');
    }
  });

  it('un mensaje con `html` y otro sin él son los dos mensajes válidos', () => {
    expect(CON_HTML.html).toBe('<p>hola</p>');
    expect(SIN_HTML.html).toBeUndefined();
    expect(SIN_BODY).toBeDefined(); // el contrato de arriba es la aserción de verdad
  });

  it('el fake sigue guardando el mensaje ENTERO — el HTML queda observable gratis', async () => {
    const fake = new FakeNotificationSender();
    await fake.send(CON_HTML);
    expect(fake.sent).toHaveLength(1);
    expect(fake.sent[0]).toEqual(CON_HTML);
    expect(fake.to('ana@example.com')[0].html).toBe('<p>hola</p>');
  });

  it('el buzón de disco sigue escribiendo UNA línea JSON por mensaje, con el HTML dentro', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec056-buzon-'));
    const fichero = join(dir, 'outbox.jsonl');
    try {
      const buzon = new OutboxFileSender(fichero);
      await buzon.send(CON_HTML);
      await buzon.send(SIN_HTML);

      const lineas = readFileSync(fichero, 'utf8').split('\n').filter(Boolean);
      expect(lineas).toHaveLength(2);
      expect(JSON.parse(lineas[0])).toEqual(CON_HTML);
      // Sin `html` la clave no aparece: `JSON.stringify` omite lo indefinido.
      expect(JSON.parse(lineas[1])).toEqual(SIN_HTML);
      expect(Object.keys(JSON.parse(lineas[1]))).not.toContain('html');
      // Y el fake de debajo sigue viendo lo mismo: el buzón AÑADE, no sustituye.
      expect(buzon.sent).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// CA-2 — el adaptador manda las dos partes cuando hay dos.
// ---------------------------------------------------------------------------

/** Un `fetch` de mentira que apunta lo que se le pide y no sale a ningún sitio. */
function fetchEspia() {
  const llamadas: Array<{ url: string; cuerpo: Record<string, unknown> }> = [];
  const impl: typeof fetch = async (input, init) => {
    llamadas.push({
      url: String(input),
      cuerpo: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    return new Response(JSON.stringify({ id: 'fake' }), { status: 200 });
  };
  return { llamadas, impl };
}

describe('SPEC-056 CA-2: ResendSender manda `text` y `html` cuando hay dos cuerpos', () => {
  it('con `html` la petición lleva los dos campos, con los valores del mensaje', async () => {
    const { llamadas, impl } = fetchEspia();
    const { ok } = await new ResendSender('key-ficticia', undefined, impl).send(CON_HTML);

    expect(ok).toBe(true);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].cuerpo).toMatchObject({
      to: CON_HTML.to,
      subject: CON_HTML.subject,
      text: CON_HTML.body,
      html: CON_HTML.html,
    });
  });

  it('sin `html` la petición NO lleva la clave — no se manda `undefined` ni cadena vacía', async () => {
    const { llamadas, impl } = fetchEspia();
    await new ResendSender('key-ficticia', undefined, impl).send(SIN_HTML);

    expect(llamadas).toHaveLength(1);
    expect(Object.keys(llamadas[0].cuerpo)).not.toContain('html');
    expect(llamadas[0].cuerpo.text).toBe(SIN_HTML.body);
  });

  it('ninguna de las dos llamadas sale a la red: solo se habló con el fetch inyectado', async () => {
    const { llamadas, impl } = fetchEspia();
    const emisor = new ResendSender('key-ficticia', undefined, impl);
    await emisor.send(CON_HTML);
    await emisor.send(SIN_HTML);

    expect(llamadas).toHaveLength(2);
    // El único host citado es el de la API, y quien lo recibió fue el espía.
    for (const llamada of llamadas) expect(llamada.url).toBe('https://api.resend.com/emails');
  });
});

// ---------------------------------------------------------------------------
// CA-19 / CA-20 — el remitente.
// ---------------------------------------------------------------------------

/** `"Nombre visible" <buzon@dominio>` partido en sus dos mitades. */
function partirRemitente(valor: string): { nombre: string; direccion: string } {
  const m = /^"([^"]*)"\s*<([^<>\s]+)>$/.exec(valor);
  expect(m, `el remitente no tiene la forma \`"Nombre" <buzon@dominio>\`: ${valor}`).not.toBeNull();
  return { nombre: m![1], direccion: m![2] };
}

/**
 * Todo remitente con esa forma que aparezca en un texto (`.env.example`, un runbook…).
 * Devuelve **una entrada por aparición**, no por valor distinto: lo que CA-20 vigila es
 * que ninguna de las que hay se quede atrás, y deduplicar escondería justo eso.
 */
const remitentesEn = (texto: string): string[] =>
  [...texto.matchAll(/"[^"\n]*"\s*<[^<>\s@]+@[^<>\s]+>/g)].map((m) => m[0]);

describe('SPEC-056 CA-19: el remitente por defecto ya no apunta a un dominio ajeno', () => {
  const { nombre, direccion } = partirRemitente(REMITENTE_POR_DEFECTO);

  it('el dominio de envío es el verificado en Resend, y no `stockeiro.app`', () => {
    expect(direccion).toBe('stockeiro@tremen.dev');
    expect(direccion.split('@')[1]).toBe('tremen.dev');
    expect(REMITENTE_POR_DEFECTO).not.toContain('stockeiro.app');
  });

  it('el nombre visible lleva la marca — y la lleva DERIVADA, no tecleada', () => {
    expect(nombre).toContain('Stockeiro');
    expect(nombre).toContain(MARCA.nombre);
    expect(nombre).toBe(`Stockeiro - ${MARCA.nombre}`);
  });

  it('el nombre visible es ASCII puro y cabe donde el móvil lo trunca (D-11, razones 2 y 3)', () => {
    expect([...nombre].every((c) => c.charCodeAt(0) < 0x80), `«${nombre}» tiene bytes ≥ 0x80`).toBe(
      true,
    );
    expect(nombre.length).toBeLessThanOrEqual(25);
    // El separador de la app es ` · ` (U+00B7) y aquí NO vale: en una cabecera de
    // correo exigiría encoded-word (RFC 2047) y un cliente que la deshaga.
    expect(nombre).not.toContain('·');
  });

  it('va entre comillas, porque `tremen.dev` lleva un punto (RFC 5322 §3.4)', () => {
    expect(REMITENTE_POR_DEFECTO.startsWith('"')).toBe(true);
    expect(REMITENTE_POR_DEFECTO).toMatch(/^"[^"]+"\s<[^<>]+>$/);
  });

  it('el valor por defecto es el que usa `ResendSender` cuando `RESEND_FROM` no está', async () => {
    const anterior = process.env.RESEND_FROM;
    delete process.env.RESEND_FROM;
    try {
      const { llamadas, impl } = fetchEspia();
      await new ResendSender('key-ficticia', undefined, impl).send(SIN_HTML);
      expect(llamadas[0].cuerpo.from).toBe(REMITENTE_POR_DEFECTO);
    } finally {
      if (anterior === undefined) delete process.env.RESEND_FROM;
      else process.env.RESEND_FROM = anterior;
    }
  });

  it('en todo `src/` no queda ningún remitente que cite `stockeiro.app`', () => {
    const fuentes = ficherosDe(join(rootDir, 'src'), ['.ts', '.tsx']);
    expect(fuentes.length, 'el recorrido de `src/` se ha quedado vacío').toBeGreaterThan(20);
    const infractores = fuentes.filter((f) => readFileSync(f, 'utf8').includes('stockeiro.app'));
    expect(infractores.map((f) => f.slice(rootDir.length + 1).replace(/\\/g, '/'))).toEqual([]);
  });
});

describe('SPEC-056 CA-20: el código, el ejemplo y la guía dicen los tres lo mismo', () => {
  const ENV = '.env.example';
  const GUIA = 'docs/despliegue.md';

  /** El valor de `RESEND_FROM` en la plantilla de entorno, sin las comillas de shell. */
  function remitenteDeEnvExample(): string {
    const m = /^RESEND_FROM=(.*)$/m.exec(leer(ENV));
    expect(m, `${ENV} no declara RESEND_FROM`).not.toBeNull();
    const crudo = m![1].trim();
    return /^'(.*)'$/.test(crudo) ? crudo.slice(1, -1) : crudo;
  }

  it('el ejemplo de entorno propone exactamente el remitente que el código trae por defecto', () => {
    expect(remitenteDeEnvExample()).toBe(REMITENTE_POR_DEFECTO);
  });

  it('la guía de despliegue propone ese mismo remitente en todos los sitios donde lo propone', () => {
    const propuestos = remitentesEn(leer(GUIA));
    // Centinela de no-vacuidad: la guía lo propone al menos dos veces (§2 y §7). Sin
    // esto, un cambio de formato en el runbook dejaría este caso verde sin mirar nada.
    expect(propuestos.length, `${GUIA} ya no propone ningún remitente`).toBeGreaterThanOrEqual(2);
    for (const propuesto of propuestos) expect(propuesto).toBe(REMITENTE_POR_DEFECTO);
  });

  it('ninguno de los tres cita `stockeiro.app` como dominio de envío ni como ejemplo a verificar', () => {
    // `docs/despliegue.md` SÍ sigue citando `stockeiro.app` en el aviso de APP_BASE_URL
    // (§0), y eso NO es de esta spec: es territorio de SPEC-052 y SPEC-055. Lo que aquí
    // se afirma es sobre las líneas que hablan del REMITENTE y del dominio a verificar.
    const lineasDeRemitente = (ruta: string) =>
      leer(ruta)
        .split('\n')
        .filter((l) => /RESEND_FROM|Add Domain|dominio verificado/i.test(l));

    const sospechosas = [ENV, GUIA].flatMap((ruta) =>
      lineasDeRemitente(ruta)
        .filter((l) => l.includes('stockeiro.app'))
        .map((l) => `${ruta}: ${l.trim()}`),
    );
    expect(lineasDeRemitente(GUIA).length, 'no se encontró ninguna línea del remitente').toBeGreaterThan(1);
    expect(sospechosas).toEqual([]);
  });

  it('`.env.example` sigue declarando exactamente ONCE claves: esta spec no añade ninguna', () => {
    // La misma lectura que `tests/spec-031-frontera.test.ts`, reimplementada aquí porque
    // CA-18 prohíbe tocar aquel fichero — ni siquiera para exportar algo. Esta spec
    // cambia EL VALOR de una línea; el recuento es lo que demuestra que nada más.
    const declaradas = [...leer(ENV).matchAll(/^#?\s*([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]);
    expect(declaradas.sort()).toHaveLength(11);
    expect(declaradas).toContain('RESEND_FROM');
    expect(declaradas).toContain('APP_BASE_URL');
  });

  it('`APP_BASE_URL` no se toca: sigue valiendo lo que valía (SPEC-052 / SPEC-055 en vuelo)', () => {
    // R-6: esta spec comparte `.env.example` con dos sesiones en paralelo. Que la línea
    // vecina siga intacta es parte del acotado, no una casualidad.
    expect(leer(ENV)).toContain('APP_BASE_URL="https://stockeiro.app"');
  });
});

/** Todos los ficheros con una de esas extensiones bajo `dir`, recursivamente. */
function ficherosDe(dir: string, extensiones: string[]): string[] {
  const out: string[] = [];
  for (const entrada of readdirSync(dir).sort()) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) out.push(...ficherosDe(ruta, extensiones));
    else if (extensiones.some((e) => entrada.endsWith(e))) out.push(ruta);
  }
  return out;
}
