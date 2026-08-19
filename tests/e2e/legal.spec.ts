import { test, expect, type Page } from '@playwright/test';
import {
  AFIRMACIONES_PROHIBIDAS,
  MARCADORES_DE_POSICION,
} from '../legal-afirmaciones-prohibidas';

/**
 * SPEC-035 — las páginas legales contra la app corriendo de verdad.
 *
 * Cubre lo que solo se ve con un servidor delante y un navegador anónimo:
 *   CA-1  se leen sin cookie de sesión, y las de datos siguen sin leerse
 *   CA-3  quién opera esto, con datos reales y ni un marcador de posición
 *   CA-4  el responsable es la persona física; tremen.dev es marca y nada más
 *   CA-5  las categorías de dato del esquema, visibles en la página
 *   CA-6  los cinco terceros que intervienen, y para qué
 *   CA-7  de dónde vienen los precios, qué son y con qué carácter
 *   CA-8  y NADA más que eso: la lista cerrada de afirmaciones prohibidas
 *   CA-12 ni un recurso de terceros
 *   CA-13 ni una cookie fuera de las de sesión
 *   CA-16 el derecho de supresión, enunciado y con su residual honesto
 */

const RUTAS_LEGALES = ['/legal', '/legal/aviso-legal', '/legal/privacidad', '/legal/terminos'];
const RUTAS_DE_DATOS = ['/dashboard', '/cartera', '/vigiladas', '/avisos'];

/** El texto que de verdad lee una persona en la página, sin el pie. */
const textoPrincipal = (page: Page) => page.locator('main').innerText();

/** El texto de la página entera, pie incluido: es lo que CA-8 analiza. */
const textoRenderizado = async (page: Page) =>
  `${await textoPrincipal(page)}\n${await page.locator('footer').innerText()}`;

test.describe('CA-1: las cuatro se leen sin sesión, y las de datos no', () => {
  for (const ruta of RUTAS_LEGALES) {
    test(`${ruta} responde su contenido sin redirigir a /login`, async ({ page }) => {
      const respuesta = await page.goto(ruta);

      expect(respuesta?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe(ruta);
      await expect(page.locator('main h1')).toBeVisible();
    });
  }

  test('las rutas de datos siguen exigiendo sesión', async ({ page }) => {
    for (const ruta of RUTAS_DE_DATOS) {
      await page.goto(ruta);
      expect(new URL(page.url()).pathname, `${ruta} no puede abrirse sin sesión`).toBe('/login');
    }
  });
});

test.describe('CA-3: quién opera esto y cómo escribirle', () => {
  test('el aviso legal identifica al titular con datos reales', async ({ page }) => {
    await page.goto('/legal/aviso-legal');
    const texto = await textoPrincipal(page);

    expect(texto).toContain('Alberto Fojo Eiras');
    expect(texto).toMatch(/persona f[ií]sica/i);
    expect(texto).toContain('Estrada de Viveiro 62');
    expect(texto).toContain('15337');
    expect(texto).toContain('Porto do Barqueiro');
    expect(texto).toContain('Mañón');
    expect(texto).toContain('A Coruña');
    expect(texto).toContain('hola@tremen.dev');
    expect(texto).toContain('stockeiro.tremen.dev');
  });

  test('el contacto es un enlace mailto utilizable, no texto muerto', async ({ page }) => {
    await page.goto('/legal/aviso-legal');
    await expect(page.locator('a[href="mailto:hola@tremen.dev"]').first()).toBeVisible();
  });

  test('ninguna página legal contiene texto de relleno', async ({ page }) => {
    for (const ruta of RUTAS_LEGALES) {
      await page.goto(ruta);
      const texto = await textoRenderizado(page);
      for (const { patron, motivo } of MARCADORES_DE_POSICION) {
        expect(texto, `${ruta} contiene un marcador de posición (${patron}) — ${motivo}`).not.toMatch(
          patron,
        );
      }
    }
  });
});

test.describe('CA-4: el responsable es la persona, no la marca', () => {
  test('el aviso legal declara titular a la persona física, no al dominio', async ({ page }) => {
    await page.goto('/legal/aviso-legal');
    // La frase que declara al titular se marca en el DOM para que se pueda leer
    // sola: es la que CA-4 examina, y su sujeto tiene que ser el nombre.
    const frase = await page.locator('[data-testid="titular"]').innerText();

    expect(frase).toContain('Alberto Fojo Eiras');
    expect(frase.indexOf('Alberto Fojo Eiras')).toBeLessThan(frase.indexOf('Stockeiro'));
    expect(frase).not.toContain('tremen.dev');
  });

  test('la privacidad declara responsable del tratamiento a la persona física', async ({
    page,
  }) => {
    await page.goto('/legal/privacidad');
    const frase = await page.locator('[data-testid="responsable"]').innerText();

    expect(frase).toMatch(/responsable del tratamiento/i);
    expect(frase).toContain('Alberto Fojo Eiras');
    expect(frase).not.toContain('tremen.dev');
  });

  test('tremen.dev no aparece nunca como titular ni como responsable', async ({ page }) => {
    for (const ruta of ['/legal/aviso-legal', '/legal/privacidad']) {
      await page.goto(ruta);
      const texto = await textoRenderizado(page);
      for (const patron of [
        /tremen\.dev[^.]{0,40}\bes\s+el\s+titular/i,
        /tremen\.dev[^.]{0,40}\bes\s+el\s+responsable/i,
        /titular[^.]{0,20}:\s*tremen\.dev/i,
        /responsable[^.]{0,30}:\s*tremen\.dev/i,
      ]) {
        expect(texto, `${ruta} pone a la marca en el sitio de la persona`).not.toMatch(patron);
      }
    }
  });

  test('tremen.dev aparece, y aparece como marca y proyecto', async ({ page }) => {
    await page.goto('/legal/aviso-legal');
    const texto = await textoPrincipal(page);
    expect(texto).toContain('tremen.dev');
    expect(texto).toMatch(/marca/i);
  });
});

test.describe('CA-5 y CA-6: qué se guarda y quién lo procesa', () => {
  test('la privacidad describe las siete categorías de dato del esquema', async ({ page }) => {
    await page.goto('/legal/privacidad');
    const texto = await textoPrincipal(page);

    for (const titulo of [
      'Cuenta',
      'Enlaces de recuperación de contraseña',
      'Operaciones de tu cartera',
      'Acciones vigiladas y sus zonas',
      'Episodios de entrada en zona',
      'Avisos que se te han enviado',
      'Equivalencias aprendidas al importar',
    ]) {
      expect(texto, `falta la categoría "${titulo}"`).toContain(titulo);
    }
    // Y lo que de verdad se guarda, dicho sin eufemismos.
    expect(texto).toMatch(/correo electr[oó]nico/i);
    expect(texto).toMatch(/contrase[nñ]a/i);
  });

  test('la privacidad nombra a los cinco terceros y para qué interviene cada uno', async ({
    page,
  }) => {
    await page.goto('/legal/privacidad');
    const fila = (nombre: string) => page.locator(`[data-testid="encargado-${nombre}"]`);

    for (const [nombre, para] of [
      ['vercel', /alojamiento|ejecuci[oó]n/i],
      ['neon', /base de datos/i],
      ['resend', /correo|avisos|recuperaci[oó]n/i],
      ['marketstack', /cotizaci/i],
      ['twelve-data', /b[uú]squeda/i],
    ] as const) {
      await expect(fila(nombre)).toBeVisible();
      expect(await fila(nombre).innerText()).toMatch(para);
    }
  });

  test('la privacidad dice que no hay analítica ni cookies más allá de la sesión', async ({
    page,
  }) => {
    await page.goto('/legal/privacidad');
    const texto = await textoPrincipal(page);
    expect(texto).toMatch(/anal[ií]tica/i);
    expect(texto).toMatch(/cookie/i);
    expect(texto).toMatch(/estrictamente necesaria/i);
  });
});

test.describe('CA-7: de dónde vienen los precios y qué son', () => {
  for (const ruta of ['/legal/terminos', '/legal/privacidad']) {
    test(`${ruta} declara fuente, carácter diferido y uso informativo`, async ({ page }) => {
      await page.goto(ruta);
      const bloque = await page.locator('[data-testid="datos-de-mercado"]').innerText();

      // (a) quién es la fuente
      expect(bloque).toContain('Marketstack');
      // (b) precios de cierre diferidos, no tiempo real, con su fecha de referencia
      expect(bloque).toMatch(/cierre/i);
      expect(bloque).toMatch(/diferid/i);
      expect(bloque).toMatch(/no\s+(?:son\s+|se\s+ofrecen\s+en\s+)?(?:precios\s+en\s+)?tiempo real/i);
      expect(bloque).toMatch(/fecha de referencia/i);
      // (c) carácter meramente informativo
      expect(bloque).toMatch(/(meramente|car[aá]cter)\s+informativ/i);
    });
  }
});

test.describe('CA-8: y NADA más que eso', () => {
  for (const ruta of RUTAS_LEGALES) {
    test(`${ruta} no afirma ningún derecho ni compromiso que no se tenga`, async ({ page }) => {
      await page.goto(ruta);
      const texto = await textoRenderizado(page);

      for (const { patron, motivo } of AFIRMACIONES_PROHIBIDAS) {
        expect(texto, `${ruta} dice algo prohibido (${patron}) — ${motivo}`).not.toMatch(patron);
      }
    });
  }
});

test.describe('CA-12: ni un recurso de terceros', () => {
  for (const ruta of RUTAS_LEGALES) {
    test(`${ruta} no solicita nada fuera de su propio origen`, async ({ page, baseURL }) => {
      const ajenas: string[] = [];
      page.on('request', (peticion) => {
        const url = peticion.url();
        if (url.startsWith('data:') || url.startsWith('blob:') || url === 'about:blank') return;
        if (!url.startsWith(baseURL!)) ajenas.push(`${peticion.resourceType()} ${url}`);
      });

      await page.goto(ruta, { waitUntil: 'networkidle' });

      expect(ajenas, `${ruta} carga recursos externos:\n${ajenas.join('\n')}`).toEqual([]);
    });
  }
});

test.describe('CA-13: sin analítica y sin más cookies que la de sesión', () => {
  test('recorrer /legal anónimamente no fija ninguna cookie', async ({ page, context }) => {
    for (const ruta of RUTAS_LEGALES) await page.goto(ruta);

    expect(await context.cookies()).toEqual([]);
  });

  test('en /login solo aparecen las cookies que Auth.js necesita', async ({ page, context }) => {
    await page.goto('/login');

    const ajenas = (await context.cookies()).filter(
      (c) => !/^(__Secure-|__Host-)?authjs\./.test(c.name),
    );
    expect(ajenas.map((c) => c.name), 'cookie que no es del flujo de sesión').toEqual([]);
  });
});

test.describe('CA-16: el derecho de supresión, enunciado y honesto', () => {
  test('la privacidad dice que se borra desde la app, nombra la ruta y no oculta el residual', async ({
    page,
  }) => {
    await page.goto('/legal/privacidad');
    const bloque = await page.locator('[data-testid="derechos"]').innerText();

    expect(bloque).toMatch(/borrar tu cuenta/i);
    expect(bloque).toContain('/cuenta');
    // El residual de F-ADR-022-1: el correo ya entregado no vuelve.
    expect(bloque).toMatch(/correo/i);
    expect(bloque).toMatch(/(ya\s+entregad|buz[oó]n del destinatario)/i);
    expect(bloque).toMatch(/registros del proveedor/i);
  });

  test('esta spec NO crea el enlace a /cuenta: eso es SPEC-036', async ({ page }) => {
    // La frontera está declarada. Si mañana aparece el enlace tiene que ser porque
    // SPEC-036 entregó la pantalla, con su CA — no porque se coló aquí y apunta a
    // una ruta que todavía no existe.
    await page.goto('/legal/privacidad');
    await expect(page.locator('main a[href="/cuenta"]')).toHaveCount(0);
  });
});

test.describe('los plazos que publica la privacidad son los que aplica el código', () => {
  test('la caducidad del enlace de recuperación se dice en minutos, y son 30', async ({ page }) => {
    // `tests/legal-textos-veraces.test.ts` ata el número al `RESET_TOKEN_TTL_MINUTES`
    // real (ADR-015 pto. 4). Aquí se comprueba lo otro: que ese número llegue a la
    // página, que es donde lo lee una persona. Antes ponía «a las pocas horas», que
    // no era falso pero describía una ventana seis veces mayor que la real.
    await page.goto('/legal/privacidad');
    const bloque = await page.locator('[data-testid="conservacion"]').innerText();

    expect(bloque).toMatch(/30\s*minutos/);
    expect(bloque, 'la ventana real son minutos, no horas').not.toMatch(/pocas\s+horas/i);
  });

  test('la disponibilidad describe el servicio y no promete un cierre avisado', async ({
    page,
  }) => {
    await page.goto('/legal/terminos');
    const bloque = await page.locator('[data-testid="disponibilidad"]').innerText();

    // Lo que sí es verdad y tiene que seguir dicho.
    expect(bloque).toMatch(/pruebas/i);
    expect(bloque).toMatch(/no\s+hay\s+compromiso/i);
    // Y lo que no se promete. La lista cerrada de CA-8 vigila las cuatro páginas
    // enteras; esto deja el motivo escrito donde se lee el apartado.
    expect(bloque).not.toMatch(/con\s+antelaci[oó]n/i);
    expect(bloque).not.toMatch(/se\s+avisar[ií]a/i);
  });
});
