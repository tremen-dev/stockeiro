# Evidencia HTTP — SPEC-001 (verificador, 2026-07-13)

## CA-5 · Rutas protegidas (RN-03) — flujo real vía next start + curl
```
GET /dashboard (sin sesión)  -> 307 -> http://localhost:3123/login
GET /                         -> 307 -> http://localhost:3123/dashboard
GET /login (público)          -> 200
GET /register (público)       -> 200
```
