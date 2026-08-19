/**
 * test_spc_engine.js
 * ==================
 * Unit tests for the Qlik Sense SPC engine. Expected values are derived from
 * the Python `abspc` package so the two implementations stay aligned.
 *
 * Run with: `node tests/test_spc_engine.js` (or `npm test`).
 */
'use strict';

const assert = require('assert');
const engine = require('../shared/spc-engine.js');

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    process.stdout.write('  PASS  ' + name + '\n');
  } catch (error) {
    failures.push({ name, error });
    process.stdout.write('  FAIL  ' + name + ': ' + error.message + '\n');
  }
}

function closeTo(actual, expected, tolerance) {
  const tol = tolerance === undefined ? 1e-9 : tolerance;
  assert.ok(
    Math.abs(actual - expected) <= tol,
    'expected ' + actual + ' to be within ' + tol + ' of ' + expected
  );
}

const STABLE = [48, 52, 49, 55, 47, 51, 53, 50, 48, 54, 49, 52, 50, 51, 53];

// ---------------------------------------------------------------------------
// Control limits
// ---------------------------------------------------------------------------

test('XmR limits use the 3/d2 (2.66) multiplier', () => {
  const values = [50, 52, 48, 51, 49];
  const result = engine.calculateControlLimits(values, 'XmR');
  const mean = 50;
  const meanMr = (2 + 4 + 3 + 2) / 4;
  const sigmaMultiplier = 3 / 1.128;
  closeTo(result.mean[0], mean, 1e-12);
  closeTo(result.ucl[0], mean + sigmaMultiplier * meanMr, 1e-12);
  closeTo(result.lcl[0], mean - sigmaMultiplier * meanMr, 1e-12);
  closeTo(result.uwl[0], mean + (2 * sigmaMultiplier / 3) * meanMr, 1e-12);
});

test('"i" is accepted as an alias of XmR', () => {
  const a = engine.calculateControlLimits(STABLE, 'i');
  const b = engine.calculateControlLimits(STABLE, 'XmR');
  assert.deepStrictEqual(a.ucl, b.ucl);
  assert.strictEqual(a.chartType, 'xmr');
});

test('p chart uses pooled proportion and varying limits', () => {
  const numerators = [10, 12, 8, 15, 9];
  const denominators = [100, 120, 90, 150, 95];
  const result = engine.calculateControlLimits(numerators, 'p', {
    subgroupSizes: denominators
  });
  const pBar = 54 / 555;
  closeTo(result.mean[0], pBar, 1e-12);
  closeTo(result.values[0], 0.1, 1e-12);
  closeTo(result.ucl[0], pBar + 3 * Math.sqrt(pBar * (1 - pBar) / 100), 1e-12);
  assert.ok(result.ucl[0] !== result.ucl[2], 'limits should vary with subgroup size');
  assert.ok(result.lcl.every((v) => v >= 0), 'p chart LCL is clipped at zero');
});

test('p chart accepts pre-computed proportions', () => {
  const proportions = [0.1, 0.12, 0.09, 0.11];
  const denominators = [100, 100, 100, 100];
  const result = engine.calculateControlLimits(proportions, 'p', {
    subgroupSizes: denominators
  });
  closeTo(result.mean[0], 0.105, 1e-12);
  assert.deepStrictEqual(result.values, proportions);
});

test('u chart converts counts to rates', () => {
  const counts = [5, 8, 6, 10];
  const denominators = [100, 120, 90, 150];
  const result = engine.calculateControlLimits(counts, 'u', { subgroupSizes: denominators });
  const uBar = 29 / 460;
  closeTo(result.mean[0], uBar, 1e-12);
  closeTo(result.values[0], 0.05, 1e-12);
  closeTo(result.ucl[0], uBar + 3 * Math.sqrt(uBar / 100), 1e-12);
});

test("p' chart applies Laney's sigma(z) correction", () => {
  const numerators = [120, 180, 130, 200, 140, 190, 125, 205];
  const denominators = [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000];
  const plain = engine.calculateControlLimits(numerators, 'p', {
    subgroupSizes: denominators
  });
  const prime = engine.calculateControlLimits(numerators, 'pprime', {
    subgroupSizes: denominators
  });

  // Same centre line, but overdispersed data widens the limits
  closeTo(prime.mean[0], plain.mean[0], 1e-12);
  assert.ok(prime.ucl[0] > plain.ucl[0], "p' limits should be wider than p");

  const pBar = plain.mean[0];
  const sigma = denominators.map((n) => Math.sqrt((pBar * (1 - pBar)) / n));
  const z = prime.values.map((v, i) => (v - pBar) / sigma[i]);
  let mrSum = 0;
  for (let i = 1; i < z.length; i += 1) { mrSum += Math.abs(z[i] - z[i - 1]); }
  const sigmaZ = mrSum / (z.length - 1) / 1.128;
  closeTo(prime.ucl[0], pBar + 3 * sigma[0] * sigmaZ, 1e-12);
});

test("p' collapses back to p when the data is not overdispersed", () => {
  // Points sitting exactly one binomial sigma apart give sigma(z) = 1 / 1.128 * 1
  const denominators = [500, 500, 500, 500, 500, 500];
  const pBar = 0.2;
  const sigma = Math.sqrt((pBar * (1 - pBar)) / 500);
  const proportions = [0, 1, 0, 1, 0, 1].map((k) => pBar + (k ? 1.128 / 2 : -1.128 / 2) * sigma);
  const plain = engine.calculateControlLimits(proportions, 'p', {
    subgroupSizes: denominators
  });
  const prime = engine.calculateControlLimits(proportions, 'pprime', {
    subgroupSizes: denominators
  });
  closeTo(prime.ucl[0], plain.ucl[0], 1e-9);
});

test("u' chart widens u limits for overdispersed rates", () => {
  const counts = [20, 60, 25, 70, 30, 65, 22, 75];
  const denominators = [500, 500, 500, 500, 500, 500, 500, 500];
  const plain = engine.calculateControlLimits(counts, 'u', { subgroupSizes: denominators });
  const prime = engine.calculateControlLimits(counts, 'uprime', {
    subgroupSizes: denominators
  });
  closeTo(prime.mean[0], plain.mean[0], 1e-12);
  assert.ok(prime.ucl[0] > plain.ucl[0], "u' limits should be wider than u");
  assert.ok(prime.lcl.every((v) => v >= 0), "u' LCL is clipped at zero");
});

test("prime chart aliases are accepted", () => {
  const denominators = [200, 200, 200, 200];
  const opts = { subgroupSizes: denominators };
  assert.strictEqual(
    engine.calculateControlLimits([10, 20, 15, 25], "p'", opts).chartType, 'pprime'
  );
  assert.strictEqual(
    engine.calculateControlLimits([10, 20, 15, 25], 'U-Prime', opts).chartType, 'uprime'
  );
});

test('c chart uses sqrt(c-bar) sigma with a non-negative LCL', () => {
  const counts = [3, 5, 2, 4, 6, 3, 4, 5];
  const result = engine.calculateControlLimits(counts, 'c');
  const cBar = counts.reduce((a, b) => a + b, 0) / counts.length;
  closeTo(result.mean[0], cBar, 1e-12);
  closeTo(result.ucl[0], cBar + 3 * Math.sqrt(cBar), 1e-12);
  assert.ok(result.lcl[0] >= 0);
});

test('t chart back-transforms Nelson limits onto the time scale', () => {
  const times = [12, 30, 8, 45, 22, 18, 60, 15];
  const result = engine.calculateControlLimits(times, 't');
  const transformed = times.map((v) => Math.pow(v, 1 / 3.6));
  const meanT = transformed.reduce((a, b) => a + b, 0) / transformed.length;
  closeTo(result.mean[0], Math.pow(meanT, 3.6), 1e-9);
  assert.ok(result.ucl[0] > result.mean[0]);
  assert.ok(result.lcl[0] >= 0);
});

test('g chart uses the geometric standard deviation', () => {
  const opportunities = [10, 25, 5, 40, 15];
  const result = engine.calculateControlLimits(opportunities, 'g');
  const gBar = 19;
  closeTo(result.mean[0], gBar, 1e-12);
  closeTo(result.ucl[0], gBar + 3 * Math.sqrt(gBar * (gBar + 1)), 1e-12);
  closeTo(result.lcl[0], 0, 1e-12);
});

test('run chart centres on the median and has no limits', () => {
  const result = engine.calculateControlLimits([5, 1, 3, 9, 7], 'run');
  closeTo(result.mean[0], 5, 1e-12);
  assert.strictEqual(result.ucl, undefined);
});

test('unsupported chart types raise an error', () => {
  assert.throws(() => engine.calculateControlLimits([1, 2, 3], 'z'), /Unsupported chartType/);
});

test('p and u charts require valid denominators', () => {
  assert.throws(() => engine.calculateControlLimits([1, 2, 3], 'p'), /denominator/);
  assert.throws(
    () => engine.calculateControlLimits([1, 2], 'u', { subgroupSizes: [10, 0] }),
    /must be > 0/
  );
});

// ---------------------------------------------------------------------------
// Special-cause rules
// ---------------------------------------------------------------------------

test('rule 1 flags a point outside the control limits', () => {
  const values = STABLE.concat([120]);
  const result = engine.calculateControlLimits(values, 'xmr');
  const signals = engine.detectSpecialCauses(result);
  assert.strictEqual(signals.rule1[values.length - 1], true);
  assert.strictEqual(signals.rule1[0], false);
});

test('rule 2 flags eight consecutive points above the mean', () => {
  const values = [10, 10, 10, 10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 20, 20, 20];
  const result = engine.calculateControlLimits(values, 'xmr');
  const signals = engine.detectSpecialCauses(result);
  assert.strictEqual(signals.rule2.filter(Boolean).length, 16);
});

test('rule 3 flags six consecutively increasing points', () => {
  const values = [10, 11, 12, 13, 14, 15, 14, 13, 12, 11];
  const result = engine.calculateControlLimits(values, 'xmr');
  const signals = engine.detectSpecialCauses(result);
  assert.strictEqual(signals.rule3.slice(0, 6).every(Boolean), true);
  assert.strictEqual(signals.rule3[9], false);
});

test('rule 4 only flags points that are themselves in the warning zone', () => {
  const result = {
    values: [9.5, 10.9, 10.85, 10.2, 9.8],
    mean: [10, 10, 10, 10, 10],
    ucl: [11, 11, 11, 11, 11],
    lcl: [9, 9, 9, 9, 9],
    uwl: [10.67, 10.67, 10.67, 10.67, 10.67],
    lwl: [9.33, 9.33, 9.33, 9.33, 9.33]
  };
  const signals = engine.detectSpecialCauses(result);
  assert.strictEqual(signals.rule4[1], true);
  assert.strictEqual(signals.rule4[2], true);
  assert.strictEqual(signals.rule4[0], false);
});

test('run chart signals use shift and trend only', () => {
  const values = [1, 2, 1, 2, 1, 2, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12];
  const result = engine.calculateControlLimits(values, 'run');
  const signals = engine.detectRunChartSignals(result);
  assert.ok(signals.runSignal.some(Boolean));
  assert.strictEqual(signals.rule1.some(Boolean), false);
});

// ---------------------------------------------------------------------------
// Colours, variation and assurance
// ---------------------------------------------------------------------------

test('common-cause points are grey', () => {
  const result = engine.calculateControlLimits(STABLE, 'xmr');
  const signals = engine.detectSpecialCauses(result);
  const colours = engine.determinePointColours(result, signals, 'high', null);
  assert.ok(colours.every((c) => c === engine.POINT_COLOURS.COMMON_CAUSE));
});

test('a high outlier is improvement when higher is better and concern otherwise', () => {
  const values = STABLE.concat([120]);
  const result = engine.calculateControlLimits(values, 'xmr');
  const signals = engine.detectSpecialCauses(result);
  const high = engine.determinePointColours(result, signals, 'high', null);
  const low = engine.determinePointColours(result, signals, 'low', null);
  assert.strictEqual(high[values.length - 1], engine.POINT_COLOURS.IMPROVEMENT);
  assert.strictEqual(low[values.length - 1], engine.POINT_COLOURS.CONCERN);
});

test('variation classification follows the latest special-cause point', () => {
  const values = STABLE.concat([120]);
  const result = engine.calculateControlLimits(values, 'xmr');
  const signals = engine.detectSpecialCauses(result);
  assert.strictEqual(engine.determineVariationType(result, signals, 'high'), 'improvement_high');
  assert.strictEqual(engine.determineVariationType(result, signals, 'low'), 'concern_high');
});

test('stable data is classified as common cause', () => {
  const result = engine.calculateControlLimits(STABLE, 'xmr');
  const signals = engine.detectSpecialCauses(result);
  assert.strictEqual(engine.determineVariationType(result, signals, 'high'), 'common_cause');
});

test('assurance compares the target against the latest limits', () => {
  const result = engine.calculateControlLimits(STABLE, 'xmr');
  const lcl = result.lcl[0];
  const ucl = result.ucl[0];
  assert.strictEqual(engine.determineAssuranceType(result, lcl - 1, 'high'), 'pass');
  assert.strictEqual(engine.determineAssuranceType(result, ucl + 1, 'high'), 'fail');
  assert.strictEqual(engine.determineAssuranceType(result, 50, 'high'), 'hit_or_miss');
  assert.strictEqual(engine.determineAssuranceType(result, ucl + 1, 'low'), 'pass');
  assert.strictEqual(engine.determineAssuranceType(result, null, 'high'), 'no_target');
});

// ---------------------------------------------------------------------------
// Rebasing
// ---------------------------------------------------------------------------

test('auto-rebasing splits the series into phases on a sustained shift', () => {
  const baseline = [50, 52, 48, 51, 49, 53, 47, 50, 52, 48, 51, 49, 50, 52, 48];
  const shifted = [70, 72, 68, 71, 69, 73, 67, 70, 72, 68];
  const values = baseline.concat(shifted);
  const result = engine.rebaseControlLimits(values, 'xmr', {
    improvementDirection: 'high',
    rebaseOn: 'improvement',
    baseline: 15
  });
  assert.strictEqual(result.rebasePhase[0], 0);
  assert.strictEqual(result.rebasePhase[values.length - 1], 1);
  assert.ok(result.mean[values.length - 1] > result.mean[0]);
});

test('rebasing is rejected for run charts and invalid options', () => {
  assert.throws(() => engine.rebaseControlLimits(STABLE, 'run'), /not supported/);
  assert.throws(
    () => engine.rebaseControlLimits(STABLE, 'xmr', { rebaseOn: 'nope' }),
    /rebaseOn/
  );
  assert.throws(
    () => engine.rebaseControlLimits(STABLE, 'xmr', { baseline: -1 }),
    /baseline/
  );
});

// ---------------------------------------------------------------------------
// Auto-detection & high-level analysis
// ---------------------------------------------------------------------------

test('chart type detection recognises proportions, counts and continuous data', () => {
  assert.strictEqual(engine.detectChartType([0.1, 0.2, 0.15]).chartType, 'p');
  assert.strictEqual(engine.detectChartType([3, 4, 2, 5]).chartType, 'c');
  assert.strictEqual(engine.detectChartType([48.2, 52.7, -3]).chartType, 'xmr');
  assert.strictEqual(engine.detectChartType([5, 8, 6], true).chartType, 'u');
});

test('analyse returns a complete NHS MDC result set', () => {
  const analysis = engine.analyse(STABLE.concat([120]), {
    chartType: 'xmr',
    improvementDirection: 'high',
    target: 30
  });
  assert.strictEqual(analysis.chartType, 'xmr');
  assert.strictEqual(analysis.values.length, 16);
  assert.strictEqual(analysis.colours.length, 16);
  assert.strictEqual(analysis.variation, 'improvement_high');
  assert.strictEqual(analysis.assurance, 'pass');
  assert.strictEqual(analysis.rulesTriggered.R1, 1);
  assert.strictEqual(analysis.hasEnoughData, true);
  assert.strictEqual(analysis.latestValue, 120);
});

test('analyse flags series that are too short for reliable SPC', () => {
  const analysis = engine.analyse([1, 2, 3, 4], { chartType: 'xmr' });
  assert.strictEqual(analysis.hasEnoughData, false);
  assert.strictEqual(analysis.pointCount, 4);
});

test('analyse defaults denominators when p/u charts are chosen without one', () => {
  const analysis = engine.analyse([0.1, 0.12, 0.09, 0.11], { chartType: 'p' });
  assert.ok(analysis.ucl[0] > analysis.mean[0]);
});

test('analyse rejects empty data', () => {
  assert.throws(() => engine.analyse([]), /No data available/);
});

process.stdout.write('\n' + passed + ' passed, ' + failures.length + ' failed\n');
if (failures.length) {
  process.exit(1);
}
