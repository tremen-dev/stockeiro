# Reglas de negocio — Stockeiro

> Numeradas y estables: las specs y ADRs las citan como RN-xx. No se borran;
> se marcan derogadas con fecha y motivo.

- **RN-01** (Aislamiento de datos por usuario): cada usuario solo puede ver y
  modificar sus propios datos (carteras, posiciones, acciones vigiladas, zonas y
  avisos). Ningún flujo devuelve ni acepta datos de otro usuario. Invariante de
  seguridad: toda lectura/escritura filtra por el `userId` de la sesión.
- **RN-02** (Identidad por email único): un usuario se identifica por una
  dirección de email única en el sistema; no puede haber dos cuentas con el mismo
  email.
- **RN-03** (Acceso autenticado): salvo las páginas públicas de registro e inicio
  de sesión, todo acceso a datos o acciones requiere una sesión válida.
- **RN-04** (Coste base = precio medio ponderado): el coste base de una posición
  es el precio medio ponderado de sus compras, incluyendo los **gastos** de cada
  compra. Fuente: sdd-cartera. (Gastos = concepto único: broker, impuestos de
  compra, cambio de divisa; no se separan.)
- **RN-05** (P/L realizado): el P/L realizado de una venta = (precio de venta ×
  cantidad vendida − gastos de la venta) − (precio medio × cantidad vendida). Los
  **dividendos** se suman al P/L realizado como ingreso, sin alterar el coste base
  ni la cantidad. Fuente: sdd-cartera; D-6.
- **RN-06** (P/L actual): el P/L actual de una posición abierta = (precio de
  mercado − precio medio) × cantidad viva. Requiere una cotización; si no hay
  precio, NO se calcula (se muestra "sin dato") y NUNCA se mezcla ni suma con el
  realizado. Fuente: sdd-cartera; D-6.
- **RN-07** (Splits): un split de ratio r ajusta la cantidad viva (×r) y el precio
  medio (÷r); no cambia el valor de la posición ni su P/L. Fuente: sdd-cartera.
- **RN-08** (No sobreventa): no se puede vender más cantidad que la cantidad viva
  de la posición.
- **RN-09** (Divisa única por posición): los importes de una posición están en una
  única divisa; no hay conversión automática de divisa (el coste del cambio, si lo
  hay, se registra dentro de los **gastos**). Multi-moneda avanzada queda fuera
  (FOUNDATION "Fuera").
- **RN-10** (Zona = rango de precio): una zona de compra o de venta es un **rango
  [min, max]** con min ≤ max, no un valor puntual (D-3). Las zonas de una acción
  vigilada son **opcionales e independientes**: se puede vigilar sin zona, con solo
  una, o con ambas. Compra y venta son **etiquetas**; no se exige que una esté por
  debajo de la otra.
- **RN-11** (Entrada en zona): el precio observado del ciclo (cierre/último, con su
  `asOf`, en la MISMA base ajustada/no-ajustada con la que el usuario definió la
  zona) **entra** en una zona si `min ≤ precio ≤ max` (inclusive). La detección es
  idéntica para compra y venta. Sin datos intradía, "tocar" no aplica (dictamen
  sdd-mercados). Afecta a CE-1.
- **RN-12** (Base de precio = último cierre NO ajustado): la cotización que se
  ingiere, se compara contra zonas (RN-11) y alimenta el P/L actual (RN-06) es el
  **último precio de cierre NO ajustado**, coherente con cómo el usuario define
  zonas y su coste base manual. La serie NO se ajusta por splits/dividendos (esos
  se registran a mano en la cartera, RN-07/RN-05). Cada cotización lleva su `asOf`,
  que se muestra al usuario (D-2). Fuente: sdd-mercados; ADR-002/ADR-004.
- **RN-13** (Disparo por entrada; permanencia observable): el motor registra **un
  solo** disparo por **episodio de entrada** en zona (transición fuera→dentro, RN-11):
  mientras la cotización permanezca dentro NO se crean disparos nuevos (idempotencia),
  y el disparo se **re-arma** solo cuando sale de la zona y vuelve a entrar. La zona de
  compra y la de venta se evalúan de forma independiente. La **condición de permanencia**
  (acciones que siguen dentro de su zona) queda **observable** —los episodios abiertos
  son el estado actual— para que la capa de aviso (CE-2) pueda emitir tanto el aviso de
  **entrada** (por cada acción que entra) como un aviso **agregado de permanencia** (uno
  con todas las que siguen en zona). La detección no se duplica; la periodicidad de los
  avisos la decide la spec de notificación. Fuente: sdd-mercados; ADR-005.
- **RN-14** (Tipos de aviso e idempotencia del envío): el aviso de **entrada** (individual)
  se emite **exactamente una vez por episodio de disparo** (RN-13); no se reenvía mientras
  el episodio siga abierto. El aviso de **permanencia** (agregado) es un resumen periódico,
  **uno por usuario y ciclo**, con todas las acciones cuyo episodio sigue abierto; se repite
  cada ciclo como recordatorio pero no se duplica dentro del mismo ciclo. Esta idempotencia
  del ENVÍO es distinta de la del disparo (RN-13): aquí se deduplica la emisión del aviso.
  Cada aviso se registra con su `asOf` (D-2). Fuente: producto (gate humano); ADR-006.
- **RN-15** (Canal proactivo con registro y fallback): el aviso se entrega por un canal
  **proactivo** que no exige abrir la app (email transaccional en v1) y se **registra
  siempre in-app** como fuente de verdad y fallback: un fallo de entrega del canal externo
  **no pierde** el aviso (queda in-app) ni aborta los avisos de otros usuarios (resiliencia
  por usuario, RN-01). Objetivo CE-2: 100 % de disparos con aviso registrado. Fuente:
  ADR-006; cierra R-4.

## Reglas de ingeniería (RI-xx)

> Serie aparte de la de dominio. Las **RN-xx** de arriba son reglas de negocio
> —las vigilan `sdd-cartera` y `sdd-mercados`, y su fuente es un dictamen de
> dominio—; las **RI-xx** son reglas de ingeniería: vinculan a cualquier spec que
> toque el código o el esquema, y su fuente es un ADR. La numeración es
> independiente y estable: no se borran, se marcan derogadas con fecha y motivo.

- **RI-01** (Migraciones aditivas, *expand/contract*): una migración no borra, no
  renombra y no estrecha una columna **en el mismo despliegue** que cambia el
  código. Lo destructivo se parte en dos despliegues separados por al menos un
  despliegue verde: primero se añade y se rellena; después, en otra spec, se
  retira lo viejo. El incumplimiento se detecta automáticamente (SPEC-032) y
  **solo se desbloquea por escrito**, con justificación y plan de vuelta atrás,
  en `drizzle/destructive-waivers.json`. Fuente: ADR-018 D-5.1.
- **RI-02** (*"Hecho" significa "vivo"*): una spec no pasa a `hecho` por tener
  GREEN del verificador. Pasa a `hecho` cuando su merge está en `main` **y** el
  despliegue de ese merge está vivo: la puerta de despliegue
  (`.github/workflows/deploy-gate.yml`) en verde, o a mano
  `node scripts/check-alive.mjs --url <origen> --commit <sha del merge>` con
  salida **0**. El GREEN del verificador **sigue siendo sobre el árbol de trabajo
  y antes del merge**: lo que esta regla añade es el último paso, que ocurre
  **después**. La evidencia (enlace al run de la puerta, o la salida del comando)
  se pega en el ledger de la spec. Fuente: ADR-018 D-7.
  El mecanismo que la hace cumplible son `/api/version` (SPEC-031) y la puerta
  post-deploy (SPEC-028): sin los dos, la regla es incumplible —el despliegue no
  sabría de qué commit viene y respondería `unknown`—, que es exactamente por lo
  que estuvo aplazada desde el 2026-08-17.
