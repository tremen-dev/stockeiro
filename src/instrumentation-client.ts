import { initBotId } from 'botid/client/core';
import { startBotIdClient } from '@/lib/registration/botid-client';
import { deploymentIdentity } from '@/lib/version/identity';

/**
 * SPEC-066 CA-5 / ADR-042 pto. 17 — el cliente de BotID, entero o nada.
 *
 * Next ejecuta este fichero en el navegador antes de hidratar. En un despliegue de Vercel
 * (Production o Preview) inicializa BotID sobre los dos POST protegidos; fuera de Vercel
 * (local, CI, e2e) no hace nada y no se pide ningún recurso de BotID. La decisión sale de
 * la identidad de despliegue congelada en el build, no de `NODE_ENV`.
 */
startBotIdClient(deploymentIdentity.environment, initBotId);
