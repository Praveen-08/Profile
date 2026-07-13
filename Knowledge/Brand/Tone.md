# Tone

Drawn from actual site copy (`index.html`, `services.html`, `listing-launch-os` prompt system).

## PK Visuals brand voice
- Confident, premium, understated — short declarative sentences ("Visuals that help agents win
  listings, attract buyers, and sell faster.")
- Outcome-first, not equipment-first: leads with what the agent/vendor gets (faster sale,
  stronger buyer attention), not camera specs.
- No hype punctuation, no exclamation marks in headline copy.

## NZ real estate compliance voice (from `listing-launch-os/lib/prompts/system.ts`)
This is the most precisely specified tone rule in the whole codebase — apply it to any
agent-facing or vendor-facing copy generator:
- NZ English spelling
- No invented facts about the property
- No unsupported superlatives
- No guaranteed investment/return claims
- "Approximately" for any measurement that isn't exact
- Respect each agent's personal "words to avoid" list
- SafeCheck compliance review before anything ships

## Working rule
Marketing-facing copy (PK Visuals site, Instagram, reels) = luxury/editorial, gold-on-black,
serif headlines. Agent/vendor-facing generated copy (Listing Launch outputs) = compliant,
factual, NZ real estate industry-safe, no invented claims — luxury tone but never at the cost of
accuracy.
