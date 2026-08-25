# Backtest results log

One row per backtest run. Add a row every time you change something meaningful
(entry filter, stop method, target R:R, symbol, timeframe) so you can see what actually
moved the numbers instead of relying on memory.

Fill in `Breakeven R:R` and `Expectancy` straight from the on-chart stats table in
`strategies/rr-backtester.pine` — don't recompute by hand.

| Date | Symbol | Timeframe | Entry logic (short desc) | Stop method | Target R:R | Trades | Win rate | Realized R:R | Breakeven R:R | Expectancy (R) | Profit factor | Net profit | Notes / next change |
|------|--------|-----------|---------------------------|-------------|-----------|--------|----------|---------------|----------------|-----------------|----------------|------------|----------------------|
| 2026-08-25 | (e.g. BTCUSDT) | (e.g. 1H) | EMA20/EMA50 cross (starter template) | ATR x1.5 | 2.0 | — | — | — | — | — | — | — | Baseline run — fill in after first backtest |

## How to fill this in

- **Trades** — `strategy.closedtrades` from the table. Ignore results under ~30 trades;
  the win rate is noise until then.
- **Realized R:R vs Breakeven R:R** — if Realized ≥ Breakeven, the run was net
  profitable at that win rate; if Realized < Breakeven, it lost money even if the win
  rate looked decent.
- **Expectancy (R)** — positive and consistent across nearby R:R values (not just one
  lucky setting) is a much stronger signal than a single high number.
- **Notes / next change** — always end with a concrete next step: "raise target R:R to
  2.5", "add a trend filter", "test on ETHUSDT to check it's not symbol-specific", etc.
  This is what keeps the loop moving instead of stalling.
