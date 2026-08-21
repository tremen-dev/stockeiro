---
id: SPEC-043
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-043 La cotizacion que dejo de refrescarse lo dice, y la cuota agotada deja de disfrazarse de caida del proveedor

## Resumen
- Fase: **borrador** — spec escrita por sdd-arquitecto el 2026-08-21, **pendiente del gate
  humano**. Nada implementado.
- Rama: `ft/SPEC-043-la-cotizacion-que-dejo-de-refrescarse-lo-dice`
- Decisión que la acompaña: **ADR-027** (`docs/adr/ADR-027-…`), también en `borrador`.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (cuota_agotada por `usage_limit_reached`) | | | | ❌ |
| CA-2 (429 por segundo sigue transitorio) | | | | ❌ |
| CA-3 (429 mudo se presume cuota) | | | | ❌ |
| CA-4 (texto sin promesa de reintento) | | | | ❌ |
| CA-5 (resiliencia y contrato del ciclo — no regresión) | | | | ❌ |
| CA-6 (ayuda explica el motivo y su cuenta no miente) | | | | ❌ |
| CA-7 (definición por `updated_at`, no por `as_of`) | | | | ❌ |
| CA-8 (`/vigiladas` lo dice con precio y con estado de zona) | | | | ❌ |
| CA-9 (`/cartera` lo dice con P/L calculado) | | | | ❌ |
| CA-10 (sin diagnóstico no se inventa el motivo) | | | | ❌ |
| CA-11 (la marca desaparece sola) | | | | ❌ |
| CA-12 (una sola definición y umbral derivado de la cadencia) | | | | ❌ |
| CA-13 (RN-06 y RN-11 intactos: marcar no es borrar) | | | | ❌ |
| CA-14 (no se alerta a nadie — ADR-023 pto. 15) | | | | ❌ |
| CA-15 (geometría a 360 y 1280 — ADR-026) | | | | ❌ |
| CA-16 (el incidente real reproducido — CE-F1) | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-043/. Informe HTML opcional: _qa/SPEC-043/informe.html -->
Pendiente. CA-8, CA-9, CA-10 y CA-15 pedirán captura (`/vigiladas` y `/cartera` con fila
marcada y sin marcar, a 360 px y a 1280 px).

## Salvedades / follow-ups
Abiertas desde el diseño, antes de implementar:

- **F-ADR-027-1** (gate humano, **no la resuelve esta spec**): **CE-F3 de EPIC-FIX**
  (*coste cero de arranque*) y la realidad medida ya no caben juntos — 13 símbolos × ~31
  días ≈ 400 unidades/mes contra las 100 del free tier de Marketstack. Ningún cambio de
  código lo arregla. Decisión de producto y coste.
- **F-ADR-027-2**: el proveedor avisa al 75/90/100 % de consumo **por correo al titular** y
  la app **no** conecta esa señal — hacerlo sería la alerta proactiva que **ADR-023 pto. 15**
  deja fuera por decisión escrita.
- **F-ADR-027-3** (→ EPIC-MEJORA): nadie mira el **consumo previsto**, que crece con cada
  símbolo nuevo vigilado. Un contador en Operación sería barato, pero es funcionalidad.
- **F-SPEC-043-1** (→ idea de roadmap, **no** CA): el **aviso de permanencia** (RN-14)
  sigue diciendo *«sigue en zona»* sobre una cotización sin refrescar. Verificado el
  2026-08-21: el cuerpo **sí** lleva fecha (`src/lib/notifications/service.ts:140`,
  `` `Siguen en zona: ${lista}. (asOf ${cycleRef})` ``), o sea que no es mudo — pero repite
  la **misma señal débil** que ya falló en pantalla, y además `cycleRef` sale de
  **`max(quotes.asOf)` GLOBAL** (línea 67), **no por símbolo**: basta **un** símbolo fresco
  para que el digest entero parezca fresco. **El arreglo natural, una vez exista RN-16, es
  que RN-14 consuma esa misma regla** en vez de redecidir qué es viejo. Fuera de alcance
  aquí porque tocar el motor o el contenido de los avisos es cambiar el producto.
- **F-SPEC-043-2** (→ candidato a **spec propia**): **saltar el ciclo los fines de semana**.
  Propuesto y **rechazado** en el gate del 2026-08-21. (i) No rescata ningún plan: ~286
  unidades/mes contra 100 del free tier, y un 1,1 % de ahorro sobre Basic. (ii) **Choca con
  CA-7**: 72 h de hueco viernes→lunes contra un umbral de 36 h marcaría **todo** el universo
  como sin refrescar el fin de semana, y devolvería la necesidad del calendario de sesiones
  que medir por `updated_at` eliminó. (iii) El ciclo del sábado **no es inútil**: el
  proveedor publica el EOD con retraso desigual por símbolo (medido: `APP` con `date`
  `2026-08-19` mientras `AAPL` e `ITX` ya traían `2026-08-20`), así que matarlo pierde el
  cierre del viernes hasta el lunes para los rezagados. (iv) «Fin de semana» es la parte
  fácil: BMEX, XPAR, XNAS y XNYS tienen **festivos distintos**. **Condición escrita para el
  día que se retome: entra A LA VEZ que un umbral consciente del calendario, nunca antes.**
- **Decisión consciente, no salvedad** (2026-08-21): `outcome='success'` con `updated=0` y
  `skipped=13` **se queda como está**. Se miró en el incidente que lo destapó y se decidió
  no moverlo; tocarlo abre el contrato de **ADR-023**. Queda escrito para que el próximo que
  lo lea sepa que no es un descuido.
- **Constancia de despliegue, no bloqueante** (2026-08-21): la `MARKETSTACK_API_KEY` de
  producción es de una **cuenta de prueba que el humano no administra**, así que los avisos
  de consumo al 75/90/100 % **van a un buzón que nadie lee** — ese canal **no existe en la
  práctica** y no puede citarse como mitigación (ver F-ADR-027-2). Se dará de alta cuenta
  propia y se **rotará la clave**. **Nada de esta spec depende de esa clave**: los CA se
  verifican con el fake y con `fetchImpl`, no contra la API real.

## Cómo retomar (handoff)
Estado real: **solo diseño**. En el árbol hay tres ficheros y **ni una línea de `src/`**:

1. `docs/epicas/EPIC-FIX/SPEC-043-…md` — la spec, 16 CA, en `borrador`.
2. `docs/epicas/EPIC-FIX/SPEC-043-…ledger.md` — este fichero.
3. `docs/adr/ADR-027-…md` — la decisión, en `borrador`.

**El gate ya respondió (2026-08-21) y las respuestas están plegadas en la spec y en el
ADR.** Lo decidido, para no tener que releerlo todo:

| Cuestión | Resuelto |
|---|---|
| Umbral de rancidez | **36 h** — fijado en CA-7, con un solo sitio por CA-12 |
| Vocabulario de `dominio.md` | **ok tal cual** (nota 1); se escribe **al aprobar** |
| **RN-16** en `reglas.md` | **SÍ** — redacción cerrada en la nota 5; se escribe **al aprobar** |
| `outcome='success'` con `updated=0` | **Se queda**, como decisión consciente |
| RN-14 sobre precio congelado | **Fuera** → F-SPEC-043-1 |
| Salto de fin de semana | **Fuera** → F-SPEC-043-2 |

**Lo único que falta es la aprobación explícita, y no la da el arquitecto.** Al aprobar,
tres escrituras que **no puede hacer el implementador** (ADR-025):

1. `docs/fundacion/dominio.md` ← las dos filas de la **nota 1** (`cuota_agotada` y
   «Cotización sin refrescar»), ya redactadas y listas para pegar. Sin ellas la
   implementación no tiene rótulo del que copiar.
2. `docs/fundacion/reglas.md` ← **RN-16**, ya redactada en la **nota 5**.
3. **ADR-027** a `aprobada`: es lo que autoriza el motivo nuevo y lo que deja escrita la
   enmienda a **ADR-002 pto. 4** y la corrección de cifra de **ADR-012**.

Sugerencia de orden de implementación, si se parte la entrega: **bloque B primero** (CA-7 a
CA-13, la cotización sin refrescar), porque el bloque A sin el B seguiría dejando el motivo
escondido detrás de un precio viejo.
