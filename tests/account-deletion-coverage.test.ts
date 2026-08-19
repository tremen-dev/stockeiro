import { describe, it, expect } from 'vitest';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '@/db/schema';
import {
  ACCOUNT_DELETION_COVERAGE,
  DELETION_ORDER,
  SHARED_TABLES,
} from '@/lib/account/deletion';

/**
 * SPEC-036 CA-5 — la cobertura del borrado está atada al ESQUEMA, no a la memoria
 * de quien lo escribió.
 *
 * Es el mismo mecanismo que `tests/legal-datos-y-esquema.test.ts` monta para la
 * política de privacidad (SPEC-035 CA-5), y por la misma razón: el día que alguien
 * añada una tabla con `user_id`, se entera **en su PR** de que también hay que
 * borrarla. Sin este test, la omisión no se nota hasta que alguien reclame que
 * borró su cuenta y sus datos siguen ahí.
 *
 * La propiedad se escribe en los DOS sentidos:
 *
 *  - Una tabla con `user_id` que la cobertura no declara → el borrado deja rastro.
 *  - Una tabla declarada que ya no tiene dueño → la cobertura describe un esquema
 *    que ya no existe, y peor: puede estar borrando algo compartido.
 *
 * `users` entra aunque no tenga columna `user_id`: es la fila de la persona.
 *
 * Y hay una tercera mitad, la que ADR-022 pto. 2 exige y que ningún recuento de
 * filas delataría: las tres tablas COMPARTIDAS (`symbols`, `quotes`,
 * `quote_diagnostics`) no pueden aparecer nunca en la cobertura. No son de nadie
 * (ADR-002/ADR-007) y borrarlas con quien se va rompería la cartera de los demás
 * (R-6 de EPIC-004).
 */

/** La columna que marca "esto es de alguien" en todo el esquema (RN-01, ADR-001). */
const COLUMNA_DE_PROPIEDAD = 'user_id';

/** El nombre de la tabla de cuentas: es de la persona por definición, no por columna. */
const TABLA_DE_CUENTA = 'users';

/** Toda tabla del esquema, con su nombre real de Postgres y sus columnas. */
function tablasDelEsquema(): Array<{ nombre: string; columnas: string[] }> {
  return (Object.values(schema) as unknown[])
    .filter((v): v is PgTable => v instanceof PgTable)
    .map((t) => {
      const cfg = getTableConfig(t);
      return { nombre: cfg.name, columnas: cfg.columns.map((c) => c.name) };
    });
}

/** Las tablas que contienen datos personales: la de cuentas y toda la que lleva dueño. */
function tablasConDatosPersonales(): string[] {
  return tablasDelEsquema()
    .filter((t) => t.nombre === TABLA_DE_CUENTA || t.columnas.includes(COLUMNA_DE_PROPIEDAD))
    .map((t) => t.nombre)
    .sort();
}

const cubiertas = () => ACCOUNT_DELETION_COVERAGE.map((c) => c.table).sort();

describe('SPEC-036 CA-5: el esquema y la cobertura del borrado dicen lo mismo', () => {
  it('el recorrido del esquema no es vacío: encuentra tablas de verdad', () => {
    // Sin esto, un fallo del introspector dejaría los comparados de abajo en verde
    // sin haber mirado nada.
    expect(tablasDelEsquema().length).toBeGreaterThanOrEqual(9);
    expect(tablasConDatosPersonales()).toContain(TABLA_DE_CUENTA);
  });

  it('cada tabla con datos de una persona está cubierta por el borrado', () => {
    for (const tabla of tablasConDatosPersonales()) {
      expect(
        cubiertas(),
        `la tabla "${tabla}" guarda datos de una persona y el borrado de cuenta no la ` +
          'cubre — declárala en ACCOUNT_DELETION_COVERAGE (src/lib/account/deletion.ts). ' +
          'Si de verdad no debe borrarse, eso es una decisión de ADR, no una omisión.',
      ).toContain(tabla);
    }
  });

  it('no hay tabla cubierta que ya no guarde datos de nadie', () => {
    const reales = tablasConDatosPersonales();
    for (const { table } of ACCOUNT_DELETION_COVERAGE) {
      expect(
        reales,
        `el borrado dice cubrir "${table}", que ya no guarda datos de ninguna persona`,
      ).toContain(table);
    }
  });

  it('los dos conjuntos son EXACTAMENTE el mismo', () => {
    expect(cubiertas()).toEqual(tablasConDatosPersonales());
  });

  it('las siete tablas que CA-4 nombra están, cada una con su mecanismo', () => {
    const porTabla = new Map(ACCOUNT_DELETION_COVERAGE.map((c) => [c.table, c]));
    for (const tabla of [
      'users',
      'password_reset_tokens',
      'transactions',
      'watched_symbols',
      'zone_triggers',
      'notifications',
      'symbol_aliases',
    ]) {
      const entrada = porTabla.get(tabla);
      expect(entrada, `falta la cobertura de ${tabla}`).toBeDefined();
      expect(['delete', 'cascade']).toContain(entrada!.via);
      // Lo que se le enseña a una persona en /cuenta sale de aquí (CA-2): el nombre
      // de la tabla no es una explicación.
      expect(entrada!.label.length).toBeGreaterThan(3);
      expect(entrada!.label).not.toBe(tabla);
    }
  });
});

describe('SPEC-036 CA-5: el orden del borrado es el de ADR-022 pto. 4', () => {
  it('las sentencias explícitas van en el orden decidido, y `users` la última', () => {
    expect(DELETION_ORDER).toEqual([
      'notifications',
      'watched_symbols',
      'transactions',
      'symbol_aliases',
      'password_reset_tokens',
      'users',
    ]);
  });

  it('el orden explícito es exactamente la cobertura menos lo que cae por cascade', () => {
    const explicitas = ACCOUNT_DELETION_COVERAGE.filter((c) => c.via === 'delete').map(
      (c) => c.table,
    );
    expect(DELETION_ORDER).toEqual(explicitas);
  });

  it('`zone_triggers` no se borra a mano: cae con su acción vigilada (ADR-017)', () => {
    const zt = ACCOUNT_DELETION_COVERAGE.find((c) => c.table === 'zone_triggers');
    expect(zt?.via).toBe('cascade');
    expect(zt?.from).toBe('watched_symbols');
    expect(DELETION_ORDER).not.toContain('zone_triggers');
  });
});

describe('SPEC-036 CA-6: lo compartido no entra en el borrado, por construcción', () => {
  it('las tres tablas compartidas están declaradas como tales', () => {
    expect([...SHARED_TABLES].sort()).toEqual(['quote_diagnostics', 'quotes', 'symbols']);
  });

  it('ninguna tabla compartida aparece en la cobertura del borrado', () => {
    for (const tabla of SHARED_TABLES) {
      expect(
        cubiertas(),
        `"${tabla}" es COMPARTIDA (ADR-002/ADR-007): borrarla con quien se va rompe la ` +
          'cartera y la vigilancia de los demás (R-6)',
      ).not.toContain(tabla);
    }
  });

  it('y ninguna de ellas tiene columna de dueño — que es por lo que no son de nadie', () => {
    const porNombre = new Map(tablasDelEsquema().map((t) => [t.nombre, t]));
    for (const tabla of SHARED_TABLES) {
      const t = porNombre.get(tabla);
      expect(t, `"${tabla}" ya no existe en el esquema`).toBeDefined();
      expect(t!.columnas).not.toContain(COLUMNA_DE_PROPIEDAD);
    }
  });
});
