# Colours

Source: `styles.css` `:root` design tokens (repo root site).

| Token | Value | Use |
|---|---|---|
| `--black` | `#070707` | Primary background |
| `--black-soft` | `#0d0d0d` | Secondary background |
| `--black-card` | `#111111` | Card surfaces |
| `--border` | `rgba(255,255,255,0.07)` | Hairline borders on black |
| `--border-gold` | `rgba(201,168,76,0.3)` | Accent borders |
| `--white` | `#f0ede8` | Primary text (warm off-white, not pure white) |
| `--white-dim` | `rgba(240,237,232,0.52)` | Secondary text |
| `--white-muted` | `rgba(240,237,232,0.22)` | Disabled/faint text |
| `--gold` | `#c9a84c` | Brand accent (CTAs, labels, dividers) |
| `--gold-light` | `#dfc278` | Gold hover/highlight state |
| `--gold-dim` | `rgba(201,168,76,0.1)` | Gold background tint |

Palette logic: near-black base + warm off-white text + a single muted gold accent. No secondary
brand colour — gold carries all emphasis. Keep this discipline in any new PK Visuals or Listing
Launch surface (dashboard, GPT outputs, decks) — don't introduce a second accent colour without a
deliberate reason.
