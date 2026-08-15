/* ============================================================
   game.js — Temperature Sort. Five swatches at matched lightness
   and chroma, hues sampled inside the unambiguous warm→cool arc
   (orange-red through yellow/green to blue — never magenta or
   purple, whose temperature depends on context). Tap two chips to
   swap until the row runs warm→cool, then "done sorting". Score
   is Kendall pair concordance; a round is the mean of 4 sets.
   DOM-based drill — the board replaces the template canvas.
   ============================================================ */
(function () {
  'use strict';

  var SLUG = 'temperature-sort';
  var SETS_PER_ROUND = 4;
  var CHIPS_PER_SET = 5;

  /* The warmth arc in "paint wheel" degrees: 20 (warmest orange-red)
     to 235 (coolest blue). Rendered through OKLCH (hue 40..262) so
     lightness and chroma stay perceptually even across hues. */
  var ARC_WARM = 20, ARC_COOL = 235;
  var OK_WARM = 40, OK_COOL = 262;

  /* ============ pure scoring — inputs in, 0–100 out ============ */

  /* Position along the warm→cool arc: 0 = warmest, 1 = coolest. */
  function warmthKey(hue) {
    return (hue - ARC_WARM) / (ARC_COOL - ARC_WARM);
  }

  /* Kendall concordance: of all chip pairs in the player's order,
     the fraction already running warm→cool. 5 chips = 10 pairs, so
     each correct pair is worth 10; reversed row = 0, one adjacent
     swap = 90, perfect = 100. */
  function kendallScore(keysInOrder) {
    var n = keysInOrder.length, total = 0, good = 0, i, j;
    for (i = 0; i < n; i++) {
      for (j = i + 1; j < n; j++) {
        total += 1;
        if (keysInOrder[i] < keysInOrder[j]) good += 1;
      }
    }
    return total === 0 ? 0 : (good / total) * 100;
  }

  /* Round score = mean of the set scores. */
  function roundScore(setScores) {
    var sum = 0, i;
    for (i = 0; i < setScores.length; i++) sum += setScores[i];
    return setScores.length === 0 ? 0 : sum / setScores.length;
  }

  /* 1-based warmth ranks (1 = warmest) for keys in display order. */
  function warmthRanks(keys) {
    var ranks = [], i, j, r;
    for (i = 0; i < keys.length; i++) {
      r = 1;
      for (j = 0; j < keys.length; j++) if (keys[j] < keys[i]) r += 1;
      ranks.push(r);
    }
    return ranks;
  }

  /* ============ pure colour math — OKLCH → sRGB ============ */

  function arcToOkHue(hue) {
    return OK_WARM + warmthKey(hue) * (OK_COOL - OK_WARM);
  }

  function oklchToRgbLin(L, C, Hdeg) {
    var h = Hdeg * Math.PI / 180;
    var a = C * Math.cos(h), b = C * Math.sin(h);
    var l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    var s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
  }

  function inGamut(rgb) {
    return rgb[0] >= -0.0005 && rgb[0] <= 1.0005 &&
           rgb[1] >= -0.0005 && rgb[1] <= 1.0005 &&
           rgb[2] >= -0.0005 && rgb[2] <= 1.0005;
  }

  /* Largest sRGB-representable chroma at (L, hue), capped. */
  function maxChroma(L, Hdeg, cap) {
    if (inGamut(oklchToRgbLin(L, cap, Hdeg))) return cap;
    var lo = 0, hi = cap, mid, i;
    for (i = 0; i < 24; i++) {
      mid = (lo + hi) / 2;
      if (inGamut(oklchToRgbLin(L, mid, Hdeg))) lo = mid; else hi = mid;
    }
    return lo;
  }

  function gammaEnc(c) {
    c = Math.min(1, Math.max(0, c));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  }

  function oklchCss(L, C, Hdeg) {
    var rgb = oklchToRgbLin(L, C, Hdeg);
    return 'rgb(' + Math.round(gammaEnc(rgb[0]) * 255) + ',' +
                    Math.round(gammaEnc(rgb[1]) * 255) + ',' +
                    Math.round(gammaEnc(rgb[2]) * 255) + ')';
  }

  /* ============ set generation ============ */

  /* Ramp within the round: hue gaps shrink ~45° → ~16° and chroma
     drops, so late sets are near-neighbour hues at murkier paint. */
  var GAP_BY_SET = [45, 34, 24, 16];
  var CHROMA_BY_SET = [0.12, 0.105, 0.09, 0.072];

  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

  function shuffled(n) {
    var a = [], i, j, t;
    for (i = 0; i < n; i++) a.push(i);
    for (i = n - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function makeSet(setIdx) {
    var gaps = [], span = 0, hues, chips = [], i, chroma, order, keys;
    for (i = 0; i < CHIPS_PER_SET - 1; i++) {
      gaps.push(GAP_BY_SET[setIdx] * rand(0.8, 1.2));
      span += gaps[i];
    }
    /* jittered gaps can (rarely) outgrow the arc — scale them back so
       every hue stays inside [ARC_WARM, ARC_COOL] */
    if (span > ARC_COOL - ARC_WARM) {
      for (i = 0; i < gaps.length; i++) gaps[i] *= (ARC_COOL - ARC_WARM) / span;
      span = ARC_COOL - ARC_WARM;
    }
    hues = [rand(ARC_WARM, ARC_COOL - span)];
    for (i = 0; i < gaps.length; i++) hues.push(hues[i] + gaps[i]);

    var Lbase = rand(0.66, 0.7);
    for (i = 0; i < CHIPS_PER_SET; i++) {
      chips.push({ hue: hues[i], key: warmthKey(hues[i]), L: Lbase + rand(-0.02, 0.02) });
    }
    /* one shared chroma per set (the most every hue can reach) so
       saturation can never be the sorting cue */
    chroma = CHROMA_BY_SET[setIdx];
    for (i = 0; i < chips.length; i++) {
      chroma = Math.min(chroma, maxChroma(chips[i].L, arcToOkHue(chips[i].hue), chroma));
    }
    for (i = 0; i < chips.length; i++) {
      chips[i].css = oklchCss(chips[i].L, chroma, arcToOkHue(chips[i].hue));
    }

    do {
      order = shuffled(CHIPS_PER_SET);
      keys = [];
      for (i = 0; i < order.length; i++) keys.push(chips[order[i]].key);
    } while (kendallScore(keys) === 100); /* never deal a pre-sorted row */

    return { chips: chips, order: order, chroma: chroma, Lbase: Lbase };
  }

  /* ============ DOM + state ============ */

  var chipsRow = document.getElementById('tsChips');
  var stripWrap = document.getElementById('tsStripWrap');
  var strip = document.getElementById('tsStrip');
  var btnDone = document.getElementById('btnDone');
  var hint = document.getElementById('hint');
  var toast = document.getElementById('toast');
  var hudRound = document.getElementById('hudRound');
  var hudScore = document.getElementById('hudScore');
  var hudBest = document.getElementById('hudBest');

  ArtDaily.init({ slug: SLUG });

  var round = 0, setIdx = 0, setScores = [], current = null;
  var selected = -1; /* selected position in the row, -1 = none */
  var phase = 'sort'; /* 'sort' | 'reveal' | 'done' */
  var chipEls = [];

  function sortHint() {
    hint.textContent = 'set ' + (setIdx + 1) + ' of ' + SETS_PER_ROUND +
      ' — tap two chips to swap them. warm on the left, cool on the right.';
  }

  function revealHint(sc) {
    var msg = sc === 100 ? 'every pair in order.' :
              sc >= 90 ? 'one pair flipped.' :
              sc >= 70 ? 'close — check the neighbours.' :
              'the strip shows where each hue really sits.';
    hint.textContent = 'set ' + (setIdx + 1) + ': ' + sc + ' / 100 — ' + msg;
  }

  function buildChips() {
    var i;
    chipsRow.innerHTML = '';
    chipEls = [];
    for (i = 0; i < CHIPS_PER_SET; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ts-chip';
      (function (pos, el) {
        el.addEventListener('click', function () { onChipTap(pos); });
      })(i, b);
      chipsRow.appendChild(b);
      chipEls.push(b);
    }
  }

  /* Repaint the row (and reveal annotations) from current state.
     Chip buttons persist across swaps so keyboard focus survives. */
  function render() {
    if (!current) return;
    var keys = [], i;
    for (i = 0; i < current.order.length; i++) keys.push(current.chips[current.order[i]].key);
    var ranks = warmthRanks(keys);
    for (i = 0; i < chipEls.length; i++) {
      var el = chipEls[i];
      el.style.background = current.chips[current.order[i]].css;
      el.classList.toggle('is-selected', phase === 'sort' && selected === i);
      el.setAttribute('aria-pressed', String(phase === 'sort' && selected === i));
      el.disabled = phase !== 'sort';
      el.innerHTML = '';
      if (phase === 'sort') {
        el.setAttribute('aria-label', 'swatch ' + (i + 1) + ' of ' + CHIPS_PER_SET);
      } else {
        el.setAttribute('aria-label', 'swatch ' + (i + 1) + ', warmth rank ' + ranks[i] +
          (ranks[i] === i + 1 ? ', correct' : ''));
        var pill = document.createElement('span');
        pill.className = 'ts-rank' + (ranks[i] === i + 1 ? ' is-ok' : '');
        pill.textContent = String(ranks[i]);
        el.appendChild(pill);
      }
    }
    renderStrip(keys, ranks);
  }

  /* The reveal strip: the whole warm→cool arc at this set's paint
     mix, with each chip's true position ticked and rank-numbered. */
  function renderStrip(keys, ranks) {
    if (phase !== 'reveal') { stripWrap.hidden = true; return; }
    var stops = [], i, t;
    for (i = 0; i <= 10; i++) {
      t = i / 10;
      stops.push(oklchCss(current.Lbase, current.chroma,
        OK_WARM + t * (OK_COOL - OK_WARM)) + ' ' + (t * 100) + '%');
    }
    strip.style.background = 'linear-gradient(90deg,' + stops.join(',') + ')';
    strip.innerHTML = '';
    for (i = 0; i < keys.length; i++) {
      var mark = document.createElement('span');
      mark.className = 'ts-mark';
      mark.style.left = (keys[i] * 100) + '%';
      mark.textContent = String(ranks[i]);
      strip.appendChild(mark);
    }
    stripWrap.hidden = false;
  }

  function onChipTap(pos) {
    if (phase !== 'sort') return;
    if (selected === -1) {
      selected = pos;
    } else if (selected === pos) {
      selected = -1; /* same chip again = deselect */
    } else {
      var t = current.order[selected];
      current.order[selected] = current.order[pos];
      current.order[pos] = t;
      selected = -1;
    }
    render();
  }

  function startSet() {
    current = makeSet(setIdx);
    selected = -1;
    phase = 'sort';
    btnDone.textContent = 'done sorting';
    btnDone.disabled = false;
    buildChips();
    sortHint();
    render();
  }

  function newRound() {
    round += 1;
    setIdx = 0;
    setScores = [];
    hudRound.textContent = String(round);
    hudScore.textContent = '–';
    startSet();
  }

  function onDone() {
    var keys, i, sc;
    if (phase === 'sort') {
      keys = [];
      for (i = 0; i < current.order.length; i++) keys.push(current.chips[current.order[i]].key);
      sc = Math.round(kendallScore(keys));
      setScores.push(sc);
      phase = 'reveal';
      btnDone.textContent = setIdx < SETS_PER_ROUND - 1 ? 'next set →' : 'finish round';
      revealHint(sc);
      render();
      return;
    }
    if (phase === 'reveal') {
      if (setIdx < SETS_PER_ROUND - 1) {
        setIdx += 1;
        startSet();
      } else {
        finishRound();
      }
    }
  }

  function finishRound() {
    phase = 'done';
    btnDone.disabled = true;
    stripWrap.hidden = true;
    var res = ArtDaily.report(roundScore(setScores));
    hudScore.textContent = String(res.score);
    hudBest.textContent = res.best === null ? '–' : String(res.best);
    hint.textContent = 'round done (' + setScores.join(' · ') + ') — press “new round” to go again.';
    showToast((res.isNewBest ? 'new best! ' : 'score ') + res.score + ' / 100', res.isNewBest);
  }

  var toastTimer = null;
  function showToast(msg, celebrate) {
    toast.innerHTML = '';
    var s = document.createElement('span');
    s.className = celebrate ? 'toast-accent' : '';
    s.textContent = msg;
    toast.appendChild(s);
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 2200);
  }

  /* ---- chrome wiring ---- */
  btnDone.addEventListener('click', onDone);
  document.getElementById('btnRound').addEventListener('click', newRound);

  var btnHow = document.getElementById('btnHow');
  var howTo = document.getElementById('howTo');
  btnHow.addEventListener('click', function () {
    howTo.hidden = !howTo.hidden;
    btnHow.setAttribute('aria-expanded', String(!howTo.hidden));
  });

  /* Swatch colours are data (absolute), all chrome uses CSS vars —
     a re-render on theme flip keeps annotation contrast honest. */
  ArtDaily.onTheme(render);

  /* ---- boot ---- */
  var best = ArtDaily.best();
  hudBest.textContent = best === null ? '–' : String(best);
  newRound();
})();
