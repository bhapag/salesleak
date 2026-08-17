# Brand

**Parent company:** NobleArc Technologies
**Short brand:** NobleArc
**Product:** SalesLeak
**Endorsement lockup:** SalesLeak by NobleArc

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
- SalesLeak does not yet have its own separate product logo — its identity today is the wordmark "SalesLeak" set in the app's existing UI type. Do not invent one during brand-integration work.

## Colors (NobleArc palette — parent-brand contexts only)

| | Hex |
|---|---|
| Deep Navy | `#0B1739` |
| Warm White | `#F7F5F0` |
| Metallic Gold | `#C6A15B` |

This palette is for NobleArc endorsement moments only (login/signup footer, sidebar endorsement, billing/company attribution, the formal master lockup). It does not replace SalesLeak's existing product UI palette (slate/white) — this is brand integration, not a UI redesign.

## Assets

- `/public/brand/noblearc/noblearc-master-dark.png` — canonical full lockup (icon + "NobleArc" wordmark + "TECHNOLOGIES"), warm-white/gold on deep navy. Exact, unmodified copy of the approved source image.
- `/public/brand/noblearc/noblearc-icon-dark.png` — icon-only, losslessly cropped from the master (identical pixels, no redraw, no approximation). Still sits on its navy background.

**Known gap:** both assets are raster PNGs on a solid navy background — not a transparent PNG, not a vector (SVG/AI/EPS). They only work cleanly when placed on a deep-navy field; they cannot currently be dropped onto a white/light background or scaled to arbitrary sizes without quality loss. A true transparent and/or vector master should be produced from the original source file by whoever owns it. Nothing in this codebase should attempt to fake transparency or hand-vectorize the screenshot — that would mean redrawing/approximating the approved mark, which is explicitly out of scope.

## Where NobleArc appears in the product (and where it doesn't)

Small "by NobleArc" endorsement (secondary, muted):
- Login page — below "SalesLeak"
- Signup page — below "SalesLeak"
- Onboarding shell header — once, not repeated per step
- Sidebar — small, secondary, beside "SalesLeak"
- Billing page — near the page header
- Public website-form page — "Powered by SalesLeak · NobleArc," small, below the company's own form

Formal/full attribution:
- Company Settings page footer — "SalesLeak is a product of NobleArc Technologies."

Full master corporate lockup (icon + wordmark + TECHNOLOGIES, the actual image asset):
- Not shown anywhere inside the day-to-day operational product. Reserved for company/about, formal, marketing, and legal contexts only — none of which exist in the app yet.

Deliberately untouched:
- Favicon/app icon — still the default Next.js placeholder icon, never a SalesLeak asset and never NobleArc's icon. Left alone. A proper SalesLeak favicon is a separate, future SalesLeak-level branding task — see the integration report for details.
- Global product UI colors, layout, and typography — unchanged. This pass adds an endorsement; it does not restyle SalesLeak.
