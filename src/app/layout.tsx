import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
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

export const metadata: Metadata = {
  title: 'Stockeiro',
  description: 'Vigilancia de zonas de compra/venta con cartera y avisos',
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
