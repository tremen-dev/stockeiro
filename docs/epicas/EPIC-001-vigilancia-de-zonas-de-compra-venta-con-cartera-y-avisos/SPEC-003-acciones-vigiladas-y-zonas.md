---
id: SPEC-003
tipo: spec
epica: EPIC-001
estado: en-progreso
aprobada-por: humano
historial:
  - {estado: borrador, fecha: 2026-07-13, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-13, por: humano}
  - {estado: en-progreso, fecha: 2026-07-13, por: sdd-implementador}
---
# SPEC-003 — Acciones vigiladas y zonas

## Problema
El usuario sigue acciones para las que sus portales le dan **zonas de compra y de
venta** (rangos). Necesita registrarlas para que la app las vigile (CE-1). Hoy no
hay dónde declarar qué acciones vigila ni con qué zonas. Esta spec entrega la
**lista de acciones vigiladas por usuario con sus zonas** y **cierra la definición
formal de "zona" (R-2)** como predicado testable que el futuro Motor de disparo
consumirá. Reglas: **RN-01, RN-10, RN-11**; decisiones **D-2, D-3, ADR-002**.
Dominio: sdd-mercados. NO incluye la ingesta ni el motor periódico (specs propias).

## Usuarios / roles afectados
- **Usuario final**: añade/edita/quita acciones vigiladas y define sus zonas de
  compra y/o de venta (rangos). Todo ligado a su cuenta (RN-01).

## Criterios de aceptación
Cada CA es verificable con un test. Precios en `numeric` (RN-09 aplica a la divisa
del símbolo). Zonas opcionales e independientes (RN-10).

- **CA-1 (Vigilar sin zona).**
  Dado un usuario autenticado sin la acción en su lista,
  cuando vigila un ticker sin definir zonas,
  entonces la acción queda vigilada (referenciando el símbolo compartido) y NO tiene
  zona; no puede disparar nada todavía (RN-10).
- **CA-2 (Vigilar con zona de compra y/o venta).**
  Dado un usuario autenticado,
  cuando vigila un ticker con una zona de compra [min,max] y/o una de venta [min,max],
  entonces se guardan tal cual (rangos, no valores puntuales, D-3/RN-10).
- **CA-3 (Rango inválido rechazado).**
  Dado un usuario que define una zona,
  cuando el min es mayor que el max de esa zona,
  entonces la operación se rechaza con error y no se guarda (RN-10, min ≤ max).
- **CA-4 (Editar zonas).**
  Dada una acción ya vigilada,
  cuando el usuario cambia, añade o quita una de sus zonas,
  entonces la acción vigilada refleja las nuevas zonas (sin duplicar la acción).
- **CA-5 (Dejar de vigilar).**
  Dada una acción vigilada,
  cuando el usuario la quita de su lista,
  entonces desaparece de sus acciones vigiladas.
- **CA-6 (Entrada en zona — predicado, RN-11).**
  Dada una zona [min,max] y un precio observado p,
  cuando se evalúa la entrada,
  entonces "entra" sii min ≤ p ≤ max (inclusive: los extremos min y max cuentan como
  dentro); fuera del rango no entra.
- **CA-7 (Detección idéntica compra/venta; sin zona no dispara).**
  Dada una acción vigilada con zona de compra y/o de venta y un precio observado,
  cuando se evalúa,
  entonces se indica qué zonas están "entradas" (compra, venta o ambas) con la MISMA
  regla (RN-11); una acción sin zonas nunca reporta entrada.
- **CA-8 (Símbolo compartido, ADR-002).**
  Dado que el usuario A vigila el ticker "ITX",
  cuando el usuario B vigila el mismo ticker "ITX",
  entonces ambas acciones vigiladas referencian el MISMO registro de símbolo.
- **CA-9 (Aislamiento por usuario, RN-01).**
  Dado el usuario A con acciones vigiladas y el usuario B autenticado,
  cuando B lista o pide por id una acción vigilada,
  entonces no ve ni puede leer/modificar ninguna de A (filtrado por `userId`).
- **CA-10 (Una entrada por símbolo).**
  Dado un usuario que ya vigila un ticker,
  cuando vuelve a vigilar el mismo ticker,
  entonces no se crea una segunda entrada: se actualizan sus zonas (upsert por
  (userId, symbolId)).

## Entidades y reglas afectadas
- **`watched_symbol`** (por usuario): `id`, `userId`→user, `symbolId`→symbol,
  `buyMin`, `buyMax`, `sellMin`, `sellMax` (numeric, nullable por pares),
  `createdAt`. Único por (userId, symbolId). Reutiliza el `symbol` compartido
  (ADR-002; introducido en SPEC-002).
- **Predicado de zona** (puro): `entraEnZona(precio, {min,max}) = min ≤ precio ≤ max`
  (RN-11). Es la formalización de R-2 que consumirá el Motor de disparo.
- Reglas: **RN-01, RN-10, RN-11**. Decisiones: **D-2, D-3, ADR-002**. Términos:
  `docs/fundacion/dominio.md` (acción vigilada, zona de compra/venta, disparo).

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Ingesta de cotizaciones** y **Motor de disparo periódico** (evaluar todas las
  vigiladas cada ciclo y generar disparos): specs propias. Aquí solo el modelo +
  el predicado puro de entrada.
- **Notificaciones/avisos** (CE-2): spec propia.
- **Anti-ruido / confirmación en N sesiones**: la detección de v1 es por una sola
  observación dentro del rango (RN-11); un debounce se valorará en el Motor.
- **Base ajustada vs no-ajustada del precio**: la zona se compara contra el precio
  en la misma base con que el usuario la definió; garantizar esa coherencia es de
  la spec de Ingesta (dictamen sdd-mercados). Aquí se asume precio "último/observado".
- **UI final** con estilo tremen-ds: exposición mínima; el pulido va con la spec de UI.

## Notas para el gate humano
**Aprobado 2026-07-13 por el humano:** los 4 puntos ACEPTADOS — entrada = precio
observado dentro de [min,max] inclusive; compra/venta como etiquetas sin exigir
orden; zonas opcionales; y coherencia de base de precio delegada a la spec de Ingesta.

Resoluciones ya tomadas contigo:
- **Entrada en zona = precio observado dentro de [min,max] inclusive** (sin intradía,
  "tocar" no es observable; dictamen sdd-mercados). ¿OK?
- **Compra/venta son etiquetas**, detección idéntica, sin exigir compra < venta (RN-10). ¿OK?
- **Zonas totalmente opcionales**: se puede vigilar sin zona (no dispara). ¿OK?
- **Coherencia de base de precio** (ajustado/no-ajustado): queda como invariante para
  la spec de Ingesta; aquí no se resuelve. sdd-mercados avisa de que mezclarlas falsea
  el disparo. ¿Conforme con dejarlo a Ingesta?
