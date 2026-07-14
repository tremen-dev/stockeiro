# Dominio y lenguaje ubicuo — Stockeiro

> Glosario canónico. Estos términos NO se traducen ni se anglicizan en código,
> UI ni documentación. Si un término falta, se añade aquí antes de usarse.

| Término | Definición | Notas |
|---|---|---|
| Acción / Instrumento | Título de renta variable cotizado en bolsa; es el único instrumento que modela el núcleo del producto. | Instrumento = la acción; fondos, cripto, derivados y divisas quedan fuera (D-7). |
| Símbolo (ticker) | Identificador de una acción en un mercado (p. ej. `ITX`), entidad **global compartida** entre usuarios que las acciones vigiladas y las posiciones referencian, no propiedad de ningún usuario. | Registro compartido de símbolos; la cotización es por símbolo, no por usuario (ADR-002; sdd-mercados). |
| Usuario | Persona con cuenta propia que gestiona sus acciones vigiladas, zonas, cartera y avisos, aislada del resto. | Identidad por email único; aislamiento estricto (RN-01, RN-02, RN-03; D-5). |
| Acción vigilada (watchlist) | Acción que un usuario sigue y para la que ha definido sus zonas de compra y/o de venta, para que la app la vigile por él. | Las zonas las aporta el usuario, la app no las calcula (D-4). |
| Zona de compra | **Rango** de precio, no un valor puntual, dentro del cual el usuario considera oportuna la compra de una acción. | Rango, no umbral exacto; su semántica (tocar vs. cerrar dentro) se cierra en spec (D-3; CE-1; R-2; sdd-mercados). |
| Zona de venta | **Rango** de precio, no un valor puntual, dentro del cual el usuario considera oportuna la venta de una acción. | Rango, no umbral exacto (D-3; CE-1; R-2; sdd-mercados). |
| Disparo / Entrada en zona | Evento que el motor detecta cuando la cotización de una acción vigilada entra en su zona de compra o de venta. | Se evalúa en modo diferido/batch, no en tiempo real (CE-1; D-2; D-3). |
| Motor de disparo | Componente que, cada ciclo de refresco, compara las cotizaciones contra las zonas de las acciones vigiladas y genera los disparos. | Depende del puerto de datos, no del proveedor (CE-1; ADR-002). |
| Ciclo de refresco | Periodo acordado (hipótesis ≤ 24 h, p. ej. 1×/día tras cierre) en el que se ingieren cotizaciones y se evalúan disparos. | Determina el cumplimiento de "cero zonas perdidas" (D-2; CE-1; R-3; ADR-002). |
| Cotización | Precio de una acción para un símbolo, con su divisa y su `asOf`, obtenido del proveedor externo. | Una sola fuente de precio por símbolo (ADR-002; sdd-mercados). |
| Cotización diferida | Cotización que no es tiempo real, sino la última disponible dentro del ciclo de refresco. | La app nunca da falsa sensación de tiempo real (D-2). |
| asOf | Marca de antigüedad del dato que indica a qué momento corresponde una cotización o un disparo. | Debe mostrarse siempre al usuario (D-2; ADR-002). |
| Precio ajustado vs. no ajustado | Cotización con eventos corporativos (splits/dividendos) reflejados en la serie histórica (ajustado) frente a la sin ajustar (no ajustado). | Se persisten explícitamente; mezclarlos falsea disparos y P/L (ADR-002; sdd-mercados). |
| Split | Evento corporativo que multiplica el número de acciones y divide su precio sin cambiar el valor total; rompe la serie de precios. | Ajusta cantidad y coste base de la posición (sdd-mercados; sdd-cartera; R-5). |
| Dividendo | Reparto de beneficio por acción; evento corporativo que puede o no formar parte del resultado de la posición. | Su inclusión en el P/L se decide por spec (sdd-mercados; sdd-cartera; R-5). |
| Cartera | Agregado de todas las posiciones de un usuario, con vista por posición y vista agregada. | Datos refrescados a diario, sin hojas de cálculo externas (CE-3; sdd-cartera). |
| Posición | Tenencia de un usuario sobre una acción concreta, con su precio medio de compra, cantidad viva y, si aplica, precio de venta. | Referencia un símbolo compartido (ADR-002; sdd-cartera). |
| Cantidad | Número de acciones vivas de una posición; disminuye con las ventas y se ajusta por splits. | "Cantidad viva" tras ventas parciales (sdd-cartera). |
| Precio medio de compra | Coste medio por acción de una posición cuando se ha comprado en varios tramos; base del cálculo de P/L. | Coste base ante compras escalonadas (sdd-cartera). |
| Precio de venta | Precio al que se materializa la venta total o parcial de una posición. | Entra en el P/L realizado, neto de comisiones (sdd-cartera). |
| Comisión | Coste de intermediación de compra o de venta que reduce el resultado de la posición. | Neteada en el P/L realizado (sdd-cartera; R-5). |
| Venta parcial | Venta de solo parte de la cantidad de una posición, que reduce la cantidad viva y realiza P/L proporcional sobre lo vendido. | Afecta a cantidad viva y coste base (sdd-cartera; R-5). |
| P/L actual | Beneficio/pérdida **no materializado** de una posición abierta: (precio de mercado − precio medio de compra) × cantidad viva. | Nunca se mezcla ni suma con el realizado (D-6; CE-3; sdd-cartera). |
| P/L realizado | Beneficio/pérdida **materializado** tras una venta total o parcial: (precio de venta − precio medio de compra) × cantidad vendida, neto de comisiones. | Magnitud distinta del actual; nunca se agregan como una sola (D-6; CE-3; sdd-cartera). |
| Aviso / Notificación proactiva | Comunicación que la app envía al usuario cuando se produce un disparo, sin que este tenga que abrir la app. | Canal: email transaccional en v1 + registro in-app como fallback; objetivo 100 % de disparos notificados (CE-2; R-4; ADR-006). |
| Aviso de entrada | Aviso **individual** por cada acción cuyo disparo se abre (entra en zona); se emite una sola vez por episodio. | Idempotente por episodio de disparo (RN-13/RN-14; SPEC-006). |
| Aviso de permanencia (agregado) | Aviso **único por usuario y ciclo** que lista todas sus acciones que siguen en zona (episodios abiertos). | Recordatorio periódico; se repite cada ciclo pero no se duplica dentro del ciclo (RN-14; SPEC-006). |
| Puerto de envío de avisos (`NotificationSender`) | Frontera de integración de dominio que expone el envío de un aviso con independencia del proveedor concreto. | Primer adaptador: Resend (email); el dominio no depende del proveedor (ADR-006; análogo a `MarketDataProvider`). |
| Puerto de datos de mercado (`MarketDataProvider`) | Frontera de integración de dominio que expone las cotizaciones (`getQuotes`) con independencia del proveedor concreto. | Primer adaptador: Twelve Data; el dominio no depende del proveedor (ADR-002). |
| Caché de cotizaciones deduplicada | Almacén de cotizaciones donde cada símbolo referenciado por cualquier usuario se pide **una sola vez** por ciclo y todos lo leen. | 1 símbolo = 1 llamada; el coste escala con símbolos distintos, no con usuarios (ADR-002). |
