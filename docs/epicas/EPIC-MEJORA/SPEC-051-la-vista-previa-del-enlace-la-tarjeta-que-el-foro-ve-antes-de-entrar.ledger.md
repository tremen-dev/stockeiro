---
id: SPEC-051
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-051 La vista previa del enlace: la tarjeta que el foro ve antes de entrar

## Resumen
- Fase: `borrador` — escrita por sdd-arquitecto el 2026-08-23, **rearbitrada el mismo día** con
  las decisiones del humano (Alberto Fojo). Pendiente de su aprobación formal.
- Rama: `ft/SPEC-051-la-vista-previa-del-enlace-la-tarjeta-que-el-foro-ve-antes-de-entrar`
- **Nació como `SPEC-050`.** Otra sesión ocupó el id `SPEC-049` (EPIC-FIX) mientras ésta se
  escribía, y la cadena se desplazó. Citas reverificadas contra `9387681`.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->

| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (`metadataBase` desde `appBaseUrl()`) | | | | ❌ |
| CA-2 (la tarjeta completa en `/`) | | | | ❌ |
| CA-3 (las palabras son las de cada página) | | | | ❌ |
| CA-4 (URL absoluta y del propio origen) | | | | ❌ |
| CA-5 (`twitter:card` grande, misma imagen) | | | | ❌ |
| CA-6 (convención de fichero, nada a mano) | | | | ❌ |
| CA-7 (PNG 1200×630 opaco) | | | | ❌ |
| CA-8 (tres colores, derivados del CSS) | | | | ❌ |
| CA-9 (ni una letra, ni una fuente) | | | | ❌ |
| CA-10 (geometría y área segura) | | | | ❌ |
| CA-11 (contraste) | | | | ❌ |
| CA-12 (legible a tamaño de previsualización) | | | | ❌ |
| CA-13 (reproducible por `icon:build`, sin clave nueva) | | | | ❌ |
| CA-14 (alcanzable por un anónimo) | | | | ❌ |
| CA-15 (sin `Set-Cookie`) | | | | ❌ |
| CA-16 (mismos bytes con y sin sesión) | | | | ❌ |
| CA-17 (las **dos** guardias, nombradas y autorizadas) | | | | ❌ |
| CA-18 (suites verdes; acotación al gate) | | | | ❌ |
| CA-19 (la landing sigue sin pedir nada fuera) | | | | ❌ |
| CA-20 (alcance acotado — **criterio de gate, no de suite**) | n-a | n-a | | ❌ |

> **CA-20 no lleva fila de test a propósito.** Es criterio de acotación y **ADR-031 pto. 1.2**
> lo saca de la suite: lo verifica sdd-verificador en el gate y **pega aquí la salida**.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Capturas de trabajo: test-results/SPEC-051/ (ignorado por git). Evidencia que se commitea: _qa/SPEC-051/ -->
<!-- Pedir en el gate: la tarjeta a 1200×630 y su reducción a 240×126, que es como se ve en un hilo. -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-051-1… con destino (spec futura o EPIC-MEJORA). -->

## Cómo retomar (handoff)
- Spec en `borrador` **ya arbitrada**. Los dos puntos abiertos los cerró el humano el 2026-08-23;
  falta solo su aprobación formal.
- **Guardias ajenas: son DOS, no tres.** Autorizadas nominalmente bajo **CA-17**:
  `tests/legal-rutas-publicas.test.ts:78` (SPEC-035 CA-2) y `tests/cuenta-rutas.test.ts:94`
  (SPEC-036 CA-10). **La tercera desaparece por construcción**: el humano eligió que el generador
  cuelgue del `icon:build` que ya existe (**D-8**, **CA-13**), así que `package.json` no gana
  ninguna clave en `scripts` y `tests/deploy-gate-workflow.test.ts` **no se toca en absoluto**.
  **Un tercer fichero ajeno modificado es RED**: se escala.
- **`metadataBase` desde `APP_BASE_URL`, confirmado**: sin ADR, sin clave nueva, la lista cerrada
  de once de `tests/spec-031-frontera.test.ts` intacta, y la spec se queda en EPIC-MEJORA.
- **Trabajo colateral declarado**: la cabecera de `scripts/build-icon.mjs` dice hoy *«Escribe los
  dos ficheros del icono»* y pasan a ser tres. Corregirla es parte de la entrega (CA-20 la admite
  en `scripts/`); un documento de verdad que afirma algo falso es un defecto.
- **Reencuadre según ADR-031** (hecho al reverificar, no pedido por el humano): CA-1, CA-6 y
  CA-13 son ahora propiedades del árbol, y **CA-20 salió de la suite** — nada alimenta ya una
  aserción con `origin/main`/`HEAD`.
- Verificado que `tests/icono-frontera.test.ts` (SPEC-047) **no se rompe**: SPEC-048 lo ancló a
  una ventana fija (`ENTREGA_DE_SPEC_047 = { antes: '6da9fbe', despues: '104f94e' }`), así que
  los ficheros nuevos de esta spec no entran en su diff.
- Antes de empezar: `git fetch origin main` y rebasar. Solape posible con **SPEC-050** en
  `src/app/page.tsx`; la segunda en llegar reconcilia.
