import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { db } from '@/db/client';
import { zoneStatusForUser } from '@/lib/watchlist/zone-status';
import {
  AVISO_LO_EMITE_EL_CICLO,
  CADENCIA_LINEA,
  RUTA_AYUDA,
  VACIO_VIGILADAS,
} from '@/lib/help/content';
import { AppNav } from '../app-nav';
import { AltaVigilada } from './alta-vigilada';
import { WatchedTable } from './watched-table';

// Acciones vigiladas con ESTADO DE ZONA (SPEC-007): el color de fondo de cada fila
// indica si su última cotización está en zona (compra/venta) o fuera; la etiqueta de
// texto lo acompaña para accesibilidad. El estado se computa con `entraEnZona` (RN-11).
//
// SPEC-041: la página SIGUE SIENDO Server Component y sigue haciendo lo mismo —consulta,
// aislamiento por usuario y cálculo del estado—; entrega las filas ya resueltas. Lo que
// se ha movido al cliente es sólo la PRESENTACIÓN de la tabla, para poder reordenarla
// sin ir al servidor (CA-10), y el momento en que aparece el formulario de alta
// (CA-12/CA-13). Ni un dato, ni un cálculo, ni una regla cambian de sitio (CE-M1).
export default async function VigiladasPage() {
  const user = await requireUser(); // SPEC-023 CA-13: sesión revocada -> login
  const rows = await zoneStatusForUser(db, user.id);
  const listaVacia = rows.length === 0;
  /*
    SPEC-058 CA-11 — la frase del desacompasamiento se enseña **cuando hay algo en zona**,
    que es cuando el usuario puede leer la pantalla como una promesa de correo. Desde
    RN-17 el precio entra también en el alta, así que se puede ver «En compra» horas antes
    de que el ciclo compare y avise — y en un caso el correo no llega nunca (ADR-038,
    dictamen aviso 3). El texto NO se escribe aquí: es la misma constante que muestra
    `/ayuda`, como manda ADR-026 pto. 2.
  */
  const hayAlgoEnZona = rows.some((r) => r.state === 'buy' || r.state === 'sell' || r.state === 'both');

  return (
    <>
      <AppNav active="vigiladas" />
      <main className="page">
        <div className="page-head">
          <span className="eyebrow">Vigiladas</span>
          <h1 className="headline">Acciones vigiladas</h1>
          <p className="sub">
            El color de cada fila indica su estado de zona según la última cotización (precio de
            cierre no ajustado, con su fecha).
          </p>
        </div>

        {listaVacia ? (
          /*
            SPEC-039 CA-9 — el estado vacío GUÍA en vez de constatar. Antes decía
            «añade un ticker con su zona de compra y/o venta» y ya: correcto, y
            completamente insuficiente para quien no sabe qué es una zona en este
            producto, si el rango es de precio, ni cada cuánto se mira.

            Ahora lleva las cuatro cosas que CE-1 necesita: el primer paso (el
            formulario está justo debajo, no hay que buscarlo), un ejemplo CON
            NÚMEROS, la cadencia —la misma frase literal que la primera pantalla y la
            ayuda, CA-3— y el enlace a la explicación larga.

            La cadencia va aquí y no solo en la ayuda a propósito (R-4): esta es la
            pantalla donde alguien se queda mirando un precio que no cambia, y nadie
            lee la ayuda antes de quejarse.

            SPEC-041 CA-21: este bloque NO se toca. Ni sus textos, que se siguen leyendo
            de `src/lib/help/content.ts`, ni su sitio. Y CA-12 protege lo que el texto
            promete: «Empieza aquí abajo…» apunta al formulario, que va INMEDIATAMENTE
            después y desplegado, sin ningún control intermedio que pulsar.
          */
          <div className="empty" data-testid="vigiladas-vacio">
            <span className="empty-title">{VACIO_VIGILADAS.titulo}</span>
            <p>{VACIO_VIGILADAS.primerPaso}</p>
            <div className="empty-guia">
              <p className="empty-ejemplo" data-testid="vigiladas-vacio-ejemplo">
                {VACIO_VIGILADAS.ejemplo}
              </p>
              <p data-testid="vigiladas-vacio-cadencia">{CADENCIA_LINEA}</p>
              <p>
                <Link href={RUTA_AYUDA}>Cómo funciona Stockeiro</Link> — qué es una zona,
                cuándo dispara y cuándo llega el aviso.
              </p>
            </div>
          </div>
        ) : (
          <>
            {hayAlgoEnZona && (
              <p className="sub" data-testid="vigiladas-aviso-del-ciclo">
                {AVISO_LO_EMITE_EL_CICLO}
              </p>
            )}
            <WatchedTable filas={rows} />
          </>
        )}

        <AltaVigilada listaVacia={listaVacia} />
      </main>
    </>
  );
}
