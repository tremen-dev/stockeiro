---
id: ADR-008
tipo: adr
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-07-14, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-14, por: humano (Alberto Fojo)}
---
# ADR-008: Linea mantenida de Next.js (16.x) como piso de seguridad y politica de parcheo de CVE

- Deciders: propone sdd-arquitecto; aprueba el humano (gate). Alcance (migrar a 16.x) ya decidido por el humano el 2026-07-14 vía sdd-orquestador.
- Specs relacionadas: SPEC-009 (ejecuta la migración). Reinterpreta la versión de framework de ADR-001 (no lo supersede: ADR-001 fija "Next.js App Router en Vercel", sin fijar versión mayor).

## Contexto
Los builds de Vercel muestran el aviso *"Vulnerable version of Next.js detected,
please update immediately."* Corresponde a la familia de CVE de React Server
Components sobre App Router:

- **CVE-2025-66478** (React2Shell, RCE, CVSS 10.0) — línea 15.5 parcheada en 15.5.7.
- **CVE-2025-55183** (exposición de código fuente, medium) y **CVE-2025-55184 /
  CVE-2025-67779** (DoS, high; el fix inicial fue incompleto, el completo es
  67779) — línea 15.5 parcheada en 15.5.9.

El proyecto está en `next@15.5.20`, que **ya supera todos esos cortes** (es la
última del canal 15.5, tag npm `backport`). `npm audit` confirma que `next` en sí
solo aparece como *moderate* (vía postcss), no como el RCE. Por tanto el aviso de
Vercel no señala un CVE sin parchear en 15.5.20, sino que **15.5 es un backport de
fin de vida**: Vercel empuja a la línea mantenida activamente (16.x), que es la
única que recibirá futuros parches de seguridad sin fricción.

ADR-001 fijó el stack "Next.js (App Router) en Vercel" pero dejó la versión mayor
abierta y advirtió explícitamente de "fijar versión" para dependencias en
evolución. No hay decisión locked que impida subir de major.

## Decisión
1. **Adoptar la línea mantenida de Next.js (16.x)** como versión de referencia del
   proyecto. Objetivo inmediato: `next@16.2.x` (≥ 16.2.10, última `latest` a
   2026-07-14) con `react`/`react-dom@19.2.x` (pareja recomendada por la 16.x).
2. **Política de piso de seguridad:** el proyecto se mantiene en la línea mayor de
   Next.js **soportada activamente**; no se permanece en backports de fin de vida
   una vez existe una línea mayor mantenida. Ante un aviso de vulnerabilidad de
   Vercel o un CVE publicado que afecte a App Router/RSC, se sube a la última
   versión parcheada de la línea mantenida como trabajo de EPIC-INFRA.
3. **Verificación obligatoria antes de fijar la versión:** la migración de major se
   valida con `npm run build`, `npm run typecheck`, `npm run test` y la suite
   Playwright existente en verde, aplicando los codemods oficiales de Next
   (`npx @next/codemod@latest upgrade latest`). No se fija una versión que no pase
   esa verificación.

## Consecuencias
### Positivas
- Elimina el aviso de vulnerabilidad de Vercel y sitúa el proyecto en la línea que
  recibe parches de seguridad activos.
- Convierte el parcheo de CVE de framework en trabajo rutinario, gobernado y
  trazable bajo EPIC-INFRA, en vez de reacciones ad-hoc.
- Coherente con el requisito de "UI de nivel profesional/vendible": el proyecto se
  compartirá en un foro y no debe arrastrar avisos de seguridad visibles.

### Negativas / follow-ups
- Subir de major (15 → 16) tiene superficie de breaking changes; se absorbe con
  codemods + la verificación obligatoria de la decisión 3 (SPEC-009).
- Fija una pareja React 19.2.x; futuras subidas de React quedan acopladas a la
  línea de Next mantenida.
- Tras parchear un CVE de RSC, el aviso oficial recomienda **rotar los secretos**
  de la app; queda como acción manual/humana post-deploy (recogida en SPEC-009).
- Requiere disciplina de seguimiento de la línea mantenida; mitigable con `npm
  audit` en CI y la herramienta `npx fix-react2shell-next` para chequeos puntuales.

## Alternativas consideradas
- **Permanecer en 15.5.x parcheado (statu quo, 15.5.20):** en el papel ya está por
  encima de los cortes de CVE conocidos, pero es un backport de fin de vida; Vercel
  seguiría avisando y no habría parches futuros sin volver a migrar. Rechazada:
  aplaza el problema y mantiene el aviso visible.
- **Saltar a canary/última canary de 16.x:** obtiene parches antes, pero introduce
  inestabilidad no aceptable para un producto que se comparte públicamente.
  Rechazada frente a la `latest` estable de 16.x.
- **Migrar a un framework/hosting distinto para desacoplarse de la cadencia de CVE
  de Next:** desproporcionado; contradice ADR-001 y la preferencia por baja
  fricción. Rechazada.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
