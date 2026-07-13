import { and, eq } from 'drizzle-orm';
import type { PgDatabase, PgTableWithColumns } from 'drizzle-orm/pg-core';

type Db = PgDatabase<any, any, any>;

/**
 * Aislamiento de datos por usuario (RN-01, CA-6, ADR-001).
 *
 * Toda entidad de dominio de Stockeiro (posición, acción vigilada, zona, aviso)
 * lleva una columna `userId`. Estos helpers son la ÚNICA vía sancionada para
 * leer datos propiedad de un usuario: fuerzan el filtro por `ownerId`, de modo
 * que ninguna consulta pueda devolver datos de otro usuario.
 *
 * Regla: nunca consultes una tabla con dueño sin pasar por aquí (o replicando su
 * cláusula). El aislamiento vive en la capa de aplicación (no RLS todavía).
 */
type OwnedTable = PgTableWithColumns<any> & {
  id: any;
  userId: any;
};

/** Lista SOLO las filas cuyo `userId` coincide con el dueño de la sesión. */
export function listForOwner<T extends OwnedTable>(db: Db, table: T, ownerId: string) {
  return db.select().from(table as any).where(eq(table.userId, ownerId));
}

/**
 * Devuelve la fila por id SOLO si pertenece al dueño. Si el id existe pero es de
 * otro usuario, devuelve null (indistinguible de "no existe": no filtra si el id
 * ajeno es real). Así el acceso directo por id ajeno responde no encontrado.
 */
export async function findByIdForOwner<T extends OwnedTable>(
  db: Db,
  table: T,
  id: string,
  ownerId: string,
): Promise<any | null> {
  const [row] = await db
    .select()
    .from(table as any)
    .where(and(eq(table.id, id), eq(table.userId, ownerId)))
    .limit(1);
  return row ?? null;
}
