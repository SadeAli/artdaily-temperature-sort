# Temperature Sort 🌡️

Order five swatches warm → cool: drag chips into place, or tap one then
another to swap (the keyboard/assistive path). Trains colour-temperature
judgement on the unambiguous orange→yellow→green→blue arc
(magenta/purple stay out — their temperature is context-dependent).
Swatches share lightness and chroma (OKLCH, gamut-fitted) so hue is the
only honest cue; hue gaps shrink from ~45° to ~16° across a round's 4 sets.

Scoring: Kendall's tau rescaled to 0–100 — (concordant − discordant
pairs) ÷ 10 pairs × 100, floored at 0, per set; round = mean of the 4
sets. Perfect = 100, one adjacent swap = 80 (each inversion costs 20),
reversed = 0. Tau rather than raw concordance because raw concordance
pays a shuffled row exactly 50/100 on average — a shrug scored as half
marks; under tau a shuffle averages ~16. After each set the true warmth
ranks and hue-arc positions are revealed on a warm→cool strip (the
numbers carry the split — accent sat at its true rank, graphite was
misplaced — and a correct swatch's tick is drawn heavier; the strip's
space is always reserved so buttons never shift).

Run: `python3 -m http.server 8080` in this folder, open `localhost:8080`.
Part of [Art Daily](https://artdaily.sadeali.com/) · [sadeali.com](https://sadeali.com/).

## What changed in the input-fairness pass

The drag threshold is eased per hardware and floored at 10px: at 6px an
ordinary trackpad tap crossed it, moved nothing, and then had its click
swallowed — so roughly every other tap silently did nothing. A gesture
that ends in the slot it started in is now treated as a tap. The score's
zero point sits below a shuffle rather than at it, so "half the pairs
right" reads 17 instead of 0; the tap-to-swap path has a visible line of
its own; and the warm→cool arc is shown unmarked before the first scored
set so the two words are anchored by something you can see.

## Input fairness

Scores are only ever compared against your own history, so the drill
eases its tolerances for the hardware in your hand and says which one it
eased for (the "scoring for…" chip in the HUD). A pen keeps the strict
reference; a mouse or trackpad, which pivots at the wrist and cannot
creep, gets roughly double the room; a finger sits between. Start and
grab zones move the other way — a screenless tablet needs the *biggest*
targets, because the hand is out of sight. Relative tolerances carry an
absolute pixel floor so a phone is never held to a stricter standard
than a desktop for the same drill.

