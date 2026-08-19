---
id: SPEC-035
tipo: spec
epica: EPIC-004
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-arquitecto}
---
# SPEC-035 — Páginas legales, titular y descargo de no asesoramiento

## Problema

**Hoy Stockeiro no dice quién la opera, ni qué hace con los datos de quien entra, ni que no
es asesoramiento financiero.** No hay ninguna página que lo diga: el árbol de rutas es
`/`, `/login`, `/register`, `/forgot-password`, `/reset-password/<token>`, `/dashboard`,
`/cartera`, `/cartera/importar`, `/vigiladas`, `/avisos`. Eso ha sido correcto mientras el
único usuario era el autor. Deja de serlo el día que la app se publica en un hilo de un foro
de bolsa y **un desconocido teclea su email y su contraseña** en un dominio que no conoce.

Esta spec cubre **CE-4** (*"Dice quién es y qué hace con tus datos"*) y es, junto con
**SPEC-034** (rol) y **SPEC-036** (borrar cuenta), el corte mínimo que **bloquea publicar**.

Hay tres cosas que se hacen mal cuando se escriben páginas legales deprisa, y las tres
tienen consecuencia aquí:

1. **Prometer una licencia que no se tiene.** El gate de la épica (2026-08-19) decidió
   **publicar con el free tier de Marketstack**, asumiendo **R-1** a conciencia: ese plan
   **no concede derechos de uso comercial ni de redistribución** (**ADR-012**, ratificado en
   el roadmap §Ops como **F-EPIC-004-1**). La consecuencia es literal y está escrita en la
   épica: estas páginas **declaran la fuente de los precios y su carácter informativo, y
   nada más**. Una frase de más aquí crea una obligación que la app no puede cumplir.
2. **Enumerar los datos "de memoria".** La lista de lo que se guarda tiene que ser la que
   dice el esquema, no la que uno recuerda. Y tiene que **seguir siéndolo** cuando alguien
   añada una tabla dentro de seis meses.
3. **Dejar el descargo enterrado.** Un descargo de no asesoramiento que solo existe en la
   página de términos es un descargo que nadie lee. **D-1** (*"la app avisa, no opera"*) y
   **D-4** (*"la app no calcula ni recomienda zonas"*) llevan en FOUNDATION desde el primer
   día como decisiones *locked*; esta spec es donde por fin se le dicen al usuario.

Reglas en juego: **RN-03** (acceso autenticado), con **una excepción declarada y acotada**
—las páginas legales son públicas por diseño, igual que **CA-15 de SPEC-023** declaró las
suyas—; **RN-01**, **RN-02** y **RN-12** / **D-2** (el carácter diferido del dato, que aquí
se dice por escrito y no solo se muestra en un `asOf`).

## Usuarios / roles afectados

- **Visitante que llega del foro y aún no se ha registrado**: puede leer, **antes** de dar
  su email, quién opera la app, qué se guarda, quién lo procesa y que esto no es
  asesoramiento. Sin cuenta y sin sesión.
- **Tester ya registrado**: tiene las mismas páginas a un clic desde cualquier pantalla, y
  ve el descargo en el pie **en todas ellas**, no solo si va a buscarlo.
- **Operador (Alberto Fojo)**: queda identificado por nombre y con un contacto. Es la
  contrapartida de publicar: dejar de ser anónimo.
- **Quien evalúa si esto cumple**: encuentra en una sola página la lista de subencargados
  (Vercel, Neon, Resend, Marketstack, Twelve Data) y la de categorías de datos, sin tener
  que leer el código.

## Criterios de aceptación

Cada CA es verificable con un test: contenido y rutas con **Playwright**, y las
comprobaciones estructurales (rutas públicas, grafo de imports, correspondencia con el
esquema) con **Vitest**.

- **CA-1 (Se leen sin sesión — CE-4, RN-03).**
  Dado un navegador **sin cookie de sesión**,
  cuando visita `/legal`, `/legal/aviso-legal`, `/legal/privacidad` y `/legal/terminos`,
  entonces las cuatro responden su contenido **sin redirigir a `/login`**; y siguen
  exigiendo sesión `/dashboard`, `/cartera`, `/vigiladas` y `/avisos`.

- **CA-2 (La excepción a RN-03 se declara y se acota — patrón de SPEC-023 CA-15).**
  Dado el guard (`isPublicPath`, `PUBLIC_PREFIXES` en `src/lib/auth/guard.ts`),
  cuando se evalúan las rutas,
  entonces `/legal` y sus subrutas son públicas y una ruta que solo **se parezca**
  (p. ej. `/legalX`) **no** lo es. El `matcher` de `src/proxy.ts` **no cambia**: `/legal` ya
  entra en él, y lo que decide es el guard.

- **CA-3 (Se sabe quién opera esto y cómo escribirle).**
  Dada `/legal/aviso-legal`,
  cuando se lee,
  entonces identifica al **titular** de la app por su nombre y ofrece **un medio de contacto
  operativo**, y nombra el dominio desde el que se presta el servicio.

- **CA-4 (La lista de datos guardados es la del esquema, y sigue siéndolo).**
  Dada `/legal/privacidad` y el esquema de `src/db/schema.ts`,
  cuando se comparan,
  entonces la página describe la categoría de dato de **cada** tabla con `userId` —cuenta
  (`users`), enlaces de recuperación (`password_reset_tokens`), operaciones
  (`transactions`), acciones vigiladas y zonas (`watched_symbols`), episodios de zona
  (`zone_triggers`), avisos (`notifications`) y equivalencias del import
  (`symbol_aliases`)—, y **un test falla si aparece una tabla con `userId` que la página no
  cubre**. La correspondencia se **comprueba**, no se confía.

- **CA-5 (Quién procesa los datos, dicho entero).**
  Dada `/legal/privacidad`,
  cuando se lee,
  entonces nombra a los cinco terceros que intervienen y **para qué** interviene cada uno:
  **Vercel** (alojamiento y ejecución), **Neon** (base de datos), **Resend** (correo de
  avisos y de recuperación), **Marketstack** (cotizaciones) y **Twelve Data** (búsqueda de
  símbolos), coherente con **ADR-001**, **ADR-006**, **ADR-012** y **ADR-002**.

- **CA-6 (De dónde vienen los precios y qué son — R-1, D-2, RN-12).**
  Dada `/legal/terminos` (y el bloque equivalente de `/legal/privacidad`),
  cuando se lee la sección de datos de mercado,
  entonces declara: (a) **quién es la fuente** de los precios, (b) que son **precios de
  cierre diferidos, no tiempo real**, con su fecha de referencia (**D-2**, **RN-12**), y
  (c) que se ofrecen **con carácter meramente informativo**.

- **CA-7 (Y NADA más que eso — R-1, decisión del gate).**
  Dadas las páginas de `/legal`,
  cuando se analiza su texto renderizado,
  entonces **no contienen ninguna afirmación de derecho de licencia, redistribución,
  explotación comercial, exclusividad o titularidad sobre las cotizaciones**, ni garantía
  alguna sobre su exactitud, continuidad o disponibilidad. Se verifica contra una **lista
  cerrada y versionada de afirmaciones prohibidas**; la lista vive junto al test, con el
  motivo escrito, para que quien la amplíe entienda qué está protegiendo.

- **CA-8 (El descargo de no asesoramiento está, y está donde se ve — CE-4, D-1, D-4).**
  Dada la app entera,
  cuando se renderiza **cualquier** página —pública o autenticada—,
  entonces el pie contiene una línea inequívoca de que Stockeiro **no presta asesoramiento
  financiero** ni recomienda operaciones, con enlace al texto completo; y
  `/legal/terminos` contiene ese texto completo, coherente con **D-1** (*avisa, no opera*)
  y **D-4** (*no calcula ni recomienda zonas*).

- **CA-9 (El pie está en todas partes y no filtra nada).**
  Dado el pie compartido,
  cuando lo ve un **visitante sin sesión** y cuando lo ve un usuario autenticado,
  entonces en ambos casos ofrece los enlaces a las páginas legales; y en el caso anónimo
  **no aparece ningún enlace de la navegación autenticada** ni ningún dato de usuario. El
  pie **no consulta la base de datos**.

- **CA-10 (Las páginas legales no cargan nada de terceros).**
  Dadas las páginas de `/legal`,
  cuando se sirven,
  entonces **no solicitan ningún recurso externo** (ni script, ni tipografía, ni imagen, ni
  baliza): comprobable interceptando las peticiones de red en Playwright y exigiendo que
  todas sean del propio origen. Es coherente con la disciplina que **ADR-015** pto. 9 ya
  impuso a `/reset-password`, y es lo que hace verdad lo que la propia página dice.

- **CA-11 (Sin analítica y sin más cookies que la de sesión, dicho y comprobado).**
  Dada `/legal/privacidad`, que declara que no hay analítica de terceros ni cookies más allá
  de la **estrictamente necesaria** para mantener la sesión,
  cuando un navegador anónimo recorre `/legal` y `/login`,
  entonces **no se le fija ninguna cookie** salvo las que Auth.js necesita para el flujo de
  sesión. Lo que la página promete se comprueba en la misma prueba que la lee.

- **CA-12 (Las páginas legales responden con la base caída).**
  Dado el grafo de imports de las rutas de `/legal`,
  cuando se analiza,
  entonces **ninguna** alcanza `src/db/` ni el cliente de base de datos — mismo estilo de
  comprobación que `tests/version-import-graph.test.ts` ya aplica a `/api/version`
  (SPEC-031). Una página que explica el servicio y desaparece cuando el servicio falla no
  sirve para lo que se escribió.

- **CA-13 (Se llega desde donde hace falta llegar).**
  Dadas `/login` y `/register`,
  cuando las visita alguien **sin cuenta**,
  entonces puede alcanzar las páginas legales **antes** de introducir ningún dato: hay
  camino desde el formulario de alta al texto que explica qué se va a hacer con lo que va a
  teclear.

- **CA-14 (El derecho de supresión se enuncia; el botón lo entrega SPEC-036).**
  Dada `/legal/privacidad`,
  cuando se lee el apartado de derechos,
  entonces enuncia que el usuario puede **borrar su cuenta y sus datos desde la propia
  app**, nombra la ruta donde se hace y advierte del residual honesto de **F-ADR-022-1** (el
  correo ya entregado vive en el buzón del destinatario y en los registros del proveedor).
  **Esta spec no crea el enlace ni la pantalla**: es la frontera con **SPEC-036**, que añade
  el enlace y su CA propio.

- **CA-15 (No degrada lo entregado).**
  Dada la suite existente,
  cuando se ejecuta,
  entonces sigue verde, y en particular **CA-15 de SPEC-023** (las rutas públicas son las
  declaradas y solo esas) sigue pasando con la lista ampliada.

## Entidades y reglas afectadas

**Sin cambios de esquema.** Esta spec no crea ni modifica ninguna tabla y no escribe nada.
Es, deliberadamente, la única de EPIC-004 que no toca la base de datos — de ahí que sea la
más barata de desplegar de las tres que bloquean publicar.

**Rutas nuevas** (públicas por diseño, CA-1/CA-2): `/legal` (índice), `/legal/aviso-legal`,
`/legal/privacidad`, `/legal/terminos`. Se declaran en `PUBLIC_PREFIXES`
(`src/lib/auth/guard.ts`), **único sitio** donde vive la excepción a **RN-03**.

**Componente nuevo**: el **pie compartido** (`AppFooter`), hermano de `AppNav`
(`src/app/app-nav.tsx`) pero **sin sesión y sin base de datos** (CA-9). Se monta en el
layout raíz (`src/app/layout.tsx`) para que alcance también a las páginas del grupo
`(auth)`. Es la pieza que **SPEC-038** extenderá con la versión visible: esta spec lo crea,
aquella lo amplía, y ninguna de las dos lo duplica.

**Reglas y decisiones**: **RN-03** (con la excepción declarada de CA-2), **RN-01** y
**RN-02** (intactas: aquí no se lee ni un dato de usuario), **RN-12** y **D-2** (el carácter
diferido, CA-6), **D-1** y **D-4** (el descargo, CA-8); **ADR-001** (Vercel/Neon/Auth.js),
**ADR-002**/**ADR-012** (proveedores de mercado y **R-1**), **ADR-006** (Resend),
**ADR-015** pto. 9 (la disciplina de no cargar terceros), **ADR-022** (qué promete el
borrado, CA-14). Dominio: se añaden a `docs/fundacion/dominio.md` los términos **Titular**,
**Descargo de no asesoramiento** y **Fuente de precios**.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Consultar a un abogado.** Esta spec entrega páginas **veraces y completas** sobre lo que
  la app hace de verdad; **no** entrega una revisión jurídica ni certifica cumplimiento de
  ninguna normativa concreta. La diferencia importa y está en las notas del gate.
- **Banner de cookies y gestor de consentimiento.** No hay cookies fuera de la de sesión ni
  analítica (CA-11): añadir un banner para pedir consentimiento de nada sería teatro. El día
  que entre analítica, entra con su banner y su spec.
- **Registro de actividades de tratamiento, DPA firmados con cada proveedor, evaluación de
  impacto.** Papeleo de cumplimiento, no producto. Se nombra en las notas del gate para que
  no se confunda su ausencia con un descuido.
- **Portabilidad / exportar mis datos**: fuera de la épica por decisión escrita. La página
  enuncia la supresión (CA-14), **no** promete exportación.
- **La pantalla de borrado**: es **SPEC-036**. Aquí solo se enuncia el derecho.
- **La versión visible**: es **SPEC-038**, que extiende el pie que esta spec crea.
- **Ayuda de producto, cadencia explicada al usuario y canal de feedback**: son **SPEC-039**.
  El carácter diferido se dice aquí en clave **legal** (CA-6); explicárselo a un tester para
  que no crea que la app está rota (**R-4**) es otro trabajo y otra spec.
- **Traducción / i18n**: fuera de la épica. Estas páginas se escriben en español.
- **Cambiar de plan en Marketstack**: es **F-EPIC-004-1**, acción de ops, decidida en el gate
  (se publica con el free tier). Esta spec **vive con esa decisión**; no la reabre.

## Salvedades y follow-ups

- **F-SPEC-035-1 (contenido, requiere al humano).** El nombre del titular, la forma jurídica
  (persona física) y el email de contacto **los tiene que dar el humano**: no me los invento.
  Sin ellos, CA-3 no se puede cumplir con datos reales. Es el único dato de esta spec que no
  sale del repositorio.
- **F-SPEC-035-2 (residual asumido de R-1).** Que las páginas no afirmen derechos que no se
  tienen **no crea** los derechos que faltan. Publicar precios del free tier de Marketstack
  en abierto sigue siendo el riesgo que el gate asumió a conciencia; esta spec lo hace
  **visible y honesto**, no lo resuelve. Lo resuelve **F-EPIC-004-1**.
- **F-SPEC-035-3 (mantenimiento).** CA-4 ata la página al esquema y **fallará a propósito**
  cuando alguien añada una tabla con `userId`. Es la intención: la política de privacidad se
  actualiza en la misma PR que crea el dato, o no se actualiza nunca.
- **F-SPEC-035-4 (futuro).** No hay versionado ni fecha de última actualización con
  historial de cambios de los textos legales. Con una versión inicial es innecesario; en
  cuanto cambien, hará falta.

## Notas para el gate humano

1. **Necesito tres datos tuyos (F-SPEC-035-1): nombre del titular, condición (persona
   física) y email de contacto.** Es lo único de toda la épica que no puedo derivar del
   repositorio, y sin ello CA-3 se cumple con un marcador de posición, que es peor que no
   tenerlo.

2. **CA-7 es el CA que protege R-1 y es contraintuitivo: prohíbe escribir cosas.** Lo normal
   al redactar términos es blindarse ("todos los derechos reservados sobre los contenidos");
   aquí eso sería exactamente el error, porque los precios **no son nuestros** y el plan que
   los sirve no concede redistribución. La lista de afirmaciones prohibidas se versiona junto
   al test para que dentro de un año nadie la "mejore" sin entender qué protege.

3. **Esto no es una revisión jurídica y no quiero que se lea como tal.** Lo que entrego son
   páginas **veraces**: describen lo que la app hace de verdad, con la lista de datos atada
   al esquema (CA-4) y la de proveedores atada a la arquitectura (CA-5). Si algún día hay
   usuarios de pago o llega una reclamación, hace falta un profesional. Decirlo aquí es
   parte de mi trabajo; decidir si te vale para publicar en un foro es parte del tuyo.

4. **El descargo en el pie de TODAS las páginas (CA-8) es una decisión de producto.** Cuesta
   una línea de espacio permanente en la interfaz. La alternativa —solo en `/legal`— es más
   limpia visualmente y, en mi opinión, insuficiente: el público de un foro de bolsa toma
   decisiones con dinero mirando estas pantallas, y **D-4** dice que la app no da criterio.
   Si te parece demasiado ruido, dilo: se queda en las páginas legales y en el registro.

5. **Ninguna migración, ningún dato.** A diferencia de SPEC-034 y SPEC-037, esta spec **no
   toca la base**, así que **no** activa el problema de `F-SPEC-023-1` (abrir la PR migra
   producción). De las tres que bloquean publicar, es la que se puede desplegar con menos
   ceremonia — buena candidata a ir la primera si quieres ver algo vivo pronto.

6. **CA-12 (responder con la base caída) puede parecer un lujo.** No lo es: el momento en
   que alguien busca "quién opera esto y a quién reclamo" es precisamente el momento en que
   algo va mal. Cuesta un test de grafo de imports que ya existe copiado de SPEC-031.

7. **Frontera con SPEC-036 (CA-14).** La página **enuncia** el derecho de supresión y nombra
   la ruta; el **enlace y la pantalla** los entrega SPEC-036. Si prefieres publicar sin
   supresión, esta spec sigue siendo verdadera pero CA-14 hay que reescribirlo, y CE-5 se
   queda sin cumplir — que es justo lo que la épica llama bloqueante.

8. **Aprobación**: la spec queda en **`borrador`** y **no la firmo yo**. No origina ningún
   ADR: se apoya en los existentes.
