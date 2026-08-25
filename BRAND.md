# Brand

**Parent company:** NobleArc Technologies
**Short brand:** NobleArc
**Product:** SalesLeak
**Endorsement lockup:** SalesLeak by NobleArc

## SalesLeak brand — finalized

Three approved SalesLeak assets, all final, all exact unmodified copies of supplied source files — none redrawn, none regenerated:

| Asset | Path | Size |
|---|---|---|
| Wordmark ("SalesLeak by NobleArc" lockup) | `/public/brand/salesleak/salesleak-master-dark.png` | 1774×887 |
| Standalone icon | `/public/brand/salesleak/salesleak-icon-master.png` | 1254×1254 |
| Favicon source | `/public/brand/salesleak/salesleak-favicon-32.png` | 32×32 |

Colors:
- Deep Navy background `#0B1739`
- "Sales" — Warm White `#F7F5F0`
- "Leak" — Muted Gold `#C6A15B`
- "by" — Muted Gold `#C6A15B`
- "NobleArc" — Warm White `#F7F5F0`

Usage:
- The full **wordmark** is used only where there's real header space (login, signup, onboarding shell).
- The **icon** is used small (22–26px, rounded corners) next to the existing compact "SalesLeak" text in the sidebar (desktop header and mobile top bar) — see "Sidebar" below.
- The **favicon** is wired in at `src/app/favicon.ico`, converted losslessly from the approved 32×32 PNG (pixel-identical, RGBA container only, so Next.js's favicon pipeline can decode it) — replaces the previous default Next.js icon.
- Do not recreate, redraw, regenerate, or modify any of the three supplied master artworks.

### Sidebar

The sidebar (desktop header + mobile top bar) now shows the approved SalesLeak icon (small, rounded) beside the existing compact text lockup — "SalesLeak" / "by NobleArc" / company name. The full rectangular wordmark image is still deliberately **not** used here — the mobile top bar is too narrow (~280px alongside the nav toggle) for it to stay legible; the icon, being a small square asset, fits naturally instead.

## Hierarchy

```
NobleArc Technologies
        ↓
     SalesLeak
```

SalesLeak is the product. NobleArc is the parent/master brand behind it (and behind future products). Inside the SalesLeak application itself, **SalesLeak stays visually primary** — NobleArc appears only as a small, secondary endorsement ("by NobleArc"), never as the dominant mark, and the app is never renamed to NobleArc.

## Rules

- Never replace "SalesLeak" with "NobleArc Technologies" inside the product. The correct relationship is always **SalesLeak by NobleArc**, not a renamed app.
- "TECHNOLOGIES" is a formal/corporate descriptor — use it only in formal contexts (the full master lockup, legal-style footers), never in everyday product UI.
- No legal suffix yet: never write "NobleArc Technologies Private Limited" or "Pvt. Ltd." — the entity isn't incorporated yet.
- No ™ or ® until explicitly approved.
- Do not invent alternate NobleArc logos, icons, or wordmark redraws. The asset in `/public/brand/noblearc/` is the canonical, approved master — it is not to be recreated, altered, or reinterpreted.
- Always spell it **NobleArc** (capital N, capital A) — never "Noblearc," "Noble Arc," or "NOBLEARC" outside a deliberately all-caps formal graphic treatment.
- Always spell it **SalesLeak** (capital S, capital L).
- SalesLeak's wordmark, standalone icon, and favicon are all now finalized and approved (see "Assets" below). Do not redesign, redraw, or regenerate any of them.

## Colors (NobleArc palette — parent-brand contexts only)

| | Hex |
|---|---|
| Deep Navy | `#0B1739` |
| Warm White | `#F7F5F0` |
| Metallic Gold | `#C6A15B` |

This palette is for NobleArc endorsement moments (login/signup footer, billing/company attribution, the formal master lockup) and, as of the Sonnet 5 visual transformation pass, the primary navigation shell itself: the desktop sidebar and mobile top bar/drawer are now a deep-navy surface (`bg-brand-navy`) with warm-white text and a gold left-rail on the active item, rather than white. The rest of the product UI (page content, cards, tables, forms) stays on the slate/white palette — the navy moment is deliberately confined to navigation structure, not spread across the whole app.

## Assets

NobleArc (parent brand):
- `/public/brand/noblearc/noblearc-master-dark.png` — canonical full lockup (icon + "NobleArc" wordmark + "TECHNOLOGIES"), warm-white/gold on deep navy. Exact, unmodified copy of the approved source image.
- `/public/brand/noblearc/noblearc-icon-dark.png` — icon-only, losslessly cropped from the master (identical pixels, no redraw, no approximation). Still sits on its navy background.

SalesLeak (product):
- `/public/brand/salesleak/salesleak-master-dark.png` — wordmark lockup, 1774×887px. "Sales" warm white, "Leak" muted gold, "by" muted gold, "NobleArc" warm white, on deep navy.
- `/public/brand/salesleak/salesleak-icon-master.png` — standalone product icon, 1254×1254px, deep-navy field with warm-white upper structure and muted-gold lower structure.
- `/public/brand/salesleak/salesleak-favicon-32.png` — the 32×32 favicon source, same icon design at its final small size.
- `src/app/favicon.ico` — the live favicon Next.js actually serves, a lossless RGBA-container conversion of `salesleak-favicon-32.png` (pixel-identical; Next.js's ICO decoder requires an alpha channel, PIL's default save did not include one, so the PNG was re-saved with a fully-opaque alpha channel before the format conversion — no visible pixel changed).

**Known gap:** all five brand-image assets are raster PNGs (plus the one derived ICO) — not vectors (SVG/AI/EPS). The wordmark and NobleArc master specifically sit on a solid navy background with no transparency, so they only work cleanly on a deep-navy field or framed in their own rounded card (as done on login/signup/onboarding) — they cannot be dropped onto a white/light background directly or scaled arbitrarily without quality loss. True transparent and/or vector masters should be produced from the original source files by whoever owns them. Nothing in this codebase attempts to fake transparency or hand-vectorize any of these — that would mean redrawing/approximating an approved mark, which is explicitly out of scope.

### Where the SalesLeak master wordmark is used

The full `salesleak-master-dark.png` image (framed in a small rounded, shadowed card so its hard navy edges don't sit as a raw rectangle on the light page) appears only where there's real header space and SalesLeak itself is the subject:

- **Login page** — replaces the old plain-text "SalesLeak" + "by NobleArc" header. ~300px wide.
- **Signup page** — same treatment, ~300px wide.
- **Onboarding shell** (`/onboarding`, shown once, not repeated per wizard step) — same treatment, slightly smaller at ~260px wide to fit the shell's tighter header.

The wordmark image deliberately does **not** appear in: the sidebar (desktop header or mobile top bar — uses the small icon + compact text instead, see "Sidebar" above), any table/list header, dashboard cards, buttons, or any operational lead/quotation/customer screen, the public website-form page, or the Billing page header. In every one of those spots either the available space is too small for the wide rectangular image to stay legible (sidebar, mobile top bar) or the brief explicitly reserves them for the existing subtle text treatment (website form, Billing).

### Why the sidebar keeps text branding

The sidebar's brand area — both the desktop header and the mobile top bar — is genuinely too small for the image: the mobile top bar is a single ~52px-tall strip shared with the nav toggle button, leaving roughly 280px of width at most. At any size that fits that strip, the wordmark's own baked-in "by NobleArc" sub-text would render below legible size — precisely the "tiny unreadable logo" the brief says to avoid. The existing compact text lockup ("SalesLeak" + small "by NobleArc") stays exactly as it was; it was not touched by this pass.

## Where NobleArc appears in the product (and where it doesn't)

Via the SalesLeak master wordmark image (its own "by NobleArc" is baked into the artwork — no separate endorsement text is added beside it):
- Login page, Signup page, Onboarding shell header (once, not repeated per step)

Small "by NobleArc" text endorsement (secondary, muted, unchanged by this pass):
- Sidebar — small, secondary, beside "SalesLeak" (desktop header and mobile top bar)
- Billing page — near the page header
- Public website-form page — "Powered by SalesLeak · NobleArc," small, below the company's own form

Formal/full attribution:
- Company Settings page footer — "SalesLeak is a product of NobleArc Technologies."

Full master corporate lockup (icon + wordmark + TECHNOLOGIES, the actual image asset):
- Not shown anywhere inside the day-to-day operational product. Reserved for company/about, formal, marketing, and legal contexts only — none of which exist in the app yet.

Deliberately untouched:
- Global product UI colors, layout, and typography — unchanged. This pass adds a wordmark, an icon, and a favicon; it does not restyle SalesLeak.
- The full rectangular wordmark image is still never used in the sidebar, table headers, dashboard cards, buttons, or any operational lead/quotation/customer screen — only the small icon (sidebar) or nothing at all (everywhere else compact text already does the job).

Resolved (previously pending, now finalized):
- Favicon/app icon — was the default Next.js placeholder; now the approved SalesLeak favicon, wired at `src/app/favicon.ico`. See "Assets" above.
- Standalone SalesLeak icon — was pending; now approved and in use in the sidebar.
