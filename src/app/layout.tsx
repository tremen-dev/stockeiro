import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stockeiro',
  description: 'Vigilancia de zonas de compra/venta con cartera y avisos',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="v-tremendo">
        <div className="frame">{children}</div>
      </body>
    </html>
  );
}
