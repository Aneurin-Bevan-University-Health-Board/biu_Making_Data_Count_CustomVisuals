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
 * Two out of three consecutive points in warning zone (2-sigma) on same side
 * @param {number[]} values - Data values
 * @param {number[]} centerLine - Center line values
 * @param {number[]} ucl - Upper control limits (3-sigma)
 * @param {number[]} lcl - Lower control limits (3-sigma)
 * @param {number[]} uwl - Upper warning limits (2-sigma)
 * @param {number[]} lwl - Lower warning limits (2-sigma)
 * @returns {boolean[]} - Array indicating rule violations
 */
export function rule4TwoInThree(values, centerLine, ucl, lcl, uwl, lwl) {
  const violations = new Array(values.length).fill(false);
  
  for (let i = 0; i <= values.length - 3; i++) {
    let upperWarningCount = 0;
    let lowerWarningCount = 0;
    
    for (let j = i; j < i + 3; j++) {
      // Check if point is in upper warning zone
      if (values[j] > uwl[j] && values[j] <= ucl[j] && values[j] > centerLine[j]) {
        upperWarningCount++;
      }
      // Check if point is in lower warning zone
      if (values[j] < lwl[j] && values[j] >= lcl[j] && values[j] < centerLine[j]) {
        lowerWarningCount++;
      }
    }
    
    if (upperWarningCount >= 2 || lowerWarningCount >= 2) {
      for (let j = i; j < i + 3; j++) {
        violations[j] = true;
      }
    }
  }
  
  return violations;
}

/**
 * Determine point colors based on special cause rules and improvement direction
 * @param {number[]} values - Data values
 * @param {number[]} centerLine - Center line values
 * @param {Object} ruleViolations - Object containing rule violation arrays
 * @param {string} improvementDirection - 'high' or 'low'
 * @param {number|null} target - Optional target value for improvement assessment
 * @returns {string[]} - Array of color codes for each point
 */
export function determinePointColors(values, centerLine, ruleViolations, improvementDirection = 'high', target = null) {
  const colors = [];
  const { rule1, rule2, rule3, rule4, specialCause } = ruleViolations;
  
  for (let i = 0; i < values.length; i++) {
    if (!specialCause[i]) {
      // Common cause variation
      colors.push(POINT_COLORS.COMMON_CAUSE);
    } else {
      // Special cause - determine if improvement or concern
      const value = values[i];
      const center = centerLine[i];
      
      let isImprovement = false;
      
      if (target !== null) {
        // Use target to determine improvement
        if (improvementDirection === 'high') {
          isImprovement = value >= target;
        } else {
          isImprovement = value <= target;
        }
      } else {
        // Use center line to determine improvement
        if (improvementDirection === 'high') {
          isImprovement = value > center;
        } else {
          isImprovement = value < center;
        }
      }
      
      colors.push(isImprovement ? POINT_COLORS.IMPROVEMENT : POINT_COLORS.CONCERN);
    }
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