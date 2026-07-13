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
