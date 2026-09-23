import type { PgDatabase } from 'drizzle-orm/pg-core';
import { credentialsSchema, emailSchema } from '@/lib/auth/validation';
import type { NotificationSender } from '@/lib/notifications/sender';
import { HONEYPOT_FIELD, RENDER_SEAL_FIELD } from './activation-rules';
import { botVerdictFailOpen, type BotCheck } from './bot-check';
import { caughtByHoneypot, isSealOldEnough } from './form-guard';
import type { ClosedReason } from './gate';
import { resendActivation, signUp, type ActivationDelivery } from './signup';

type Db = PgDatabase<any, any, any>;

/**
 * SPEC-066 — el CAMINO del alta y del reenvío, con sus filtros delante y en el orden de
 * ADR-042 pto. 12: forma del formulario → campo trampa y tiempo mínimo → BotID → grifo →
 * alta. Los filtros baratos primero; la llamada de red, después; y un envío que ya cae
 * por un filtro barato no llega a consultar BotID.
 *
 * Vive fuera de la server action porque un módulo `'use server'` sólo exporta funciones
 * async y aquí hay que INYECTAR el puerto de BotID (D-5): la acción pasa el real y los
 * unitarios uno simulado.
 */

export interface SignupFlowDeps {
  db: Db;
  sender: NotificationSender;
  /** Origen de los enlaces: `APP_BASE_URL`, nunca la cabecera `Host`. */
  baseUrl: string;
  /** `AUTH_SECRET`, del que se deriva la clave del sello (ADR-042 pto. 15). */
  secret: string;
  /** Reloj del SERVIDOR al recibir el envío, en ms. */
  now: number;
  botCheck: BotCheck;
}

export type SignupFlowResult =
  | { kind: 'invalid-form' }
  | { kind: 'closed'; reason: ClosedReason }
  /** La respuesta NEUTRA (ADR-042 ptos. 6 y 13): legítima o automatismo, idéntica. */
  | ({ kind: 'neutral' } & ActivationDelivery);

const NEUTRA_SIN_NADA: SignupFlowResult = { kind: 'neutral', delivery: Promise.resolve() };

/** CA-1, CA-3, CA-4, CA-8: el alta entera, filtros incluidos. */
export async function handleSignup(
  deps: SignupFlowDeps,
  formData: FormData,
): Promise<SignupFlowResult> {
  // 1. Forma. Un error de forma no depende de si el correo existe: no enumera.
  const parsed = credentialsSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { kind: 'invalid-form' };

  // 2. Campo trampa y tiempo mínimo (capa 1). Al automatismo, la respuesta neutra.
  if (caughtByHoneypot(formData.get(HONEYPOT_FIELD))) return NEUTRA_SIN_NADA;
  if (!isSealOldEnough(formData.get(RENDER_SEAL_FIELD), deps.now, deps.secret)) {
    return NEUTRA_SIN_NADA;
  }

  // 3. BotID (capa 2), con fail-open.
  if ((await botVerdictFailOpen(deps.botCheck)) === 'automatismo') return NEUTRA_SIN_NADA;

  // 4 y 5. Grifo y alta (capa 3).
  const alta = await signUp(deps.db, deps.sender, parsed.data.email, parsed.data.password, {
    baseUrl: deps.baseUrl,
  });
  return alta;
}

export type ResendFlowResult = { kind: 'invalid-email' } | ({ kind: 'sent' } & ActivationDelivery);

/** CA-16 (y CA-4 para el reenvío): pedir otro correo de activación, con BotID delante. */
export async function handleResend(
  deps: Omit<SignupFlowDeps, 'secret' | 'now'>,
  formData: FormData,
): Promise<ResendFlowResult> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) return { kind: 'invalid-email' };

  if ((await botVerdictFailOpen(deps.botCheck)) === 'automatismo') {
    return { kind: 'sent', delivery: Promise.resolve() };
  }
  const envio = await resendActivation(deps.db, deps.sender, parsed.data, {
    baseUrl: deps.baseUrl,
  });
  return { kind: 'sent', ...envio };
}
