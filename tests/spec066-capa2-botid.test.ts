import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import {
  REGISTER_PATH,
  RESEND_ACTIVATION_PATH,
} from '@/lib/registration/activation-rules';
import {
  checkBotIdOptions,
  makeBotCheck,
  verdictFrom,
  type BotCheck,
} from '@/lib/registration/bot-check';
import { BOTID_PROTECTED_ROUTES, startBotIdClient } from '@/lib/registration/botid-client';
import { isVercelDeployment } from '@/lib/registration/despliegue';
import { handleResend, handleSignup } from '@/lib/registration/signup-flow';
import {
  FakeNotificationSender,
  PWD,
  depsDeAlta,
  formularioDeAlta,
  recuento,
} from './spec066-arnes';

/**
 * SPEC-066 capa 2 — CA-4 (el veredicto decide y su fallo no bloquea) y CA-5 (BotID es
 * entero o no está, y sólo en Basic).
 *
 * El bot se simula a través del PUERTO (D-5), no parcheando la librería (ADR-042 pto. 17).
 */

let db: TestDb;
let sender: FakeNotificationSender;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  sender = new FakeNotificationSender();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const NADA = { cuentas: 0, tokens: 0, correos: 0 };

/** El puerto real, alimentado con la respuesta que daría la librería. */
const puertoQueResponde = (r: { isHuman: boolean; isBot: boolean; isVerifiedBot: boolean }): BotCheck =>
  makeBotCheck({ check: async () => r, onVercel: true });

const BOT = { isHuman: false, isBot: true, isVerifiedBot: false };
const BOT_VERIFICADO = { isHuman: false, isBot: true, isVerifiedBot: true };
const HUMANO = { isHuman: true, isBot: false, isVerifiedBot: false };

/** Una cuenta pendiente con su primer correo ya enviado, para probar el reenvío. */
async function pendienteEnPlazo(email: string) {
  const ahora = Date.now();
  const r = await handleSignup(depsDeAlta(db, sender, { now: ahora }), formularioDeAlta({ email, ahora }));
  if (r.kind === 'neutral') await r.delivery;
  sender.sent.length = 0;
}

function formularioDeReenvio(email: string): FormData {
  const fd = new FormData();
  fd.set('email', email);
  return fd;
}

describe('SPEC-066 CA-4: el veredicto de BotID decide', () => {
  it.each([
    ['bot', BOT],
    ['bot verificado', BOT_VERIFICADO],
  ])('%s → el ALTA da la respuesta neutra y no crea nada', async (_n, respuesta) => {
    const ahora = Date.now();
    const r = await handleSignup(
      depsDeAlta(db, sender, { now: ahora, botCheck: puertoQueResponde(respuesta) }),
      formularioDeAlta({ email: 'bot@example.com', ahora }),
    );
    expect(r.kind).toBe('neutral');
    if (r.kind === 'neutral') await r.delivery;
    expect(await recuento(db, sender)).toEqual(NADA);
  });

  it.each([
    ['bot', BOT],
    ['bot verificado', BOT_VERIFICADO],
  ])('%s → el REENVÍO da su acuse y no envía nada', async (_n, respuesta) => {
    await pendienteEnPlazo('pendiente@example.com');
    const antes = await recuento(db, sender);

    const r = await handleResend(
      { db, sender, baseUrl: 'https://stockeiro.app', botCheck: puertoQueResponde(respuesta) },
      formularioDeReenvio('pendiente@example.com'),
    );
    expect(r.kind).toBe('sent');
    if (r.kind === 'sent') await r.delivery;
    expect(await recuento(db, sender)).toEqual(antes);
    expect(sender.sent).toHaveLength(0);
  });

  it('humano → el alta y el reenvío siguen su camino', async () => {
    const ahora = Date.now();
    const alta = await handleSignup(
      depsDeAlta(db, sender, { now: ahora, botCheck: puertoQueResponde(HUMANO) }),
      formularioDeAlta({ email: 'humana@example.com', ahora }),
    );
    if (alta.kind === 'neutral') await alta.delivery;
    expect(await recuento(db, sender)).toEqual({ cuentas: 1, tokens: 1, correos: 1 });

    const reenvio = await handleResend(
      { db, sender, baseUrl: 'https://stockeiro.app', botCheck: puertoQueResponde(HUMANO) },
      formularioDeReenvio('humana@example.com'),
    );
    if (reenvio.kind === 'sent') await reenvio.delivery;
    expect(sender.sent).toHaveLength(2);
  });

  it('si el puerto LANZA, el alta y el reenvío siguen, y el log de error nombra BotID', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const caido: BotCheck = async () => {
      throw new Error('OIDC ausente: servicio de Vercel caído');
    };
    const ahora = Date.now();

    const alta = await handleSignup(
      depsDeAlta(db, sender, { now: ahora, botCheck: caido }),
      formularioDeAlta({ email: 'failopen@example.com', ahora }),
    );
    if (alta.kind === 'neutral') await alta.delivery;
    expect(await recuento(db, sender)).toEqual({ cuentas: 1, tokens: 1, correos: 1 });

    const reenvio = await handleResend(
      { db, sender, baseUrl: 'https://stockeiro.app', botCheck: caido },
      formularioDeReenvio('failopen@example.com'),
    );
    if (reenvio.kind === 'sent') await reenvio.delivery;
    expect(sender.sent).toHaveLength(2);

    const lineas = log.mock.calls.map((c) => c.map(String).join(' '));
    expect(lineas.filter((l) => /BotID/.test(l))).toHaveLength(2);
  });

  it('el orden de ADR-042 pto. 12: un envío que cae por el campo trampa NO consulta el puerto', async () => {
    const puerto = vi.fn<BotCheck>(async () => 'humano');
    const ahora = Date.now();
    await handleSignup(
      depsDeAlta(db, sender, { now: ahora, botCheck: puerto }),
      formularioDeAlta({ email: 'trampa@example.com', trampa: 'x', ahora }),
    );
    // Y tampoco uno que cae por el tiempo mínimo.
    await handleSignup(
      depsDeAlta(db, sender, { now: ahora, botCheck: puerto }),
      formularioDeAlta({ email: 'prisa@example.com', sello: null, ahora }),
    );
    expect(puerto).not.toHaveBeenCalled();

    // Control: uno limpio sí lo consulta (si no, el caso de arriba no probaría nada).
    await handleSignup(
      depsDeAlta(db, sender, { now: ahora, botCheck: puerto }),
      formularioDeAlta({ email: 'limpio@example.com', ahora }),
    );
    expect(puerto).toHaveBeenCalledTimes(1);
  });

  it('el veredicto: sólo lo que se declara humano y no es bot es humano', () => {
    expect(verdictFrom(HUMANO)).toBe('humano');
    expect(verdictFrom(BOT)).toBe('automatismo');
    expect(verdictFrom(BOT_VERIFICADO)).toBe('automatismo');
    expect(verdictFrom({ isHuman: true, isBot: false, isVerifiedBot: true })).toBe('automatismo');
  });

  it('una cuenta activada que se re-registra no se entera de nada, tampoco vía BotID', async () => {
    await registerUser(db, 'activada@example.com', PWD);
    const ahora = Date.now();
    const r = await handleSignup(
      depsDeAlta(db, sender, { now: ahora, botCheck: puertoQueResponde(BOT) }),
      formularioDeAlta({ email: 'activada@example.com', ahora }),
    );
    expect(r.kind).toBe('neutral');
    expect(sender.sent).toHaveLength(0);
  });
});

describe('SPEC-066 CA-5: BotID es entero o no está, y sólo en modo Basic', () => {
  const IDENTIDADES_VERCEL = ['production', 'preview'];
  const IDENTIDADES_FUERA = ['development', 'unknown', '', null, undefined];

  it('en Vercel el SERVIDOR llama a checkBotId SIN modo desarrollo y con checkLevel basic', async () => {
    for (const entorno of IDENTIDADES_VERCEL) {
      const check = vi.fn(async () => HUMANO);
      await makeBotCheck({ check, onVercel: isVercelDeployment(entorno) })();
      expect(check).toHaveBeenCalledWith({
        developmentOptions: { isDevelopment: false },
        advancedOptions: { checkLevel: 'basic' },
      });
    }
  });

  it('fuera de Vercel el servidor usa la vía de desarrollo, también en basic', async () => {
    for (const entorno of IDENTIDADES_FUERA) {
      const check = vi.fn(async () => HUMANO);
      await makeBotCheck({ check, onVercel: isVercelDeployment(entorno) })();
      expect(check).toHaveBeenCalledWith({
        developmentOptions: { isDevelopment: true },
        advancedOptions: { checkLevel: 'basic' },
      });
    }
  });

  it('y esa vía, con la librería REAL, responde humano sin salir a la red ni pedir OIDC', async () => {
    const red = vi.spyOn(globalThis, 'fetch');
    const antes = process.env.VERCEL_OIDC_TOKEN;
    delete process.env.VERCEL_OIDC_TOKEN;
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(await makeBotCheck({ onVercel: false })()).toBe('humano');
      expect(red).not.toHaveBeenCalled();
    } finally {
      if (antes !== undefined) process.env.VERCEL_OIDC_TOKEN = antes;
    }
  });

  it('en Vercel el CLIENTE se inicializa protegiendo EXACTAMENTE los dos POST, en basic', () => {
    for (const entorno of IDENTIDADES_VERCEL) {
      const init = vi.fn();
      expect(startBotIdClient(entorno, init)).toBe(true);
      expect(init).toHaveBeenCalledTimes(1);
      const { protect } = init.mock.calls[0][0] as { protect: typeof BOTID_PROTECTED_ROUTES };
      expect(
        protect.map((p) => `${p.method} ${p.path} ${p.advancedOptions?.checkLevel}`).sort(),
      ).toEqual([`POST ${REGISTER_PATH} basic`, `POST ${RESEND_ACTIVATION_PATH} basic`].sort());
    }
  });

  it('fuera de Vercel el cliente NO se inicializa', () => {
    for (const entorno of IDENTIDADES_FUERA) {
      const init = vi.fn();
      expect(startBotIdClient(entorno, init)).toBe(false);
      expect(init).not.toHaveBeenCalled();
    }
  });

  it('la decisión no lee NODE_ENV: moverlo no cambia ni el servidor ni el cliente', async () => {
    const original = process.env.NODE_ENV;
    try {
      for (const nodeEnv of ['production', 'development', 'test']) {
        (process.env as Record<string, string>).NODE_ENV = nodeEnv;
        expect(isVercelDeployment('unknown')).toBe(false);
        expect(isVercelDeployment('preview')).toBe(true);
        expect(checkBotIdOptions(false).developmentOptions.isDevelopment).toBe(true);
        expect(checkBotIdOptions(true).developmentOptions.isDevelopment).toBe(false);
        expect(startBotIdClient('development', vi.fn())).toBe(false);
      }
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = original;
    }
  });
});
