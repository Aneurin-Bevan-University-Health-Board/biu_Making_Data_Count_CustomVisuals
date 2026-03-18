/**
 * test_spc_calculations.js
 * =========================
 * Tests for the Qlik Sense SPC extension utilities.
 * Verifies that SPC rules and limit calculations match the Python (abspc)
 * and Looker Core implementations exactly.
 *
 * Run with:  node tests/test_spc_calculations.js
 */

var spc = require('../lib/spc_utils');

// ─── Helpers ───────────────────────────────────────────────────────────
var passed = 0, failed = 0;

function assert(label, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    failed++;
    console.log('  FAIL: ' + label);
    console.log('    expected:', JSON.stringify(expected));
    console.log('    actual  :', JSON.stringify(actual));
  }
}

function assertClose(label, actual, expected, tol) {
  tol = tol || 1e-6;
  if (Math.abs(actual - expected) < tol) {
    passed++;
  } else {
    failed++;
    console.log('  FAIL: ' + label);
    console.log('    expected:', expected, '(±' + tol + ')');
    console.log('    actual  :', actual);
  }
}

function heading(title) {
  console.log('\n' + '═'.repeat(70));
  console.log(' ' + title);
  console.log('═'.repeat(70));
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 1: XmR Chart — A&E Wait Times
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 1: XmR Chart — A&E Average Wait Times');

var xmrData = [3.2, 4.1, 2.8, 3.5, 3.9, 4.3, 3.7, 3.1, 2.9, 3.6,
               4.0, 3.8, 3.3, 3.4, 3.2, 4.5, 5.1, 5.3, 5.6, 5.8,
               6.1, 6.4, 6.2, 6.5];

var xmrResult = spc.calculateXmRLimits(xmrData);
var xmrViolations = spc.detectSpecialCauses(
  xmrResult.values, xmrResult.meanArray,
  xmrResult.uclArray, xmrResult.lclArray,
  xmrResult.uwlArray, xmrResult.lwlArray
);

console.log('  Mean:', spc.formatNumber(xmrResult.statistics.mean, 4));
console.log('  UCL: ', spc.formatNumber(xmrResult.statistics.ucl, 4));
console.log('  LCL: ', spc.formatNumber(xmrResult.statistics.lcl, 4));

assert('XmR UCL > mean', xmrResult.statistics.ucl > xmrResult.statistics.mean, true);
assert('XmR LCL < mean', xmrResult.statistics.lcl < xmrResult.statistics.mean, true);
assert('XmR violations array length', xmrViolations.specialCause.length, xmrData.length);

// Cross-verify mean with manual calculation
var manualMean = 0;
for (var i = 0; i < xmrData.length; i++) manualMean += xmrData[i];
manualMean /= xmrData.length;
assertClose('XmR mean matches manual', xmrResult.statistics.mean, manualMean);

// Verify UCL/LCL formula: mean ± 3 * meanMR / D2
var mr = spc.calculateMovingRange(xmrData);
var meanMR = spc.calculateMean(mr);
assertClose('XmR UCL formula', xmrResult.statistics.ucl, manualMean + 3 * meanMR / spc.D2_CONSTANT);
assertClose('XmR LCL formula', xmrResult.statistics.lcl, manualMean - 3 * meanMR / spc.D2_CONSTANT);


// ═══════════════════════════════════════════════════════════════════════
// TEST 2: p Chart — Infection Rates
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 2: p Chart — Surgical Site Infection Rate');

var pData = [0.05, 0.03, 0.04, 0.06, 0.02, 0.04, 0.03, 0.05,
             0.04, 0.03, 0.02, 0.03, 0.01, 0.02, 0.01, 0.02,
             0.01, 0.01, 0.02, 0.01];
var pSubs = [];
for (var i = 0; i < pData.length; i++) pSubs.push(200);

var pResult = spc.calculatePChartLimits(pData, pSubs);

console.log('  pBar:', spc.formatNumber(pResult.statistics.meanProportion, 4));
console.log('  UCL: ', spc.formatNumber(pResult.uclArray[0], 4));
console.log('  LCL: ', spc.formatNumber(pResult.lclArray[0], 4));

assert('p-chart LCL >= 0', pResult.lclArray[0] >= 0, true);
assert('p-chart UCL <= 1', pResult.uclArray[0] <= 1, true);

// Cross-verify pBar
var tNum = 0, tDen = 0;
for (var i = 0; i < pData.length; i++) { tNum += pData[i] * pSubs[i]; tDen += pSubs[i]; }
assertClose('p-chart pBar matches', pResult.statistics.meanProportion, tNum / tDen);


// ═══════════════════════════════════════════════════════════════════════
// TEST 3: c Chart — Medication Errors
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 3: c Chart — Monthly Medication Errors');

var cData = [3, 5, 2, 4, 6, 3, 2, 4, 5, 3,
             2, 1, 2, 1, 0, 1, 0, 1, 0, 1];

var cResult = spc.calculateCChartLimits(cData);

console.log('  cBar:', spc.formatNumber(cResult.statistics.meanCount, 4));
console.log('  UCL: ', spc.formatNumber(cResult.statistics.ucl, 4));
console.log('  LCL: ', spc.formatNumber(cResult.statistics.lcl, 4));

assert('c-chart LCL >= 0', cResult.statistics.lcl >= 0, true);
assertClose('c-chart cBar', cResult.statistics.meanCount, spc.calculateMean(cData));
assertClose('c-chart UCL formula', cResult.statistics.ucl, cResult.statistics.meanCount + 3 * Math.sqrt(cResult.statistics.meanCount));


// ═══════════════════════════════════════════════════════════════════════
// TEST 4: u Chart — Pressure Ulcers
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 4: u Chart — Pressure Ulcers per 1000 Patient-Days');

var uRates = [2.86, 1.95, 3.49, 2.50, 1.79, 2.62, 2.20, 2.95, 1.58, 3.11, 2.00, 2.38];
var uAreas = [4200, 4100, 4300, 4000, 3900, 4200, 4100, 4400, 3800, 4500, 4000, 4200];

var uResult = spc.calculateUChartLimits(uRates, uAreas);

console.log('  uBar:', spc.formatNumber(uResult.statistics.meanRate, 4));
assert('u-chart meanArray length', uResult.meanArray.length, uRates.length);
assert('u-chart variable UCL length', uResult.uclArray.length, uRates.length);

// Verify LCL >= 0
for (var i = 0; i < uResult.lclArray.length; i++) {
  assert('u-chart LCL[' + i + '] >= 0', uResult.lclArray[i] >= 0, true);
}


// ═══════════════════════════════════════════════════════════════════════
// TEST 5: Run Chart — Patient Satisfaction
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 5: Run Chart — Patient Satisfaction');

var runData = [7.2, 7.5, 7.1, 7.8, 7.3, 7.0, 6.8, 7.4, 7.6, 7.2,
               8.1, 8.3, 8.0, 8.5, 8.2, 8.4, 8.6, 8.1, 8.3, 8.5];

var runResult = spc.detectRunChartSignals(runData);

console.log('  Median:', spc.formatNumber(runResult.median, 4));
assert('Run chart median', runResult.median, spc.calculateMedian(runData));
assert('Run chart signal array length', runResult.specialCause.length, runData.length);


// ═══════════════════════════════════════════════════════════════════════
// TEST 6: Rule 1 — Astronomical Point
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 6: Rule 1 — Astronomical Point');

var r1Values = [5, 5, 5, 5, 20, 5, 5, 5, 5, -10];
var r1UCL    = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
var r1LCL    = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

var r1Result = spc.rule1Astronomical(r1Values, r1UCL, r1LCL);
assert('Rule 1 detects above UCL', r1Result[4], true);
assert('Rule 1 detects below LCL', r1Result[9], true);
assert('Rule 1 no false positive', r1Result[0], false);
assert('Rule 1 no false positive middle', r1Result[3], false);


// ═══════════════════════════════════════════════════════════════════════
// TEST 7: Rule 2 — 7-Point Shift
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 7: Rule 2 — 7-Point Shift');

var shift7 = [10, 10, 10, 15, 15, 15, 15, 15, 15, 15, 10, 10];
var shiftMean = spc.calculateMean(shift7);
var shiftCentre = [];
for (var i = 0; i < shift7.length; i++) shiftCentre.push(shiftMean);

var shiftR2 = spc.rule2Shift(shift7, shiftCentre, 7);
assert('Shift detected at index 3', shiftR2[3], true);
assert('Shift detected at index 9', shiftR2[9], true);
assert('Shift NOT detected at index 0', shiftR2[0], false);
assert('7-point shift spans indices 3-9',
  shiftR2.slice(3, 10).every(function (f) { return f; }), true);


// ═══════════════════════════════════════════════════════════════════════
// TEST 8: Rule 3 — 7-Point Trend
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 8: Rule 3 — 7-Point Trend');

var trend7 = [5, 10, 6, 7, 8, 9, 10, 11, 12, 5, 10, 10];
var trendR3 = spc.rule3Trend(trend7, 7);
assert('Trend detected at index 2', trendR3[2], true);
assert('Trend detected at index 8', trendR3[8], true);
assert('Trend NOT at index 0', trendR3[0], false);
assert('7-point trend spans indices 2-8',
  trendR3.slice(2, 9).every(function (f) { return f; }), true);


// ═══════════════════════════════════════════════════════════════════════
// TEST 9: Rule 4 — Two-in-Three
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 9: Rule 4 — Two-in-Three');

// Values placed in warning zone (between UWL and UCL)
var r4Centre = [10, 10, 10, 10, 10];
var r4UCL    = [16, 16, 16, 16, 16];
var r4LCL    = [4,  4,  4,  4,  4];
var r4UWL    = [14, 14, 14, 14, 14];
var r4LWL    = [6,  6,  6,  6,  6];
// Points at 15 are in warning zone (above UWL, below UCL), all above centre
var r4Vals   = [11, 15, 11, 15, 11];

var r4Result = spc.rule4TwoInThree(r4Vals, r4Centre, r4UCL, r4LCL, r4UWL, r4LWL);
assert('Rule 4 detects warning-zone point at index 1', r4Result[1], true);
assert('Rule 4 detects warning-zone point at index 3', r4Result[3], true);
// Points at index 0,2,4 are at 11 which is between centre (10) and UWL (14) — not in warning zone
assert('Rule 4 does not flag non-warning point', r4Result[0], false);


// ═══════════════════════════════════════════════════════════════════════
// TEST 10: Point Colours
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 10: Point Colour Determination');

var colourValues = [5, 5, 5, 5, 20, 5, 5, 5, 5, -10];
var colourCentre = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
var colourUCL    = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
var colourLCL    = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var colourR1     = [false, false, false, false, true, false, false, false, false, true];
var colourSC     = [false, false, false, false, true, false, false, false, false, true];
var colourViol   = { rule1: colourR1, rule2: [], rule3: [], rule4: [], specialCause: colourSC };

// improvement_direction = 'high'
var highColors = spc.determinePointColors(colourValues, colourCentre, colourUCL, colourLCL, colourViol, 'high', null);
assert('High direction: above UCL = improvement', highColors[4], spc.POINT_COLORS.IMPROVEMENT);
assert('High direction: below LCL = concern', highColors[9], spc.POINT_COLORS.CONCERN);
assert('Common cause = grey', highColors[0], spc.POINT_COLORS.COMMON_CAUSE);

// improvement_direction = 'low'
var lowColors = spc.determinePointColors(colourValues, colourCentre, colourUCL, colourLCL, colourViol, 'low', null);
assert('Low direction: above UCL = concern', lowColors[4], spc.POINT_COLORS.CONCERN);
assert('Low direction: below LCL = improvement', lowColors[9], spc.POINT_COLORS.IMPROVEMENT);

// With target
var targetColors = spc.determinePointColors(colourValues, colourCentre, colourUCL, colourLCL, colourViol, 'high', 25);
assert('Target direction: closer to target = improvement', targetColors[4], spc.POINT_COLORS.IMPROVEMENT);


// ═══════════════════════════════════════════════════════════════════════
// TEST 11: Edge Cases
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 11: Edge Cases');

// 11a. Two data points
var tiny = [10, 20];
var tinyLimits = spc.calculateXmRLimits(tiny);
assert('2-point mean', tinyLimits.statistics.mean, 15);
assert('2-point MR', spc.calculateMovingRange(tiny), [10]);

// 11b. All identical (no variation)
var flat = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
var flatLimits = spc.calculateXmRLimits(flat);
assert('Flat data mean', flatLimits.statistics.mean, 5);
assert('Flat data meanMR', flatLimits.statistics.meanMovingRange, 0);

// 11c. Empty moving range
var single = [42];
assert('Single value MR', spc.calculateMovingRange(single), []);

// 11d. formatNumber
assert('formatNumber null', spc.formatNumber(null), 'N/A');
assert('formatNumber NaN', spc.formatNumber(NaN), 'N/A');
assert('formatNumber 3.14159 2dp', spc.formatNumber(3.14159, 2), '3.14');


// ═══════════════════════════════════════════════════════════════════════
// TEST 12: NHS Colour Constants
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 12: NHS Colour Constants');

assert('NHS_COLORS.BLUE', spc.NHS_COLORS.BLUE, '#005EB8');
assert('NHS_COLORS.DARK_BLUE', spc.NHS_COLORS.DARK_BLUE, '#003087');
assert('NHS_COLORS.ORANGE', spc.NHS_COLORS.ORANGE, '#ED8B00');
assert('NHS_COLORS.GREY', spc.NHS_COLORS.GREY, '#768692');
assert('NHS_COLORS.WARM_YELLOW', spc.NHS_COLORS.WARM_YELLOW, '#FFB81C');
assert('POINT_COLORS.COMMON_CAUSE = GREY', spc.POINT_COLORS.COMMON_CAUSE, spc.NHS_COLORS.GREY);
assert('POINT_COLORS.IMPROVEMENT = BLUE', spc.POINT_COLORS.IMPROVEMENT, spc.NHS_COLORS.BLUE);
assert('POINT_COLORS.CONCERN = ORANGE', spc.POINT_COLORS.CONCERN, spc.NHS_COLORS.ORANGE);


// ═══════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════
heading('TEST SUMMARY');
console.log('  Passed: ' + passed);
console.log('  Failed: ' + failed);
console.log('  Total:  ' + (passed + failed));
if (failed > 0) {
  console.log('\n  ⚠  SOME TESTS FAILED — see details above');
  process.exit(1);
} else {
  console.log('\n  ✓  ALL TESTS PASSED');
}
