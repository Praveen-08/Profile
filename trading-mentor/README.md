# Trading Mentor

A working repo for developing your own trading edge: write a strategy, backtest it on
TradingView, log the results, refine it, and repeat until the numbers hold up.

Pine Script only runs and backtests inside TradingView (there's no way to execute it
outside their platform), so the loop below is built around TradingView's Pine Editor +
Strategy Tester, with this repo as your version history and results journal.

## The loop

1. **Hypothesis.** Write down, in one sentence, what edge you think exists (e.g. "EMA20
   crossing EMA50 on 1H BTCUSDT tends to run further than it retraces").
2. **Code it.** Open `strategies/rr-backtester.pine` in TradingView's Pine Editor. Swap
   the `ENTRY SIGNAL` block for your hypothesis's logic — leave everything else
   (position sizing, stop/target by R multiple, stats table) alone. It already computes,
   on every run:
   - **Win rate** — % of closed trades that were winners.
   - **Realized R:R** — average win size ÷ average loss size, in practice.
   - **Breakeven R:R** — the R:R your *current* win rate needs just to break even
     (`(1 − winrate) / winrate`). If your realized R:R is below this, the strategy is a
     net loser even though it might "feel" like it wins a lot.
   - **Expectancy (in R)** — expected profit per trade, in units of risk, using your
     *target* R:R input and the *actual* win rate.
   - **Profit factor**, **net profit**, **closed trade count**.
3. **Backtest.** Add the script to a chart, open the Strategy Tester panel. Test on
   enough history/trades that the numbers are meaningful (a rule of thumb: don't trust
   anything under ~30 closed trades).
4. **Sweep the R:R.** This is how you find your *ideal* R:R, not just a win rate: rerun
   with the `Target R:R` input at a few values (1.0, 1.5, 2.0, 2.5, 3.0...). Win rate
   will drop as target R:R rises — that's expected. What you're looking for is the value
   that maximizes **Expectancy** and **Profit Factor**, not the one with the highest win
   rate. On a paid TradingView plan you can right-click the input in the Strategy
   Tester's Settings tab and use "Optimize" to sweep a range automatically instead of
   doing it by hand.
5. **Log it.** Record every meaningful run in [`journal/results-log.md`](journal/results-log.md)
   — parameters, win rate, realized R:R, expectancy, profit factor, net profit, and a
   one-line note on what you'd try next. This is what turns "I tried some stuff" into an
   actual record you can learn from.
6. **Refine.** Based on the log, adjust the entry filter, stop method, or target R:R, and
   go back to step 3. Keep the change that improved things; revert the one that didn't.
7. **Validate before risking money.** Once a version looks solid in backtest:
   out-of-sample test it on a date range / symbol you didn't tune on, then forward-test
   it on a paper account before trading it live. A strategy curve-fit to one backtest
   window is not an edge.

## Repo layout

```
trading-mentor/
  strategies/
    rr-backtester.pine   # the template — swap in your entry signal, keep everything else
  journal/
    results-log.md       # one row per backtest iteration
```

## Why R:R and win rate have to be read together

A strategy isn't "good" because its win rate is high, and it isn't "bad" because its
win rate is low. They only mean something together:

- Expectancy (in R) = `winrate × targetR − (1 − winrate)`
- A 40% win rate at 3R is worth **more** than a 70% win rate at 1R:
  `0.40×3 − 0.60 = 0.60R` vs `0.70×1 − 0.30 = 0.40R`.

The stats table's **Breakeven R:R** row tells you, at your current win rate, the minimum
R:R you need just to survive. Your **Realized R:R** row tells you what you're actually
getting. The gap between those two numbers — not the win rate alone — is your edge.
