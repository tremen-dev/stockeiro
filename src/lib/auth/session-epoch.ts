/**
 * Época de credencial (ADR-016 pto. 7): la pieza que DECIDE si una sesión sigue
 * vigente, aislada del acceso a datos para poder probarse sola — mismo patrón que
 * `isPublicPath`/`requireSession` (SPEC-001). El runtime la invoca; el test no
 * necesita levantar Auth.js.
 */

/** Valor que el JWT estampa al hacer login: milisegundos, para sobrevivir al JSON. */
export function toEpochClaim(passwordChangedAt: Date): number {
  return passwordChangedAt.getTime();
}

/**
 * ¿La sesión sigue vigente? Compara LO QUE EL TOKEN TRAJO DEL LOGIN contra lo que
 * la base dice AHORA (ADR-016 pto. 3 y 5).
 *
 * Todo lo que no sea una coincidencia exacta cuenta como caducado. En particular,
 * un token SIN el dato NO vale (ADR-016 pto. 6): tratar la ausencia como "vale"
 * dejaría una puerta permanente abierta a cualquier cookie antigua — y ese es
 * justo el motivo del relogin global el día del despliegue.
 */
export function isSessionEpochCurrent(claim: unknown, current: Date | null | undefined): boolean {
  if (!(current instanceof Date) || Number.isNaN(current.getTime())) return false;
  if (typeof claim !== 'number' || !Number.isFinite(claim)) return false;
  return claim === current.getTime();
}
