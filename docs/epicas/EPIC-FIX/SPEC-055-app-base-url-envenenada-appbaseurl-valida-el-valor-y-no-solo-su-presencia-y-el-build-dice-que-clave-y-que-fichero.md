---
id: SPEC-055
tipo: spec
epica: EPIC-FIX
estado: en-revision
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-24, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-24, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-24, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-24, por: sdd-implementador}
  - {estado: en-progreso, fecha: 2026-08-24, por: sdd-verificador}
  - {estado: en-revision, fecha: 2026-08-24, por: sdd-implementador}
---
# SPEC-055 — `APP_BASE_URL` envenenada: `appBaseUrl()` valida el valor y no solo su presencia, y el build dice qué clave y qué fichero

## Problema

**`appBaseUrl()` protege contra la clave ausente y no contra la clave envenenada.**

`npm run build` muere con `Failed to collect configuration for /_not-found` → `Invalid URL`
**aunque `APP_BASE_URL` esté definida**, y el mensaje **no nombra ni la clave culpable ni el
fichero**. El desarrollador ve un `Invalid URL` sin sujeto y se pone a buscar en
`DATABASE_URL`, que es la única URL que tiene en la cabeza.

### La cadena, línea a línea

Cinco eslabones. Ninguno es un fallo por sí solo; juntos producen un build rojo mudo.

1. **`.env` no declara `APP_BASE_URL` en absoluto.** Quien mire ahí no encuentra nada
   sospechoso, porque no encuentra nada.
2. **`.env.production.local` sí la declara, y vale el literal `"[SENSITIVE]"`.** Lo escribe
   **`vercel env pull`** cuando la variable está marcada como *Sensitive* en Vercel: la CLI
   se niega a revelar el valor y deja ese marcador en su lugar. **No es basura aleatoria:
   es un literal conocido, predecible y sistemático**, y por tanto reconocible.
3. **Next carga `.env.production.local` por encima de `.env`, y sólo en builds de
   producción.** Por eso `npm run dev` va bien y `npm run build` no. Eso hace el defecto
   especialmente traicionero: aparece justo cuando el desarrollador cree haber hecho lo
   correcto —sincronizar su entorno con el de Vercel—, y desaparece si vuelve a `dev`.
4. **`appBaseUrl()` (`src/lib/config/app-url.ts:13`) valida presencia, no validez.**
   `const raw = env.APP_BASE_URL?.trim(); if (!raw) throw …`. `"[SENSITIVE]"` es una cadena
   no vacía: **pasa la guardia** y se devuelve tal cual, recortadas las barras finales.
5. **`src/app/layout.tsx:57` hace `metadataBase: new URL(appBaseUrl())`**, que se evalúa
   **en tiempo de build** —es un export `metadata`, SPEC-051 CA-1—, y
   `new URL('[SENSITIVE]')` lanza `Invalid URL`.

El apaño conocido es arrancar con `APP_BASE_URL=http://localhost:3200 npm run build`. **Eso
es el apaño, no el arreglo**: tapa el síntoma en la máquina de quien ya sabe la respuesta.

### Lo que este defecto NO es

- **No es una fuga.** `.gitignore:12` cubre `.env*.local`: nada de esto está commiteado.
  Verificado.
- **No es un fichero que haya que arreglar.** `.env.production.local` es local de cada
  máquina y lo reescribe `vercel env pull` en la siguiente pasada. Esta spec **no lo toca**.
- **No es el defecto de SPEC-052.** Ésa cubre la clave **ausente**; ésta, la clave
  **presente y envenenada**. Ver §Frontera con SPEC-052.

### La parte que deja de ser una molestia de build: el oráculo de enumeración

`appBaseUrl()` no la usa sólo el layout. `src/app/(auth)/actions.ts:128` la usa para componer
el enlace de **recuperación de contraseña**, y **ADR-015 pto. 8** la eligió precisamente para
que ese enlace **nunca** salga de la cabecera `Host`. **Verificado en el código, no supuesto:**

Con un valor envenenado, `appBaseUrl()` **no lanza** (eslabón 4), así que el valor llega vivo
a `requestPasswordReset(db, sender, email, { baseUrl })`. Ahí dentro
(`src/lib/auth/password-reset.ts`) el orden es:

| Paso | Línea | Qué pasa con `baseUrl = '[SENSITIVE]'` |
|---|---|---|
| `getUserByEmail` → `if (!user) return nothing` | `:80` | **email desconocido: sale por aquí, acuse normal, HTTP 200** |
| límite por cuenta (CA-12 de SPEC-023) → `return nothing` | `:95` | **email limitado: sale por aquí, acuse normal, HTTP 200** |
| `invalidateLiveTokens(db, user.id)` | `:98` | los enlaces vivos del usuario **quedan consumidos** |
| `db.insert(passwordResetTokens)` | `:101` | se inserta un token nuevo |
| `buildResetUrl(opts.baseUrl, token)` | `:107` | **lanza `Invalid URL`** → la acción revienta → **HTTP 500** |

Es decir: **email que no existe → 200 con el acuse; email que existe y no está limitado →
500.** Eso es exactamente el oráculo de enumeración que **SPEC-023 CA-1/CA-2/CA-12** cerró
por diseño («la respuesta es LA MISMA exista o no la cuenta», `password-reset.ts:61-65`),
reabierto por la puerta de atrás. Y con daño colateral: el usuario legítimo que ya tenía un
enlace vivo **lo pierde** —`invalidateLiveTokens` corre antes del estallido— y no recibe el
sustituto.

Con la clave **ausente** esto no pasa: `appBaseUrl()` se evalúa como argumento en
`actions.ts:128`, o sea **antes** de entrar en `requestPasswordReset`, y lanza para todo el
mundo por igual. **Es precisamente el envenenamiento —y sólo él— el que mueve el estallido
al otro lado de las dos salidas tempranas.** Colapsar el caso envenenado dentro del caso
ausente cierra el oráculo por construcción.

#### La otra mitad de la frase: el oráculo era LATENTE, y esto se mide

Añadido el **2026-08-24** tras el gate del verificador (O3). Todo lo de arriba está
condicionado —«con la clave envenenada»— y por tanto no miente; pero **decirlo sin decir la
otra mitad hace que se lea peor de lo que fue**, y en este proyecto ya hay varias specs
dedicadas a frases que fueron ciertas y dejaron de serlo. La otra mitad, con sus dos apoyos:

- **El razonamiento, del gate.** `metadataBase` se evalúa en **tiempo de build** (eslabón 5,
  SPEC-051 CA-1), así que **un despliegue de producción con la clave envenenada no llega a
  existir**: el build se cae antes de que haya nada que desplegar. Por tanto el oráculo
  **nunca estuvo abierto en un despliegue vivo**. Era un defecto **latente**, esperando a que
  alguien construyera y desplegara con la variable marcada *Sensitive*.
- **La medida, contra producción, del 2026-08-24** —la que el verificador no podía tomar
  desde los artefactos, porque `.env.production.local` trae la clave enmascarada y ése es el
  defecto entero—: `curl https://stockeiro.tremen.dev/login` devuelve
  `<meta property="og:url" content="https://stockeiro.tremen.dev"/>`. Ese `og:url` **sale de
  `metadataBase`, que sale de `appBaseUrl()`**. Luego **`APP_BASE_URL` vale hoy en producción
  `https://stockeiro.tremen.dev` y es válida**: comprobado, no deducido.

**Qué cambia y qué no.** No cambia la gravedad de lo que la spec arregla —el 200/500 está
medido y es real en cuanto la clave se envenena, que es un `vercel env pull` de distancia— ni
justifica bajar de prioridad. Cambia el tiempo verbal: **no hay incidente que investigar, ni
usuarios afectados que avisar, ni ventana que acotar.** Quien lea esta spec dentro de seis
meses tiene derecho a saber las dos cosas.

### Por qué `new URL()` no lanza no basta como listón

Medido, ejecutando las expresiones reales de los dos consumidores:

| Valor | `new URL(v)` (el layout) | `new URL('/reset-password/tok', v + '/')` (el correo) |
|---|---|---|
| `[SENSITIVE]` | **lanza** `Invalid URL` | **lanza** `Invalid URL` |
| `stockeiro.tremen.dev` (sin esquema) | **lanza** `Invalid URL` | **lanza** `Invalid URL` |
| `//evil.com` | **lanza** `Invalid URL` | **lanza** `Invalid URL` |
| `ftp://x.com` | **pasa**, `origin=ftp://x.com` | **pasa**: `ftp://x.com/reset-password/tok` |
| `file:///etc/passwd` | **pasa**, `origin=null` | **pasa**: `file:///reset-password/tok` |
| `javascript:alert(1)` | **pasa**, `origin=null` | lanza |
| `https://a.com/es` | **pasa**, conserva `/es` | **pasa**, y **pierde `/es`**: `https://a.com/reset-password/tok` |
| `http://localhost:3200` | pasa | pasa |
| `https://stockeiro.tremen.dev` | pasa | pasa |

Dos cosas que sólo se ven con la tabla delante:

- **`ftp://` y `file:` sobreviven a `new URL` y llegan hasta el correo.** Un origen que
  parsea no es un origen usable. El listón «que no lance» es necesario y no suficiente.
- **Con una ruta, los dos consumidores discrepan sobre el mismo valor**: el layout la
  conserva en `metadataBase` y el enlace de correo la tira. Un valor que significa dos cosas
  distintas según quién lo lea no es configuración válida, es una trampa.

## Usuarios / roles afectados

- **Quien construye después de un `vercel env pull`.** Es el usuario principal: hace lo
  correcto, se lleva un `Invalid URL` sin sujeto y pierde la tarde. Hoy el mensaje no le dice
  ni la clave ni el fichero, que son las dos únicas cosas que necesita.
- **La persona que pide recuperar su contraseña** en un despliegue con la clave envenenada:
  hoy pierde su enlace vivo y recibe un 500. No lo ve venir y no puede hacer nada.
- **Cualquiera capaz de probar direcciones contra el formulario de recuperación**: con la
  clave envenenada, el par 200/500 le dice qué cuentas existen. **Los dos anteriores son
  víctimas potenciales, no víctimas**: ese despliegue no llega a existir porque el build cae
  antes — ver §La otra mitad de la frase.
- **Quien implemente esto**: hereda un contrato con **dos consumidores** (`metadataBase` en
  build y el enlace de correo en petición) y **dos specs vecinas** cuyos tests no puede tocar
  (§Frontera con SPEC-052, §Fuera de alcance).

## Frontera con SPEC-052

**SPEC-052 cubre la clave AUSENTE; esta spec cubre la clave PRESENTE Y ENVENENADA.** No es
interpretación: su propio §Fuera de alcance manda aquí, literalmente —

> **Cambiar la conducta de `appBaseUrl()`** (que no lance, que caiga a un valor por defecto,
> que lea `VERCEL_URL`). Es diseño arbitrado de SPEC-051 y las tres alternativas están
> rechazadas por escrito en su §Diseño D-4. **Otra spec y otra conversación.**

Esta es esa otra spec, y **no toma ninguna de las tres alternativas**: ver D-1.

### Ficheros ESCRITOS en común: ninguno. Acoplamientos: dos, y ninguno es un fichero escrito

Comprobado contra la rama en vuelo
(`git diff --name-only origin/main...ft/SPEC-052-sin-app-base-url-el-build-ya-no-sale-verde`):

| SPEC-052 toca | SPEC-055 toca |
|---|---|
| `.env.example` | `src/lib/config/app-url.ts` |
| `docs/despliegue.md` | `src/app/layout.tsx` (**sólo comentario**) |
| `tests/entornos-de-despliegue.test.ts` (nuevo) | `tests/app-base-url.test.ts` (nuevo) |

**Intersección de ESCRITURAS: vacía.** Pero eso no basta, y esta spec lo aprendió por las
dos vías. Hay **dos** acoplamientos reales, y ninguno se ve en un `git diff --name-only`:

**Acoplamiento 1 — por contrato. SPEC-052 CA-14 congela el mensaje de la rama que esta spec
NO cambia.** Su test
(`tests/entornos-de-despliegue.test.ts:697-740`, en su rama) exige
`expect(() => appBaseUrl(sinLaClave)).toThrow(/APP_BASE_URL no definida/)` y lo mismo para
`'   '`, y además exige que la firma siga siendo `appBaseUrl(env)`. **Cambiar ese literal, o
esa firma, pone RED a SPEC-052 sin tocar ni uno de sus ficheros.** Por eso CA-1 de esta spec
lo conserva palabra por palabra y lo dice en voz alta.

**Acoplamiento 2 — por lectura. Un test que LEE un fichero de SPEC-052 y asevera sobre su
contenido ata esta rama al estado del árbol de la otra.** Es el que se nos coló: el primer
test de CA-5 leía `.env.example` y exigía que su valor fuera `https`, justo mientras el CA-17
de SPEC-052 lo cambia a `http://localhost:3000`. El daño es **el mismo** que el del
acoplamiento 1 —el primer merge deja roja a la otra spec sin que nadie haya tocado sus
ficheros—, sólo que llega por el canal contrario y no lo enseña ninguna herramienta de diff.
**Leer un fichero ajeno y aseverar sobre él acopla igual que escribirlo:** está en D-7, en la
redacción nueva de CA-5 y, porque no es local a esta spec, en `FOUNDATION.md`.

## Diseño

Siete decisiones. Las dos primeras son las que impiden que esto se convierta en una
reapertura de SPEC-051. La séptima se añadió **después** del gate del verificador y es la que
arregla CA-5.

- **D-1 — Esto extiende D-4 de SPEC-051; no lo contradice.** SPEC-051 §Diseño D-4 dice de
  `appBaseUrl()` que **«ya falla ruidosamente si falta, que es la conducta correcta»**, y
  rechaza por escrito tres alternativas: una variable nueva, un valor por defecto y leer
  `VERCEL_URL`. **Las tres son más laxas: quitan el fallo o lo sustituyen por una
  adivinanza.** Lo de aquí es **más estricto**: que además de lanzar cuando falta, lance
  cuando el valor **no es un origen absoluto `http`/`https` usable**. No se añade clave
  (CA-10), no se crea una segunda fuente de verdad, no hay valor por defecto y no se lee
  `VERCEL_URL`. Es la misma dirección de D-4, un paso más allá.
- **D-2 — La validación vive en `appBaseUrl()`, y en ningún otro sitio.** Es el único
  productor del origen absoluto (ADR-015 pto. 8 puso uno solo a propósito) y tiene los dos
  consumidores colgando. Validar en el layout dejaría el correo sin cubrir; validar en
  `buildResetUrl` dejaría el build sin cubrir y crearía **dos** guardias que pueden
  divergir. Una sola puerta, cerrada antes de que el valor salga de la función. Corolario
  medido: colapsa el caso envenenado dentro del caso ausente y cierra el oráculo de
  enumeración **por construcción**, sin tocar `password-reset.ts` (CA-8).
- **D-3 — Qué es «válido»: un origen absoluto `http`/`https`, y nada más.** Cuatro
  condiciones, en este orden:
  1. **Parsea**: `new URL(valor)` no lanza.
  2. **Protocolo `http:` o `https:`**. Rechaza `ftp:`, `file:`, `javascript:` y compañía,
     que la tabla de §Problema demuestra que hoy llegan hasta el correo.
  3. **Sin ruta, query, fragmento ni credenciales.** La barra final **se sigue tolerando**
     —se recorta como hoy, así que `https://a.com/` sigue siendo válido—; un segmento de
     ruta, no. Motivo medido, no estético: con ruta, `metadataBase` la conserva y el enlace
     de correo la tira.
  4. **`http` y `localhost` siguen valiendo**, sin excepción ni «sólo en desarrollo». CI
     (`.github/workflows/ci.yml:148`) y el e2e (`tests/e2e/server.mjs:69`) usan
     `http://localhost:3200`. **Esto no es una concesión: es un requisito, y CA-5 lo prueba
     leyendo esos dos ficheros en vez de escribir el valor a mano.**
- **D-4 — El mensaje es el arreglo tanto como la guardia.** Este proyecto ya trata «decir el
  motivo» como requisito y no como aseo: **SPEC-016** (el motivo del proveedor deja de
  tragarse) y **SPEC-043** (la cuota agotada deja de disfrazarse de caída) son la misma
  doctrina. Un `Invalid URL` sin sujeto es la versión de entorno de aquel «sin cotización»
  mudo. Por eso el mensaje nombra **la clave, el valor recibido y dónde buscarlo** (CA-6):
  sin las tres, la guardia convierte un build rojo mudo en otro build rojo mudo.
- **D-5 — `[SENSITIVE]` tiene pista propia, pero como añadido, no como rama que decide.**
  El literal es conocido, predecible y sistemático, y **la acción correcta ante él es
  distinta**: no es «corrige la errata», es «esa variable está marcada *Sensitive* en Vercel
  y `vercel env pull` no te la trajo». Ahorrar ese salto es el 90% del valor de esta spec
  para el caso real. Pero se implementa como **pista aditiva sobre el rechazo genérico**, no
  como condición previa: si mañana Vercel escribe `[REDACTED]` o cualquier otra cosa, el
  rechazo de D-3 sigue disparando y sólo se pierde la pista. **Un literal reconocido, cero
  listas cerradas** — que es la lección de `F-SPEC-048-2`: una guardia que congela una lista
  que crece caduca sola.
- **D-6 — La batería de prueba no afirma que un valor es malo: lo demuestra.** Cada fila de
  la tabla de valores rechazados **evalúa en el propio test la expresión que rompía** —
  `new URL(v)` y `new URL('/reset-password/tok', v + '/')`— y comprueba que **antes** el
  valor colaba o estallaba sin diagnóstico, y que **ahora** lo rechaza la guardia con su
  mensaje. Es ADR-026 §7 («una guardia nueva demuestra que caza el defecto») aplicado a una
  guardia que no es de geometría, y es lo que impide que la tabla se convierta en una lista
  congelada de literales que nadie vuelve a comprobar (`F-SPEC-048-2`).
- **D-7 — Leer un fichero ajeno y aseverar sobre su contenido acopla igual que escribirlo.**
  Añadida el **2026-08-24**, después del gate, a raíz de F1: el test de CA-5 leía
  `.env.example` —fichero de SPEC-052— y **exigía que su valor empezara por `https://`**.
  Ninguna línea de SPEC-052 se tocaba, y aun así el primer merge de cualquiera de las dos
  ramas dejaba roja a la otra, con la cara de un cambio legítimo de la vecina. **Es el mismo
  daño al que esta spec dedica una sección entera (§Frontera con SPEC-052) y que CA-1 evita
  por el canal de escritura, cometido por el canal de lectura.** Y contradice lo que
  `FOUNDATION.md` §*Cómo se trabaja aquí* ya fija —*un test de frontera fija una propiedad, no
  un estado del árbol*—: que `.env.example` traiga hoy un ejemplo `https` es un estado del
  árbol, no una propiedad de `appBaseUrl()`.
  El corolario operativo, que es el que decide CA-5: **leer un fichero sólo compra algo cuando
  lo que se lee es un valor VIVO —uno que un proceso real consume— y ese proceso es de esta
  spec o de nadie.**
  - `.github/workflows/ci.yml` y `tests/e2e/server.mjs` lo son: **CI construye** con su valor
    y **el e2e sirve** con el suyo. Si mañana uno cambia a algo que la guardia rechaza, el
    rojo de aquí **precede** al rojo de CI o del e2e. Esa anticipación es lo que se compra, y
    la paga el mismo que la cobra: ninguno de los dos ficheros es de otra spec en vuelo.
  - `.env.example` **no** lo es: no lo lee ningún proceso, es documentación para humanos, y
    encima es territorio de SPEC-052. Leerlo no compra nada y cuesta el acoplamiento entero.
  Si alguien quiere una guardia de que el ejemplo que `.env.example` enseña pasa
  `appBaseUrl()` —y es una propiedad legítima, no la estoy despachando—, **vive con quien es
  dueño del fichero**. Queda pedida a SPEC-052 como tercer punto de `D-SPEC-055-1`.
  **Esta decisión no es local a esta spec**, así que se sube donde el próximo la vea: queda
  escrita como corolario en `FOUNDATION.md` §*Cómo se trabaja aquí*, colgando de la
  convención del 2026-08-20 que generaliza.

## Criterios de aceptación

Todos verificables con test unitario. El fichero nuevo es `tests/app-base-url.test.ts`;
`appBaseUrl()` **no tiene hoy ningún test propio** (comprobado: sólo la referencian
`tests/tarjeta-frontera.test.ts` de forma estática y, en su rama, la de SPEC-052).

### La guardia

- **CA-1 — La rama que hoy funciona no se toca, y su mensaje se conserva palabra por
  palabra.** Dado un `env` **sin** `APP_BASE_URL`, o con `'   '`, cuando se llama a
  `appBaseUrl(env)`, entonces lanza y el mensaje **sigue casando `/APP_BASE_URL no
  definida/`**, y la firma sigue siendo `appBaseUrl(env: NodeJS.ProcessEnv = process.env)`.
  *Test:* los dos casos en el fichero nuevo, con la nota escrita al lado de que el literal
  es **contrato con SPEC-052 CA-14** y no se cambia sin avisar a esa spec.

- **CA-2 — Un valor que no parsea se rechaza con diagnóstico.** Dado
  `APP_BASE_URL` con un valor que `new URL()` no acepta —`[SENSITIVE]`,
  `stockeiro.tremen.dev` (sin esquema), `//evil.com`, `"https://a.com"` (con las comillas
  dentro del valor)—, cuando se llama a `appBaseUrl(env)`, entonces lanza un error que
  cumple CA-6. *Test:* una fila por valor; cada fila comprueba primero que
  `new URL(valor)` lanza `Invalid URL` —el antes, evaluado, no afirmado (D-6)— y después el
  mensaje nuevo.

- **CA-3 — Un valor que parsea pero cuyo protocolo no es `http:`/`https:` se rechaza.**
  Dado `ftp://x.com`, `file:///etc/passwd` o `javascript:alert(1)`, cuando se llama a
  `appBaseUrl(env)`, entonces lanza y el mensaje nombra el protocolo recibido y dice cuáles
  se aceptan. *Test:* una fila por valor; cada fila comprueba primero que **hoy** el valor
  atraviesa la función y llega vivo al enlace de correo —`buildResetUrl(valorDeHoy, 'tok')`
  produce `ftp://x.com/reset-password/tok` y `file:///reset-password/tok`— y después que la
  guardia lo detiene.

- **CA-4 — Un valor con ruta, query, fragmento o credenciales se rechaza; la barra final,
  no.** Dado `https://a.com/es`, `https://a.com?x=1`, `https://a.com#f` o
  `https://u:p@a.com`, entonces lanza. Dado `https://a.com/` (sólo barra final), entonces
  **no** lanza y devuelve `https://a.com`, igual que hoy. Y dado `https://a.com//` —**varias**
  barras finales y nada más— **lo mismo**: «igual que hoy» se lee al pie de la letra, porque
  el recorte de hoy ya era `/\/+$/` y no una sola barra. Tolerarlas es lo conservador y no
  abre nada: el valor sale ya recortado, así que ninguno de los dos consumidores llega a ver
  la barra doble y no hay discrepancia que arbitrar. **Decisión registrada** (§Decisiones,
  fila 4): la tomó el implementador, la ratifico, y se escribe aquí para que deje de ser
  tácita. *Test:* para el caso de la ruta, la
  fila **calcula** la discrepancia entre los dos consumidores —`new URL('https://a.com/es')`
  conserva `/es` y `new URL('/reset-password/tok', 'https://a.com/es/')` lo pierde— y la
  exige distinta antes de exigir el rechazo.

- **CA-5 — Los valores que hoy funcionan de verdad siguen funcionando: los DOS que un
  proceso consume se leen de su fichero, y el tercero se escribe en el test.**
  Dado el valor de `APP_BASE_URL` **extraído de `.github/workflows/ci.yml`** (job que
  construye) y el **extraído de `tests/e2e/server.mjs`**, cuando se pasan a `appBaseUrl()`,
  entonces devuelven el origen sin lanzar. Y dado un origen `https` de producción **escrito
  literalmente en el test** —`https://stockeiro.tremen.dev`, el mismo que el mensaje de CA-6
  ya propone como ejemplo—, entonces igual.
  *Test:* se leen de fichero **exactamente dos** valores, y son esos dos; si mañana CI cambia
  el suyo a algo que la guardia rechaza, el rojo sale aquí y no en un despliegue. El origen
  `https` **no se deriva de ningún fichero**, y **ningún caso de este CA lee `.env.example`**
  ni ningún otro fichero cuyo dueño sea otra spec — el porqué está en **D-7**, y es la
  corrección de esta redacción. **Centinela:** si cualquiera de las dos extracciones devuelve
  vacío, el caso falla en vez de pasar de vacío.
  *Nota de encuadre, para que nadie la añada creyendo que la pedía:* aquí **no** se pide una
  guardia que vigile qué ficheros lee esta batería. Sería exactamente la lista cerrada que
  caduca sola (`F-SPEC-048-2`). La regla vive escrita en D-7 y en `FOUNDATION.md`, que es
  donde el próximo la mira.
  *Historia de este CA, escrita a propósito:* su primera redacción decía «más un origen
  `https` de producción **de la misma forma**» y sólo nombraba dos ficheros. «De la misma
  forma» admitía dos lecturas —«también extraído de un fichero» y «que se comporta igual»— y
  la implementación escogió la primera: leyó `.env.example`, que es de SPEC-052, y **aseveró
  que su valor era `https`**. Eso plantaba un rojo garantizado bajo la spec hermana, que está
  cambiando ese literal a `http://localhost:3000` ahora mismo. Lo cazó el gate (F1 del
  ledger); el defecto era de la letra, no del código.

### El mensaje

- **CA-6 — El mensaje nombra la clave, el valor y dónde buscarlo.** Dado cualquiera de los
  valores rechazados por CA-2, CA-3 o CA-4, entonces el mensaje contiene: (a) el literal
  `APP_BASE_URL`; (b) el **valor recibido**, delimitado para que se vean espacios y comillas;
  (c) la forma esperada, con ejemplo (`http://localhost:3200`,
  `https://stockeiro.tremen.dev`); y (d) **dónde mirar**: que en un build de producción
  `.env.production.local` **manda sobre** `.env`, con los dos nombres escritos. *Test:* los
  cuatro asertos, aplicados a **todas** las filas de las tres tablas, no a una de muestra.
  *Nota de seguridad para el gate:* `APP_BASE_URL` es un origen público, no un secreto —por
  eso el valor se puede echar al log. CA-7 recorta de todos modos.

- **CA-7 — `[SENSITIVE]` lleva su pista, y la pista es aditiva.** Dado el valor exacto
  `[SENSITIVE]`, entonces el mensaje **añade** —conservando todo lo de CA-6— que lo escribe
  `vercel env pull` cuando la variable está marcada *Sensitive* en Vercel, y nombra
  `.env.production.local`. Dado un marcador parecido pero distinto (`[REDACTED]`), entonces
  **se rechaza igual** por CA-2 y **sin** la pista. *Test:* los dos casos; el segundo es el
  que prueba que no hay lista cerrada decidiendo (D-5). El valor se recorta a una longitud
  máxima antes de entrar en el mensaje, y hay un caso con un valor larguísimo que lo prueba.

### La parte de seguridad

- **CA-8 — Con la clave envenenada, el camino de recuperación falla igual para una cuenta
  que existe y para una que no, y no llega a tocar la base de datos.** Dado un `env` con
  `APP_BASE_URL='[SENSITIVE]'`, cuando el camino de recuperación compone su origen —o sea
  `appBaseUrl(env)`, la **única** fuente de `baseUrl` en `src/app/(auth)/actions.ts:128`—,
  entonces lanza **antes** de que `requestPasswordReset` reciba nada: cero consultas, cero
  `update` sobre `passwordResetTokens`, cero `insert`, y el mismo error para las dos
  direcciones. *Test, en dos mitades:*
  1. **El después:** dos llamadas (email que existe / email que no) con un doble de `db` que
     registra **cualquier** acceso → **cero accesos** en ambas y error idéntico.
  2. **El antes, medido en el mismo fichero:** llamando a `requestPasswordReset` directamente
     con `baseUrl: '[SENSITIVE]'` sobre ese mismo doble, el email inexistente **devuelve el
     acuse** y el existente **lanza tras haber ejecutado un `update` y un `insert`**. La
     asimetría se **calcula**, no se afirma; y si alguien afloja la guardia, esta mitad se
     pone roja.
  **`src/lib/auth/password-reset.ts` no se modifica.** El arreglo es que el valor envenenado
  ya no puede llegar hasta él.

- **CA-9 — La única fuente del origen absoluto sigue siendo `appBaseUrl()`.** Dado el árbol
  bajo `src/`, entonces ningún fichero compone por su cuenta el `baseUrl` que va a
  `requestPasswordReset` ni el argumento de `metadataBase`: los dos salen de `appBaseUrl()`.
  *Test:* guardia estática sobre `src/`, con **centinela**: si la guardia encuentra **cero**
  puntos de uso, el caso falla —una guardia que no ve nada no está verde, está vacía.

### Que no vuelva, y que no se lleve nada por delante

- **CA-10 — No se añade ninguna clave de entorno.** Entonces `tests/spec-031-frontera.test.ts`
  (las **once** claves declaradas, con `toHaveLength(11)`) sigue verde **sin tocarse**, igual
  que `tests/tarjeta-frontera.test.ts` (que exige literalmente
  `metadataBase: new URL(appBaseUrl())` y `from '@/lib/config/app-url'`). *Test:* los dos
  ficheros existentes pasan sin una línea modificada; se verifica en el gate con
  `git diff --name-only` de la rama.

- **CA-11 — La guardia demuestra que caza el defecto (ADR-026 §7).** Entonces el fichero de
  test contiene una reimplementación de tres líneas de la `appBaseUrl()` **anterior**
  (`trim` + `if (!raw) throw` + recorte de barras), con su porqué y su fecha al lado, y
  **cada** valor rechazado por CA-2, CA-3 y CA-4 se pasa por ella y se exige que **la
  atraviese** —salvo los que ya estallaban río abajo, que se exigen estallando con
  `Invalid URL` sin diagnóstico. Si mañana alguien afloja la guardia nueva, el contraste se
  pone rojo. *Test:* ese recorrido, más un centinela de que la tabla de valores rechazados
  no está vacía y tiene **al menos un representante de cada una de las tres familias**
  (no parsea / protocolo / forma).

- **CA-12 — La batería crece sin tocar ninguna aserción.** Entonces la tabla de valores se
  recorre con `it.each` o un bucle y **ningún** aserto del fichero fija su longitud ni la
  compara con una lista literal: añadir un valor mañana no obliga a actualizar un número.
  *Test:* un caso que lee su propio fichero fuente y comprueba que la constante de la tabla
  no aparece dentro de un `toHaveLength(` ni de un `toEqual([`. Motivo escrito al lado:
  `F-SPEC-048-2`, la familia de guardias que congelan una lista que crece.

- **CA-13 — El comentario del punto de estallido dice la otra mitad.** Entonces la cabecera
  de `src/lib/config/app-url.ts` y el comentario del bloque `metadata` de
  `src/app/layout.tsx` dejan de decir sólo *«lanza si falta»* y dicen **«lanza si falta o si
  el valor no es un origen absoluto `http`/`https`»**, nombrando el caso `[SENSITIVE]` y su
  procedencia. *Test:* los dos ficheros contienen esas afirmaciones. El cambio en
  `layout.tsx` es **sólo de comentario**: la expresión no se toca y
  `tests/tarjeta-frontera.test.ts:75` sigue verde.

## Entidades y reglas afectadas

### Lo que esta spec aplica sin cambiarlo

- **ADR-015 pto. 8** — *el origen del enlace sale de configuración, NUNCA de la petición*.
  Es la razón de que `APP_BASE_URL` exista. Esta spec no lo reinterpreta: lo **hace
  cumplir**, porque un origen que no es un origen no protege de nada.
- **SPEC-023 CA-1/CA-2/CA-4/CA-12** — el acuse idéntico exista o no la cuenta, y el origen
  fuera de la cabecera `Host`. CA-8 restaura la primera en el escenario envenenado; no
  cambia una línea de `password-reset.ts`.
- **SPEC-051 §Diseño D-4 y riesgo R-2** — el origen absoluto ya está arbitrado y
  `appBaseUrl()` ya lanza en build. **Intactos**; D-1 explica por qué esto los extiende en su
  misma dirección en vez de contradecirlos.
- **SPEC-052 CA-14** — congela el literal `APP_BASE_URL no definida` y la firma de la
  función. **Contrato compartido**, conservado por CA-1.
- **SPEC-016 y SPEC-043** — «decir el motivo» como requisito, no como aseo. Es la doctrina
  que sostiene CA-6 y CA-7 (D-4).
- **ADR-026 §7** — una guardia nueva demuestra que caza el defecto. CA-11.
- **`F-SPEC-048-2`** — guardias que congelan una lista que crece. D-5 y CA-12.
- **`FOUNDATION.md` §Cómo se trabaja aquí** — *un test de frontera fija una propiedad, no un
  estado del árbol*. Por eso CA-5 **deriva** de sus ficheros los dos valores **vivos** (los
  de CI y del e2e) en vez de escribirlos. **Y es lo único de esta lista que esta spec no se
  limita a aplicar: le añade un corolario** —leer un fichero ajeno y aseverar sobre su
  contenido acopla igual que escribirlo—, porque F1 demostró que la convención tal y como
  estaba escrita no cubría el canal de lectura. Ver **D-7**, y el gate de §Notas pto. 7.
- **`.gitignore:12`** (`.env*.local`) — la razón de que aquí no haya nada que limpiar.

### Ficheros que esta spec modifica

| Fichero | Qué cambia | CA |
|---|---|---|
| `src/lib/config/app-url.ts` | La validación del valor en `appBaseUrl()` y su mensaje; cabecera | CA-1..CA-8, CA-13 |
| `src/app/layout.tsx` | **Sólo el comentario** del bloque `metadata`; ni una línea de expresión | CA-13 |
| `tests/app-base-url.test.ts` (**nuevo**) | Toda la batería, sus centinelas y el contraste con la versión anterior | CA-1..CA-12 |
| `package.json` + `package-lock.json` | La **subida de versión** (0.4.0 → 0.4.1) que el gate `Version bump` exige por tocar `src/`; los dos en el **mismo commit**, que es lo que manda ADR-033 | — (gate, no CA) |
| `FOUNDATION.md` | Un corolario en §*Cómo se trabaja aquí*: leer un fichero ajeno y aseverar sobre su contenido acopla igual que escribirlo | D-7 |
| La propia spec y su `.ledger.md` | — | — |

**Esta tabla estaba incompleta y se corrige aquí (O2 del verificador).** `package.json` y
`package-lock.json` faltaban aunque el párrafo siguiente ya los anunciaba: la tabla se
escribió antes que su propia frase. `FOUNDATION.md` entra ahora, con D-7. **Ocho ficheros en
total**, y ése es el conjunto cerrado que el gate debe ver en `git diff --name-only`.

Nada bajo `drizzle/`, `.github/workflows/`, `docs/despliegue.md`, `.env.example` ni
`tests/entornos-de-despliegue.test.ts`. `src/lib/auth/password-reset.ts` **no se toca**
(CA-8). Esta entrega **sí** toca `src/`, así que el gate `Version bump` **sí** exigirá subida
de versión — al contrario que SPEC-052.

## Fuera de alcance

Aparcado a propósito, con su motivo:

- **`.env.example` y `docs/despliegue.md`. Territorio de SPEC-052, que los está
  reescribiendo ahora mismo.** No se tocan aquí, ni siquiera para añadir una línea. Lo que
  esta spec necesita de ellos queda como **dependencia**, no como cambio: ver §Notas pto. 4.
- **`tests/ci-workflow.test.ts` caso 5.1 y `tests/entornos-de-despliegue.test.ts`.** SPEC-052
  se apoya en el primero explícitamente y es dueña del segundo. CA-5 **lee** `ci.yml`; no
  modifica ni el workflow ni su guardia.
- **Cambiar la conducta cuando la clave falta** (no lanzar, valor por defecto, `VERCEL_URL`,
  clave nueva). Rechazado por escrito en SPEC-051 §Diseño D-4 y confirmado por SPEC-052
  CA-14. D-1 explica que esta spec va en la dirección contraria a esas tres.
- **Soportar un despliegue en sub-ruta** (`https://host/app`). CA-4 **rechaza** el valor en
  vez de hacer que los dos consumidores se pongan de acuerdo. Arreglar `buildResetUrl` para
  que respete un prefijo de ruta es otro trabajo, con su propio riesgo sobre enlaces ya
  enviados. Queda como **`F-SPEC-055-1`**, y hoy no hay ningún despliegue que lo pida.
- **Validar el resto de claves de entorno con el mismo patrón** (`RESEND_FROM` como
  dirección, `DATABASE_URL` como URL, `AUTH_SECRET` como longitud mínima…). Es la
  generalización obvia y **no cabe en una spec de FIX**: cada clave tiene su forma y su
  consumidor. Queda como **`F-SPEC-055-2`**, destino EPIC-INFRA.
- **Evitar que `vercel env pull` escriba el marcador**, o desmarcar la variable como
  *Sensitive* en Vercel. Es una decisión de ops sobre la consola de Vercel, no código de este
  repositorio, y una guardia que dependa de ella sería una guardia que no podemos ejecutar.
- **Tocar `.env.production.local`.** Es local de cada máquina, está ignorado y lo reescribe
  la CLI en la siguiente pasada. Arreglarlo a mano es el apaño que esta spec viene a
  sustituir.
- **Un `next build` dentro de la suite** para probar el rojo de build de punta a punta.
  Inviable por tiempo, y un unitario que «afirme» el fallo sin construir sería el verde
  vacío que ADR-031 prohíbe. Se verifica **en el gate**, una vez, con la salida pegada en el
  ledger — mismo tratamiento que SPEC-052 CA-16.

## Decisiones registradas

Cuatro decisiones que **se tomaron de verdad** —tres en el gate humano del **2026-08-24** y
una durante la implementación— y que hasta ahora sólo vivían en el código o en una
conversación. Se escriben aquí, con su autor, porque una decisión que sólo existe en el diff
se vuelve a discutir dentro de seis meses. Las señaló el verificador, con razón.

| # | Decisión | Quién | Dónde vive |
|---|---|---|---|
| 1 | **`javascript:` y `file:` NO llevan mensaje propio**: basta el rechazo genérico de CA-3, que ya nombra el protocolo recibido. A diferencia de `[SENSITIVE]`, no son valores que escriba solo ningún proceso: llegan por error humano, y en cuanto se lee el protocolo la corrección es evidente. Cierra la 1.ª pregunta de §Notas pto. 6 | **humano (Alberto Fojo)** | CA-3, sin cambio |
| 2 | **Sin ADR.** La restricción de no admitir ruta (D-3 pto. 3) queda como fuera de alcance con nombre, **`F-SPEC-055-1`**, y no como ADR inmutable: es una restricción sobre el valor de una clave de configuración, reversible por otra spec, no una frontera de datos ni de integración. Cierra §Notas pto. 5 | **humano (Alberto Fojo)** | §Fuera de alcance, `F-SPEC-055-1` |
| 3 | **El valor se recorta a 120 caracteres** en el mensaje, no a 60. CA-7 exigía el recorte sin fijar el número. `APP_BASE_URL` **no es un secreto** —lo dice la nota de seguridad de CA-6—, así que el recorte es **legibilidad, no confidencialidad**, y 120 deja ver entera una URL larga de verdad. Cierra la 2.ª pregunta de §Notas pto. 6 | **sdd-orquestador** | `src/lib/config/app-url.ts:41` (`MAX_VALOR_EN_MENSAJE`), CA-7 |
| 4 | **Se aceptan varias barras finales** (`https://a.com//`), no sólo una | **sdd-implementador**, ratificada por sdd-arquitecto | CA-4 |

Sobre la 4, que es la única que no venía del gate y por eso la razono: **me parece bien y la
ratifico.** Tres motivos, en orden de peso. (a) **Es lo que CA-4 ya decía**: «se recorta como
hoy», y el recorte de hoy es `/\/+$/`, no una sola barra — rechazarlas habría sido *más*
estricto que la letra aprobada, y en la dirección contraria a la que se aprobó. (b) **Es lo
conservador**: no deja pasar ningún valor que antes no pasara, y `//` al final no es un
segmento de ruta, que es lo único que D-3 pto. 3 rechaza y por el motivo **medido** de que
los dos consumidores discrepan. (c) **El valor sale ya recortado de la función**, así que
ningún consumidor llega a ver la barra doble y no hay discrepancia que arbitrar. Si algún día
hubiera que rechazarlas sería por higiene y no por conducta, y eso no vale un cambio de
contrato con SPEC-052 encima de la mesa.

## Notas para el gate humano

Lo que necesitas para decidir, y lo que decides tú.

**1. Encaje en EPIC-FIX.** Es un defecto de una capacidad ya entregada y verificada
—SPEC-023 (recuperación) y SPEC-051 (`metadataBase`)— que deja de cumplir su promesa con un
entorno real. Mismo precedente que SPEC-033, SPEC-048, SPEC-049 y SPEC-052.

**2. Las cuatro decisiones que me pediste, con su veredicto.**

| # | Pregunta | Decisión | Dónde |
|---|---|---|---|
| 1 | ¿Qué es «válido»? | Origen absoluto **`http`/`https`**, **sin ruta/query/fragmento/credenciales**; barra final tolerada; `http` y `localhost` **siguen valiendo por requisito**, con los valores leídos de CI y del e2e | D-3, CA-2..CA-5 |
| 2 | ¿Dónde vive y qué dice el mensaje? | En **`appBaseUrl()` y sólo ahí**; el mensaje nombra **clave, valor y fichero probable**, con la precedencia `.env.production.local` > `.env` escrita | D-2, D-4, CA-6 |
| 3 | ¿`[SENSITIVE]` con mensaje propio? | **Sí, pero como pista aditiva** sobre el rechazo genérico, nunca como la rama que decide | D-5, CA-7 |
| 4 | ¿El otro llamante? | **Sí, y es el hallazgo de la spec**: hoy hay un **oráculo de enumeración** en recuperación de contraseña. Se cierra sin tocar `password-reset.ts` | §Problema, CA-8 |

**3. Lo que encontré verificando el camino de recuperación, que no estaba en el encargo.**
Con la clave envenenada, un email que **no existe** recibe el acuse normal (200) y uno que
**sí existe** provoca un 500 — porque el estallido cae **después** de las dos salidas
tempranas de `password-reset.ts` (`:80` y `:95`). Eso reabre por la puerta de atrás el
oráculo que SPEC-023 CA-1/CA-12 cerró por diseño. Y de propina, el usuario legítimo
**pierde su enlace vivo**: `invalidateLiveTokens` (`:98`) corre antes del estallido. Con la
clave **ausente** no pasa, porque ahí `appBaseUrl()` lanza antes de entrar. **Es el
envenenamiento, y sólo él, el que mueve el fallo al lado malo de la comparación.** Si te
parece que esto solo ya justifica la spec por delante del build rojo, coincido.

**Matiz añadido después del gate del verificador (O3), y va con esta nota:** el oráculo era
**latente**. `metadataBase` se evalúa en build, así que un despliegue de producción con la
clave envenenada no llega a existir, y la medida contra producción del 2026-08-24
(`curl https://stockeiro.tremen.dev/login` → `og:url` = `https://stockeiro.tremen.dev`)
confirma que la clave viva **es válida**. Sigue justificando la spec; lo que no hay es
incidente que investigar. Todo el detalle, en §La otra mitad de la frase.

**4. La dependencia que dejo, y a quién.** Mi mensaje de error remite al desarrollador a
`.env.production.local` y a la precedencia sobre `.env`. **Eso debería estar también en el
runbook y en `.env.example`, y esos dos ficheros son de SPEC-052.** No los toco. Lo que pido
a quien gobierne SPEC-052, como **D-SPEC-055-1**, son dos líneas:
- en `docs/despliegue.md` §0: que `vercel env pull` deja `[SENSITIVE]` en las variables
  marcadas como tales en Vercel, y que en un build de producción `.env.production.local`
  **manda sobre** `.env`;
- en el comentario de `APP_BASE_URL` de `.env.example`: la forma aceptada — origen `http`/
  `https`, **sin ruta ni barra final** (que es, casi con las mismas palabras, lo que ya dice
  hoy: *«Sin dominio ni barra final»*).

Si SPEC-052 ya ha mergeado cuando esto se implemente, las dos líneas se pueden colgar de
esta spec en vez de dejarlas como dependencia. **Decisión tuya en el gate**; ninguna de las
dos hace falta para que los trece CA pasen.

**5. Sobre el ADR: no he escrito ninguno, y este es el argumento.** D-1 sostiene que esto
**extiende** SPEC-051 D-4 en su misma dirección —más estricto, no más laxo— y por tanto no
hay decisión nueva que arbitrar: no hay clave nueva (CA-10), ni fuente de verdad nueva
(D-2), ni dependencia, ni migración. **Lo único que huele a ADR es D-3 punto 3**, rechazar
una ruta: eso sí constriñe trabajo futuro —cierra la puerta a un despliegue en sub-ruta—.
Lo he dejado **fuera de alcance con nombre (`F-SPEC-055-1`)** en vez de en un ADR, porque es
una restricción sobre el valor de una clave de configuración, reversible por otra spec, y no
una frontera de datos ni de integración.
**RESUELTO en el gate del 2026-08-24: sin ADR, `F-SPEC-055-1` se queda como está** — decisión
del humano, registrada en §Decisiones fila 2.

**6. Dos preguntas que estaban abiertas, y ya no lo están.** Las dos se decidieron en el gate
del 2026-08-24 y viven ahora en §Decisiones (filas 1 y 3), no aquí:
- **¿`javascript:` y `file:` merecen mensaje propio?** **No**: basta el genérico, que ya
  nombra el protocolo recibido. *(Decisión del humano.)*
- **¿60 o 120 caracteres de recorte?** **120**, y el motivo es legibilidad, no
  confidencialidad: `APP_BASE_URL` no es un secreto. *(Decisión de sdd-orquestador.)*

**7. Lo que cambió en esta spec DESPUÉS del RED del verificador (2026-08-24), y por qué
deberías mirarlo tú.** No se tocó ni una línea de código ni de test: el verificador no
encontró ningún defecto en la implementación. Lo que estaba mal era **la letra**:
- **CA-5, reescrito.** Su «de la misma forma» admitía dos lecturas y la implementación cogió
  la que ataba esta rama a `.env.example`, que es de SPEC-052. Ahora dice de qué fuente sale
  cada valor: **dos leídos, uno escrito**. La lección general, en **D-7**.
- **`FOUNDATION.md`**, un corolario nuevo. Es lo único de este lote que sale del territorio de
  esta spec, y por eso es lo primero que te pido que mires: **es una convención de proyecto,
  no una decisión de SPEC-055**. Si prefieres que espere a su propio gate, se saca de la rama
  y queda como follow-up.
- **La tabla de ficheros** (O2) y **la latencia del oráculo** (O3), corregidas donde tocaba.
- **Cuatro decisiones tácitas**, ahora escritas con su autor en §Decisiones. Tres son tuyas
  del gate anterior; confirma que las recogí como las dijiste.
