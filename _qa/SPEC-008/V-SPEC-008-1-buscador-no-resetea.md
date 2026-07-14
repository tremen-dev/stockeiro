# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: avisos-zona.spec.ts >> SPEC-007: /vigiladas colorea la fila según el estado de zona
- Location: tests\e2e\avisos-zona.spec.ts:52:1

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('form').filter({ hasText: 'Vigilar una acción' }).locator('.symbol-search-input')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - navigation "Principal" [ref=e3]:
      - link "Stockeiro." [ref=e4] [cursor=pointer]:
        - /url: /dashboard
      - generic [ref=e5]:
        - link "Panel" [ref=e6] [cursor=pointer]:
          - /url: /dashboard
        - link "Cartera" [ref=e7] [cursor=pointer]:
          - /url: /cartera
        - link "Vigiladas" [ref=e8] [cursor=pointer]:
          - /url: /vigiladas
        - link "Avisos" [ref=e9] [cursor=pointer]:
          - /url: /avisos
      - button "Cerrar sesión" [ref=e11] [cursor=pointer]
    - main [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: Vigiladas
        - heading "Acciones vigiladas" [level=1] [ref=e15]
        - paragraph [ref=e16]: El color de cada fila indica su estado de zona según la última cotización (precio de cierre no ajustado, con su fecha).
      - table [ref=e18]:
        - rowgroup [ref=e19]:
          - row "Ticker Estado Precio A fecha Zona compra Zona venta acciones" [ref=e20]:
            - columnheader "Ticker" [ref=e21]
            - columnheader "Estado" [ref=e22]
            - columnheader "Precio" [ref=e23]
            - columnheader "A fecha" [ref=e24]
            - columnheader "Zona compra" [ref=e25]
            - columnheader "Zona venta" [ref=e26]
            - columnheader "acciones" [ref=e27]
        - rowgroup [ref=e28]:
          - row "REP Sin cotización — — 20 – 25 — Quitar" [ref=e29]:
            - cell "REP" [ref=e30]
            - cell "Sin cotización" [ref=e31]:
              - generic [ref=e32]: Sin cotización
            - cell "—" [ref=e34]
            - cell "—" [ref=e35]
            - cell "20 – 25" [ref=e36]
            - cell "—" [ref=e37]
            - cell "Quitar" [ref=e38]:
              - button "Quitar" [ref=e40] [cursor=pointer]
      - generic [ref=e41]:
        - strong [ref=e42]: Vigilar una acción
        - generic [ref=e43]:
          - generic [ref=e44]: Acción
          - generic [ref=e45]:
            - generic [ref=e46]:
              - strong [ref=e47]: REP
              - generic [ref=e48]: Repsol SA
            - generic [ref=e49]:
              - generic [ref=e50]: BME
              - generic [ref=e51]: EUR
            - button "Cambiar" [ref=e52] [cursor=pointer]
        - generic [ref=e53]:
          - text: Zona de compra (min / max)
          - generic [ref=e54]:
            - textbox "Zona de compra (min / max)" [ref=e55]:
              - /placeholder: min
            - textbox "max" [ref=e56]
        - generic [ref=e57]:
          - text: Zona de venta (min / max)
          - generic [ref=e58]:
            - textbox "Zona de venta (min / max)" [ref=e59]:
              - /placeholder: min
            - textbox "max" [ref=e60]
        - button "Vigilar" [ref=e61] [cursor=pointer]
  - alert [ref=e62]
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import postgres from 'postgres';
  3   | 
  4   | // Render real de SPEC-007: color de fondo según estado de zona en /vigiladas, y bandeja
  5   | // /avisos con contador de no-leídos y marcar-leído. Se siembran cotizaciones/avisos por SQL
  6   | // (como haría la ingesta/notificación), sin llamar a APIs externas.
  7   | const DB_URL = 'postgres://postgres:postgres@localhost:54329/stockeiro_e2e';
  8   | const SHOTS = '_qa/SPEC-007';
  9   | const PWD = 'clave-secreta-123';
  10  | 
  11  | async function registrarYEntrar(page: Page, email: string) {
  12  |   await page.goto('/register');
  13  |   await page.fill('input[name="email"]', email);
  14  |   await page.fill('input[name="password"]', PWD);
  15  |   await page.click('button[type="submit"]');
  16  |   await page.waitForURL('**/dashboard');
  17  | }
  18  | 
  19  | async function vigilar(page: Page, ticker: string, buyMin?: string, buyMax?: string) {
  20  |   const form = page.locator('form', { hasText: 'Vigilar una acción' });
  21  |   // SPEC-008: elegir del buscador (E2E_FAKE_SYMBOL_SEARCH=1) en vez de teclear el ticker.
> 22  |   await form.locator('.symbol-search-input').fill(ticker);
      |                                              ^ Error: locator.fill: Test timeout of 60000ms exceeded.
  23  |   await form.locator('.symbol-result', { hasText: ticker }).first().click();
  24  |   if (buyMin) await form.locator('input[name="buyMin"]').fill(buyMin);
  25  |   if (buyMax) await form.locator('input[name="buyMax"]').fill(buyMax);
  26  |   await form.locator('button[type="submit"]').click();
  27  |   await expect(page.locator('tr', { hasText: ticker })).toBeVisible();
  28  | }
  29  | 
  30  | async function withSql<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  31  |   const sql = postgres(DB_URL, { ssl: false, max: 1 });
  32  |   try {
  33  |     return await fn(sql);
  34  |   } finally {
  35  |     await sql.end();
  36  |   }
  37  | }
  38  | const seedQuote = (ticker: string, price: string) =>
  39  |   withSql(async (sql) => {
  40  |     const [s] = await sql`SELECT id FROM symbols WHERE ticker = ${ticker}`;
  41  |     await sql`INSERT INTO quotes (symbol_id, price, currency, as_of)
  42  |       VALUES (${s.id}, ${price}, 'EUR', '2026-07-13T00:00:00.000Z')
  43  |       ON CONFLICT (symbol_id) DO UPDATE SET price = EXCLUDED.price, as_of = EXCLUDED.as_of`;
  44  |   });
  45  | const seedDigest = (email: string, cycleRef: string, payload: string) =>
  46  |   withSql(async (sql) => {
  47  |     const [u] = await sql`SELECT id FROM users WHERE email = ${email}`;
  48  |     await sql`INSERT INTO notifications (user_id, kind, cycle_ref, payload, channel, status, as_of)
  49  |       VALUES (${u.id}, 'digest', ${cycleRef}, ${payload}, 'email', 'sent', '2026-07-13T00:00:00.000Z')`;
  50  |   });
  51  | 
  52  | test('SPEC-007: /vigiladas colorea la fila según el estado de zona', async ({ page }) => {
  53  |   await registrarYEntrar(page, 'zona1@example.com');
  54  |   await page.goto('/vigiladas');
  55  | 
  56  |   // Tickers EXCLUSIVOS de este spec (símbolos compartidos, ADR-002): no reutilizar
  57  |   // ITX/AAPL/SAN que otros e2e asumen sin cotización.
  58  |   await vigilar(page, 'REP', '20', '25'); // en zona con precio 22
  59  |   await vigilar(page, 'TEF', '10', '15'); // sin cotización -> neutro
  60  |   await seedQuote('REP', '22');
  61  |   await page.reload();
  62  | 
  63  |   // CA-1: REP en zona de compra -> fila con clase zone-buy y etiqueta de texto.
  64  |   const rep = page.locator('tr', { hasText: 'REP' });
  65  |   await expect(rep).toHaveClass(/zone-buy/);
  66  |   await expect(rep).toContainText('En zona de compra');
  67  |   await expect(rep).toContainText('2026-07-13'); // CA-4 asOf
  68  | 
  69  |   // CA-2: TEF sin cotización -> neutro.
  70  |   const tef = page.locator('tr', { hasText: 'TEF' });
  71  |   await expect(tef).toHaveClass(/zone-none/);
  72  |   await expect(tef).toContainText('Sin cotización');
  73  | 
  74  |   await page.screenshot({ path: `${SHOTS}/ca1-vigiladas-estado-zona.png`, fullPage: true });
  75  | });
  76  | 
  77  | test('SPEC-007: bandeja /avisos con contador de no-leídos y marcar-leído', async ({ page }) => {
  78  |   await registrarYEntrar(page, 'avisos1@example.com');
  79  |   await seedDigest('avisos1@example.com', 'c1', 'Permanencia en zona: ITX (compra)');
  80  |   await seedDigest('avisos1@example.com', 'c2', 'Permanencia en zona: AAPL (compra)');
  81  | 
  82  |   // CA-10: el contador de la nav muestra 2 sin leer.
  83  |   await page.goto('/dashboard');
  84  |   await expect(page.locator('.nav-count')).toHaveText('2');
  85  | 
  86  |   await page.goto('/avisos');
  87  |   await expect(page.locator('.notif-item.unread')).toHaveCount(2); // CA-6
  88  | 
  89  |   // CA-8: marcar uno como leído baja el contador a 1.
  90  |   await page.locator('.notif-item.unread').first().locator('button', { hasText: 'Marcar leído' }).click();
  91  |   await expect(page.locator('.nav-count')).toHaveText('1');
  92  |   await expect(page.locator('.notif-item.unread')).toHaveCount(1);
  93  |   await page.screenshot({ path: `${SHOTS}/ca8-avisos-marcar-leido.png`, fullPage: true });
  94  | 
  95  |   // CA-9: marcar todos -> contador desaparece (0) y estado "Todo al día".
  96  |   await page.locator('button', { hasText: 'Marcar todos como leídos' }).click();
  97  |   await expect(page.locator('.nav-count')).toHaveCount(0);
  98  |   await expect(page.locator('main')).toContainText('Todo al día');
  99  | });
  100 | 
  101 | test('SPEC-007: /avisos sin avisos muestra estado vacío', async ({ page }) => {
  102 |   await registrarYEntrar(page, 'vacio1@example.com');
  103 |   await page.goto('/avisos');
  104 |   await expect(page.locator('.empty')).toContainText('Aún no tienes avisos'); // CA-7
  105 | });
  106 | 
```