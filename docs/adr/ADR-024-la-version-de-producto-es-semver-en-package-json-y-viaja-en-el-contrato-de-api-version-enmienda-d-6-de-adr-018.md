---
id: ADR-024
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-arquitecto}
---
# ADR-024: La versión de producto es semver en `package.json` y viaja en el contrato de `/api/version` (enmienda D-6 de ADR-018)

- Deciders: propone **sdd-arquitecto** (2026-08-19) por **veredicto del humano** (Alberto
  Fojo, gate de EPIC-004 del 2026-08-19). Yo había propuesto en **SPEC-038** que *"el commit
  ES la versión"* y advertí que un número de producto solo sería honesto si `/api/version` lo
  sirviera también. El humano eligió el número de producto **asumiendo ese coste**, con un
  argumento de uso que acepto: *un tester que reporta un fallo en un hilo de foro cita una
  versión, no un SHA*. Pendiente de aprobación por el humano en el gate de **SPEC-038**.
- Specs relacionadas: la origina **SPEC-038** (La versión visible dentro de la app). Consume
  y amplía **SPEC-031** (`/api/version`, `resolveIdentity`, canal de build). Afecta a
  **SPEC-028** (puerta post-despliegue) solo por no romperla. Enmienda el **punto D-6 de
  ADR-018**; **no lo supersede** ni toca ningún otro punto de aquel ADR.

## Contexto

**Qué dice hoy D-6 de ADR-018 y qué entregó SPEC-031.** `/api/version` responde
**exactamente** `{commit, environment, builtAt}` (`src/app/api/version/route.ts`), resuelto
una sola vez al cargar el módulo por `deploymentIdentity` (`src/lib/version/identity.ts`) a
partir de tres literales que `next.config.mjs` congela en tiempo de build vía
`buildIdentity` (`src/lib/version/build-identity.mjs`). D-6 declaró *"mecanismo libre,
propiedades obligatorias"* y dos garantías que son la razón de ser del endpoint:

- **responde con la base de datos caída** —`tests/version-import-graph.test.ts` vigila que la
  ruta no alcance `src/db/`—, que es lo que hace cumplible **RI-02** (*"hecho significa
  vivo"*); y
- **no expone ningún dato personal**, por construcción: tres constantes de build.

Y `tests/spec-031-frontera.test.ts` congela el perímetro: la lista cerrada de steps de CI, el
literal de `vercel.json` y el juego de claves de `.env.example`, más la exigencia de que las
variables `STOCKEIRO_*` **no se configuren en ningún sitio, se calculen**.

**Qué pide CE-3 de EPIC-004.** *"Cualquiera lee dentro de la app la versión que está usando,
y ese dato **coincide** con lo que responde `/api/version`"*.

**Dónde está la tensión.** El sha de un commit es la identidad **correcta** del artefacto y
la que necesita la puerta de despliegue, pero es **inservible como vocabulario humano**:
nadie escribe *"me falla en `a1b2c3d`"* en un hilo de bolsa, y quien lo escriba se
equivocará al copiarlo. Un semver sí es citable. Pero un semver que viva **solo** en la
interfaz sería una **segunda fuente de verdad**: dos números, dos sitios, y la posibilidad
de que digan cosas distintas — exactamente lo que CE-3 prohíbe. La única forma honesta de
tener un número de producto es que **el endpoint también lo sirva**, y eso cambia el
contrato que fijó D-6.

**Y hay una tercera restricción, más callada: la ceremonia se olvida.** Un número que hay
que acordarse de subir a mano acaba congelado en `0.1.0` durante seis meses, y entonces
miente más que no tenerlo — porque afirma una identidad estable sobre artefactos distintos.
Si el número entra, tiene que entrar con algo que obligue a moverlo.

## Decisión

1. **`/api/version` gana una cuarta propiedad obligatoria: `version`.** El contrato pasa a
   ser **exactamente** `{version, commit, environment, builtAt}`, ni una clave más. `version`
   es la versión de producto en formato **semver** (`MAJOR.MINOR.PATCH`).

2. **Esto ENMIENDA el punto D-6 de ADR-018; no lo supersede.** ADR-018 está **aprobada** y es
   inmutable: no se reescribe. Lo que cambia es **una** de sus cláusulas —el juego de
   propiedades obligatorias del endpoint, que pasa de tres a cuatro—. **Todo lo demás de D-6
   sigue vigente y explícitamente reafirmado aquí**:
   - `/api/version` **debe seguir respondiendo con la base de datos caída**;
   - **no expone ningún dato personal**;
   - los valores se **congelan en tiempo de build** y no pueden cambiar sin reconstruir;
   - existe un **valor distinguible** para lo que no se sabe (`unknown`), y el mecanismo
     concreto sigue siendo libre.
   Quien lea D-6 a partir de hoy debe leerlo **junto a este ADR**. Ningún otro punto de
   ADR-018 (D-1 a D-5, D-7 y la puerta post-despliegue) queda tocado.

3. **La fuente de verdad del número es el campo `version` de `package.json`.** Es el sitio
   convencional, ya existe (hoy `0.1.0`), lo entiende `npm version`, y no hay que
   aprovisionar nada. **No** se crea una constante paralela en `src/`, ni un fichero
   `VERSION`, ni se derivan etiquetas de git.

4. **Se lee en tiempo de BUILD, no en runtime.** `next.config.mjs` —**único** sitio del
   repositorio autorizado a leer fuentes externas para esto, como ya ocurre con el sha de
   Vercel (SPEC-031)— lee `package.json` y se lo pasa a `buildIdentity`, que devuelve una
   cuarta clave `STOCKEIRO_VERSION`. Next la sustituye por un literal en el bundle. Leer
   `package.json` en runtime sería **E/S de disco dentro de una función serverless**, y eso
   rompería el pto. 2: el endpoint tiene que poder responder cuando todo lo demás falla.

5. **Se valida por contenido, no por presencia** — la regla que SPEC-031 ya aplica al sha y a
   la fecha. `resolveIdentity` acepta el valor solo si tiene forma de semver; en cualquier
   otro caso devuelve la sentinela **`unknown`**. Un `version: ""` que se colara diría que
   este despliegue sabe qué versión es cuando no lo sabe.

6. **Una sola fuente, dos consumidores.** `deploymentIdentity` alimenta **a la vez** el
   endpoint y el pie de la interfaz (**SPEC-038**). La coincidencia que exige CE-3 es una
   propiedad **por construcción**: no hay dos lectores que puedan desincronizarse, hay uno.

7. **La flecha de dependencia va en un solo sentido**: la presentación importa la identidad;
   la identidad **no** importa a la presentación. Es lo que mantiene el grafo de imports de
   `/api/version` tan pequeño como lo dejó SPEC-031, y `tests/version-import-graph.test.ts`
   se **amplía** para vigilarlo, nunca se relaja.

8. **Quién sube el número: una persona, deliberadamente, en la PR que lo merece.** No se
   automatiza el **qué** —elegir `MAJOR`, `MINOR` o `PATCH` es un juicio de producto, y
   generarlo solo produce números sin significado—. Guía, no regla:
   - **PATCH**: corrección de un defecto, sin capacidad nueva.
   - **MINOR**: una spec entregada que añade capacidad visible.
   - **MAJOR**: se reserva para `1.0.0`, el día que Stockeiro deje de ser una prueba.
   Se sube con `npm version <segmento> --no-git-tag-version`, que edita `package.json` y nada
   más: **no se crean etiquetas de git**, porque la identidad del despliegue sigue siendo el
   commit (ADR-018) y una etiqueta sería un tercer sitio donde vive la verdad.

9. **Que se suba SÍ se automatiza: lo exige la CI.** Un gate nuevo compara la versión de la
   rama con la de `origin/main` y **falla la PR** si el diff toca código de aplicación y la
   versión **no ha aumentado**. Es el mismo patrón que este proyecto ya usa para las
   migraciones destructivas (`scripts/scan-destructive-sql.mjs`, SPEC-032) y para el runbook:
   **una regla que el repositorio se aplica a sí mismo**, en vez de una costumbre que se
   olvida. Las rutas que disparan el gate son las de aplicación —`src/` y las que la
   configuración del proyecto ya declara vigiladas—: una PR **solo de documentación no
   requiere subir nada**, que es lo que hace el gate soportable.

10. **La comparación es semver, no textual.** El gate exige **estrictamente mayor** que
    `origin/main`, de modo que también caza el caso de bajarla por error en un rebase.

11. **La puerta post-despliegue no cambia.** `scripts/check-alive.mjs` sigue comprobando
    `commit` contra el sha del merge (**RI-02**, **SPEC-028**): la identidad del artefacto
    para efectos de *"hecho significa vivo"* **sigue siendo el commit**, no el semver. Dos
    despliegues pueden compartir semver; nunca comparten commit. El semver es vocabulario
    humano, no identidad técnica — y confundirlos rompería RI-02.

## Consecuencias

### Positivas

- **CE-3 se cumple sin segunda verdad**: el pie y el endpoint leen el mismo módulo.
- **El feedback de un foro pasa a ser accionable**: *"v0.3.0"* se copia bien y se dice en voz
  alta; un sha de siete caracteres, no.
- **El número no se puede quedar quieto** (pto. 9). La ceremonia olvidable se convierte en un
  gate rojo.
- **Las dos garantías que importaban de D-6 sobreviven intactas** y quedan reafirmadas por
  escrito (pto. 2), en vez de darse por supuestas.
- **Cero configuración nueva**: `STOCKEIRO_VERSION` se **calcula**, como sus tres hermanas, y
  no entra en `.env.example` ni en los entornos de Vercel.

### Negativas / follow-ups

- **ADR-018 D-6 deja de leerse solo.** Es el coste inevitable de enmendar un ADR aprobado en
  vez de reescribirlo. Se mitiga citando este ADR desde SPEC-038 y desde el propio endpoint.
- **Hay que tocar tests entregados.** `tests/spec-031-frontera.test.ts` congela la lista de
  steps de CI, y el gate del pto. 9 añade uno; congela también el juego de claves y la lista
  de variables calculadas, que pasa de tres a cuatro. Su propio comentario dice que *"cada
  entrada nueva tiene que venir con un CA que la pida"*: **SPEC-038 la trae**. Cambiar esos
  literales es la **única** modificación admisible de expectativas existentes, y va
  justificada por este ADR.
- **Un gate más en cada PR de código.** Fricción real, aceptada a cambio de que el número
  signifique algo. Su falso positivo típico —una PR de código que de verdad no merece bump—
  se resuelve subiendo el PATCH, que cuesta un comando.
- **Dos despliegues pueden compartir semver** (pto. 11). Es correcto y es la razón de que
  `check-alive` siga mirando el commit; pero significa que el semver **no** identifica un
  artefacto, solo una versión de producto. Que ambos viajen juntos en el endpoint y en el pie
  es lo que evita el malentendido.
- **F-ADR-024-1 (residual asumido).** Nada impide que alguien suba el segmento equivocado
  (un `MAJOR` donde tocaba `PATCH`). El gate comprueba que **suba**, no que suba bien. Juzgar
  eso es del gate humano, no de un script.

## Alternativas consideradas

- **Que el commit sea la única versión** (mi propuesta original en SPEC-038). **Rechazada por
  el humano** con un argumento de uso que acepto: quien reporta un fallo en un foro cita una
  versión, no un sha, y un sha mal copiado convierte el reporte en ruido. Lo que yo defendía
  —una sola fuente de verdad— **no se pierde** con este ADR: se conserva metiendo el semver
  *dentro* del contrato en vez de dejarlo suelto en la interfaz.

- **Semver solo en la interfaz, sin tocar `/api/version`.** **Rechazada**: es exactamente la
  segunda fuente de verdad que CE-3 prohíbe, y el pie acabaría diciendo `v0.3.0` sobre un
  artefacto que el endpoint identifica de otra forma, sin nada que los ate. Era el camino que
  no requería enmendar ADR-018, y por eso mismo era el tentador.

- **Derivar la versión de una etiqueta de git** (`git describe`). **Rechazada**: Vercel
  construye **sin `.git`** (verificado en ADR-018 el 2026-08-17 — por eso el sha llega vacío
  en producción), así que la etiqueta no estaría disponible justo donde hace falta. Además
  añade un tercer lugar donde vive la verdad.

- **Leer `package.json` en runtime dentro del endpoint.** **Rechazada** (pto. 4): E/S de
  disco en la ruta que debe responder cuando todo lo demás falla, y un valor que dejaría de
  estar congelado con el artefacto. Rompe las dos garantías que D-6 sí conserva.

- **Generar el número automáticamente** (fecha, contador de commits, `0.1.<nº de commits>`).
  **Rechazada**: produce un número que **sube solo** y por tanto no significa nada — no
  distingue un arreglo de tipografía de una capacidad nueva. Si el número no comunica, es un
  sha más largo y peor.

- **Bump automático en CI** (que la propia CI incremente el PATCH al mergear).
  **Rechazada**: quita el juicio de producto del pto. 8, y además escribe en la rama por la
  espalda, lo que choca con el despliegue continuo desde `main` de ADR-018. Se prefiere
  **exigir** el bump (pto. 9) a **hacerlo**.

- **Superseder ADR-018 entero con un ADR nuevo.** **Rechazada**: ADR-018 decide el despliegue
  continuo, la verificación en PR, el deploy al mergear y la comprobación de vida. Aquí solo
  cambia el juego de propiedades de un endpoint. Superseder el ADR completo para enmendar una
  cláusula haría ilegible la historia de las decisiones — que es justo lo que la regla de
  inmutabilidad quiere evitar.
