import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CATEGORIAS_DE_DATO,
  CONSERVACION,
  COOKIES_Y_ANALITICA,
  DATOS_DE_MERCADO,
  DERECHOS,
  ENCARGADOS,
  TITULAR,
} from '@/lib/legal/content';

export const metadata: Metadata = {
  title: 'Privacidad · Stockeiro',
  description: 'Qué datos guarda Stockeiro, para qué, quién más los ve y cómo borrarlos.',
};

/**
 * Política de privacidad (SPEC-035 CA-4, CA-5, CA-6, CA-7, CA-13, CA-16). Pública.
 *
 * La lista de datos NO se escribe aquí: se recorre desde `CATEGORIAS_DE_DATO`, que
 * `tests/legal-datos-y-esquema.test.ts` compara contra `src/db/schema.ts`. Es la
 * diferencia entre una página que describe el sistema y una que lo describía cuando
 * se escribió: si alguien añade una tabla con `userId`, el test se pone rojo y la
 * política se actualiza en la misma PR que crea el dato (F-SPEC-035-3).
 *
 * Lo mismo con los terceros: salen de la arquitectura, no de la memoria.
 */
export default function PrivacidadPage() {
  return (
    <main className="legal">
      <h1 className="legal-title">Política de privacidad</h1>

      <p className="legal-lede">
        Lo corto: Stockeiro guarda tu correo, la huella de tu contraseña —nunca la contraseña
        misma— y los datos de bolsa que tú metes. No los vende, no los pasa a nadie que no
        aparezca en esta página y no te rastrea. Lo largo, debajo.
      </p>

      <section className="legal-seccion">
        <h2>Quién responde de tus datos</h2>
        <p className="legal-destacado" data-testid="responsable">
          El responsable del tratamiento es {TITULAR.nombre}, {TITULAR.forma}, con domicilio en{' '}
          {TITULAR.domicilio}.
        </p>
        <p>
          Puedes escribirle a <a href={`mailto:${TITULAR.contacto}`}>{TITULAR.contacto}</a> para
          cualquier cosa relacionada con tus datos. Contesta una persona.
        </p>
      </section>

      <section className="legal-seccion">
        <h2>Qué se guarda de ti</h2>
        <p>
          Esta lista es la del sistema, no un resumen: se genera desde el propio esquema de la
          base de datos y una prueba automática falla si alguna vez dejan de coincidir.
        </p>
        <dl className="legal-datos">
          {CATEGORIAS_DE_DATO.map((categoria) => (
            <div key={categoria.tabla} data-testid={`dato-${categoria.tabla}`}>
              <dt>{categoria.titulo}</dt>
              <dd>{categoria.descripcion}</dd>
            </div>
          ))}
        </dl>
        <p>
          No se pide ni se guarda nada más: ni nombre, ni teléfono, ni dirección postal, ni
          datos de pago. Stockeiro no cobra.
        </p>
      </section>

      <section className="legal-seccion">
        <h2>Para qué se usan</h2>
        <p>
          Para prestarte el servicio y para nada más: mantener tu cuenta, calcular lo que te
          enseña la app y enviarte los avisos que tú has configurado. No se usan para
          elaborar perfiles, ni se cruzan con datos de nadie, ni se venden.
        </p>
        <p>
          La base que lo permite es la ejecución del servicio que has pedido al crear la
          cuenta. Si borras la cuenta, deja de haber base y deja de haber datos.
        </p>
      </section>

      <section className="legal-seccion">
        <h2>Quién más los ve</h2>
        <p>
          Stockeiro se apoya en cinco servicios de terceros. Estos son todos, y esto es lo que
          hace cada uno:
        </p>
        <ul className="legal-encargados">
          {ENCARGADOS.map((encargado) => (
            <li key={encargado.id} data-testid={`encargado-${encargado.id}`}>
              <strong>{encargado.nombre}</strong>
              <span className="legal-encargado-para">{encargado.para}</span>
              <span className="legal-encargado-ve">Qué ve: {encargado.ve}</span>
            </li>
          ))}
        </ul>
        <p>
          Fuera de esa lista, nadie. Tus datos no se comunican a terceros con fines
          publicitarios ni de ningún otro tipo.
        </p>
      </section>

      <section className="legal-seccion" data-testid="datos-de-mercado">
        <h2>Los precios que ves</h2>
        {DATOS_DE_MERCADO.map((parrafo) => (
          <p key={parrafo.slice(0, 24)}>{parrafo}</p>
        ))}
        <p>
          Esto se cuenta con más detalle en los{' '}
          <Link href="/legal/terminos">términos de uso</Link>.
        </p>
      </section>

      <section className="legal-seccion">
        <h2>Cookies y seguimiento</h2>
        {COOKIES_Y_ANALITICA.map((parrafo) => (
          <p key={parrafo.slice(0, 24)}>{parrafo}</p>
        ))}
      </section>

      <section className="legal-seccion" data-testid="derechos">
        <h2>Tus derechos</h2>
        {DERECHOS.map((parrafo) => (
          <p key={parrafo.slice(0, 24)}>{parrafo}</p>
        ))}
      </section>

      <section className="legal-seccion" data-testid="conservacion">
        <h2>Cuánto tiempo se conservan</h2>
        {CONSERVACION.map((parrafo) => (
          <p key={parrafo.slice(0, 24)}>{parrafo}</p>
        ))}
      </section>
    </main>
  );
}
