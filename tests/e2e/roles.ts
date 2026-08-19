import postgres from 'postgres';

/**
 * Rol de cuenta en el e2e (SPEC-034 / ADR-021).
 *
 * Desde SPEC-034 toda cuenta nueva nace `tester`, y un `tester` NO ve Cartera ni
 * Importar. Las pruebas que ejercitan esas secciones tienen que DECLARAR el rol que
 * necesitan en su arranque, en vez de heredarlo por descuido (F-SPEC-034-4): relajar
 * el default para que los tests estén cómodos es como se pierde la garantía en
 * producción.
 *
 * No hay pantalla para cambiar el rol (F-ADR-021-1): se cambia con un `UPDATE`, que
 * es exactamente lo que hace el operador en Neon. Y como el rol se lee en cada
 * petición (ADR-021 pto. 4), surte efecto en la navegación siguiente — sin volver a
 * iniciar sesión y con la misma cookie, que es lo que prueba CA-10.
 */

export const DB_URL = 'postgres://postgres:postgres@localhost:54329/stockeiro_e2e';

export type Rol = 'tester' | 'completo' | 'admin';

/** Cambia el rol de una cuenta ya registrada. Devuelve el rol que quedó en la base. */
export async function ponerRol(email: string, rol: Rol): Promise<Rol> {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    const filas = await sql`UPDATE users SET role = ${rol} WHERE email = ${email} RETURNING role`;
    if (filas.length !== 1) {
      throw new Error(`ponerRol: no existe la cuenta ${email} (¿se registró antes?)`);
    }
    return filas[0].role as Rol;
  } finally {
    await sql.end();
  }
}

/** El rol que la base dice AHORA para esa cuenta. Útil para anclar el "nace tester". */
export async function rolDe(email: string): Promise<Rol | null> {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    const filas = await sql`SELECT role FROM users WHERE email = ${email}`;
    return (filas[0]?.role as Rol) ?? null;
  } finally {
    await sql.end();
  }
}
