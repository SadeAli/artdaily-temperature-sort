# Temperature Sort 🌡️

Order five swatches warm → cool. Trains colour-temperature judgement on
the unambiguous orange→yellow→green→blue arc (magenta/purple stay out —
their temperature is context-dependent). Swatches share lightness and
chroma (OKLCH, gamut-fitted) so hue is the only honest cue; hue gaps
shrink from ~45° to ~16° across a round's 4 sets.

Scoring: Kendall pair concordance — pairs in warm→cool order ÷ 10 total
pairs × 100 per set; round = mean of the 4 sets. After each set the true
warmth ranks and hue-arc positions are revealed on a warm→cool strip.

Run: `python3 -m http.server 8080` in this folder, open `localhost:8080`.
Part of [Art Daily](https://artdaily.sadeali.com/) · [sadeali.com](https://sadeali.com/).
