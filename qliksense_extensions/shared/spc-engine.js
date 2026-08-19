/**
 * spc-engine.js
 * =============
 * NHS Making Data Count (MDC) Statistical Process Control calculations for
 * Qlik Sense (client-managed / on-premise) extensions.
 *
 * This is a faithful JavaScript port of the Python `abspc` package
 * (`abspc/spc.py`) so that Qlik charts, the Python package and the Looker
 * visuals all produce identical control limits and special-cause flags.
 *
 * Supported chart types: XmR (alias "i"), p, u, c, t, g, run.
 *
 * The module is written as a UMD wrapper so it can be loaded by RequireJS
 * inside Qlik Sense (`define(["./lib/spc-engine"], ...)`) and by Node.js for
 * the unit tests. It has no external dependencies.
 */
(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NhsMdcSpcEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // -------------------------------------------------------------------------
  // NHS colour constants (aligned with abspc/spc.py)
  // -------------------------------------------------------------------------
  var NHS_COLOURS = {
    BLUE: '#005EB8',
    DARK_BLUE: '#003087',
    ORANGE: '#ED8B00',
    GREY: '#768692',
    WARM_YELLOW: '#FFB81C',
    LIGHT_BLUE: '#41B6E6',
    PALE_GREY: '#E8EDEE'
  };

  var POINT_COLOURS = {
    COMMON_CAUSE: NHS_COLOURS.GREY,
    IMPROVEMENT: NHS_COLOURS.BLUE,
    CONCERN: NHS_COLOURS.ORANGE
  };

  // Minimum number of data points recommended for reliable SPC analysis
  var SPC_MIN_DATA_POINTS = 15;

  var SUPPORTED_CHART_TYPES = ['xmr', 'p', 'pprime', 'u', 'uprime', 'c', 't', 'g', 'run'];

  // Spellings a user might reasonably type into a Qlik expression
  var CHART_TYPE_ALIASES = {
    i: 'xmr',
    "p'": 'pprime',
    'p-prime': 'pprime',
    'p_prime': 'pprime',
    "u'": 'uprime',
    'u-prime': 'uprime',
    'u_prime': 'uprime'
  };

  // Charts whose limits are derived from a denominator per data point
  var DENOMINATOR_CHART_TYPES = ['p', 'pprime', 'u', 'uprime'];

  // XmR / t chart constants: 3 / d2 with d2 = 1.128 (subgroup size of 2)
  var D2 = 1.128;
  var SIGMA_MULTIPLIER = 3.0 / D2;                    // ~2.66
  var WARN_MULTIPLIER = 2.0 * SIGMA_MULTIPLIER / 3.0; // ~1.77
  var T_CHART_POWER = 3.6;                            // Nelson transformation

  // -------------------------------------------------------------------------
  // Small numeric helpers (NaN tolerant, mirroring numpy's nan* functions)
  // -------------------------------------------------------------------------

  function isNum(v) {
    return typeof v === 'number' && isFinite(v);
  }

  function validValues(values) {
    var out = [];
    for (var i = 0; i < values.length; i++) {
      if (isNum(values[i])) { out.push(values[i]); }
    }
    return out;
  }

  function nanMean(values) {
    var valid = validValues(values);
    if (!valid.length) { return NaN; }
    var sum = 0;
    for (var i = 0; i < valid.length; i++) { sum += valid[i]; }
    return sum / valid.length;
  }

  function nanSum(values) {
    var valid = validValues(values);
    var sum = 0;
    for (var i = 0; i < valid.length; i++) { sum += valid[i]; }
    return sum;
  }

  function nanMedian(values) {
    var valid = validValues(values).sort(function (a, b) { return a - b; });
    if (!valid.length) { return NaN; }
    var mid = Math.floor(valid.length / 2);
    return valid.length % 2 === 0 ? (valid[mid - 1] + valid[mid]) / 2 : valid[mid];
  }

  function movingRanges(values) {
    var out = [];
    for (var i = 1; i < values.length; i++) {
      out.push(Math.abs(values[i] - values[i - 1]));
    }
    return out;
  }

  function filled(length, value) {
    var out = new Array(length);
    for (var i = 0; i < length; i++) { out[i] = value; }
    return out;
  }

  function normaliseChartType(chartType) {
    var key = (chartType === null || chartType === undefined ? '' : chartType)
      .toString().trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(CHART_TYPE_ALIASES, key)) {
      key = CHART_TYPE_ALIASES[key];
    }
    if (SUPPORTED_CHART_TYPES.indexOf(key) === -1) {
      throw new Error(
        "Unsupported chartType '" + chartType + "'. Must be one of: " +
        SUPPORTED_CHART_TYPES.join(', ')
      );
    }
    return key;
  }

  function clipLower(values, minimum) {
    return values.map(function (v) {
      return isNum(v) ? Math.max(v, minimum) : v;
    });
  }

  // -------------------------------------------------------------------------
  // Chart-specific limit calculations
  // -------------------------------------------------------------------------

  function calcXmr(values) {
    var meanVal = nanMean(values);
    var meanMr = nanMean(movingRanges(values));
    if (!isNum(meanMr)) { meanMr = 0; }
    var n = values.length;
    return {
      values: values.slice(),
      mean: filled(n, meanVal),
      ucl: filled(n, meanVal + SIGMA_MULTIPLIER * meanMr),
      lcl: filled(n, meanVal - SIGMA_MULTIPLIER * meanMr),
      uwl: filled(n, meanVal + WARN_MULTIPLIER * meanMr),
      lwl: filled(n, meanVal - WARN_MULTIPLIER * meanMr)
    };
  }

  /**
   * Centre line and per-point binomial sigma for p / p-prime charts. `values`
   * may already be proportions, or raw numerator counts (auto-detected exactly
   * as in Python: any value > 1 implies counts).
   */
  function proportionStats(values, subgroupSizes) {
    var proportions;
    var pBar;
    var isCount = values.some(function (v) { return isNum(v) && v > 1.0; });

    if (isCount) {
      proportions = values.map(function (v, i) { return v / subgroupSizes[i]; });
      pBar = nanSum(values) / nanSum(subgroupSizes);
    } else {
      proportions = values.slice();
      pBar = nanSum(values.map(function (v, i) { return v * subgroupSizes[i]; })) /
        nanSum(subgroupSizes);
    }

    return {
      series: proportions,
      centre: pBar,
      sigma: subgroupSizes.map(function (size) {
        return Math.sqrt(pBar * (1 - pBar) / size);
      })
    };
  }

  /**
   * Centre line and per-point Poisson sigma for u / u-prime charts. `values`
   * may be per-unit rates, or raw counts (auto-detected as whole numbers,
   * mirroring the Python integer-dtype check).
   */
  function rateStats(values, subgroupSizes) {
    var isCount = validValues(values).every(function (v) { return v % 1 === 0; });
    var rates, uBar;

    if (isCount) {
      rates = values.map(function (v, i) { return v / subgroupSizes[i]; });
      uBar = nanSum(values) / nanSum(subgroupSizes);
    } else {
      rates = values.slice();
      uBar = nanSum(values.map(function (v, i) { return v * subgroupSizes[i]; })) /
        nanSum(subgroupSizes);
    }

    return {
      series: rates,
      centre: uBar,
      sigma: subgroupSizes.map(function (size) { return Math.sqrt(uBar / size); })
    };
  }

  /**
   * Laney's sigma(z): how far the observed point-to-point variation exceeds
   * what the binomial / Poisson model alone predicts. Returns 1 when the data
   * matches the model, so a p-prime chart collapses back to a plain p chart.
   */
  function laneySigmaZ(stats) {
    var z = stats.series.map(function (v, i) {
      return isNum(v) && stats.sigma[i] > 0 ? (v - stats.centre) / stats.sigma[i] : NaN;
    });
    var meanMr = nanMean(movingRanges(z));
    return isNum(meanMr) && meanMr > 0 ? meanMr / D2 : 1.0;
  }

  function attributeLimits(stats, sigmaZ) {
    var n = stats.series.length;
    var ucl = [], lcl = [], uwl = [], lwl = [];
    for (var i = 0; i < n; i++) {
      var sigmaI = stats.sigma[i] * sigmaZ;
      ucl.push(stats.centre + 3 * sigmaI);
      lcl.push(stats.centre - 3 * sigmaI);
      uwl.push(stats.centre + 2 * sigmaI);
      lwl.push(stats.centre - 2 * sigmaI);
    }
    return {
      values: stats.series,
      mean: filled(n, stats.centre),
      ucl: ucl,
      lcl: lcl,
      uwl: uwl,
      lwl: lwl
    };
  }

  function calcP(values, subgroupSizes) {
    return attributeLimits(proportionStats(values, subgroupSizes), 1.0);
  }

  function calcU(values, subgroupSizes) {
    return attributeLimits(rateStats(values, subgroupSizes), 1.0);
  }

  function calcPPrime(values, subgroupSizes) {
    var stats = proportionStats(values, subgroupSizes);
    return attributeLimits(stats, laneySigmaZ(stats));
  }

  function calcUPrime(values, subgroupSizes) {
    var stats = rateStats(values, subgroupSizes);
    return attributeLimits(stats, laneySigmaZ(stats));
  }

  function calcC(values) {
    var cBar = nanMean(values);
    var sigma = Math.sqrt(cBar);
    var n = values.length;
    return {
      values: values.slice(),
      mean: filled(n, cBar),
      ucl: filled(n, cBar + 3 * sigma),
      lcl: filled(n, cBar - 3 * sigma),
      uwl: filled(n, cBar + 2 * sigma),
      lwl: filled(n, cBar - 2 * sigma)
    };
  }

  function calcT(values) {
    if (values.some(function (v) { return isNum(v) && v < 0; })) {
      throw new Error('t-chart values represent times between events and must be >= 0');
    }
    var transformed = values.map(function (v) {
      return isNum(v) ? Math.pow(v, 1.0 / T_CHART_POWER) : NaN;
    });
    var meanT = nanMean(transformed);
    var mrs = movingRanges(transformed);
    var meanMr = mrs.length ? nanMean(mrs) : 0.0;
    if (!isNum(meanMr)) { meanMr = 0; }

    function back(x) {
      if (!isNum(x)) { return NaN; }
      return x > 0 ? Math.pow(x, T_CHART_POWER) : 0.0;
    }

    var n = values.length;
    return {
      values: values.slice(),
      mean: filled(n, back(meanT)),
      ucl: filled(n, back(meanT + SIGMA_MULTIPLIER * meanMr)),
      lcl: filled(n, back(meanT - SIGMA_MULTIPLIER * meanMr)),
      uwl: filled(n, back(meanT + WARN_MULTIPLIER * meanMr)),
      lwl: filled(n, back(meanT - WARN_MULTIPLIER * meanMr))
    };
  }

  function calcG(values) {
    if (values.some(function (v) { return isNum(v) && v < 0; })) {
      throw new Error(
        'g-chart values are non-negative counts of opportunities between rare events'
      );
    }
    var gBar = nanMean(values);
    var sigma = Math.sqrt(gBar * (gBar + 1.0));
    var n = values.length;
    return {
      values: values.slice(),
      mean: filled(n, gBar),
      ucl: filled(n, gBar + 3 * sigma),
      lcl: filled(n, Math.max(gBar - 3 * sigma, 0.0)),
      uwl: filled(n, gBar + 2 * sigma),
      lwl: filled(n, Math.max(gBar - 2 * sigma, 0.0))
    };
  }

  function calcRun(values) {
    return {
      values: values.slice(),
      mean: filled(values.length, nanMedian(values))
    };
  }

  /**
   * Calculate the centre line and 3-sigma / 2-sigma limits for a series.
   *
   * @param {number[]} values Measured values.
   * @param {string} chartType One of xmr|i|p|pprime|u|uprime|c|t|g|run.
   * @param {Object} [options] `subgroupSizes` (array, required for p/u and
   *   their Laney p'/u' variants).
   * @returns {Object} `{values, mean, ucl, lcl, uwl, lwl}` — limit arrays are
   *   omitted for run charts. `values` may be rescaled (p/u charts).
   */
  function calculateControlLimits(values, chartType, options) {
    var opts = options || {};
    var key = normaliseChartType(chartType);

    if (!values || !values.length) {
      throw new Error('No values supplied for SPC calculation');
    }

    var subgroupSizes = opts.subgroupSizes;
    if (DENOMINATOR_CHART_TYPES.indexOf(key) !== -1) {
      if (!subgroupSizes || subgroupSizes.length !== values.length) {
        throw new Error(
          "Chart type '" + key + "' requires a denominator (subgroup size) " +
          'for every data point'
        );
      }
      for (var i = 0; i < subgroupSizes.length; i++) {
        if (!isNum(subgroupSizes[i]) || subgroupSizes[i] <= 0) {
          throw new Error('All denominator (subgroup size) values must be > 0');
        }
      }
    }

    var result;
    if (key === 'xmr') { result = calcXmr(values); }
    else if (key === 'p') { result = calcP(values, subgroupSizes); }
    else if (key === 'pprime') { result = calcPPrime(values, subgroupSizes); }
    else if (key === 'u') { result = calcU(values, subgroupSizes); }
    else if (key === 'uprime') { result = calcUPrime(values, subgroupSizes); }
    else if (key === 'c') { result = calcC(values); }
    else if (key === 't') { result = calcT(values); }
    else if (key === 'g') { result = calcG(values); }
    else { result = calcRun(values); }

    // Counts / proportions cannot go below zero
    if (['p', 'pprime', 'u', 'uprime', 'c', 't', 'g'].indexOf(key) !== -1) {
      result.lcl = clipLower(result.lcl, 0);
      result.lwl = clipLower(result.lwl, 0);
    }

    result.chartType = key;
    return result;
  }

  // -------------------------------------------------------------------------
  // Special-cause rules
  // -------------------------------------------------------------------------

  function rule1Astronomical(values, ucl, lcl) {
    return values.map(function (v, i) {
      return v > ucl[i] || v < lcl[i];
    });
  }

  function rule2Shift(values, centre, runLength) {
    var n = values.length;
    var len = runLength || 8;
    var flags = filled(n, false);
    for (var start = 0; start <= n - len; start++) {
      var allAbove = true;
      var allBelow = true;
      for (var j = start; j < start + len; j++) {
        if (!(values[j] > centre[j])) { allAbove = false; }
        if (!(values[j] < centre[j])) { allBelow = false; }
      }
      if (allAbove || allBelow) {
        for (var k = start; k < start + len; k++) { flags[k] = true; }
      }
    }
    return flags;
  }

  function rule3Trend(values, runLength) {
    var n = values.length;
    var len = runLength || 6;
    var flags = filled(n, false);
    for (var start = 0; start <= n - len; start++) {
      var increasing = true;
      var decreasing = true;
      for (var j = start + 1; j < start + len; j++) {
        if (!(values[j] > values[j - 1])) { increasing = false; }
        if (!(values[j] < values[j - 1])) { decreasing = false; }
      }
      if (increasing || decreasing) {
        for (var k = start; k < start + len; k++) { flags[k] = true; }
      }
    }
    return flags;
  }

  function rule4TwoInThree(values, centre, ucl, lcl, uwl, lwl) {
    var n = values.length;
    var flags = filled(n, false);
    var close = new Array(n);
    var rtm = new Array(n);

    for (var i = 0; i < n; i++) {
      var outside = values[i] > ucl[i] || values[i] < lcl[i];
      close[i] = !outside && (values[i] > uwl[i] || values[i] < lwl[i]);
      rtm[i] = values[i] > centre[i] ? 1 : (values[i] < centre[i] ? -1 : 0);
    }

    for (var p = 0; p < n; p++) {
      if (!close[p]) { continue; }
      var starts = [p - 2, p - 1, p];
      for (var s = 0; s < starts.length; s++) {
        var ws = starts[s];
        var we = ws + 3;
        if (ws < 0 || we > n) { continue; }
        var closeCount = 0;
        var rtmSum = 0;
        for (var j = ws; j < we; j++) {
          if (close[j]) { closeCount++; }
          rtmSum += rtm[j];
        }
        if (closeCount >= 2 && Math.abs(rtmSum) === 3) {
          flags[p] = true;
          break;
        }
      }
    }
    return flags;
  }

  /**
   * Apply NHS MDC rules 1-4 to a calculated series.
   * @returns {Object} `{rule1, rule2, rule3, rule4, specialCause}` boolean arrays.
   */
  function detectSpecialCauses(result) {
    var values = result.values;
    var rule1 = rule1Astronomical(values, result.ucl, result.lcl);
    var rule2 = rule2Shift(values, result.mean, 8);
    var rule3 = rule3Trend(values, 6);
    var hasWarnings = !!(result.uwl && result.lwl);
    var rule4 = hasWarnings
      ? rule4TwoInThree(values, result.mean, result.ucl, result.lcl, result.uwl, result.lwl)
      : filled(values.length, false);

    return {
      rule1: rule1,
      rule2: rule2,
      rule3: rule3,
      rule4: rule4,
      specialCause: values.map(function (v, i) {
        return rule1[i] || rule2[i] || rule3[i] || rule4[i];
      })
    };
  }

  /**
   * Run-chart signals: shift (8+ points one side of the median) and
   * trend (6+ consecutive rises or falls).
   */
  function detectRunChartSignals(result) {
    var values = result.values;
    var runShift = rule2Shift(values, result.mean, 8);
    var runTrend = rule3Trend(values, 6);
    var signal = values.map(function (v, i) { return runShift[i] || runTrend[i]; });
    return {
      runShift: runShift,
      runTrend: runTrend,
      runSignal: signal,
      // Aliased so callers can colour run charts like SPC charts
      rule1: filled(values.length, false),
      rule2: runShift,
      rule3: runTrend,
      rule4: filled(values.length, false),
      specialCause: signal
    };
  }

  // -------------------------------------------------------------------------
  // Point colouring
  // -------------------------------------------------------------------------

  function isHighSignal(value, mean, ucl, isRule1, isRule2, isRule3, allValues, idx) {
    if (isRule1) { return value > ucl; }
    // Rule 3 (trend): direction comes from the slope, not the side of the mean
    if (isRule3 && !isRule2) {
      if (idx > 0) { return allValues[idx] > allValues[idx - 1]; }
      if (idx < allValues.length - 1) { return allValues[idx + 1] > allValues[idx]; }
    }
    return value > mean;
  }

  /**
   * Determine the NHS MDC colour for every data point.
   * Mirrors `determine_point_colours` in abspc/spc.py.
   */
  function determinePointColours(result, signals, improvementDirection, target) {
    var direction = improvementDirection === 'low' ? 'low' : 'high';
    var values = result.values;
    var mean = result.mean;
    var ucl = result.ucl || filled(values.length, Infinity);
    var hasTarget = isNum(target) || (Array.isArray(target) && target.length === values.length);
    var isDynamicTarget = Array.isArray(target);
    var colours = [];

    for (var i = 0; i < values.length; i++) {
      if (!signals.specialCause[i]) {
        colours.push(POINT_COLOURS.COMMON_CAUSE);
        continue;
      }

      var high = isHighSignal(
        values[i], mean[i], ucl[i],
        signals.rule1[i], signals.rule2[i], signals.rule3[i],
        values, i
      );

      var isImprovement;
      if (hasTarget) {
        var targetValue = isDynamicTarget ? target[i] : target;
        isImprovement = direction === 'high'
          ? (values[i] >= targetValue) || high
          : (values[i] <= targetValue) || !high;
      } else {
        isImprovement = direction === 'high' ? high : !high;
      }

      colours.push(isImprovement ? POINT_COLOURS.IMPROVEMENT : POINT_COLOURS.CONCERN);
    }

    return colours;
  }

  // -------------------------------------------------------------------------
  // Auto-rebasing
  // -------------------------------------------------------------------------

  function findShiftStart(values, mean, improvementDirection, runLength, rebaseOn, minStart) {
    var n = values.length;
    var improvementSide = [];
    var worseningSide = [];
    for (var i = 0; i < n; i++) {
      var high = values[i] > mean[i];
      var low = values[i] < mean[i];
      improvementSide.push(improvementDirection === 'high' ? high : low);
      worseningSide.push(improvementDirection === 'high' ? low : high);
    }

    var masks;
    if (rebaseOn === 'improvement') { masks = [improvementSide]; }
    else if (rebaseOn === 'worsening') { masks = [worseningSide]; }
    else { masks = [improvementSide, worseningSide]; }

    for (var start = Math.max(minStart || 0, 0); start <= n - runLength; start++) {
      for (var m = 0; m < masks.length; m++) {
        var all = true;
        for (var j = start; j < start + runLength; j++) {
          if (!masks[m][j]) { all = false; break; }
        }
        if (all) { return start; }
      }
    }
    return null;
  }

  function writePhase(target, source, from) {
    ['values', 'mean', 'ucl', 'lcl', 'uwl', 'lwl'].forEach(function (key) {
      if (!source[key] || !target[key]) { return; }
      for (var i = 0; i < source[key].length; i++) {
        target[key][from + i] = source[key][i];
      }
    });
  }

  /**
   * Recalculate control limits per phase when a sustained shift is detected.
   * Mirrors `rebase_control_limits` in abspc/spc.py.
   *
   * @param {number[]} values Measured values.
   * @param {string} chartType Any supported type except "run".
   * @param {Object} [options] `subgroupSizes`, `improvementDirection`,
   *   `minPhaseLength` (default 8), `rebaseOn` (improvement|worsening|any),
   *   `baseline` (default 15).
   */
  function rebaseControlLimits(values, chartType, options) {
    var opts = options || {};
    var key = normaliseChartType(chartType);
    if (key === 'run') {
      throw new Error('Auto-rebasing is not supported for run charts');
    }

    var direction = opts.improvementDirection === 'low' ? 'low' : 'high';
    var rebaseOn = opts.rebaseOn || 'improvement';
    if (['improvement', 'worsening', 'any'].indexOf(rebaseOn) === -1) {
      throw new Error("rebaseOn must be one of 'improvement', 'worsening', 'any'");
    }
    var minPhaseLength = isNum(opts.minPhaseLength) ? Math.round(opts.minPhaseLength) : 8;
    if (minPhaseLength < 2) {
      throw new Error('minPhaseLength must be at least 2');
    }
    var baseline = isNum(opts.baseline) ? Math.round(opts.baseline) : 15;
    if (baseline < 0) {
      throw new Error('baseline must be a non-negative integer');
    }

    var subgroupSizes = opts.subgroupSizes;
    function limitsFor(from, to) {
      return calculateControlLimits(values.slice(from, to), key, {
        subgroupSizes: subgroupSizes ? subgroupSizes.slice(from, to) : undefined
      });
    }

    var result = limitsFor(0, values.length);
    result.rebasePhase = filled(values.length, 0);

    var phase = 0;
    var phaseStart = 0;

    for (;;) {
      var relIdx = findShiftStart(
        result.values.slice(phaseStart),
        result.mean.slice(phaseStart),
        direction, minPhaseLength, rebaseOn, baseline
      );
      if (relIdx === null || relIdx === 0) { break; }

      var absRebase = phaseStart + relIdx;
      if (values.length - absRebase < minPhaseLength) { break; }

      // Recalculate the now-closed phase using only its own data
      if (absRebase - phaseStart >= 2) {
        writePhase(result, limitsFor(phaseStart, absRebase), phaseStart);
      }
      // Recalculate the new phase from the raw data
      writePhase(result, limitsFor(absRebase, values.length), absRebase);

      phase += 1;
      for (var i = absRebase; i < values.length; i++) {
        result.rebasePhase[i] = phase;
      }
      phaseStart = absRebase;
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Variation & assurance
  // -------------------------------------------------------------------------

  var VARIATION_LABELS = {
    common_cause: 'Common-cause variation',
    improvement_high: 'Special-cause variation \u2014 Improvement (high)',
    improvement_low: 'Special-cause variation \u2014 Improvement (low)',
    concern_high: 'Special-cause variation \u2014 Concern (high)',
    concern_low: 'Special-cause variation \u2014 Concern (low)'
  };

  var ASSURANCE_LABELS = {
    pass: 'Consistently passing the target',
    hit_or_miss: 'Hit or miss \u2014 may or may not meet the target',
    fail: 'Consistently failing the target',
    no_target: 'No target set'
  };

  /**
   * Classify the overall variation using the most recent special-cause point.
   */
  function determineVariationType(result, signals, improvementDirection) {
    var direction = improvementDirection === 'low' ? 'low' : 'high';
    if (!signals || !signals.specialCause) { return 'common_cause'; }

    var lastIdx = -1;
    for (var i = signals.specialCause.length - 1; i >= 0; i--) {
      if (signals.specialCause[i]) { lastIdx = i; break; }
    }
    if (lastIdx === -1) { return 'common_cause'; }

    var valueIsHigh = result.values[lastIdx] > result.mean[lastIdx];
    if (direction === 'high') {
      return valueIsHigh ? 'improvement_high' : 'concern_low';
    }
    return valueIsHigh ? 'concern_high' : 'improvement_low';
  }

  /**
   * Classify assurance against a target using the most recent phase limits.
   */
  function determineAssuranceType(result, target, improvementDirection) {
    // Handle dynamic target array by using the last value
    var targetValue = Array.isArray(target) && target.length > 0 
      ? target[target.length - 1] 
      : target;
    
    if (!isNum(targetValue)) { return 'no_target'; }
    if (!result.ucl || !result.lcl) { return 'no_target'; }

    var direction = improvementDirection === 'low' ? 'low' : 'high';
    var ucl = result.ucl[result.ucl.length - 1];
    var lcl = result.lcl[result.lcl.length - 1];

    if (direction === 'high') {
      if (targetValue <= lcl) { return 'pass'; }
      if (targetValue >= ucl) { return 'fail'; }
      return 'hit_or_miss';
    }
    if (targetValue >= ucl) { return 'pass'; }
    if (targetValue <= lcl) { return 'fail'; }
    return 'hit_or_miss';
  }

  // -------------------------------------------------------------------------
  // Chart-type auto detection
  // -------------------------------------------------------------------------

  /**
   * Recommend a chart type from the shape of the data.
   * @returns {Object} `{chartType, reasoning}`
   */
  function detectChartType(values, hasDenominator) {
    var valid = validValues(values);
    if (!valid.length) {
      throw new Error('No valid numeric values found in data');
    }

    var maxValue = Math.max.apply(null, valid);
    var meanValue = nanMean(valid);
    var hasDecimals = valid.some(function (v) { return v % 1 !== 0; });
    var allIntegers = valid.every(function (v) { return v % 1 === 0; });
    var allPositive = valid.every(function (v) { return v >= 0; });
    var range01 = valid.every(function (v) { return v >= 0 && v <= 1; });
    var smallIntegers = valid.every(function (v) { return v >= 0 && v <= 50 && v % 1 === 0; });

    if (hasDenominator && range01 && hasDecimals) {
      return { chartType: 'p', reasoning: 'Proportions (0-1) with a denominator supplied' };
    }
    if (hasDenominator && allIntegers && allPositive) {
      return { chartType: 'u', reasoning: 'Integer counts with a denominator supplied' };
    }
    if (range01 && hasDecimals) {
      return {
        chartType: 'p',
        reasoning: 'Values appear to be proportions (0-1 range with decimals)'
      };
    }
    if (allIntegers && allPositive && smallIntegers && maxValue <= 10 && meanValue < 5) {
      return {
        chartType: 'c',
        reasoning: 'Small integer counts suggest a c chart (fixed population)'
      };
    }
    if (allIntegers && allPositive) {
      return { chartType: 'c', reasoning: 'Positive integer values suggest count data (c chart)' };
    }
    return {
      chartType: 'xmr',
      reasoning: 'Continuous or negative values suggest individual measurements (XmR)'
    };
  }

  // -------------------------------------------------------------------------
  // High-level analysis used by the Qlik visualisations
  // -------------------------------------------------------------------------

  function parseTarget(target) {
    if (target === null || target === undefined || target === '') { return null; }
    
    // Handle array of targets (dynamic targets)
    if (Array.isArray(target)) {
      var parsed = target.map(function(t) {
        var num = Number(t);
        return isNum(num) ? num : NaN;
      });
      // Return null if all values are NaN, otherwise return the array
      var hasValidTarget = parsed.some(function(t) { return isNum(t); });
      return hasValidTarget ? parsed : null;
    }
    
    // Handle single numeric target
    var num = Number(target);
    return isNum(num) ? num : null;
  }

  /**
   * Run the full NHS MDC analysis for a series.
   *
   * @param {number[]} rawValues Measured values in time order.
   * @param {Object} [options]
   *   - chartType: 'auto' (default) or any supported type
   *   - subgroupSizes: denominators for p/u charts
   *   - improvementDirection: 'high' (default) or 'low'
   *   - target: number or null
   *   - autoRebase: boolean (default false)
   *   - rebaseOn / baseline / minPhaseLength: rebasing controls
   * @returns {Object} Analysis containing values, limits, signals, colours,
   *   variation and assurance classifications and summary statistics.
   */
  function analyse(rawValues, options) {
    var opts = options || {};
    var values = (rawValues || []).map(function (v) {
      var num = Number(v);
      return isNum(num) ? num : NaN;
    });

    if (!values.length) {
      throw new Error('No data available');
    }

    var subgroupSizes = opts.subgroupSizes && opts.subgroupSizes.length === values.length
      ? opts.subgroupSizes.map(Number)
      : null;
    var hasDenominator = !!subgroupSizes;
    var requested = (opts.chartType || 'auto').toString().toLowerCase();
    var detection = null;
    var chartType = requested;

    if (requested === 'auto') {
      detection = detectChartType(values, hasDenominator);
      chartType = detection.chartType;
    }
    chartType = normaliseChartType(chartType);

    if (DENOMINATOR_CHART_TYPES.indexOf(chartType) !== -1 && !hasDenominator) {
      // Mirror the Python / Looker default assumptions rather than failing
      var isProportion = chartType === 'p' || chartType === 'pprime';
      subgroupSizes = filled(values.length, isProportion ? 100 : 1);
      hasDenominator = true;
    }

    var direction = opts.improvementDirection === 'low' ? 'low' : 'high';
    var target = parseTarget(opts.target);

    var result;
    if (opts.autoRebase && chartType !== 'run') {
      result = rebaseControlLimits(values, chartType, {
        subgroupSizes: subgroupSizes,
        improvementDirection: direction,
        rebaseOn: opts.rebaseOn,
        baseline: opts.baseline,
        minPhaseLength: opts.minPhaseLength
      });
    } else {
      result = calculateControlLimits(values, chartType, { subgroupSizes: subgroupSizes });
      result.rebasePhase = filled(values.length, 0);
    }

    var signals = chartType === 'run'
      ? detectRunChartSignals(result)
      : detectSpecialCauses(result);

    var variationType = determineVariationType(result, signals, direction);
    var assuranceType = chartType === 'run'
      ? 'no_target'
      : determineAssuranceType(result, target, direction);

    return {
      chartType: chartType,
      requestedChartType: requested,
      detection: detection,
      values: result.values,
      mean: result.mean,
      ucl: result.ucl || null,
      lcl: result.lcl || null,
      uwl: result.uwl || null,
      lwl: result.lwl || null,
      rebasePhase: result.rebasePhase,
      signals: signals,
      colours: determinePointColours(result, signals, direction, target),
      variation: variationType,
      variationLabel: VARIATION_LABELS[variationType],
      assurance: assuranceType,
      assuranceLabel: ASSURANCE_LABELS[assuranceType],
      improvementDirection: direction,
      target: target,
      rulesTriggered: {
        R1: signals.rule1.filter(Boolean).length,
        R2: signals.rule2.filter(Boolean).length,
        R3: signals.rule3.filter(Boolean).length,
        R4: signals.rule4.filter(Boolean).length
      },
      pointCount: values.length,
      hasEnoughData: values.length >= SPC_MIN_DATA_POINTS,
      latestValue: result.values[result.values.length - 1]
    };
  }

  return {
    NHS_COLOURS: NHS_COLOURS,
    POINT_COLOURS: POINT_COLOURS,
    SPC_MIN_DATA_POINTS: SPC_MIN_DATA_POINTS,
    SUPPORTED_CHART_TYPES: SUPPORTED_CHART_TYPES,
    VARIATION_LABELS: VARIATION_LABELS,
    ASSURANCE_LABELS: ASSURANCE_LABELS,
    calculateControlLimits: calculateControlLimits,
    detectSpecialCauses: detectSpecialCauses,
    detectRunChartSignals: detectRunChartSignals,
    determinePointColours: determinePointColours,
    rebaseControlLimits: rebaseControlLimits,
    determineVariationType: determineVariationType,
    determineAssuranceType: determineAssuranceType,
    detectChartType: detectChartType,
    analyse: analyse
  };
}));
