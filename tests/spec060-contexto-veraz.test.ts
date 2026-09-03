import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALIAS_DE_PROSA,
  majoresDeclarados,
  versionesAfirmadas,
  desajustesDeVersion,
  VERSIONES_QUE_HAY_QUE_CAZAR,
  VERSIONES_LEGITIMAS,
  rutasCitadas,
  identificadoresCitados,
  citasRotas,
  CITAS_QUE_HAY_QUE_CAZAR,
  CITAS_LEGITIMAS,
  driversDelCodigo,
  driversDelDocumento,
  MODULO_CON_DOS_DRIVERS,
  MODULO_CON_TRES_DRIVERS,
  MODULO_SIN_DRIVERS,
  DOCUMENTO_DE_AYER,
} from './spec060-contexto-veraz';
import { copiasDelSchedule } from './spec059-hora-del-ciclo';

/**
 * SPEC-060 — **el contexto maestro deja de mentir**.
 *
 * `docs/fundacion/contexto.md` es el paso 2 de `CLAUDE.md`: el primer sitio donde mira
 * todo el que entra al proyecto. El 2026-09-03 tenía **once afirmaciones falsas** en 121
 * líneas, y una de ellas —`DB_DRIVER=postgres-js`— mandaba al recién llegado contra la
 * base de producción sin un aviso.
 *
 * ## Qué prueba esta suite y qué no
 *
 * Cubre **tres** de las once averías (D-1, D-2, D-5), que son las tres de **Nivel 1**
 * (**ADR-040** pto. 1): las que tienen un artefacto vivo del que derivarse. Las otras
 * ocho son delegación o prosa; se curan en el diff y su defensa es **estructural** —el
 * documento deja de guardar lo que envejece— más el mapa de dueños de CA-13. **No hay
 * test que impida escribir una frase falsa sobre el estado del proyecto**, y fabricarlo
 * sería peor que no tenerlo: congelaría redacción y acabaría aflojado (spec, §Notas 6).
 *
 * ## Ninguna guardia de aquí teclea el valor que vigila
 *
 * La versión sale de `package.json`, la existencia sale del sistema de ficheros y el
 * conjunto de `DB_DRIVER` sale de `src/db/client.ts`. Los únicos literales del fichero
 * son **especímenes**, y están escritos en los CA de la spec.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const contexto = () => readFileSync(join(rootDir, 'docs', 'fundacion', 'contexto.md'), 'utf8');
const packageJson = () => readFileSync(join(rootDir, 'package.json'), 'utf8');
const clienteDeDatos = () => readFileSync(join(rootDir, 'src', 'db', 'client.ts'), 'utf8');

describe('SPEC-060 CA-1: la versión del framework se deriva, no se teclea', () => {
  it('el detector caza las versiones que NO son las declaradas', () => {
    // Especímenes del CA: `Next.js 15` (la línea 26 de hoy), `React 18` y `Auth.js v4`.
    for (const espécimen of VERSIONES_QUE_HAY_QUE_CAZAR) {
      expect(desajustesDeVersion(espécimen, packageJson()), espécimen).not.toEqual([]);
    }
  });

  it('y NO caza las buenas, ni el paquete sin número, ni el texto real del documento', () => {
    // La segunda dirección es la que hay que probar de verdad: `ADR-020`, `D-7`, `RN-16`,
    // `SPEC-023`, `10.000/mes`, `30 min`, `~82%` y `2026-08-23` viven DENTRO del
    // documento vigilado, y un detector de «nombre seguido de número» los acusaría a los
    // ocho. Es el pisotón que ya pagó SPEC-059, aquí medido antes de darlo.
    for (const espécimen of VERSIONES_LEGITIMAS) {
      expect(desajustesDeVersion(espécimen, packageJson()), espécimen).toEqual([]);
    }
  });

  it('el mapa de alias apunta a paquetes que package.json declara de verdad', () => {
    // El puente escrito a mano es la única parte de CA-1 que puede envejecer (ADR-040,
    // consecuencias). Que sus destinos existan lo comprueba el árbol, no la memoria.
    const majores = majoresDeclarados(packageJson());
    for (const [alias, paquete] of Object.entries(ALIAS_DE_PROSA)) {
      expect(majores.has(paquete), `${alias} → ${paquete}`).toBe(true);
    }
  });

  it('el documento sigue nombrando su stack (centinela de no-vacuidad)', () => {
    // Un documento que dejó de nombrar su stack no puede dar verde por vacío: comparar
    // cero parejas contra `package.json` es no haber mirado.
    expect(versionesAfirmadas(contexto(), majoresDeclarados(packageJson())).length).toBeGreaterThan(
      0,
    );
  });

  it('ninguna versión que el documento afirma difiere de la que declara package.json', () => {
    expect(desajustesDeVersion(contexto(), packageJson())).toEqual([]);
  });
});

describe('SPEC-060 CA-2: toda cita del documento apunta a algo que existe', () => {
  it('el detector caza la ruta muerta y el identificador que nunca existió', () => {
    // Especímenes del CA: `src/middleware.ts` (Next 16 lo renombró a `src/proxy.ts`) y
    // `ADR-013`, que tiene forma válida y no existe — el hueco de la numeración.
    for (const espécimen of CITAS_QUE_HAY_QUE_CAZAR) {
      expect(citasRotas(espécimen, rootDir), espécimen).not.toEqual([]);
    }
  });

  it('y NO caza lo que existe, ni los comodines, ni lo que no es un fichero', () => {
    // `tests/*.test.ts` describe una familia y se salta a propósito; `RN-16`, `RI-03`,
    // `D-2`, `CE-1` y `F-SPEC-023-1` son reglas y salvedades, no documentos; y
    // `decimal.js` es un paquete npm que el documento cita, no una ruta de este árbol.
    for (const espécimen of CITAS_LEGITIMAS) {
      expect(citasRotas(espécimen, rootDir), espécimen).toEqual([]);
    }
  });

  it('el documento sigue citando rutas e identificadores (centinela de no-vacuidad)', () => {
    expect(rutasCitadas(contexto()).length).toBeGreaterThan(0);
    expect(identificadoresCitados(contexto()).length).toBeGreaterThan(0);
  });

  it('el conjunto de citas rotas del documento está VACÍO', () => {
    expect(citasRotas(contexto(), rootDir)).toEqual([]);
  });
});

describe('SPEC-060 CA-3: el documento nombra los valores de DB_DRIVER que el código reconoce', () => {
  it('el extractor del código devuelve exactamente lo que el módulo reconoce', () => {
    // Ejercitado sobre módulos sintéticos ANTES de mirar el árbol. El de tres drivers es
    // el que importa: el extractor sigue al CÓDIGO y no a esta spec, así que un driver
    // nuevo lo deja diciendo la verdad en vez de mintiendo.
    expect(driversDelCodigo(MODULO_CON_DOS_DRIVERS)).toEqual(['neon', 'pg']);
    expect(driversDelCodigo(MODULO_CON_TRES_DRIVERS)).toEqual(['neon', 'pg', 'postgres-js']);
  });

  it('y devuelve null —no []— cuando no hay conjunto que leer (centinela)', () => {
    // Sin este centinela, un módulo reescrito dejaría el caso de abajo comparando dos
    // vacíos: verde sin haber mirado nada.
    expect(driversDelCodigo(MODULO_SIN_DRIVERS)).toBeNull();
    expect(driversDelDocumento('un documento que no atribuye ningún valor')).toBeNull();
  });

  it('el documento de AYER no coincide con el código: el par completo, en rojo', () => {
    // `neon-http` y `postgres-js` son los dos nombres que la línea 39 llevaba desde el
    // 2026-08-23, y `src/db/client.ts` no ha reconocido nunca ninguno de los dos.
    expect(driversDelDocumento(DOCUMENTO_DE_AYER)).not.toEqual(driversDelCodigo(clienteDeDatos()));
  });

  it('las dos mitades, derivadas, coinciden', () => {
    // Ningún literal de driver se teclea aquí: una mitad sale del módulo que decide y la
    // otra del documento que lo cuenta.
    const delCodigo = driversDelCodigo(clienteDeDatos());
    const delDocumento = driversDelDocumento(contexto());
    expect(delCodigo, 'src/db/client.ts ya no declara su conjunto reconocido').not.toBeNull();
    expect(delDocumento, 'contexto.md ya no atribuye ningún valor a DB_DRIVER').not.toBeNull();
    expect([...delDocumento!].sort()).toEqual([...delCodigo!].sort());
  });
});

describe('SPEC-060 CA-5: el contexto describe el scheduler sin teclear su hora', () => {
  it('no lleva ni una copia del schedule (ADR-039 pto. 8)', () => {
    // Detector reutilizado de SPEC-059 CA-5: esta spec NO añade uno nuevo ni especímenes
    // nuevos — los dos sentidos ya están probados en `tests/spec059-hora-del-ciclo.test.ts`
    // y duplicarlos sería una segunda copia de la regla.
    //
    // Y se aplica a `contexto.md` **y a nada más**: ampliarlo a `docs/fundacion/` pondría
    // roja la entrada «Refresco bajo demanda» de `dominio.md`, que cita el cron viejo EN
    // PASADO y que SPEC-059 CA-10 protege expresamente (ADR-040 pto. 4).
    expect(copiasDelSchedule(contexto())).toEqual([]);
  });
});

describe('SPEC-060 CA-14: un DB_DRIVER que el código no reconoce falla al arrancar', () => {
  // El módulo lanza al importarse si falta `DATABASE_URL` —lleva así desde ADR-001— así
  // que el arnés le da una cadena de juguete. Ni `neon()` ni `postgres()` abren conexión
  // al construirse: la primera consulta es la que conecta, y aquí no hay ninguna.
  let resolverDriver: (env: Record<string, string | undefined>) => string;
  let DRIVERS_RECONOCIDOS: readonly string[];

  beforeAll(async () => {
    process.env.DATABASE_URL ??= 'postgresql://u:p@localhost:5432/stockeiro_test';
    const modulo = await import('@/db/client');
    resolverDriver = modulo.resolverDriver;
    DRIVERS_RECONOCIDOS = modulo.DRIVERS_RECONOCIDOS;
  });

  it('la variable ausente sigue significando el driver por defecto (ni una diferencia)', () => {
    // Es lo que corre en producción hoy —`DB_DRIVER` no está definida ni en `vercel.json`
    // ni en los workflows, y en `.env.example` está comentada— y lo que va a seguir
    // corriendo. Con la variable ausente, la rama nueva NO se puede alcanzar.
    expect(resolverDriver({})).toBe(DRIVERS_RECONOCIDOS[0]);
    expect(resolverDriver({ DB_DRIVER: '' })).toBe(DRIVERS_RECONOCIDOS[0]);
  });

  it('los valores reconocidos se comportan como hoy', () => {
    // El e2e —único sitio del repositorio que define la variable, `tests/e2e/server.mjs`—
    // no cambia una línea. El literal no se teclea: sale del mismo sitio que la decisión.
    for (const valor of DRIVERS_RECONOCIDOS) {
      expect(resolverDriver({ DB_DRIVER: valor }), valor).toBe(valor);
    }
  });

  it('un valor presente y no reconocido LANZA, y el mensaje trae las cuatro cosas', () => {
    // Especímenes del CA: el valor que el documento llevaba recomendando, su hermano, el
    // typo de dos eses y la mayúscula. `PG` NO se normaliza: reconocer variantes sería
    // adivinar la intención, y adivinar es lo que trajo el defecto.
    for (const valor of ['postgres-js', 'neon-http', 'postgress', 'PG']) {
      let error: Error | undefined;
      try {
        resolverDriver({ DB_DRIVER: valor });
      } catch (e) {
        error = e as Error;
      }
      expect(error, `${valor} debería haber sido rechazado`).toBeInstanceOf(Error);
      const mensaje = error!.message;
      expect(mensaje, 'la clave').toContain('DB_DRIVER');
      expect(mensaje, 'el valor recibido, delimitado').toContain(`«${valor}»`);
      expect(mensaje, 'dónde mirar').toContain('.env.example');
      expect(mensaje, 'dónde mirar').toContain('src/db/client.ts');
      for (const reconocido of DRIVERS_RECONOCIDOS) {
        expect(mensaje, 'los valores reconocidos').toContain(reconocido);
      }
    }
  });

  it('los valores reconocidos del mensaje salen del MISMO sitio que la decisión', () => {
    // ADR-040 pto. 1 aplicado al propio arreglo: si el mensaje repitiera la lista, la
    // entrega que cura una copia nacería con otra dentro. La prueba es que el extractor
    // de CA-3 encuentra UN solo conjunto en el módulo y es el que se exporta.
    expect(driversDelCodigo(clienteDeDatos())).toEqual([...DRIVERS_RECONOCIDOS]);
  });
});
