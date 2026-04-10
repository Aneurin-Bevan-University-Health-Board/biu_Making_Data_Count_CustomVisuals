/**
 * spc_utils.js
 * ============
 * Shared utilities for NHS Making Data Count (MDC) Statistical Process Control charts.
 * Rules aligned with the NHS-R NHSRplotthedots package and custom_spc_mdc Python package.
 */

// NHS Color Constants
export const NHS_COLORS = {
  BLUE: '#005EB8',        // Mean line, improvement points
  DARK_BLUE: '#003087',   // Control limit lines
  ORANGE: '#ED8B00',      // Concern points
  GREY: '#768692',        // Common cause points
  WARM_YELLOW: '#FFB81C', // Target line
  LIGHT_BLUE: '#41B6E6',  // Tolerance band shading
  PALE_GREY: '#E8EDEE'    // Alternative tolerance band
};

// Point classification colors
export const POINT_COLORS = {
  COMMON_CAUSE: NHS_COLORS.GREY,
  IMPROVEMENT: NHS_COLORS.BLUE,
  CONCERN: NHS_COLORS.ORANGE
};

// Minimum number of data points recommended for reliable SPC analysis
export const SPC_MIN_DATA_POINTS = 15;

/**
 * Calculate moving range for XmR charts
 * @param {number[]} values - Array of measured values
 * @returns {number[]} - Array of moving ranges
 */
export function calculateMovingRange(values) {
  if (values.length < 2) return [];
  
  const movingRanges = [];
  for (let i = 1; i < values.length; i++) {
    movingRanges.push(Math.abs(values[i] - values[i - 1]));
  }
  return movingRanges;
}

/**
 * Calculate mean of an array, excluding any null/undefined values
 * @param {number[]} values - Array of values
 * @returns {number} - Mean value
 */
export function calculateMean(values) {
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (validValues.length === 0) return 0;
  return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
}

/**
 * Calculate median of an array
 * @param {number[]} values - Array of values
 * @returns {number} - Median value
 */
export function calculateMedian(values) {
  const validValues = values.filter(v => v !== null && v !== undefined && !isNaN(v));
  if (validValues.length === 0) return 0;
  
  const sorted = [...validValues].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * NHS MDC Special Cause Rule 1: Astronomical Point
 * Single value outside 3-sigma control limits
 * @param {number[]} values - Data values
 * @param {number[]} ucl - Upper control limits
 * @param {number[]} lcl - Lower control limits
 * @returns {boolean[]} - Array indicating rule violations
 */
export function rule1Astronomical(values, ucl, lcl) {
  return values.map((value, i) => {
    return value > ucl[i] || value < lcl[i];
  });
}

/**
 * NHS MDC Special Cause Rule 2: Shift
 * Seven or more consecutive points on same side of center line
 * @param {number[]} values - Data values
 * @param {number[]} centerLine - Center line values (mean or median)
 * @param {number} runLength - Required consecutive points (default: 7)
 * @returns {boolean[]} - Array indicating rule violations
 */
export function rule2Shift(values, centerLine, runLength = 7) {
  const violations = new Array(values.length).fill(false);
  
  for (let i = 0; i <= values.length - runLength; i++) {
    let aboveCount = 0;
    let belowCount = 0;
    
    for (let j = i; j < i + runLength; j++) {
      if (values[j] > centerLine[j]) {
        aboveCount++;
      } else if (values[j] < centerLine[j]) {
        belowCount++;
      }
    }
    
    // If all points are on the same side
    if (aboveCount === runLength || belowCount === runLength) {
      for (let j = i; j < i + runLength; j++) {
        violations[j] = true;
      }
    }
  }
  
  return violations;
}

/**
 * NHS MDC Special Cause Rule 3: Trend
 * Seven or more consecutive points all increasing or all decreasing
 * @param {number[]} values - Data values
 * @param {number} runLength - Required consecutive points (default: 7)
 * @returns {boolean[]} - Array indicating rule violations
 */
export function rule3Trend(values, runLength = 7) {
  const violations = new Array(values.length).fill(false);
  
  for (let i = 0; i <= values.length - runLength; i++) {
    let increasing = true;
    let decreasing = true;
    
    for (let j = i + 1; j < i + runLength; j++) {
      if (values[j] <= values[j - 1]) {
        increasing = false;
      }
      if (values[j] >= values[j - 1]) {
        decreasing = false;
      }
    }
    
    if (increasing || decreasing) {
      for (let j = i; j < i + runLength; j++) {
        violations[j] = true;
      }
    }
  }
  
  return violations;
}

/**
 * NHS MDC Special Cause Rule 4: Two-in-Three
 * Aligned with NHSRplotthedots ptd_two_in_three.
 * Only flags points that are themselves in the warning zone, and requires
 * all 3 consecutive points in the window to be on the same side of the centre line.
 * @param {number[]} values - Data values
 * @param {number[]} centerLine - Center line values
 * @param {number[]} ucl - Upper control limits (3-sigma)
 * @param {number[]} lcl - Lower control limits (3-sigma)
 * @param {number[]} uwl - Upper warning limits (2-sigma)
 * @param {number[]} lwl - Lower warning limits (2-sigma)
 * @returns {boolean[]} - Array indicating rule violations
 */
export function rule4TwoInThree(values, centerLine, ucl, lcl, uwl, lwl) {
  const n = values.length;
  const violations = new Array(n).fill(false);

  // close: in warning zone (beyond uwl/lwl but NOT outside ucl/lcl)
  const close = new Array(n);
  // rtm: relative-to-mean sign (+1 above, -1 below, 0 equal)
  const rtm = new Array(n);
  for (let i = 0; i < n; i++) {
    const outside = values[i] > ucl[i] || values[i] < lcl[i];
    close[i] = !outside && (values[i] > uwl[i] || values[i] < lwl[i]);
    rtm[i] = values[i] > centerLine[i] ? 1 : (values[i] < centerLine[i] ? -1 : 0);
  }

  for (let i = 0; i < n; i++) {
    if (!close[i]) continue; // only flag points themselves in the warning zone
    // Check all windows of 3 that contain point i
    const windowStarts = [i - 2, i - 1, i];
    for (const ws of windowStarts) {
      const we = ws + 3;
      if (ws < 0 || we > n) continue;
      let closeCount = 0;
      let rtmSum = 0;
      for (let j = ws; j < we; j++) {
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
 * Determine point colors based on special cause rules and improvement direction.
 * Aligned with Python _is_high_signal / _towards_target logic.
 * @param {number[]} values - Data values
 * @param {number[]} centerLine - Center line values
 * @param {number[]} ucl - Upper control limits
 * @param {number[]} lcl - Lower control limits
 * @param {Object} ruleViolations - Object containing rule violation arrays
 * @param {string} improvementDirection - 'high' or 'low'
 * @param {number|null} target - Optional target value for improvement assessment
 * @returns {string[]} - Array of color codes for each point
 */
export function determinePointColors(values, centerLine, ucl, lcl, ruleViolations, improvementDirection = 'high', target = null) {
  const colors = [];
  const { rule1, rule2, rule3, rule4, specialCause } = ruleViolations;
  
  for (let i = 0; i < values.length; i++) {
    if (!specialCause[i]) {
      colors.push(POINT_COLORS.COMMON_CAUSE);
      continue;
    }

    // Determine if special cause is in the high direction
    // Rule 1: check if value is above UCL (high) or below LCL (low)
    // Other rules: check if value is above or below centre
    const isHigh = rule1[i] ? values[i] > ucl[i] : values[i] > centerLine[i];
    
    let isImprovement;
    if (target !== null) {
      // Aligned with Python _towards_target: closer to target than mean
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
 * Validate data for SPC calculations
 * @param {Array} data - Input data array
 * @param {string} chartType - Type of chart ('xmr', 'p', 'u', 'c', 'run')
 * @param {string} valueColumn - Name of value column
 * @param {string|null} subgroupColumn - Name of subgroup size column (for p/u charts)
 * @throws {Error} If validation fails
 */
export function validateData(data, chartType, valueColumn = 'value', subgroupColumn = null) {
  if (!data || data.length === 0) {
    throw new Error('Data array cannot be empty');
  }
  
  // Check required columns exist
  if (!data[0].hasOwnProperty(valueColumn)) {
    throw new Error(`Value column '${valueColumn}' not found in data`);
  }
  
  if (['p', 'u'].includes(chartType.toLowerCase()) && subgroupColumn) {
    if (!data[0].hasOwnProperty(subgroupColumn)) {
      throw new Error(`Subgroup size column '${subgroupColumn}' not found in data`);
    }
  }
  
  // Validate data types
  for (let i = 0; i < data.length; i++) {
    const value = data[i][valueColumn];
    if (value !== null && value !== undefined && isNaN(Number(value))) {
      throw new Error(`Invalid numeric value at row ${i}: ${value}`);
    }
    
    if (subgroupColumn) {
      const subgroupSize = data[i][subgroupColumn];
      if (subgroupSize !== null && subgroupSize !== undefined && 
          (isNaN(Number(subgroupSize)) || Number(subgroupSize) <= 0)) {
        throw new Error(`Invalid subgroup size at row ${i}: ${subgroupSize}`);
      }
    }
  }
}

/**
 * Format number for display with appropriate decimal places
 * @param {number} value - Number to format
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} - Formatted number string
 */
export function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  return Number(value).toFixed(decimals);
}

/**
 * Determine the overall variation icon type for an SPC chart.
 * Aligned with Python determine_variation_type.
 * @param {number[]} values - Data values
 * @param {number[]} centerLine - Centre line values (mean or median)
 * @param {boolean[]} specialCause - Per-point special-cause flag
 * @param {string} improvementDirection - 'high' or 'low'
 * @returns {string} One of 'improvement_high', 'improvement_low',
 *   'common_cause', 'concern_high', 'concern_low'
 */
export function determineVariationType(values, centerLine, specialCause, improvementDirection = 'high') {
  if (!specialCause || !specialCause.some(Boolean)) {
    return 'common_cause';
  }

  // Find the most recent special-cause index
  let lastIdx = -1;
  for (let i = specialCause.length - 1; i >= 0; i--) {
    if (specialCause[i]) { lastIdx = i; break; }
  }

  const isHigh = values[lastIdx] > centerLine[lastIdx];

  if (improvementDirection === 'high') {
    return isHigh ? 'improvement_high' : 'concern_low';
  }
  return isHigh ? 'concern_high' : 'improvement_low';
}

/**
 * Determine the assurance icon type for an SPC chart.
 * Aligned with Python determine_assurance_type.
 * @param {number} target - Target value (null → 'no_target')
 * @param {number} ucl - Upper control limit (last phase)
 * @param {number} lcl - Lower control limit (last phase)
 * @param {string} improvementDirection - 'high' or 'low'
 * @returns {string} One of 'pass', 'hit_or_miss', 'fail', 'no_target'
 */
export function determineAssuranceType(target, ucl, lcl, improvementDirection = 'high') {
  if (target === null || target === undefined) {
    return 'no_target';
  }

  if (improvementDirection === 'high') {
    if (target <= lcl) return 'pass';
    if (target >= ucl) return 'fail';
    return 'hit_or_miss';
  }
  // Lower is better
  if (target >= ucl) return 'pass';
  if (target <= lcl) return 'fail';
  return 'hit_or_miss';
}