# tremen.dev — Design System

Paquete portátil del sistema visual de **tremen.dev**.
Plain CSS. Sin JS, sin build, sin dependencias.

```
tremen-ds/
├── README.md
├── example.html                 ← arranque mínimo
├── colors_and_type.css          ← tokens + tema .v-tremendo + reset
├── responsive.css               ← pasada mobile (un breakpoint)
├── icons.svg                    ← sprite de iconos (opcional)
└── components/
    ├── index.css                ← importa todo lo de abajo
    ├── _base.css                ← body bg + grain + .frame
    ├── nav.css                  ← .nav · .lockup · .lang-switch · .nav-cta
    ├── buttons.css              ← .btn · .btn.primary · .btn-link
    ├── eyebrows.css             ← .eyebrow-row · .section-eyebrow
    ├── headline.css             ← h1.headline · h2.section · .lede
    ├── artifact.css             ← .artifact · .pill
    ├── marquee.css              ← .strip · .strip-track
    ├── cards.css                ← .cards · .card
    ├── capabilities.css         ← .cap-grid · .cap · .cap-foot
    ├── stamp.css                ← .stamp
    └── footer.css               ← footer · .stamp-foot
```

---

## Install

Copia la carpeta `tremen-ds/` dentro de tu proyecto y enlaza una sola hoja:

```html
<link rel="stylesheet" href="tremen-ds/components/index.css" />
<body class="v-tremendo">
  <div class="frame">
    <!-- usa cualquier componente -->
  </div>
</body>
```

La clase `v-tremendo` en el `<body>` activa el tema (dark cálido +
acento ember). Si algún día hay un segundo tema, se añade otra clase.

### Fuentes

Geist + Geist Mono se cargan desde Google Fonts vía `@import` dentro
de `colors_and_type.css`. Si trabajas offline o quieres self-hostear,
sustituye ese `@import` por tus `@font-face`.

---

## Imports selectivos

Si solo necesitas botones en una página, evita arrastrar el sistema entero:

```html
<link rel="stylesheet" href="tremen-ds/colors_and_type.css" />
<link rel="stylesheet" href="tremen-ds/components/buttons.css" />
```

Dependencias mínimas de cada componente:

| Componente            | Necesita |
|---|---|
| **buttons**           | `colors_and_type.css` |
| **eyebrows**          | `colors_and_type.css` |
| **headline**          | `colors_and_type.css` |
| **stamp**             | `colors_and_type.css` |
| **footer**            | `colors_and_type.css` |
| **nav**               | `colors_and_type.css` |
| **artifact**          | `colors_and_type.css` |
| **cards**             | `colors_and_type.css` |
| **capabilities**      | `colors_and_type.css` + `icons.svg` (si quieres iconos) |
| **marquee**           | `colors_and_type.css` + asume un `.frame` con padding 48px (o ajusta el `margin: 0 -48px`) |

Todos comparten los mismos tokens (`--accent`, `--bg`, `--fg`, etc.),
así que cualquier sustitución a nivel `:root` o `.v-tremendo` se propaga.

---

## Iconos

`capabilities.css` espera símbolos `#ic-crm`, `#ic-auto`, `#ic-datos`,
`#ic-ia`, `#ic-tooling`, `#ic-migraciones`. Tres formas de cargarlos:

**A · referenciar el SVG externo** (lo más limpio):
```html
<svg class="icon"><use href="tremen-ds/icons.svg#ic-crm"/></svg>
```

**B · inline al principio del `<body>`** (cero requests adicionales):
copia el contenido entero de `icons.svg` dentro de un `<svg
style="position:absolute; width:0; height:0;" aria-hidden="true">…</svg>`
nada más abrir el body. Luego:
```html
<svg class="icon"><use href="#ic-crm"/></svg>
```

**C · sustituir por los tuyos** — son símbolos `viewBox="0 0 24 24"`,
stroke 1.75, `currentColor`. Cualquier set Lucide-like encaja.

---

## Tokens (los que querrás tocar)

Editables en `colors_and_type.css`:

```css
:root {
  --font-sans:  'Geist', …;
  --font-mono:  'Geist Mono', …;
  --ember:      #FF6B00;   /* el accent principal */
  --bone:       #F5F1EA;   /* foreground crema */
  --live:       #7CFFB2;   /* verde "ai alive" — usar con cuentagotas */
}

.v-tremendo {
  --bg:         #111110;   /* dark cálido */
  --bg-elev:    #1A1815;
  --line:       #2A2620;
  --radius:     10px;
  --radius-card: 14px;
}
```

Cambiar `--ember` recolorea hover-glow, headline-accents, llaves,
status pills y borde de focus de todo el sistema. Es el switch
principal de marca.

---

## Convenciones

- **Clases planas, cortas** (`.btn`, `.card`, `.nav`) — sin prefijo
  de marca por ahora. Si vas a montar esto encima de Bootstrap o Tailwind,
  añade un prefijo `.tr-` con un find-and-replace global.
- **No hay JS.** El `lang-switch` del nav es solo presentación; la
  lógica de cambio de idioma (`.on`, `[lang="es"]` visibility) vive
  en el sitio que lo consume — copia el snippet del `<script>` de
  `index.html` original si lo necesitas.
- **Mobile.** `responsive.css` da una sola pasada `<= 720px` afinada
  a las páginas originales. Para otras estructuras puedes ignorarlo
  y escribir el tuyo.

---

## Cosas que **no** están en el paquete

Por ahora viven solo en el sitio principal:

- Variantes de página (pricing-grid, steps, programs, posts, formulario
  de contacto) — son layouts específicos, no componentes reutilizables.
- Lógica i18n (selector de idioma + visibilidad por `[lang]`).
- Plantillas (`proposal-template.html`, `email-signature.html`,
  `invoice-template.html`) — son piezas terminadas, no componentes.

Si los quieres en el paquete, ábrelos y dilo.

---

**v0.1** — © Alberto Fojo
