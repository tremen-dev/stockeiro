import NextAuth from 'next-auth';
import { authConfig } from './base-config';

/**
 * «¿Este visitante tiene sesión?», y nada más (SPEC-039 CA-2).
 *
 * Instancia EDGE-SAFE de Auth.js —la misma `authConfig` sin proveedores que usa el
 * middleware—: **decodifica el JWT de la cookie y ya**. Ni bcrypt, ni Postgres, ni
 * revalidación de época. Eso la hace utilizable desde una página que CA-14 obliga a
 * responder con la base de datos caída.
 *
 * Existe para la raíz y **solo** para la raíz, donde la pregunta no es «¿quién eres?»
 * sino «¿te enseño la puerta o te dejo pasar?»:
 *
 *  - sin sesión → la primera pantalla, que explica qué es esto y con qué cadencia;
 *  - con sesión → al panel, exactamente como hasta ahora.
 *
 * **No sirve como guardia de acceso** y por eso no vive en `guard.ts`. Un token
 * emitido antes de un cambio de contraseña sigue decodificando (ADR-016: la
 * revalidación es de Node y está en `config.ts`), así que quien tenga uno revocado
 * será mandado al panel y el panel lo devolverá a login — el mismo rebote que da hoy
 * la raíz, que redirige siempre. Aquí se decide qué pantalla se pinta, no a qué datos
 * se llega; los datos los siguen guardando `requireUser` y el middleware.
 *
 * Se lee en la PÁGINA y no en el middleware a propósito: `src/proxy.ts` deja la raíz
 * salir por arriba como ruta pública, y entrar en el flujo de Auth.js allí estamparía
 * `authjs.csrf-token` y `authjs.callback-url` en el navegador de quien solo ha
 * pinchado un enlace del foro — justo lo que SPEC-035 CA-13 quitó de en medio y lo
 * que `/legal/privacidad` promete que no pasa.
 */
const { auth: leerSesionDeLaCookie } = NextAuth(authConfig);

export async function tieneSesion(): Promise<boolean> {
  const sesion = await leerSesionDeLaCookie();
  return Boolean(sesion?.user?.id);
}
