import { createHash, randomBytes } from 'node:crypto';

/**
 * Mecánica del token de recuperación (ADR-015). Módulo puro y sin base de datos:
 * genera el secreto, lo digiere y expone los tres números de la decisión en
 * constantes nombradas (ADR-015 pto. 4), para que cambiarlos sea cambiar un
 * número y no perseguir literales dispersos.
 */

/** ADR-015 pto. 4: ventana de validez del enlace. */
export const RESET_TOKEN_TTL_MINUTES = 30;

/** SPEC-023 CA-12: solicitudes admitidas por cuenta dentro de la ventana. */
export const RESET_REQUEST_LIMIT = 3;

/** SPEC-023 CA-12: ventana del límite de solicitudes. */
export const RESET_REQUEST_WINDOW_MINUTES = 60;

/** Bytes de entropía del secreto (ADR-015 pto. 1): 32 bytes = 256 bits. */
const TOKEN_BYTES = 32;

/**
 * Secreto opaco de alta entropía (ADR-015 pto. 1): 32 bytes de CSPRNG en
 * `base64url`. No lleva dentro ni el usuario ni la caducidad — es una referencia
 * SIN significado a una fila, así que mirarlo no dice de quién es.
 */
export function generateResetToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/**
 * Digest irreversible que SÍ se persiste (ADR-015 pto. 2): SHA-256 en hex.
 * SHA-256 y no bcrypt a propósito: el token no es forzable por fuerza bruta a
 * ninguna velocidad (256 bits), y un digest sin sal permite buscar por índice
 * único en coste constante, sin recorrer filas ni abrir un canal de temporización.
 */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Instante de caducidad de un token emitido en `from`. */
export function resetTokenExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + RESET_TOKEN_TTL_MINUTES * 60_000);
}

/** Inicio de la ventana del límite de solicitudes (CA-12). */
export function resetRequestWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - RESET_REQUEST_WINDOW_MINUTES * 60_000);
}
