/**
 * spc_utils.js
 * ============
 * Shared utilities for NHS Making Data Count (MDC) Statistical Process Control charts.
 * Rules aligned with the NHS-R NHSRplotthedots package and custom_spc_mdc Python package.
 *
 * This module is designed to work inside a Qlik Sense extension (RequireJS / AMD).
 * It can also be loaded directly with Node.js for testing.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD / RequireJS (Qlik Sense)
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js (testing)
    module.exports = factory();
  } else {
    root.spcUtils = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // NHS Color Constants
  var NHS_COLORS = {
    BLUE: '#005EB8',        // Mean line, improvement points
    DARK_BLUE: '#003087',   // Control limit lines
    ORANGE: '#ED8B00',      // Concern points
    GREY: '#768692',        // Common cause points
    WARM_YELLOW: '#FFB81C', // Target line
    LIGHT_BLUE: '#41B6E6',  // Tolerance band shading
    PALE_GREY: '#E8EDEE'    // Alternative tolerance band
  };

  // Point classification colors
  var POINT_COLORS = {
    COMMON_CAUSE: NHS_COLORS.GREY,
    IMPROVEMENT: NHS_COLORS.BLUE,
    CONCERN: NHS_COLORS.ORANGE
  };

  // XmR chart constants
  var D2_CONSTANT = 1.128;

  /**
   * Calculate moving range for XmR charts
   * @param {number[]} values
   * @returns {number[]}
   */
  function calculateMovingRange(values) {
    if (values.length < 2) return [];
    var mr = [];
    for (var i = 1; i < values.length; i++) {
      mr.push(Math.abs(values[i] - values[i - 1]));
    }
    return mr;
  }

  /**
   * Calculate mean of an array, excluding null/undefined/NaN
   * @param {number[]} values
   * @returns {number}
   */
  function calculateMean(values) {
    var valid = [];
    for (var i = 0; i < values.length; i++) {
      if (values[i] !== null && values[i] !== undefined && !isNaN(values[i])) {
        valid.push(values[i]);
      }
    }
    if (valid.length === 0) return 0;
    var sum = 0;
    for (var i = 0; i < valid.length; i++) sum += valid[i];
    return sum / valid.length;
  }

  /**
   * Calculate median of an array
   * @param {number[]} values
   * @returns {number}
   */
  function calculateMedian(values) {
    var valid = [];
    for (var i = 0; i < values.length; i++) {
      if (values[i] !== null && values[i] !== undefined && !isNaN(values[i])) {
        valid.push(values[i]);
      }
    }
    if (valid.length === 0) return 0;
    var sorted = valid.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /**
   * NHS MDC Special Cause Rule 1: Astronomical Point
   * Single value outside 3-sigma control limits
   * @param {number[]} values
   * @param {number[]} ucl
   * @param {number[]} lcl
   * @returns {boolean[]}
   */
  function rule1Astronomical(values, ucl, lcl) {
    var result = [];
    for (var i = 0; i < values.length; i++) {
      result.push(values[i] > ucl[i] || values[i] < lcl[i]);
    }
    return result;
  }

  /**
   * NHS MDC Special Cause Rule 2: Shift
   * Seven or more consecutive points on same side of centre line
   * @param {number[]} values
   * @param {number[]} centerLine
   * @param {number} [runLength=7]
   * @returns {boolean[]}
   */
  function rule2Shift(values, centerLine, runLength) {
    runLength = runLength || 7;
    var violations = [];
    for (var i = 0; i < values.length; i++) violations.push(false);

    for (var i = 0; i <= values.length - runLength; i++) {
      var aboveCount = 0;
      var belowCount = 0;
      for (var j = i; j < i + runLength; j++) {
        if (values[j] > centerLine[j]) aboveCount++;
        else if (values[j] < centerLine[j]) belowCount++;
      }
      if (aboveCount === runLength || belowCount === runLength) {
        for (var j = i; j < i + runLength; j++) {
          violations[j] = true;
        }
      }
    }
    return violations;
  }

  /**
   * NHS MDC Special Cause Rule 3: Trend
   * Seven or more consecutive points all increasing or all decreasing
   * @param {number[]} values
   * @param {number} [runLength=7]
   * @returns {boolean[]}
   */
  function rule3Trend(values, runLength) {
    runLength = runLength || 7;
    var violations = [];
    for (var i = 0; i < values.length; i++) violations.push(false);

    for (var i = 0; i <= values.length - runLength; i++) {
      var increasing = true;
      var decreasing = true;
      for (var j = i + 1; j < i + runLength; j++) {
        if (values[j] <= values[j - 1]) increasing = false;
        if (values[j] >= values[j - 1]) decreasing = false;
      }
      if (increasing || decreasing) {
        for (var j = i; j < i + runLength; j++) {
          violations[j] = true;
        }
      }
    }
    return violations;
  }

  /**
   * NHS MDC Special Cause Rule 4: Two-in-Three
   * Aligned with NHSRplotthedots ptd_two_in_three.
   * @param {number[]} values
   * @param {number[]} centerLine
   * @param {number[]} ucl
   * @param {number[]} lcl
   * @param {number[]} uwl
   * @param {number[]} lwl
   * @returns {boolean[]}
   */
  function rule4TwoInThree(values, centerLine, ucl, lcl, uwl, lwl) {
    var n = values.length;
    var violations = [];
    for (var i = 0; i < n; i++) violations.push(false);

    var close = [];
    var rtm = [];
    for (var i = 0; i < n; i++) {
      var outside = values[i] > ucl[i] || values[i] < lcl[i];
      close.push(!outside && (values[i] > uwl[i] || values[i] < lwl[i]));
      rtm.push(values[i] > centerLine[i] ? 1 : (values[i] < centerLine[i] ? -1 : 0));
    }

    for (var i = 0; i < n; i++) {
      if (!close[i]) continue;
      var windowStarts = [i - 2, i - 1, i];
      for (var w = 0; w < 3; w++) {
        var ws = windowStarts[w];
        var we = ws + 3;
        if (ws < 0 || we > n) continue;
        var closeCount = 0;
        var rtmSum = 0;
        for (var j = ws; j < we; j++) {
          if (close[j]) closeCount++;
          rtmSum += rtm[j];
        }
        if (closeCount >= 2 && Math.abs(rtmSum) === 3) {
          violations[i] = true;
          break;
        }
      }
    }
    return violations;
  }

  /**
   * Determine point colours based on special cause rules and improvement direction.
   * @param {number[]} values
   * @param {number[]} centerLine
   * @param {number[]} ucl
   * @param {number[]} lcl
   * @param {Object} ruleViolations - { rule1, rule2, rule3, rule4, specialCause }
   * @param {string} improvementDirection - 'high' or 'low'
   * @param {number|null} target
   * @returns {string[]}
   */
  function determinePointColors(values, centerLine, ucl, lcl, ruleViolations, improvementDirection, target) {
    improvementDirection = improvementDirection || 'high';
    target = (target !== undefined) ? target : null;
    var colors = [];
    var r1 = ruleViolations.rule1;
    var sc = ruleViolations.specialCause;

    for (var i = 0; i < values.length; i++) {
      if (!sc[i]) {
        colors.push(POINT_COLORS.COMMON_CAUSE);
        continue;
      }
      var isHigh = r1[i] ? values[i] > ucl[i] : values[i] > centerLine[i];
      var isImprovement;
      if (target !== null) {
        isImprovement = Math.abs(values[i] - target) < Math.abs(centerLine[i] - target);
      } else if (improvementDirection === 'high') {
        isImprovement = isHigh;
      } else {
        isImprovement = !isHigh;
      }
      colors.push(isImprovement ? POINT_COLORS.IMPROVEMENT : POINT_COLORS.CONCERN);
    }
    return colors;
  }

  /**
   * Calculate XmR control limits
   * @param {number[]} values
   * @returns {Object}
   */
  function calculateXmRLimits(values) {
    var mr = calculateMovingRange(values);
    var mean = calculateMean(values);
    var meanMR = calculateMean(mr);
    var sigma = meanMR / D2_CONSTANT;

    var ucl = mean + 3 * sigma;
    var lcl = mean - 3 * sigma;
    var uwl = mean + 2 * sigma;
    var lwl = mean - 2 * sigma;

    var n = values.length;
    var meanArr = [], uclArr = [], lclArr = [], uwlArr = [], lwlArr = [];
    for (var i = 0; i < n; i++) {
      meanArr.push(mean);
      uclArr.push(ucl);
      lclArr.push(lcl);
      uwlArr.push(uwl);
      lwlArr.push(lwl);
    }
    return {
      values: values,
      meanArray: meanArr,
      uclArray: uclArr,
      lclArray: lclArr,
      uwlArray: uwlArr,
      lwlArray: lwlArr,
      statistics: { mean: mean, ucl: ucl, lcl: lcl, uwl: uwl, lwl: lwl, meanMovingRange: meanMR }
    };
  }

  /**
   * Calculate p-chart control limits
   * @param {number[]} proportions
   * @param {number[]} subgroupSizes
   * @returns {Object}
   */
  function calculatePChartLimits(proportions, subgroupSizes) {
    var totalNum = 0, totalDen = 0;
    for (var i = 0; i < proportions.length; i++) {
      totalNum += proportions[i] * subgroupSizes[i];
      totalDen += subgroupSizes[i];
    }
    var pBar = totalDen > 0 ? totalNum / totalDen : 0;

    var meanArr = [], uclArr = [], lclArr = [], uwlArr = [], lwlArr = [];
    for (var i = 0; i < proportions.length; i++) {
      var n = subgroupSizes[i];
      var se = Math.sqrt(pBar * (1 - pBar) / n);
      meanArr.push(pBar);
      uclArr.push(Math.min(pBar + 3 * se, 1));
      lclArr.push(Math.max(pBar - 3 * se, 0));
      uwlArr.push(Math.min(pBar + 2 * se, 1));
      lwlArr.push(Math.max(pBar - 2 * se, 0));
    }
    return {
      values: proportions,
      meanArray: meanArr,
      uclArray: uclArr,
      lclArray: lclArr,
      uwlArray: uwlArr,
      lwlArray: lwlArr,
      statistics: { meanProportion: pBar, totalNumerator: totalNum, totalDenominator: totalDen }
    };
  }

  /**
   * Calculate u-chart control limits
   * @param {number[]} rates
   * @param {number[]} subgroupSizes
   * @returns {Object}
   */
  function calculateUChartLimits(rates, subgroupSizes) {
    var totalCounts = 0, totalArea = 0;
    for (var i = 0; i < rates.length; i++) {
      totalCounts += rates[i] * subgroupSizes[i];
      totalArea += subgroupSizes[i];
    }
    var uBar = totalArea > 0 ? totalCounts / totalArea : 0;

    var meanArr = [], uclArr = [], lclArr = [], uwlArr = [], lwlArr = [];
    for (var i = 0; i < rates.length; i++) {
      var n = subgroupSizes[i];
      var se = Math.sqrt(uBar / n);
      meanArr.push(uBar);
      uclArr.push(uBar + 3 * se);
      lclArr.push(Math.max(uBar - 3 * se, 0));
      uwlArr.push(uBar + 2 * se);
      lwlArr.push(Math.max(uBar - 2 * se, 0));
    }
    return {
      values: rates,
      meanArray: meanArr,
      uclArray: uclArr,
      lclArray: lclArr,
      uwlArray: uwlArr,
      lwlArray: lwlArr,
      statistics: { meanRate: uBar, totalCounts: totalCounts, totalArea: totalArea }
    };
  }

  /**
   * Calculate c-chart control limits
   * @param {number[]} counts
   * @returns {Object}
   */
  function calculateCChartLimits(counts) {
    var cBar = calculateMean(counts);
    var se = Math.sqrt(cBar);

    var ucl = cBar + 3 * se;
    var lcl = Math.max(cBar - 3 * se, 0);
    var uwl = cBar + 2 * se;
    var lwl = Math.max(cBar - 2 * se, 0);

    var n = counts.length;
    var meanArr = [], uclArr = [], lclArr = [], uwlArr = [], lwlArr = [];
    for (var i = 0; i < n; i++) {
      meanArr.push(cBar);
      uclArr.push(ucl);
      lclArr.push(lcl);
      uwlArr.push(uwl);
      lwlArr.push(lwl);
    }
    return {
      values: counts,
      meanArray: meanArr,
      uclArray: uclArr,
      lclArray: lclArr,
      uwlArray: uwlArr,
      lwlArray: lwlArr,
      statistics: { meanCount: cBar, ucl: ucl, lcl: lcl, uwl: uwl, lwl: lwl, standardError: se }
    };
  }

  /**
   * Detect special causes for a given set of limits
   * @param {number[]} values
   * @param {number[]} meanArray
   * @param {number[]} uclArray
   * @param {number[]} lclArray
   * @param {number[]} uwlArray
   * @param {number[]} lwlArray
   * @returns {Object}
   */
  function detectSpecialCauses(values, meanArray, uclArray, lclArray, uwlArray, lwlArray) {
    var r1 = rule1Astronomical(values, uclArray, lclArray);
    var r2 = rule2Shift(values, meanArray, 7);
    var r3 = rule3Trend(values, 7);
    var r4 = rule4TwoInThree(values, meanArray, uclArray, lclArray, uwlArray, lwlArray);
    var sc = [];
    for (var i = 0; i < values.length; i++) {
      sc.push(r1[i] || r2[i] || r3[i] || r4[i]);
    }
    return { rule1: r1, rule2: r2, rule3: r3, rule4: r4, specialCause: sc };
  }

  /**
   * Detect run chart signals (shift & trend only, median-based)
   * @param {number[]} values
   * @returns {Object}
   */
  function detectRunChartSignals(values) {
    var med = calculateMedian(values);
    var medianArr = [];
    for (var i = 0; i < values.length; i++) medianArr.push(med);

    var r2 = rule2Shift(values, medianArr, 7);
    var r3 = rule3Trend(values, 7);
    var sc = [];
    for (var i = 0; i < values.length; i++) sc.push(r2[i] || r3[i]);

    return {
      median: med,
      medianArray: medianArr,
      rule2: r2,
      rule3: r3,
      specialCause: sc
    };
  }

  /**
   * Format number for display
   * @param {number} value
   * @param {number} [decimals=2]
   * @returns {string}
   */
  function formatNumber(value, decimals) {
    decimals = (decimals !== undefined) ? decimals : 2;
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return Number(value).toFixed(decimals);
  }

  /**
   * Validate data array
   * @param {Array} data
   * @param {string} chartType
   * @param {string} valueField
   * @param {string|null} subgroupField
   */
  function validateData(data, chartType, valueField, subgroupField) {
    if (!data || data.length === 0) {
      throw new Error('Data array cannot be empty');
    }
    for (var i = 0; i < data.length; i++) {
      var v = data[i][valueField];
      if (v !== null && v !== undefined && isNaN(Number(v))) {
        throw new Error('Invalid numeric value at row ' + i + ': ' + v);
      }
      if (subgroupField) {
        var s = data[i][subgroupField];
        if (s !== null && s !== undefined && (isNaN(Number(s)) || Number(s) <= 0)) {
          throw new Error('Invalid subgroup size at row ' + i + ': ' + s);
        }
      }
    }
  }

  // Public API
  return {
    NHS_COLORS: NHS_COLORS,
    POINT_COLORS: POINT_COLORS,
    D2_CONSTANT: D2_CONSTANT,
    calculateMovingRange: calculateMovingRange,
    calculateMean: calculateMean,
    calculateMedian: calculateMedian,
    rule1Astronomical: rule1Astronomical,
    rule2Shift: rule2Shift,
    rule3Trend: rule3Trend,
    rule4TwoInThree: rule4TwoInThree,
    determinePointColors: determinePointColors,
    calculateXmRLimits: calculateXmRLimits,
    calculatePChartLimits: calculatePChartLimits,
    calculateUChartLimits: calculateUChartLimits,
    calculateCChartLimits: calculateCChartLimits,
    detectSpecialCauses: detectSpecialCauses,
    detectRunChartSignals: detectRunChartSignals,
    formatNumber: formatNumber,
    validateData: validateData
  };
}));
