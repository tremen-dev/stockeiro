---
id: SPEC-014
tipo: spec
epica: EPIC-002
estado: en-revision
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-14, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-07-14, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-07-15, por: sdd-implementador}
---
# SPEC-014 — UI del import desde broker

## Problema
El import desde bróker existe como **tres capas de servicio** ya hechas (SPEC-011
lee, SPEC-012 resuelve identidad, SPEC-013 registra idempotente), pero **no hay
pantalla**: hoy un usuario no puede sembrar su cartera sin llamar a funciones. Esta
spec entrega la **UI del flujo completo** —subir extracto → resolver identidad →
previsualizar → confirmar— orquestando las tres capas tras **server actions** con
sesión, con el design system `design/tremen-ds` y a nivel profesional (la app se
comparte con testers). Reutiliza el buscador `symbol-search.tsx` (SPEC-008) para
elegir candidato. NO cambia la lógica de dominio: solo la presenta y la encadena.

## Usuarios / roles afectados
- **Usuario final**: sube el `.xls` de su bróker, revisa/resuelve los valores
  (elige el símbolo en los ambiguos, fusiona nombres del mismo emisor), ve la
  previsualización y confirma; luego ve su cartera al día. Todo bajo su sesión.
- **Sistema**: server actions que orquestan lectura+resolución+registro; el fichero
  se procesa en servidor, nunca se persiste el binario.

## Criterios de aceptación
Cada CA es verificable con **Playwright** en los viewports del proyecto. La búsqueda
usa el catálogo fake (`E2E_FAKE_SYMBOL_SEARCH=1`, patrón SPEC-008) y la subida un
**fixture `.xls` sintético anonimizado** (sin datos personales; ver notas del gate).

- **CA-1 (Entrada al import).**
  Dado un usuario autenticado en `/cartera`,
  cuando pulsa la acción "Importar extracto",
  entonces llega a **`/cartera/importar`** —un **asistente de 3 pasos** (Subir →
  Resolver → Previsualizar/Confirmar)— con la nav compartida (`AppNav`) y la
  estructura del design system (`.page`, coherente con /cartera).
- **CA-2 (Subida y lectura del extracto).**
  Dado un `.xls` de ING válido,
  cuando el usuario lo sube,
  entonces la app lo lee (SPEC-011) y muestra un resumen de lo detectado (nº de
  operaciones y de valores distintos), sin persistir nada todavía.
- **CA-3 (Fichero inválido → error legible).**
  Dado un fichero que no es un extracto de ING (o corrupto),
  cuando lo sube,
  entonces se muestra un **mensaje de error claro** (de `ExtractoIllegibleError`) y
  el flujo no avanza; la página no se rompe.
- **CA-4 (Resolución asistida de un valor).**
  Dado un valor **ambiguo o sin coincidencia**,
  cuando el usuario abre su resolución y **elige un símbolo** con el buscador
  (`symbol-search`),
  entonces ese valor queda **resuelto** a `(ticker, micCode, currency)` del candidato
  (SPEC-012) y se refleja en la UI.
- **CA-5 (Fusión manual de eventos corporativos).**
  Dados dos nombres que el usuario reconoce como el mismo emisor (p. ej. la variante
  antigua y la nueva),
  cuando los **fusiona** sobre el mismo símbolo,
  entonces ambos quedan resueltos al mismo símbolo y la UI **avisa** de un posible
  split a reconciliar a mano (SPEC-012/RN-07).
- **CA-6 (Pendientes visibles, no bloquean).**
  Dado un valor que sigue sin resolver,
  cuando se muestra la resolución,
  entonces aparece marcado como **pendiente** y no impide continuar con el resto.
- **CA-7 (Previsualización antes de confirmar).**
  Dado el estado resuelto,
  cuando el usuario pasa a previsualizar,
  entonces ve **a crear / a saltar (duplicados) / pendientes / avisos** (SPEC-013) y
  **nada se ha escrito** aún en la cartera.
- **CA-8 (Confirmar escribe y se refleja en la cartera).**
  Dada la previsualización,
  cuando el usuario **confirma**,
  entonces las transacciones se crean y, al volver a `/cartera`, las posiciones y el
  P/L reflejan lo importado (SPEC-002/SPEC-013).
- **CA-9 (Idempotencia visible en re-import).**
  Dado un extracto ya importado,
  cuando el usuario lo vuelve a subir y previsualizar,
  entonces la UI muestra **0 a crear / N a saltar** y confirmar **no duplica** la
  cartera (ADR-010).
- **CA-10 (Aviso de sobreventa en la UI).**
  Dado un extracto con una venta que excede la cantidad disponible (falta la compra
  previa),
  cuando se previsualiza,
  entonces la UI muestra el **aviso** y esa venta **no** se crea al confirmar (RN-08).
- **CA-11 (Acceso protegido, RN-03).**
  Dado un usuario **sin sesión**,
  cuando intenta entrar a la pantalla de import,
  entonces se le **redirige a login**; ninguna acción del import corre sin sesión
  (RN-01/RN-03).
- **CA-12 (Coherencia visual y responsive).**
  Dada la pantalla de import,
  cuando se ve en los viewports del proyecto (desktop y móvil),
  entonces usa el design system `tremen-ds` (tokens, componentes, `responsive.css`)
  de forma coherente con `/cartera` y `/vigiladas`, sin desbordes ni layout roto.

## Entidades y reglas afectadas
- **Sin entidad de dominio nueva**: reutiliza `transactions` (+ `import_key`,
  `importe_eur`) y `symbol_aliases` de SPEC-012/013.
- **Server actions de orquestación** (nuevas, capa de app): reciben el fichero
  subido y encadenan `BrokerStatementReader` (SPEC-011) → `runResolucion`/
  `confirmarSeleccion`/`fusionarValor` (SPEC-012) → `previsualizarImport`/
  `confirmarImport` (SPEC-013). Cada una resuelve la sesión (`auth()`), como
  `symbol-search-action.ts`. El binario se procesa en memoria, no se persiste.
- **Componentes de UI** (nuevos, en `src/app/cartera/importar/` o equivalente):
  página + cliente del flujo; **reutiliza** `src/app/_components/symbol-search.tsx`
  para elegir candidato. Estilo con `design/tremen-ds` y `AppNav`.
- Reglas: **RN-01/RN-03** (sesión y aislamiento en cada acción), **RN-08** (aviso de
  sobreventa), **RN-07** (aviso de split en fusión). Decisiones: **ADR-009/010/011**.
  Términos: `docs/fundacion/dominio.md` (cartera, posición, transacción, símbolo).

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Cambiar la lógica** de leer/resolver/registrar (SPEC-011/012/013): esta spec solo
  presenta y orquesta.
- **Otros brókers/formatos** en la UI: v1 sube el `.xls` de ING (el reader ya lo acota).
- **Editar/deshacer** un import ya confirmado desde la UI (el ledger es inmutable;
  correcciones = alta manual).
- **Registrar el `split`** desde el aviso de fusión: se avisa; el alta del split es el
  flujo manual existente de la cartera.
- **Gestión avanzada de pendientes** (reintentos masivos, cola): v1 los lista.

## Notas para el gate humano
Decisiones **resueltas en el gate (2026-07-15)**:
1. **Ruta**: **`/cartera/importar`** (sub-ruta de cartera; entrada desde un botón en
   /cartera). — decidido por el humano.
2. **Flujo**: **asistente de 3 pasos** (Subir → Resolver → Previsualizar/Confirmar),
   con **estado en el cliente** (las operaciones parseadas y las selecciones viajan a
   cada server action; el binario no se re-sube). — decidido por el humano; estado
   cliente-side por recomendación del arquitecto (el `symbol_alias` recordado ya
   persiste las resoluciones para el re-import).

Pendiente de tu confirmación al aprobar:
3. **Verificación (Playwright).** Requiere (a) un **fixture `.xls` sintético
   anonimizado** para la subida —el fichero real está gitignored por privacidad—, y
   (b) `E2E_FAKE_SYMBOL_SEARCH=1` para una resolución determinista. El implementador
   creará el fixture (patrón `buildIngXls` de SPEC-011) y, si hace falta, un flag para
   inyectar el reader/registro en E2E.
4. **Nivel de acabado.** UI **profesional/vendible** (se comparte con testers): estados
   de carga, errores legibles, vacíos y responsive. ¿Algún matiz de marca/UX a fijar?
