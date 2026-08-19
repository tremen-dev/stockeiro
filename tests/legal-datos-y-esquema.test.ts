import { describe, it, expect } from 'vitest';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '@/db/schema';
import { CATEGORIAS_DE_DATO } from '@/lib/legal/content';

/**
 * SPEC-035 CA-5 — la política de privacidad enumera lo que dice el ESQUEMA, no lo
 * que alguien recuerda.
 *
 * El test no compara textos: compara **el conjunto de tablas que guardan datos de
 * una persona** con el conjunto de categorías que la página declara. Que sean
 * exactamente el mismo conjunto es la propiedad; y está escrita en los dos sentidos
 * a propósito:
 *
 *  - Una tabla nueva con `userId` sin categoría → la página miente por omisión.
 *  - Una categoría sin tabla detrás → la página promete guardar algo que no guarda,
 *    o —peor— quedó ahí después de borrar la tabla y ya no describe nada.
 *
 * Esto **fallará a propósito** el día que alguien añada una tabla con `userId`
 * (F-SPEC-035-3). Es la intención: la política de privacidad se actualiza en la
 * misma PR que crea el dato, o no se actualiza nunca. Si estás leyendo esto porque
 * el test se te ha puesto rojo, lo que toca es describir el dato nuevo en
 * `src/lib/legal/content.ts`, no relajar la comprobación.
 *
 * `users` entra aunque no tenga columna `user_id`: es la fila de la persona, la
 * que ancla todas las demás (RN-01).
 */

/** La columna que marca "esto es de alguien" en todo el esquema (RN-01, ADR-001). */
const COLUMNA_DE_PROPIEDAD = 'user_id';

/** El nombre de la tabla de cuentas: es de la persona por definición, no por columna. */
const TABLA_DE_CUENTA = 'users';

/** Toda tabla del esquema, con su nombre real de Postgres y sus columnas. */
function tablasDelEsquema(): Array<{ nombre: string; columnas: string[] }> {
  return Object.values(schema)
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

describe('SPEC-035 CA-5: la página de privacidad y el esquema dicen lo mismo', () => {
  it('el recorrido del esquema no es vacío: encuentra tablas de verdad', () => {
    // Sin esto, un fallo del introspector dejaría los comparados de abajo en verde
    // sin haber mirado nada.
    expect(tablasDelEsquema().length).toBeGreaterThanOrEqual(9);
    expect(tablasConDatosPersonales()).toContain(TABLA_DE_CUENTA);
  });

  it('cada tabla con datos de una persona tiene su categoría declarada', () => {
    const declaradas = CATEGORIAS_DE_DATO.map((c) => c.tabla).sort();
    for (const tabla of tablasConDatosPersonales()) {
      expect(
        declaradas,
        `la tabla "${tabla}" guarda datos de una persona y /legal/privacidad no la describe — ` +
          'descríbela en src/lib/legal/content.ts (F-SPEC-035-3)',
      ).toContain(tabla);
    }
  });

  it('no hay categoría declarada sin tabla detrás', () => {
    const reales = tablasConDatosPersonales();
    for (const { tabla } of CATEGORIAS_DE_DATO) {
      expect(
        reales,
        `/legal/privacidad describe "${tabla}", que ya no guarda datos de nadie`,
      ).toContain(tabla);
    }
  });

  it('los dos conjuntos son EXACTAMENTE el mismo', () => {
    expect(CATEGORIAS_DE_DATO.map((c) => c.tabla).sort()).toEqual(tablasConDatosPersonales());
  });

  it('las siete categorías que CA-5 nombra están, con su nombre en cristiano', () => {
    const porTabla = new Map(CATEGORIAS_DE_DATO.map((c) => [c.tabla, c]));
    for (const tabla of [
      'users',
      'password_reset_tokens',
      'transactions',
      'watched_symbols',
      'zone_triggers',
      'notifications',
      'symbol_aliases',
    ]) {
      const categoria = porTabla.get(tabla);
      expect(categoria, `falta la categoría de ${tabla}`).toBeDefined();
      // El nombre de la tabla no es una categoría: a una persona se le dice qué es.
      expect(categoria!.titulo.length).toBeGreaterThan(3);
      expect(categoria!.titulo).not.toBe(tabla);
      expect(categoria!.descripcion.length).toBeGreaterThan(20);
    }
  });
});
