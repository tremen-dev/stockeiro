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
