/**
 * test_spc_calculations.js
 * =========================
 * Tests for NHS Making Data Count SPC calculations.
 * Run with:  node tests/test_spc_calculations.js
 *
 * Each test prints the input data, calculated limits, special-cause flags,
 * and point colours so you can compare against NHSRplotthedots / the Python package.
 */

// ─── Inline the core maths (same logic used in the dist/ visualisations) ───

var D2 = 1.128;

function mean(arr) {
  if (!arr.length) return 0;
  var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i];
  return s / arr.length;
}

function median(arr) {
  var s = arr.slice().sort(function (a, b) { return a - b; });
  var m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function movingRange(vals) {
  var mr = [];
  for (var i = 1; i < vals.length; i++) mr.push(Math.abs(vals[i] - vals[i - 1]));
  return mr;
}

function rule1(vals, ucl, lcl) {
  return vals.map(function (v, i) { return v > ucl[i] || v < lcl[i]; });
}

function rule2(vals, centre, run) {
  run = run || 8;
  var f = new Array(vals.length);
  for (var i = 0; i < f.length; i++) f[i] = false;
  for (var i = 0; i <= vals.length - run; i++) {
    var a = 0, b = 0;
    for (var j = i; j < i + run; j++) {
      if (vals[j] > centre[j]) a++; else if (vals[j] < centre[j]) b++;
    }
    if (a === run || b === run)
      for (var j = i; j < i + run; j++) f[j] = true;
  }
  return f;
}

function rule3(vals, run) {
  run = run || 6;
  var f = new Array(vals.length);
  for (var i = 0; i < f.length; i++) f[i] = false;
  for (var i = 0; i <= vals.length - run; i++) {
    var up = true, down = true;
    for (var j = i + 1; j < i + run; j++) {
      if (vals[j] <= vals[j - 1]) up = false;
      if (vals[j] >= vals[j - 1]) down = false;
    }
    if (up || down)
      for (var j = i; j < i + run; j++) f[j] = true;
  }
  return f;
}

function rule4(vals, centre, ucl, lcl, uwl, lwl) {
  var n = vals.length;
  var f = new Array(n);
  for (var i = 0; i < n; i++) f[i] = false;
  var close = new Array(n);
  var rtm = new Array(n);
  for (var i = 0; i < n; i++) {
    var outside = vals[i] > ucl[i] || vals[i] < lcl[i];
    close[i] = !outside && (vals[i] > uwl[i] || vals[i] < lwl[i]);
    rtm[i] = vals[i] > centre[i] ? 1 : (vals[i] < centre[i] ? -1 : 0);
  }
  for (var i = 0; i < n; i++) {
    if (!close[i]) continue;
    var windows = [i - 2, i - 1, i];
    for (var wi = 0; wi < 3; wi++) {
      var ws = windows[wi], we = ws + 3;
      if (ws < 0 || we > n) continue;
      var cc = 0, rs = 0;
      for (var j = ws; j < we; j++) { if (close[j]) cc++; rs += rtm[j]; }
      if (cc >= 2 && Math.abs(rs) === 3) { f[i] = true; break; }
    }
  }
  return f;
}

function pointColours(vals, centre, ucl, lcl, r1Flags, sc, direction, target) {
  return vals.map(function (v, i) {
    if (!sc[i]) return 'common_cause (#768692)';
    var isHigh = r1Flags[i] ? v > ucl[i] : v > centre[i];
    var imp;
    if (target !== null && target !== undefined)
      imp = Math.abs(v - target) < Math.abs(centre[i] - target);
    else
      imp = direction === 'high' ? isHigh : !isHigh;
    return imp ? 'improvement (#005EB8)' : 'concern (#ED8B00)';
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────

var passed = 0, failed = 0;

function assert(label, actual, expected) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    passed++;
  } else {
    failed++;
    console.log('  FAIL: ' + label);
    console.log('    expected:', expected);
    console.log('    actual  :', actual);
  }
}

function heading(title) {
  console.log('\n' + '═'.repeat(70));
  console.log(' ' + title);
  console.log('═'.repeat(70));
}

function printTable(headers, rows) {
  // Simple table printer
  var widths = headers.map(function (h) { return h.length; });
  rows.forEach(function (r) {
    r.forEach(function (c, i) { widths[i] = Math.max(widths[i], String(c).length); });
  });
  var sep = widths.map(function (w) { return '-'.repeat(w + 2); }).join('+');
  var fmt = function (row) {
    return row.map(function (c, i) {
      var s = String(c);
      return ' ' + s + ' '.repeat(widths[i] - s.length) + ' ';
    }).join('|');
  };
  console.log(fmt(headers));
  console.log(sep);
  rows.forEach(function (r) { console.log(fmt(r)); });
}

// ═══════════════════════════════════════════════════════════════════════
// TEST 1: XmR Chart — A&E Average Wait Times
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 1: XmR Chart — A&E Average Wait Times (hours)');

var xmrData = [3.2, 4.1, 2.8, 3.5, 3.9, 4.3, 3.7, 3.1, 2.9, 3.6,
               4.0, 3.8, 3.3, 3.4, 3.2, 4.5, 5.1, 5.3, 5.6, 5.8,
               6.1, 6.4, 6.2, 6.5];
var xmrLabels = [];
for (var i = 0; i < xmrData.length; i++) xmrLabels.push('2024-' + String(i + 1).padStart(2, '0'));

var mr = movingRange(xmrData);
var xBar = mean(xmrData);
var mrBar = mean(mr);
var sigma = mrBar / D2;
var uclVal = xBar + 3 * sigma;
var lclVal = xBar - 3 * sigma;
var uwlVal = xBar + 2 * sigma;
var lwlVal = xBar - 2 * sigma;

console.log('\nInput Data:');
console.log('  Values:', xmrData.join(', '));
console.log('\nCalculated Limits:');
console.log('  Mean (x̄):          ', xBar.toFixed(4));
console.log('  Mean Moving Range:  ', mrBar.toFixed(4));
console.log('  UCL (x̄ + 3σ):      ', uclVal.toFixed(4));
console.log('  UWL (x̄ + 2σ):      ', uwlVal.toFixed(4));
console.log('  LWL (x̄ - 2σ):      ', lwlVal.toFixed(4));
console.log('  LCL (x̄ - 3σ):      ', lclVal.toFixed(4));

var n = xmrData.length;
var cA = [], uA = [], lA = [], uwA = [], lwA = [];
for (var i = 0; i < n; i++) { cA.push(xBar); uA.push(uclVal); lA.push(lclVal); uwA.push(uwlVal); lwA.push(lwlVal); }

var r1 = rule1(xmrData, uA, lA);
var r2 = rule2(xmrData, cA, 8);
var r3 = rule3(xmrData, 6);
var r4 = rule4(xmrData, cA, uA, lA, uwA, lwA);
var sc = xmrData.map(function (_, i) { return r1[i] || r2[i] || r3[i] || r4[i]; });
var colours = pointColours(xmrData, cA, uA, lA, r1, sc, 'low', null);

console.log('\nSpecial Cause Analysis (improvement = lower):');
var rows = [];
for (var i = 0; i < n; i++) {
  rows.push([
    xmrLabels[i],
    xmrData[i].toFixed(1),
    r1[i] ? 'YES' : '',
    r2[i] ? 'YES' : '',
    r3[i] ? 'YES' : '',
    r4[i] ? 'YES' : '',
    sc[i] ? '*** SPECIAL ***' : 'common',
    colours[i]
  ]);
}
printTable(['Date', 'Value', 'R1:Astro', 'R2:Shift', 'R3:Trend', 'R4:2in3', 'Cause', 'Colour'], rows);

// Assertions
assert('XmR mean', +xBar.toFixed(4), +mean(xmrData).toFixed(4));
assert('XmR moving range count', mr.length, xmrData.length - 1);
assert('XmR UCL > mean', uclVal > xBar, true);
assert('XmR LCL < mean', lclVal < xBar, true);


// ═══════════════════════════════════════════════════════════════════════
// TEST 2: p Chart — Infection Rates
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 2: p Chart — Surgical Site Infection Rate');

var pData = [0.05, 0.03, 0.04, 0.06, 0.02, 0.04, 0.03, 0.05,
             0.04, 0.03, 0.02, 0.03, 0.01, 0.02, 0.01, 0.02,
             0.01, 0.01, 0.02, 0.01];
var pSubs = [];
for (var i = 0; i < pData.length; i++) pSubs.push(200);  // constant subgroup

var totalNum = 0, totalDen = 0;
for (var i = 0; i < pData.length; i++) { totalNum += pData[i] * pSubs[i]; totalDen += pSubs[i]; }
var pBar = totalDen > 0 ? totalNum / totalDen : 0;

var pCentre = [], pUCL = [], pLCL = [], pUWL = [], pLWL = [];
for (var i = 0; i < pData.length; i++) {
  var se = Math.sqrt(pBar * (1 - pBar) / pSubs[i]);
  pCentre.push(pBar);
  pUCL.push(Math.min(pBar + 3 * se, 1));
  pLCL.push(Math.max(pBar - 3 * se, 0));
  pUWL.push(Math.min(pBar + 2 * se, 1));
  pLWL.push(Math.max(pBar - 2 * se, 0));
}

console.log('\nInput Data (proportions, n=200 each):');
console.log('  Values:', pData.join(', '));
console.log('\nCalculated Limits:');
console.log('  p̄ (overall proportion): ', pBar.toFixed(4));
console.log('  UCL:                     ', pUCL[0].toFixed(4));
console.log('  LCL:                     ', pLCL[0].toFixed(4));
console.log('  (Limits are constant here because subgroup sizes are equal)');

var pr1 = rule1(pData, pUCL, pLCL);
var pr2 = rule2(pData, pCentre, 8);
var pr3 = rule3(pData, 6);
var pr4 = rule4(pData, pCentre, pUCL, pLCL, pUWL, pLWL);
var psc = pData.map(function (_, i) { return pr1[i] || pr2[i] || pr3[i] || pr4[i]; });
var pColours = pointColours(pData, pCentre, pUCL, pLCL, pr1, psc, 'low', null);

console.log('\nSpecial Cause Analysis (improvement = lower):');
var pRows = [];
for (var i = 0; i < pData.length; i++) {
  pRows.push([
    'Month ' + (i + 1),
    (pData[i] * 100).toFixed(1) + '%',
    pr1[i] ? 'YES' : '',
    pr2[i] ? 'YES' : '',
    pr3[i] ? 'YES' : '',
    pr4[i] ? 'YES' : '',
    psc[i] ? '*** SPECIAL ***' : 'common',
    pColours[i]
  ]);
}
printTable(['Period', 'Rate', 'R1:Astro', 'R2:Shift', 'R3:Trend', 'R4:2in3', 'Cause', 'Colour'], pRows);

assert('p-chart pBar', +pBar.toFixed(4), +(totalNum / totalDen).toFixed(4));
assert('p-chart LCL ≥ 0', pLCL[0] >= 0, true);
assert('p-chart UCL ≤ 1', pUCL[0] <= 1, true);


// ═══════════════════════════════════════════════════════════════════════
// TEST 3: c Chart — Medication Errors
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 3: c Chart — Monthly Medication Errors');

var cData = [3, 5, 2, 4, 6, 3, 2, 4, 5, 3,
             2, 1, 2, 1, 0, 1, 0, 1, 0, 1];

var cBar = mean(cData);
var cSE = Math.sqrt(cBar);
var cUCL = cBar + 3 * cSE;
var cLCL = Math.max(cBar - 3 * cSE, 0);
var cUWL = cBar + 2 * cSE;
var cLWL = Math.max(cBar - 2 * cSE, 0);

console.log('\nInput Data (counts per month):');
console.log('  Values:', cData.join(', '));
console.log('\nCalculated Limits (Poisson distribution):');
console.log('  c̄ (mean count):   ', cBar.toFixed(4));
console.log('  σ (√c̄):           ', cSE.toFixed(4));
console.log('  UCL (c̄ + 3√c̄):   ', cUCL.toFixed(4));
console.log('  UWL (c̄ + 2√c̄):   ', cUWL.toFixed(4));
console.log('  LWL (c̄ - 2√c̄):   ', cLWL.toFixed(4));
console.log('  LCL (c̄ - 3√c̄):   ', cLCL.toFixed(4));

var cn = cData.length;
var ccA = [], cuA = [], clA = [], cuwA = [], clwA = [];
for (var i = 0; i < cn; i++) { ccA.push(cBar); cuA.push(cUCL); clA.push(cLCL); cuwA.push(cUWL); clwA.push(cLWL); }

var cr1 = rule1(cData, cuA, clA);
var cr2 = rule2(cData, ccA, 8);
var cr3 = rule3(cData, 6);
var cr4 = rule4(cData, ccA, cuA, clA, cuwA, clwA);
var csc = cData.map(function (_, i) { return cr1[i] || cr2[i] || cr3[i] || cr4[i]; });
var cColours = pointColours(cData, ccA, cuA, clA, cr1, csc, 'low', null);

console.log('\nSpecial Cause Analysis (improvement = lower):');
var cRows = [];
for (var i = 0; i < cn; i++) {
  cRows.push([
    'Month ' + (i + 1),
    String(cData[i]),
    cr1[i] ? 'YES' : '',
    cr2[i] ? 'YES' : '',
    cr3[i] ? 'YES' : '',
    cr4[i] ? 'YES' : '',
    csc[i] ? '*** SPECIAL ***' : 'common',
    cColours[i]
  ]);
}
printTable(['Period', 'Count', 'R1:Astro', 'R2:Shift', 'R3:Trend', 'R4:2in3', 'Cause', 'Colour'], cRows);

assert('c-chart cBar', +cBar.toFixed(4), +mean(cData).toFixed(4));
assert('c-chart LCL ≥ 0', cLCL >= 0, true);


// ═══════════════════════════════════════════════════════════════════════
// TEST 4: Run Chart — Patient Satisfaction
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 4: Run Chart — Patient Satisfaction Score');

var runData = [7.2, 7.5, 7.1, 7.8, 7.3, 7.0, 6.8, 7.4, 7.6, 7.2,
               8.1, 8.3, 8.0, 8.5, 8.2, 8.4, 8.6, 8.1, 8.3, 8.5];

var runMedian = median(runData);
var runMedianArr = [];
for (var i = 0; i < runData.length; i++) runMedianArr.push(runMedian);

console.log('\nInput Data (satisfaction score 1-10):');
console.log('  Values:', runData.join(', '));
console.log('\nCalculated Centre Line:');
console.log('  Median:  ', runMedian.toFixed(4));
console.log('  (Run chart has no control limits — only shift & trend signals)');

var rr2 = rule2(runData, runMedianArr, 8);
var rr3 = rule3(runData, 6);
var rsc = runData.map(function (_, i) { return rr2[i] || rr3[i]; });
var noR1 = []; for (var i = 0; i < runData.length; i++) noR1.push(false);
var rColours = pointColours(runData, runMedianArr, runMedianArr, runMedianArr, noR1, rsc, 'high', null);

console.log('\nSignal Detection (improvement = higher):');
var rRows = [];
for (var i = 0; i < runData.length; i++) {
  rRows.push([
    'Q' + (i + 1),
    runData[i].toFixed(1),
    rr2[i] ? 'YES' : '',
    rr3[i] ? 'YES' : '',
    rsc[i] ? '*** SIGNAL ***' : 'common',
    rColours[i]
  ]);
}
printTable(['Period', 'Score', 'Shift', 'Trend', 'Signal', 'Colour'], rRows);

assert('Run chart median', runMedian, median(runData));


// ═══════════════════════════════════════════════════════════════════════
// TEST 5: u Chart — Pressure Ulcers per 1000 Patient-Days
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 5: u Chart — Pressure Ulcers per 1000 Patient-Days');

var uCounts = [12, 8, 15, 10, 7, 11, 9, 13, 6, 14, 8, 10];
var uAreas  = [4200, 4100, 4300, 4000, 3900, 4200, 4100, 4400, 3800, 4500, 4000, 4200];
var uRates = [];
var uTotalC = 0, uTotalA = 0;
for (var i = 0; i < uCounts.length; i++) {
  uRates.push(uCounts[i] / uAreas[i] * 1000);  // per 1000 patient-days
  uTotalC += uCounts[i];
  uTotalA += uAreas[i];
}
var uBarRate = (uTotalC / uTotalA) * 1000;

console.log('\nInput Data:');
console.log('  Counts:       ', uCounts.join(', '));
console.log('  Patient-Days: ', uAreas.join(', '));
console.log('  Rates/1000:   ', uRates.map(function (r) { return r.toFixed(2); }).join(', '));
console.log('\nCalculated Limits:');
console.log('  ū (mean rate/1000):  ', uBarRate.toFixed(4));

var uCentreArr = [], uUCLArr = [], uLCLArr = [], uUWLArr = [], uLWLArr = [];
// Note: for per-1000-rate, se = sqrt(uBar_raw / n) * 1000 where uBar_raw = total_count/total_area
var uBarRaw = uTotalC / uTotalA;
for (var i = 0; i < uCounts.length; i++) {
  var se = Math.sqrt(uBarRaw / uAreas[i]) * 1000;
  uCentreArr.push(uBarRate);
  uUCLArr.push(uBarRate + 3 * se);
  uLCLArr.push(Math.max(uBarRate - 3 * se, 0));
  uUWLArr.push(uBarRate + 2 * se);
  uLWLArr.push(Math.max(uBarRate - 2 * se, 0));
}

console.log('  UCL range:           ', Math.min.apply(null, uUCLArr).toFixed(2), '-', Math.max.apply(null, uUCLArr).toFixed(2));
console.log('  LCL range:           ', Math.min.apply(null, uLCLArr).toFixed(2), '-', Math.max.apply(null, uLCLArr).toFixed(2));
console.log('  (Variable limits because denominator sizes vary)');

var ur1 = rule1(uRates, uUCLArr, uLCLArr);
var ur2 = rule2(uRates, uCentreArr, 8);
var ur3 = rule3(uRates, 6);
var ur4 = rule4(uRates, uCentreArr, uUCLArr, uLCLArr, uUWLArr, uLWLArr);
var usc = uRates.map(function (_, i) { return ur1[i] || ur2[i] || ur3[i] || ur4[i]; });
var uColours = pointColours(uRates, uCentreArr, uUCLArr, uLCLArr, ur1, usc, 'low', null);

console.log('\nSpecial Cause Analysis (improvement = lower):');
var uRows = [];
for (var i = 0; i < uRates.length; i++) {
  uRows.push([
    'Month ' + (i + 1),
    String(uCounts[i]),
    String(uAreas[i]),
    uRates[i].toFixed(2),
    uUCLArr[i].toFixed(2),
    uLCLArr[i].toFixed(2),
    usc[i] ? '*** SPECIAL ***' : 'common',
    uColours[i]
  ]);
}
printTable(['Period', 'Count', 'Pt-Days', 'Rate/1k', 'UCL', 'LCL', 'Cause', 'Colour'], uRows);

assert('u-chart uBar', +uBarRate.toFixed(4), +((uTotalC / uTotalA) * 1000).toFixed(4));


// ═══════════════════════════════════════════════════════════════════════
// TEST 6: Edge Cases
// ═══════════════════════════════════════════════════════════════════════
heading('TEST 6: Edge Cases');

// 6a. Exactly 8-point shift
var shift8 = [10, 10, 10, 15, 15, 15, 15, 15, 15, 15, 15, 10, 10];
var shift8Mean = mean(shift8);
var shift8Centre = [];
for (var i = 0; i < shift8.length; i++) shift8Centre.push(shift8Mean);
var shift8R2 = rule2(shift8, shift8Centre, 8);
console.log('\n6a. 8 consecutive points above mean:');
console.log('  Data:   ', shift8.join(', '));
console.log('  Mean:   ', shift8Mean.toFixed(2));
console.log('  Shift:  ', shift8R2.map(function (f) { return f ? 'X' : '.'; }).join(' '));
assert('8-point shift detected at index 3-10',
  shift8R2.slice(3, 11).every(function (f) { return f; }), true);

// 6b. Exactly 6-point trend
var trend6 = [5, 10, 6, 7, 8, 9, 10, 11, 5, 10, 10];
var trend6R3 = rule3(trend6, 6);
console.log('\n6b. 6 consecutive increasing points:');
console.log('  Data:   ', trend6.join(', '));
console.log('  Trend:  ', trend6R3.map(function (f) { return f ? 'X' : '.'; }).join(' '));
assert('6-point trend detected at index 2-7',
  trend6R3.slice(2, 8).every(function (f) { return f; }), true);

// 6c. Two data points (minimum)
var tiny = [10, 20];
var tinyMean = mean(tiny);
var tinyMR = movingRange(tiny);
console.log('\n6c. Minimum data (2 points):');
console.log('  Data:   ', tiny.join(', '));
console.log('  Mean:   ', tinyMean);
console.log('  MR:     ', tinyMR.join(', '));
assert('2-point mean', tinyMean, 15);
assert('2-point MR', tinyMR, [10]);

// 6d. All identical values (no variation)
var flat = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
var flatMean = mean(flat);
var flatMR = movingRange(flat);
var flatMRBar = mean(flatMR);
console.log('\n6d. No variation (all 5s):');
console.log('  Mean:        ', flatMean);
console.log('  Mean MR:     ', flatMRBar);
console.log('  UCL = LCL =  ', flatMean, '(limits collapse to mean)');
assert('Flat data mean', flatMean, 5);
assert('Flat data MR bar', flatMRBar, 0);


// ═══════════════════════════════════════════════════════════════════════
// 7. SPC_MIN_DATA_POINTS CONSTANT
// ═══════════════════════════════════════════════════════════════════════
heading('7. SPC_MIN_DATA_POINTS constant');

var SPC_MIN_DATA_POINTS = 15;

assert('SPC_MIN_DATA_POINTS is 15', SPC_MIN_DATA_POINTS, 15);

var smallData = [1, 2, 3, 4, 5];
assert('5 points is below minimum', smallData.length < SPC_MIN_DATA_POINTS, true);

var borderData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
assert('15 points is at minimum', borderData.length < SPC_MIN_DATA_POINTS, false);

var largeData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
assert('20 points is above minimum', largeData.length < SPC_MIN_DATA_POINTS, false);


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
