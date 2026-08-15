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
