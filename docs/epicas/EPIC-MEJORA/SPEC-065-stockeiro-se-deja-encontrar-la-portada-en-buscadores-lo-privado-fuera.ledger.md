---
id: SPEC-065
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-065 Stockeiro se deja encontrar: la portada en buscadores, lo privado fuera

## Resumen
- Fase: **borrador** — escrita por sdd-arquitecto el 2026-09-23, pendiente del gate humano
- Rama: `ft/SPEC-065-stockeiro-se-deja-encontrar`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | | | | ❌ |
| CA-2 | | | | ❌ |
| CA-3 | | | | ❌ |
| CA-4 | | | | ❌ |
| CA-5 | | | | ❌ |
| CA-6 | | | | ❌ |
| CA-7 | | | | ❌ |
| CA-8 | | | | ❌ |
| CA-9 | | | | ❌ |
| CA-10 | | | | ❌ |
| CA-11 | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-065/. Informe HTML opcional: _qa/SPEC-065/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-065-1, F-SPEC-065-2… con destino (spec futura o EPIC-MEJORA). -->

Levantados por sdd-arquitecto al escribir la spec (2026-09-23), antes de implementar:

- **F-SPEC-065-1 — El alta no tiene anti-abuso.** Sin límite de frecuencia, captcha, campo
  trampa ni verificación de correo; sólo el cupo de cuentas (semilla 50, ADR-023) y el grifo
  manual de `/admin`. Con la portada indexada, unas altas basura pueden **agotar el cupo** y
  cerrar el registro a gente real. *Destino*: spec propia (capacidad nueva con decisión de
  producto; EPIC-INFRA o la épica que elija el humano). *Recomendación*: antes de enviar el
  sitemap en Search Console (F-SPEC-065-3). *Dueño de la decisión*: humano.
- **F-SPEC-065-2 — No hay tope de vigiladas por usuario.** El presupuesto del proveedor es
  ~322 símbolos distintos por ciclo (ADR-032) y el alta pide precio en el acto (ADR-038). Lo
  acota el cupo de cuentas y que los símbolos se compartan, pero no hay techo por usuario ni
  alarma de presupuesto. *Destino*: spec propia (EPIC-INFRA / producto), cuando el recuento de
  símbolos distintos se acerque al umbral de ADR-032.
- **F-SPEC-065-3 — Search Console es tarea humana.** Verificar la **propiedad de dominio
  `tremen.dev`** por registro TXT en el DNS, enviar `https://stockeiro.tremen.dev/sitemap.xml`
  y pedir la indexación de la portada. Requiere acceso al DNS y a la cuenta de Google del
  titular: no es automatizable ni verificable por un agente. *Destino*: paso manual tras el
  merge, descrito en `docs/despliegue.md` (CA-10). *Dueño*: humano (Alberto Fojo).
- **F-SPEC-065-4 — `stockeiro-lemon.vercel.app` sirve producción sin `noindex`.** Medido el
  2026-09-23: `200` y sin `X-Robots-Tag`. El `canonical` de CA-3 lo neutraliza como duplicado;
  quitarlo del todo es redirigir ese alias al dominio (o retirarlo) en el panel de Vercel.
  *Destino*: acción manual del humano, sin código. *Dueño*: humano.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

Spec en `borrador`; nada implementado. Para quien implemente, lo que no se ve leyendo sólo los CA:

- **Las mediciones de la spec (§Problema) son del 2026-09-23** y se hicieron con `curl -I` sin
  cookies contra producción, el alias `stockeiro-lemon` y dos Preview. Tras mergear (mergear es
  desplegar, ADR-018), repetirlas sobre el dominio es la comprobación post-despliegue que pide
  CA-10 (a); su resultado se pega aquí.
- **No tocar el `matcher` de `src/proxy.ts` ni `PUBLIC_PREFIXES`** (D-5). Dos ficheros de
  `tests/` (`cuenta-rutas`, `legal-rutas-publicas`) congelan el literal del matcher y otros leen esas guardias; tocarlo es exactamente el tercer arrastre que
  `F-SPEC-051-1` manda a EPIC-FIX.
- **El e2e no es producción**: `deploymentIdentity.environment` sale `unknown` en
  `tests/e2e/server.mjs`, así que `/robots.txt` servido ahí es el de `Disallow: /`. La rama de
  producción se prueba en unitario sobre la ruta real (CA-5), no cambiando el entorno del
  servidor de e2e (que cambiaría también lo que pinta el pie).
- **`canonical` nunca en el layout raíz** (CA-4): Next lo heredaría a todas las rutas.
