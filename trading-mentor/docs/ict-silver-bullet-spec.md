# ICT Silver Bullet — Extracted Specification (Phase 1) & State Machine (Phase 2)

## Source

Extracted directly from the transcript you pasted (ICT's own "Silver Bullet" teaching video).
This supersedes an earlier draft of this document that was built from generic public ICT material
because the video file itself wasn't accessible in this environment. Every rule below is either
**[STATED]** (said directly in the transcript), **[INFERRED]** (a reasonable reading of something
implied but not spelled out), or **[NOT CODABLE]** (explicitly discretionary/skill-based per the
speaker himself).

## 1. The three time windows — [STATED]

Always New York local time, DST-observed:
- **London / AM**: 03:00–04:00 NY
- **NY AM**: 10:00–11:00 NY
- **NY PM**: 14:00–15:00 NY

"One of these will form every single trading day" — but not necessarily in every instrument, and
not every window produces a valid setup every day.

## 2. Minimum trade framework — [STATED], new vs. the earlier draft

Before a setup counts as high-probability, the **distance from the entry zone to the identified
draw on liquidity** must offer at least:
- **Index futures**: 10 points/handles (= 40 ticks)
- **Forex**: 15 pips (the speaker states this once as the rule, then later gives a conversion
  "10 handles = 20 pips, 5 handles = 10 pips" — that conversion implies ~15 pips would be the
  equivalent of ~7.5 handles, not quite matching his stated 10-handle/15-pip framework exactly.
  This is a minor inconsistency in the source itself, not a transcription error I'm introducing —
  **15 pips is used as the coded default** since it's the number given as the actual rule; the
  handle/pip conversion ratio is exposed as a separate, informational input, not force-derived from it.)

This is explicitly a **minimum potential offered by the setup**, not a target you must fully
capture ("it doesn't mean you're trying to get 10 handles, it just means it offers 10 handles").
Coded as a go/no-go filter: measure distance from entry zone to the nearest qualifying draw-on-
liquidity target; if it's under the configured minimum, the setup is flagged incomplete / scored
down, never silently entered anyway.

## 3. Draws on liquidity (target candidates) — [STATED], substantially expanded vs. the earlier draft

The video gives an explicit, "not limited to" list of what price is being drawn toward. All of
these are implemented as independently toggleable target/context sources:

1. Previous day high or low
2. Previous session high or low (e.g. the London session range, viewed from the NY AM window)
3. Previous **week's** high or low
4. Current/old **New Week Opening Gap** (NWOG) — the gap between last week's close and the new
   week's open
5. A Fair Value Gap / inefficiency sitting further away in the trade direction (a "premium" FVG
   above price when bullish, a "discount" FVG below price when bearish) — an FVG can itself be a
   *target*, separate from the FVG used as the *entry* zone
6. Relative equal highs / equal lows

"Not all of these exist on any given day... but most days one of these criteria will be in play" —
confirms these are optional/best-available sources, matched by the toggle design.

**[NOT CODABLE]**: which of these is *the* draw to favor when several exist is explicitly framed
as the core discretionary skill ("determining the next most likely draw... is the number one goal
... the least important thing is the entries and exits"). The video gives no formula for this
choice. **[DECISION, unchanged from the earlier draft]**: nearest qualifying level in the trade
direction is used as the deterministic stand-in, now clearly justified as filling a gap the source
itself says is skill-based, not ruled.

## 4. The actual mechanical sequence shown in all three worked examples — [STATED], corrects the earlier draft

All three examples (London/AM/PM) follow the same pattern, and none of them show, as a distinct,
separately-labeled step inside the 60-minute window, "price sweeps a specific high/low, then BOS
forms." What's actually shown, every time:

```
(existing directional bias, established by where liquidity/inefficiency is resting)
   -> BOS ("shift in market structure") in the direction of that bias
   -> a Fair Value Gap forms on the same leg that produces the BOS
   -> price retraces back into that FVG, inside the killzone window          <- "optimal trade entry"
   -> entry, targeting the nearest qualifying draw on liquidity (Section 3),
      only valid if that target clears the minimum framework (Section 2)
```

Liquidity/sweeps are discussed as *context* — what makes a level a meaningful draw — not as a
timed precondition that must itself occur inside the 60-minute window right before the BOS.

### CONFLICT — flagging per your explicit instruction, not silently resolving

Your original instruction document requires the model to be
`LIQUIDITY -> SWEEP -> BOS -> DISPLACEMENT -> FVG/OB PULLBACK -> TARGET LIQUIDITY`, with the sweep
as a distinct, separately labeled, required step, and explicitly rejects "price swept a high/low,
therefore enter" as too simplistic in the other direction (i.e., you want sweep treated as
necessary, just not sufficient alone).

The video's own worked examples don't demonstrate a sweep happening inside the killzone window
immediately before the BOS — the liquidity context (e.g. "an obvious sell-side liquidity pool
resting below that old swing low") is established beforehand, off-screen relative to the 60-minute
clip being walked through.

**Resolution applied (not silent — flagging it here, and it's a toggle so you can change it):**
the SWEEP step stays in the state machine as you required, but its timing constraint is relaxed to
match what the video actually shows — a qualifying sweep is accepted **anytime within a configurable
lookback window before the BOS**, not only inside the 60-minute killzone itself. Default lookback:
120 bars. A toggle (`Require Sweep Inside Killzone`) is provided to force the stricter
sweep-must-be-inside-the-window reading if you'd rather keep your original instruction literally.

## 5. Displacement — [STATED, redefined vs. the earlier draft]

The video never gives a quantified displacement test (no ATR multiplier, no body-percentage
figure). What it actually uses as evidence of displacement is: **the BOS leg is the same leg that
produces a qualifying FVG.** The formation of the imbalance is itself treated as the proof of an
aggressive, displaced move — a slow grind through structure that leaves no gap isn't discussed as
displacement.

**[DECISION]**: FVG-on-the-BOS-leg is used as the primary, required displacement test (this is
now the video-grounded definition, replacing the earlier draft's own ATR/body-% invention as the
*primary* rule). The ATR-multiple / body-% check from the earlier draft is kept, but demoted to an
**optional additional quality filter** (on by default, adjustable, and separately scored) for
traders who want to require the impulse leg to also be objectively "strong," since the video
doesn't rule that out — it just doesn't require it explicitly.

## 6. Fair Value Gap — [STATED]

Standard 3-candle ICT imbalance. Body position matters, not just wicks: **"the wicks do the
damage, but the bodies tell you the narrative"** — stated explicitly, and echoed in the PM example
("the market shows the willingness to support this idea with the bodies staying inside that gap").
Coded as:
- Standard 3-candle gap detection (unchanged from the generic-source draft).
- A **"body respects zone"** quality-score criterion: are subsequent candle *bodies* (not just
  wicks) closing back inside/beyond the zone in the trade direction, rather than closing back
  through it. This is now sourced directly from the transcript rather than invented.
- FVG can be either the **entry** zone (Section 4) or a **target** (Section 3) — kept as two
  separate uses of the same detector, per the transcript's own dual usage.

## 7. Order Block — not mentioned in this transcript

The video doesn't reference Order Blocks at all — the entry mechanism described throughout is
specifically the FVG-based "optimal trade entry." **[DECISION]**: OB detection is kept in the
indicator (since your original instructions require it and it does no harm as an optional,
separately-toggleable entry zone type), but the default `Entry Zone` mode is **FVG only**, since
that's what the source material actually demonstrates in all three examples — `OB` and `Either`
remain available if you want to test them.

## 8. Session/day/week liquidity tracking

Sections 2–3 above cover this. Previous day H/L and previous session H/L were already planned;
**previous week H/L and NWOG are new additions** driven directly by the transcript.

## 9. What's still not objectively codable — [NOT CODABLE], stated by the speaker himself

- Choosing *which* draw on liquidity is "the" one to target when several are available
  (Section 3's caveat).
- "Reading where price is going next" as a general skill — described as more important than entry
  mechanics, but never reduced to a rule.
- Trading-practice advice (specialize in one market, expect losers, don't treat call-outs as
  signals) — not a chart rule, not implemented.

## Phase 2 — Deterministic state machine (revised)

```
STATE 0  No setup
   -> STATE 1 when: any enabled liquidity/draw source (Section 3) has a valid level

STATE 1  Liquidity/draw context identified
   -> STATE 2 when: a qualifying sweep (wick or close through a tracked level, then rejects
      back) occurs within the sweep lookback window (Section 4's resolved conflict: anytime in
      `Sweep Lookback` bars before a BOS, or strictly inside the killzone if
      `Require Sweep Inside Killzone` is enabled)

STATE 2  Liquidity swept
   -> STATE 3 when: a BOS confirms (opposite-side short-term swing broken, wick or close per
      `BOS Confirmation`), AND at least one enabled Silver Bullet window is currently active
   -> STATE 0 when: bars since sweep > Max Bars: Sweep->BOS  [INVALIDATED: no BOS]

STATE 3  BOS confirmed (inside an active killzone)
   -> STATE 4 when: the BOS leg produces a qualifying FVG (Section 5's video-grounded
      displacement test), and — if `Require Displacement Filter` is on — the leg also passes the
      optional ATR/body-% strength check
   -> STATE 0 when: BOS leg closes with no qualifying FVG  [INVALIDATED: no displacement/FVG]

STATE 4  Displacement + FVG (and/or OB, per Entry Zone setting) created
   -> STATE 5 when: a qualifying draw-on-liquidity target exists beyond the zone AND the
      distance from the zone to that target clears the minimum framework (Section 2)
   -> STATE 0 when: no target clears the minimum framework  [INVALIDATED: framework too small]

STATE 5  Target validated, zone armed
   -> STATE 6 when: price closes back outside the zone at least once (confirms it's live, not
      entered same-bar as formation)
   -> STATE 0 when: zone fully filled before a retracement confirms, OR bars since zone
      creation > Max Bars: Zone->Retracement, OR (if enabled) the active window closes

STATE 6  Price retraces toward the zone
   -> STATE 7 (ENTRY) when: price trades back into the zone's range
   -> STATE 0 on the same limits as STATE 5

STATE 7  Entry triggered
   -> STATE 8 when: stop or target subsequently hit

STATE 8  Target / stop reached -> reset to STATE 0
```

Only one setup tracked at a time (global), unchanged from the earlier draft — this is what stops
a sweep from one sequence pairing with an unrelated BOS. Opposite-side liquidity being swept while
a setup is pending does **not** invalidate it (per your explicit answer).
