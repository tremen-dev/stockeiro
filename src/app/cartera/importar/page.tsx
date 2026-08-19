import Link from 'next/link';
import { requireSectionUser } from '@/lib/auth/session';
import { AppNav } from '../../app-nav';
import { ImportWizard } from './import-wizard';

/**
 * Pantalla de import desde bróker (SPEC-014, `/cartera/importar`). Ruta protegida por
 * el proxy de sesión (RN-03): sin sesión, redirige a login (CA-11). Aloja el asistente
 * de 3 pasos (Subir → Resolver → Previsualizar/Confirmar).
 */
export default async function ImportarPage() {
  // SPEC-023 CA-13: sesión revocada -> login. SPEC-034 CA-6: rol sin Importar ->
  // panel con la nota, antes de pintar el asistente (ADR-021 pto. 6).
  await requireSectionUser('importar');
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
