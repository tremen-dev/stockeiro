---
id: SPEC-007
tipo: spec
epica: EPIC-001
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-07-14, por: sdd-arquitecto}
---
# SPEC-007 — UI de avisos y estado de zona

## Problema
El backend ya detecta zonas (SPEC-005) y avisa por email (SPEC-006), pero **dentro de la
app el usuario sigue a ciegas**: `/vigiladas` muestra los rangos pero no si el precio actual
está DENTRO de ellos, y no hay ninguna pantalla para revisar los avisos (solo llegan por
email). Esta spec aporta la visibilidad in-app que faltaba, en dos rebanadas:
1. **Estado de zona en `/vigiladas`**: cada acción vigilada indica si su última cotización
   está en zona (compra/venta) o fuera, mediante el **color de fondo** de su fila.
2. **Bandeja de avisos `/avisos`**: lista los avisos del usuario (SPEC-006) con leído/no-leído,
   marcar-leído y un contador de no-leídos accesible desde el panel.
Reutiliza `entraEnZona` (SPEC-003), `quotes` (SPEC-004), `zone_triggers`/`notifications`
(SPEC-005/006). Reglas: **RN-01, RN-11, D-2**. No hay ADR nuevo: el estado de zona se computa
en render desde la última cotización y el contador es una consulta (decisiones de bajo riesgo).

## Usuarios / roles afectados
- **Usuario final** (autenticado, RN-03): abre `/vigiladas` y ve de un vistazo qué acciones
  están en zona (color de fondo), y abre `/avisos` para revisar/marcar sus avisos y ver
  cuántos tiene sin leer. Todo aislado por usuario (RN-01) y con el `asOf` visible (D-2).

## Criterios de aceptación
Cada CA es verificable con un test (unit para consultas/mutaciones; **e2e Playwright** para el
render real: color de fondo y marcar-leído). Se siembran cotizaciones/avisos como en specs previas.

### Rebanada 1 — Estado de zona en /vigiladas
- **CA-1 (Color de fondo según estado de zona, RN-11).**
  Dada una acción vigilada con zona y una cotización DENTRO de la zona,
  cuando el usuario abre `/vigiladas`,
  entonces su fila se muestra con el **color de fondo** de "en zona" (NO un badge/chip), y
  acompañada de una **etiqueta de texto** del estado (accesibilidad: el color no es el único
  portador de significado); una acción fuera de zona se muestra en color "fuera".
- **CA-2 (Sin cotización → estado neutro).**
  Dada una acción vigilada cuyo símbolo aún no tiene cotización ingerida,
  cuando el usuario abre `/vigiladas`,
  entonces su fila se muestra en estado **neutro** (ni en-zona ni fuera) con "—" en precio; la
  página no rompe ni asume precio 0.
- **CA-3 (Distingue compra vs venta).**
  Dada una acción cuya cotización cae en la zona de compra (y otra en la de venta),
  cuando el usuario abre `/vigiladas`,
  entonces el estado distingue **compra** de **venta** (color/etiqueta diferenciados); si el
  precio cumpliera ambas, se indican ambas.
- **CA-4 (`asOf` visible, D-2).**
  Dada una acción con cotización,
  cuando el usuario abre `/vigiladas`,
  entonces se muestra el `asOf` de la cotización usada para decidir el estado (carácter diferido;
  nunca se presenta como tiempo real).
- **CA-5 (Aislamiento del estado, RN-01).**
  Dadas acciones vigiladas de dos usuarios,
  cuando un usuario abre `/vigiladas`,
  entonces solo ve el estado de zona de SUS acciones; el cálculo usa solo sus datos.

### Rebanada 2 — Bandeja de avisos /avisos + leído/no-leído
- **CA-6 (Lista de avisos, D-2).**
  Dado un usuario con avisos (de entrada y agregados),
  cuando abre `/avisos`,
  entonces ve la lista de SUS avisos con tipo (entrada/agregado), resumen, `asOf` y estado de
  envío, ordenada por fecha (recientes primero), filtrada por `userId`.
- **CA-7 (Estado vacío).**
  Dado un usuario sin avisos,
  cuando abre `/avisos`,
  entonces ve un **estado vacío** claro ("aún no tienes avisos"), no una tabla vacía rota.
- **CA-8 (Marcar leído individual, RN-01).**
  Dado un aviso propio no leído,
  cuando el usuario lo marca como leído,
  entonces queda leído (`readAt`) y deja de contar como no leído; es **idempotente** (marcarlo
  de nuevo no falla) y marcar por id un aviso ajeno no tiene efecto (aislamiento).
- **CA-9 (Marcar todos leídos).**
  Dado un usuario con varios avisos no leídos,
  cuando pulsa "marcar todos como leídos",
  entonces todos SUS avisos quedan leídos y su contador de no-leídos pasa a 0 (solo los suyos).
- **CA-10 (Contador de no-leídos).**
  Dado un usuario con N avisos no leídos,
  cuando ve el panel/navegación,
  entonces se muestra el contador de no-leídos (N), calculado solo con sus avisos; al marcar
  leído, el contador baja.
- **CA-11 (Aislamiento del inbox, RN-01).**
  Dados avisos de dos usuarios,
  cuando un usuario usa `/avisos`,
  entonces no ve ni puede marcar los avisos de otro; su contador cuenta solo los suyos.

## Entidades y reglas afectadas
- **`notification.readAt`** (nuevo, nullable, SPEC-007): timestamp de lectura; `null` = no leído.
  Idempotencia de marcar-leído (no se sobreescribe si ya tiene valor). Paridad de esquema en
  `schema.ts` + `test-db.ts` + `tests/e2e/server.mjs` (lección RED-1).
- **Consultas/mutaciones** (aislamiento RN-01 vía `ownership.ts`): `zoneStatusForUser` (join
  watched_symbols ∪ última `quote`, aplica `entraEnZona`), `countUnread(userId)`,
  `markNotificationRead(id, userId)`, `markAllRead(userId)`; `listNotificationsForUser` (SPEC-006)
  se extiende con `readAt`/`isRead`.
- **UI**: `/vigiladas` (color de fondo + etiqueta + `asOf`), nueva página `/avisos` (lista +
  marcar-leído + marcar-todos + empty state), y una **navegación compartida** mínima con el
  contador de no-leídos (primera barra de nav del proyecto). Design system `design/tremen-ds`
  (tokens `--live`/`--ember`/`--bg-elev`, componentes `.nav`/`.card`/`.btn`).
- Reglas: **RN-01** (aislamiento), **RN-11** (predicado de zona, reusado), **D-2** (`asOf`/diferido,
  no tiempo real). Términos: `docs/fundacion/dominio.md` (estado de zona, bandeja de avisos,
  aviso leído/no leído; añadidos por esta spec).
- Sin ADR nuevo (decisiones de bajo riesgo, ver Problema). Hereda ADR-002/004/005/006.

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Tiempo real / push de UI**: el estado y el contador se actualizan al navegar/refrescar, no
  en vivo (D-2, coherente con la cadencia diaria). WebSockets/streaming fuera.
- **Filtros y paginación avanzados** del inbox (por tipo/ticker/fecha, páginas): si el log crece
  se abordará; v1 lista ordenada por fecha.
- **Preferencias de notificación** (silenciar, canal/frecuencia): F-SPEC-006-2.
- **Archivar/borrar avisos**: v1 solo leído/no-leído; el log es inmutable.
- **Nuevas reglas de zona o de aviso**: son de SPEC-003/005/006; aquí solo se PRESENTAN.

## Notas para el gate humano
Resoluciones que propongo, para tu aprobación:

- **Estado de zona por color de fondo (tu decisión) + etiqueta de texto.** Uso color de fondo de
  la fila, NO un badge. Propuesta de paleta con tokens del DS: **en zona de compra** = tinte
  `--live` (verde), **en zona de venta** = tinte `--ember` (ámbar), **fuera** = tinte tenue/apagado,
  **sin dato** = neutro (fondo por defecto). Añado una etiqueta de texto del estado JUNTO al color
  para accesibilidad (WCAG: el color no puede ser el único indicador) — es texto inline, no un chip.
  ¿Conforme con la paleta y con la etiqueta de texto de apoyo?
- **Contador de no-leídos numérico** en la navegación (p. ej. "Avisos (3)"). El veto de "badge" era
  para el indicador de zona; aquí propongo un contador numérico. ¿OK, o lo prefieres de otra forma?
- **Primera navegación compartida**: esta spec introduce una barra/enlace de nav común (hoy cada
  página va suelta) para alojar el acceso a `/avisos` y el contador. ¿Conforme con introducirla aquí?
- **Alcance v1 sin filtros/paginación ni archivar**: lista simple + leído/no-leído. ¿Cierras aquí?
