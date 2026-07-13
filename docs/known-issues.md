# Known issues — para llevar al mantenedor de tremen-sdd

> Problemas detectados durante el uso del plugin **tremen-sdd** en este proyecto.
> No son bugs de Stockeiro; se anotan aquí para trasladarlos al plugin (autor:
> Alberto Fojo). El plugin no declara `repository`/`bugs` ni es un repo git, por
> lo que no hay tracker externo donde abrir issue.

---

## KI-1 — `tablero.mjs` no rellena la tabla `## Specs` inline de cada `_epica.md`

- **Estado: ✅ REPORTADO al mantenedor del plugin (2026-07-13).**
- **Detectado:** 2026-07-13, durante el cierre de SPEC-001 (rol sdd-documentalista).
- **Plugin/versión:** `tremen-sdd` 0.1.0
  (`~/.claude/plugins/cache/tremen-sdd/tremen-sdd/0.1.0/scripts/tablero.mjs`).

### Síntoma
La sección `## Specs` dentro de `docs/epicas/EPIC-NNN-*/_epica.md` permanece
**vacía** aunque la épica ya tenga specs con frontmatter. Esa tabla lleva el
comentario:

```
<!-- Tabla DERIVADA de los frontmatters; la regenera /sdd-tablero. No editar a mano. -->
```

…lo que promete que `/sdd-tablero` la regenera, pero no ocurre.

### Causa
`scripts/tablero.mjs` genera únicamente el tablero **global** `docs/tablero.md`
(que sí refleja bien los estados por spec). **No** escribe de vuelta la tabla
`## Specs` embebida en cada `_epica.md`. Como además está marcada "No editar a
mano", queda permanentemente vacía y desincronizada de los frontmatters.

### Impacto
- Bajo (no rompe el flujo): el estado real es consultable en `docs/tablero.md` y
  vía `/sdd-como-vamos`.
- Cosmético/de confianza: la tabla inline miente por omisión y contradice su
  propio comentario "DERIVADA … la regenera /sdd-tablero".

### Arreglo sugerido
Que `tablero.mjs` (o un paso de sdd-documentalista) reescriba también el bloque
`## Specs` de cada `_epica.md` a partir de los frontmatters de sus specs
(mismas columnas Spec/Título/Estado), no solo `docs/tablero.md`. Alternativa: si
se decide no auto-rellenarla, cambiar el comentario para no prometer que
`/sdd-tablero` la regenera.

### Reproducción
1. `scaffold.mjs epica "X"` → crea `_epica.md` con `## Specs` vacía.
2. `scaffold.mjs spec "Y" --epica EPIC-NNN` → crea la spec con frontmatter.
3. `node scripts/tablero.mjs` → `docs/tablero.md` se actualiza; la tabla
   `## Specs` de `_epica.md` sigue vacía.
