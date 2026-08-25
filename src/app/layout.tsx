import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { appBaseUrl } from '@/lib/config/app-url';
import { AppFooter } from './app-footer';
import './globals.css';

/**
 * SPEC-035 CA-12 — las tipografías se sirven desde el propio origen.
 *
 * El design system las traía con un `@import` a `fonts.googleapis.com`, así que
 * **todas** las páginas de la app pedían un recurso a un tercero: `/legal`, que
 * promete no cargar nada de fuera, y también `/reset-password`, sobre la que
 * ADR-015 pto. 9 daba por hecho lo mismo ("esta página no carga recursos de
 * terceros") sin que fuera cierto.
 *
 * `next/font/google` resuelve las familias en tiempo de build y las sirve desde
 * `/_next/static`: mismo tipo de letra, misma pinta, cero peticiones a Google y cero
 * dependencias nuevas en `package.json`. Los tokens `--font-sans` y `--font-mono` del
 * sistema de diseño se reapuntan a estas variables en `globals.css`.
 */
const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans', display: 'swap' });
const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

/**
 * SPEC-051 — la vista previa del enlace: lo que el foro enseña antes de que nadie entre.
 *
 * **`metadataBase` no es una decisión nueva: es una que ya estaba tomada.** Sale de
 * `appBaseUrl()` (SPEC-023, ADR-015 pto. 8), la misma función que compone el enlace de
 * recuperación de contraseña y por el mismo motivo: el origen absoluto sale de
 * CONFIGURACIÓN y nunca de la cabecera `Host`. Sin ella, Next emitiría un `og:image`
 * relativo —que ningún rastreador resuelve— o uno apuntando a `localhost`, que es peor
 * porque parece que funciona. Las tres alternativas (una clave nueva, el dominio del
 * aviso legal, `VERCEL_URL`) están rechazadas por escrito en §Diseño D-4 de la spec.
 *
 * `appBaseUrl()` **lanza si falta o si el valor no es un origen absoluto `http`/`https`**,
 * así que un build sin `.env` —o con la clave envenenada— falla ruidosamente. Es el diseño
 * y no un descuido (R-2): una tarjeta que en producción apunta a `localhost` es peor que un
 * build rojo. CI la define (`ci.yml`, job `E2E`) y producción también
 * (`docs/despliegue.md`).
 *
 * La segunda mitad de esa frase es de SPEC-055, y es la que se paga aquí: esta expresión se
 * evalúa **en tiempo de build**, así que un valor presente pero inválido no da un error de
 * configuración sino un `Invalid URL` sin sujeto en mitad de `next build`. El caso real es
 * `APP_BASE_URL="[SENSITIVE]"`, el marcador que `vercel env pull` escribe en
 * `.env.production.local` cuando la variable está marcada como *Sensitive* en Vercel — y
 * como ese fichero manda sobre `.env` sólo en builds de producción, `npm run dev` va bien
 * y `npm run build` no. Quien valida es `appBaseUrl()` y nadie más (SPEC-055 D-2): aquí no
 * hay guardia, y no debe haberla.
 *
 * **Aquí NO se declaran `openGraph.title` ni `openGraph.description`, y es el punto
 * entero de CA-3.** Cada página pone las suyas (`title`/`description`), y Next las
 * hereda al componer la tarjeta; si se escribieran aquí, TODAS las vistas previas dirían
 * «Stockeiro» a secas y la primera pantalla perdería su reclamo. Lo mismo con `twitter`:
 * sólo se declara la clase de tarjeta, y el resto —incluida la imagen— lo hereda de
 * `openGraph`, que es lo que hace que X enseñe la grande sin un segundo fichero (D-7).
 *
 * La imagen tampoco se declara: la ponen `opengraph-image.png` y `opengraph-image.alt.txt`
 * por convención de fichero, y es Next quien calcula su URL —con su hash de caché— y
 * emite los `<meta>`. Misma disciplina que SPEC-047 impuso a los iconos: un solo emisor.
 */
export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl()),
  title: 'Stockeiro',
  description: 'Vigilancia de zonas de compra/venta con cartera y avisos',
  openGraph: {
    type: 'website',
    siteName: 'Stockeiro',
    locale: 'es_ES',
    // El enlace que se pega en un hilo es la raíz (D-5): la tarjeta es global y todas
    // las rutas la heredan. Relativa a propósito — `metadataBase` la vuelve absoluta.
    url: '/',
  },
  twitter: { card: 'summary_large_image' },
};

/**
 * El pie compartido (SPEC-035) se monta AQUÍ y no en cada página: es la única forma
 * de que alcance también a las del grupo `(auth)` y a las de `/legal`, que son
 * públicas y no pasan por `AppNav`. Puede vivir en el layout raíz precisamente
 * porque no lee la sesión ni la base de datos (CA-10, CA-14).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="v-tremendo">
        <div className="frame">
          {children}
          <AppFooter />
        </div>
      </body>
    </html>
  );
}
