# Fonts

Source: `style.css` / `styles.css`.

- **Serif — `Cormorant Garamond`** (fallback Georgia, serif) — headings, luxury/editorial voice.
  Also referenced: `Playfair Display` (serif, used in places in `style.css`).
- **Sans — `Inter`** (fallback system-ui, sans-serif) — UI text, body copy, CTAs.
- **Script — `Sacramento`** (cursive) — used sparingly for signature/accent flourishes in
  `style.css`, not part of the core `styles.css` token set.
- Body text elsewhere in `style.css` also references `Open Sans` — treat `Inter` (from the
  `styles.css` tokens, the more recently structured stylesheet) as the canonical sans for new
  work, and `Cormorant Garamond` as the canonical serif.

Rule of thumb: serif for anything that should feel luxury/editorial (headlines, hero copy), sans
(`Inter`) for anything functional (nav, buttons, form labels, dashboard UI).
