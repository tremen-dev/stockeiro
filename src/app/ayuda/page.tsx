import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AVISOS,
  CADENCIA,
  MERCADOS,
  MERCADOS_SECCION,
  MOTIVOS_SIN_PRECIO,
  PRECIOS,
  QUE_HACE,
  QUE_NO_HACE,
  SIN_PRECIO_SECCION,
  ZONAS,
  type Seccion,
} from '@/lib/help/content';

export const metadata: Metadata = {
  title: 'Cómo funciona · Stockeiro',
  description:
    'Qué es una zona, cuándo dispara, cuándo llega el aviso, cada cuánto se actualizan los ' +
    'precios y qué mercados hay detrás.',
};

/**
 * La ayuda (SPEC-039, CE-1). **Pública**: se lee sin sesión (CA-1), porque quien
 * llega de un hilo de un foro tiene que poder decidir si esto le sirve **antes** de
 * teclear su correo — y si no le sirve, irse sin registrarse es un buen resultado.
 *
 * Es UNA página y no un manual: el circuito completo es vigiladas → zonas → avisos,
 * y todo lo demás está fuera por decisión de la épica. La ayuda de Cartera e Importar
 * se escribirá el día que los testers las vean (SPEC-034).
 *
 * Dos cosas de esta página no las escribe nadie a mano y esa es su gracia: la lista
 * de mercados sale de `OPERATING_MICS` y los motivos de «sin precio» de
 * `QuoteFailureReason`. Si mañana el producto gana un mercado o un motivo, la ayuda
 * lo gana con él — y si alguien cambia el código sin tocar la prosa que los cuenta,
 * `tests/ayuda-contenido.test.ts` se pone rojo en su PR (F-SPEC-039-3).
 *
 * No consulta la base de datos ni lee la sesión (CA-14): igual que `/legal`, es una
 * página que tiene que responder **cuando algo va mal**, que es cuando se busca.
 * `tests/ayuda-import-graph.test.ts` lo vigila.
 */
function Bloque({ seccion }: { seccion: Seccion }) {
  return (
    <section className="ayuda-seccion" id={seccion.id} data-testid={`ayuda-${seccion.id}`}>
      <h2>{seccion.titulo}</h2>
      {seccion.parrafos.map((parrafo) => (
        <p key={parrafo.slice(0, 24)}>{parrafo}</p>
      ))}
    </section>
  );
}

export default function AyudaPage() {
  return (
    <main className="ayuda">
      <h1 className="ayuda-title">Cómo funciona Stockeiro</h1>

      <p className="ayuda-lede">{QUE_HACE}</p>
      <p className="ayuda-aviso">{QUE_NO_HACE}</p>

      <nav className="ayuda-indice" aria-label="Contenido de la ayuda">
        {[CADENCIA, ZONAS, AVISOS, PRECIOS, MERCADOS_SECCION, SIN_PRECIO_SECCION].map((s) => (
          <a key={s.id} href={`#${s.id}`}>
            {s.titulo}
          </a>
        ))}
      </nav>

      <Bloque seccion={CADENCIA} />
      <Bloque seccion={ZONAS} />
      <Bloque seccion={AVISOS} />
      <Bloque seccion={PRECIOS} />

      <section
        className="ayuda-seccion"
        id={MERCADOS_SECCION.id}
        data-testid={`ayuda-${MERCADOS_SECCION.id}`}
      >
        <h2>{MERCADOS_SECCION.titulo}</h2>
        <p>{MERCADOS_SECCION.intro}</p>
        <ul className="ayuda-mercados">
          {MERCADOS.map((mercado) => (
            <li key={mercado.mic} data-mic={mercado.mic}>
              {mercado.nombre}
            </li>
          ))}
        </ul>
        <p>{MERCADOS_SECCION.cierre}</p>
      </section>

      <section
        className="ayuda-seccion"
        id={SIN_PRECIO_SECCION.id}
        data-testid={`ayuda-${SIN_PRECIO_SECCION.id}`}
      >
        <h2>{SIN_PRECIO_SECCION.titulo}</h2>
        <p>{SIN_PRECIO_SECCION.intro}</p>
        <dl className="ayuda-motivos">
          {MOTIVOS_SIN_PRECIO.map((motivo) => (
            <div key={motivo.id} data-motivo={motivo.id}>
              <dt>{motivo.titulo}</dt>
              <dd>{motivo.texto}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="ayuda-seccion" data-testid="ayuda-siguiente-paso">
        <h2>Por dónde se empieza</h2>
        <p>
          Se empieza en <Link href="/vigiladas">Vigiladas</Link>: buscas el valor por nombre o
          por ticker, eliges su mercado y escribes el rango. Con eso ya está vigilado; el
          resto lo hace el ciclo. Si todavía no tienes cuenta,{' '}
          <Link href="/register">créala aquí</Link> — y si ya la tienes,{' '}
          <Link href="/login">entra</Link>.
        </p>
      </section>
    </main>
  );
}
