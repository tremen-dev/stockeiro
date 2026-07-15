import Link from 'next/link';
import { AppNav } from '../../app-nav';
import { ImportWizard } from './import-wizard';

/**
 * Pantalla de import desde bróker (SPEC-014, `/cartera/importar`). Ruta protegida por
 * el proxy de sesión (RN-03): sin sesión, redirige a login (CA-11). Aloja el asistente
 * de 3 pasos (Subir → Resolver → Previsualizar/Confirmar).
 */
export default function ImportarPage() {
  return (
    <>
      <AppNav active="cartera" />
      <main className="page">
        <div className="page-head">
          <span className="eyebrow">Cartera · Importar</span>
          <h1 className="headline">Importar extracto</h1>
        </div>
        <section className="lede">
          <p>
            Sube el extracto de movimientos de tu bróker (formato ING <code>.xls</code>) y
            siembra tu cartera sin teclear cada operación. Nada se guarda hasta que lo confirmes.
          </p>
          <p>
            <Link href="/cartera" className="btn-link">
              ← Volver a la cartera
            </Link>
          </p>
        </section>
        <ImportWizard />
      </main>
    </>
  );
}
