/**
 * Catálogo de secciones y decisión de visibilidad por rol (SPEC-034, ADR-021 pto. 5).
 *
 * Función PURA, aislada del acceso a datos y de Next — mismo patrón que
 * `isPublicPath`/`requireSession` (SPEC-001) e `isSessionEpochCurrent` (ADR-016
 * pto. 7): el runtime la invoca, y el test no necesita levantar Auth.js ni una
 * base de datos. Este módulo NO importa nada: es la propiedad que lo hace
 * probable entero (CA-4) y la que impide que la decisión se disperse.
 *
 * UN SOLO SITIO donde se decide (ADR-021 pto. 1.a): el menú, el guard de página y
 * el de cada server action consultan ESTA función, no una lista propia. Así es
 * imposible que la navegación ofrezca lo que la ruta niega sin que un test lo cace.
 *
 * La jerarquía `tester ⊂ completo ⊂ admin` se escribe UNA vez, como rango numérico,
 * y no se reconstruye a base de condicionales por pantalla. Que sea un rango es lo
 * que hace estructuralmente imposible que exista una sección que un `tester` vea y
 * un `completo` no.
 */

/** Los tres valores del dominio, ni uno más (ADR-021 pto. 1). El orden ES la cadena. */
export const ROLES = ['tester', 'completo', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Las secciones de la app. `operacion` entra aquí aunque su ruta todavía no exista
 * (SPEC-037): ADR-021 pto. 5 exige que la pantalla de operación viva en ESTE catálogo
 * y no en un segundo mecanismo de acceso conviviendo con el primero.
 */
export const SECTIONS = ['panel', 'cartera', 'vigiladas', 'avisos', 'importar', 'operacion'] as const;
export type Section = (typeof SECTIONS)[number];

/** Rol con el que nace toda cuenta nueva (ADR-021 pto. 8). El default de la base es la red. */
export const DEFAULT_ROLE: Role = 'tester';

/** Posición en la cadena. Un `admin` es un `completo` que además opera. */
const RANK: Record<Role, number> = { tester: 0, completo: 1, admin: 2 };

/** Rol MÍNIMO que abre cada sección. Es la única tabla que hay que leer para saber quién ve qué. */
const REQUIERE: Record<Section, Role> = {
  panel: 'tester',
  vigiladas: 'tester',
  avisos: 'tester',
  cartera: 'completo',
  importar: 'completo',
  operacion: 'admin',
};

/** ¿El valor que viene de la base (o de cualquier frontera) es un rol del dominio? */
export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * LA decisión: ¿este rol ve esta sección? (CA-4).
 *
 * No responde "¿de quién son los datos?" — eso es RN-01 y no depende del rol
 * (ADR-021 pto. 9): ni siquiera un `admin` ve datos ajenos.
 */
export function canSee(role: Role, section: Section): boolean {
  return RANK[role] >= RANK[REQUIERE[section]];
}

/** Nombre de cada sección tal y como se le enseña a una persona. */
export const SECTION_LABEL: Record<Section, string> = {
  panel: 'Panel',
  cartera: 'Cartera',
  vigiladas: 'Vigiladas',
  avisos: 'Avisos',
  importar: 'Importar',
  operacion: 'Operación',
};

/** Las secciones que un rol ve, en el orden del catálogo. Lo que consume el menú (CA-5). */
export function visibleSections(role: Role): Section[] {
  return SECTIONS.filter((s) => canSee(role, s));
}
