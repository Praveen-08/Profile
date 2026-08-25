# ICT Silver Bullet indicator

`strategies/ict-silver-bullet-indicator.pine` — a Pine v6 **indicator** (not a strategy; it
doesn't backtest itself) implementing the model described in `ict-silver-bullet-spec.md` in this
folder. Read that file first — it documents exactly which rules came from the transcript you
provided, which are inferred, which are flagged as not objectively codable, and the one place the
video and your original instructions conflicted (sweep timing) and how that was resolved.

## What it does

Waits for the full sequence — liquidity context, sweep, BOS, displacement (evidenced by a
qualifying FVG on the BOS leg), the zone clearing a minimum "framework" distance to a real draw on
liquidity, and a retracement into that zone — before ever labelling `ENTRY`. Nothing fires outside
that sequence. `NO TRADE` / a low dashboard score means exactly that: the model isn't complete,
don't force it.

## Reading the chart

- **Yellow dotted lines** — tracked liquidity (swing highs/lows; equal highs/lows; previous
  day/week high-low; Asian/London session ranges — whichever sources you've enabled).
- **SWEEP** label — a tracked level got wicked/closed through and rejected.
- **BOS** (blue) — the opposite-side short-term swing broke, confirming the shift.
- **DISPLACEMENT** — the BOS leg produced a qualifying Fair Value Gap (drawn as a translucent
  aqua/fuchsia box) and, if the strength filter is on, also passed the ATR/body-% check.
- **ENTRY** (gold) — price retraced back into that zone.
- **TARGET** (green dashed line) — the nearest qualifying draw on liquidity beyond the zone, only
  shown once it's confirmed to clear your minimum framework distance (15 pips default for forex).
- **SETUP INVALIDATED** (red) — shows exactly which rule killed the setup (no BOS in time, no
  FVG/OB, target too small, zone filled before retracement, retracement never came, or the
  killzone closed) — check Section 13 of the spec doc for the full table.
- **Dashboard** (top-right) — live checklist: window / sweep / BOS / displacement / FVG-or-OB /
  retracement / target / status. Every box it shows is one of the same conditions gating the
  `ENTRY` label — nothing hidden.

## Settings worth knowing about first

- **Sweep / "Require sweep inside the killzone"** — off by default, matching how the video's own
  three worked examples play out (the liquidity/bias context predates the 60-minute window; the
  window is where the BOS + FVG + entry happen). Turn it on for the stricter literal reading of
  "sweep must happen inside the window."
- **Target / Instrument type + minimum framework** — set to Forex / 15 pips by default. Switch to
  "Index Futures/Other" and 10 points if you're trading indices/futures, per the video's stated
  minimum trade framework. A setup whose nearest liquidity target doesn't clear this distance is
  invalidated, not silently entered anyway.
- **Entry zone = FVG** by default — the video's examples only ever use the Fair Value Gap as the
  entry (never an Order Block); OB detection is included (per your original spec) but off by
  default. Switch `Entry zone` to `OB` or `Either` to experiment with it.
- **Debug mode** — turn on "Show debug reasoning labels" to see the internal state transitions
  written out on the chart (sweep confirmed / BOS confirmed / waiting for retracement, etc.) for
  auditing the logic against price action.

## Non-repainting notes

Swing highs/lows are confirmed pivots — they only appear `Pivot strength` bars after they form,
same as any pivot-based tool; that's disclosed lag, not repainting. Every other label (sweep, BOS,
displacement, entry, invalidation) is only ever placed once its condition is true on a fully closed
bar, with one exception: the `ENTRY` touch itself is evaluated intrabar (a touch into the zone is
knowable the instant it happens) — called out here and in the spec doc since it's the one place
that isn't strictly closed-bar-only.

## Testing it (Phase 4 from your instructions)

There's no substitute for scrolling through real charts with this on. Specifically look for:
false sweeps that shouldn't have armed a setup, BOS levels that look wrong (usually a swing-pivot
lookback/strength tuning issue), overlapping setups (shouldn't happen — only one setup is tracked
globally at a time), and DST-related window misalignment right after a US/EU clock change. If
something looks off, turn on debug mode first — it'll show you which state transition happened
and why before you have to read the code.
