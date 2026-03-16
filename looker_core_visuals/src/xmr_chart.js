/**
 * xmr_chart.js
 * =============
 * NHS Making Data Count XmR (Individuals/Moving Range) Chart for Looker Core
 * 
 * This visualization implements the XmR chart following NHS MDC methodology,
 * aligned with the NHS-R NHSRplotthedots package and custom_spc_mdc Python package.
 * 
 * XmR charts are suitable for individual measurements collected over time.
 */

import { 
  NHS_COLORS, 
  POINT_COLORS, 
  calculateMovingRange, 
  calculateMean,
  rule1Astronomical,
  rule2Shift,
  rule3Trend,
  rule4TwoInThree,
  determinePointColors,
  validateData,
  formatNumber
} from './spc_utils.js';

// Chart constants for XmR calculations
const D2_CONSTANT = 1.128; // For moving range of 2 observations
const D3_CONSTANT = 0;     // Lower constant for moving range control limits
const D4_CONSTANT = 3.267; // Upper constant for moving range control limits

/**
 * Calculate XmR control limits following NHS MDC methodology
 * @param {Array} data - Array of data objects with value column
 * @param {string} valueColumn - Name of the value column (default: 'value')
 * @returns {Object} - Calculated limits and processed data
 */
export function calculateXmRLimits(data, valueColumn = 'value') {
  validateData(data, 'xmr', valueColumn);
  
  const values = data.map(row => Number(row[valueColumn]));
  const movingRanges = calculateMovingRange(values);
  
  // Calculate mean of individual values (center line)
  const mean = calculateMean(values);
  
  // Calculate mean moving range (for control limit calculation)
  const meanMovingRange = calculateMean(movingRanges);
  
  // Calculate 3-sigma control limits
  const ucl = mean + (3 * meanMovingRange / D2_CONSTANT);
  const lcl = mean - (3 * meanMovingRange / D2_CONSTANT);
  
  // Calculate 2-sigma warning limits
  const uwl = mean + (2 * meanMovingRange / D2_CONSTANT);
  const lwl = mean - (2 * meanMovingRange / D2_CONSTANT);
  
  // Create arrays for each point (constant values for XmR)
  const meanArray = new Array(values.length).fill(mean);
  const uclArray = new Array(values.length).fill(ucl);
  const lclArray = new Array(values.length).fill(lcl);
  const uwlArray = new Array(values.length).fill(uwl);
  const lwlArray = new Array(values.length).fill(lwl);
  
  return {
    processedData: data.map((row, index) => ({
      ...row,
      mean: mean,
      ucl: ucl,
      lcl: lcl,
      uwl: uwl,
      lwl: lwl,
      movingRange: index > 0 ? movingRanges[index - 1] : null
    })),
    values,
    meanArray,
    uclArray,
    lclArray,
    uwlArray,
    lwlArray,
    statistics: {
      mean: mean,
      ucl: ucl,
      lcl: lcl,
      uwl: uwl,
      lwl: lwl,
      meanMovingRange: meanMovingRange
    }
  };
}

/**
 * Detect special causes in XmR chart data
 * @param {Array} values - Data values
 * @param {Array} meanArray - Center line values
 * @param {Array} uclArray - Upper control limits
 * @param {Array} lclArray - Lower control limits
 * @param {Array} uwlArray - Upper warning limits
 * @param {Array} lwlArray - Lower warning limits
 * @returns {Object} - Special cause detection results
 */
export function detectXmRSpecialCauses(values, meanArray, uclArray, lclArray, uwlArray, lwlArray) {
  const rule1 = rule1Astronomical(values, uclArray, lclArray);
  const rule2 = rule2Shift(values, meanArray, 7);
  const rule3 = rule3Trend(values, 7);
  const rule4 = rule4TwoInThree(values, meanArray, uclArray, lclArray, uwlArray, lwlArray);
  
  const specialCause = rule1.map((r1, i) => r1 || rule2[i] || rule3[i] || rule4[i]);
  
  return {
    rule1,
    rule2,
    rule3,
    rule4,
    specialCause
  };
}

/**
 * Looker Core XmR Chart Visualization
 */
export const XmRChart = {
  
  /**
   * Configuration options for the visualization
   */
  options: {
    value_column: {
      type: 'string',
      label: 'Value Column',
      default: 'value',
      section: 'Data',
      order: 1
    },
    chart_title: {
      type: 'string',
      label: 'Chart Title',
      default: 'XmR Chart - Individual Measurements',
      section: 'Chart',
      order: 1
    },
    improvement_direction: {
      type: 'string',
      label: 'Improvement Direction',
      display: 'select',
      values: [
        { 'High': 'high' },
        { 'Low': 'low' }
      ],
      default: 'high',
      section: 'Analysis',
      order: 1
    },
    target_value: {
      type: 'number',
      label: 'Target Value',
      section: 'Analysis',
      order: 2
    },
    show_target_line: {
      type: 'boolean',
      label: 'Show Target Line',
      default: false,
      section: 'Display',
      order: 1
    },
    show_control_limits: {
      type: 'boolean',
      label: 'Show Control Limits',
      default: true,
      section: 'Display',
      order: 2
    },
    show_warning_limits: {
      type: 'boolean',
      label: 'Show Warning Limits',
      default: false,
      section: 'Display',
      order: 3
    },
    show_center_line: {
      type: 'boolean',
      label: 'Show Center Line',
      default: true,
      section: 'Display',
      order: 4
    },
    show_annotations: {
      type: 'boolean',
      label: 'Show Special Cause Annotations',
      default: true,
      section: 'Display',
      order: 5
    }
  },

  /**
   * Create the visualization
   * @param {HTMLElement} element - DOM element to render to
   * @param {Object} config - Looker configuration object
   */
  create(element, config) {
    // Clear any existing content
    element.innerHTML = '';
    
    // Create container div
    const container = element.appendChild(document.createElement('div'));
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'relative';
    
    // Store reference for updates
    this._container = container;
  },

  /**
   * Update the visualization with new data
   * @param {Array} data - Looker data array
   * @param {HTMLElement} element - DOM element
   * @param {Object} config - Looker configuration object
   * @param {Object} queryResponse - Looker query response
   */
  updateAsync(data, element, config, queryResponse, done) {
    try {
      // Validate we have data
      if (!data || data.length === 0) {
        this._container.innerHTML = '<div style="padding: 20px; text-align: center;">No data available</div>';
        done();
        return;
      }

      const valueColumn = config.value_column || 'value';
      const improvementDirection = config.improvement_direction || 'high';
      const targetValue = config.target_value ? Number(config.target_value) : null;
      
      // Calculate control limits
      const xmrResults = calculateXmRLimits(data, valueColumn);
      const { values, meanArray, uclArray, lclArray, uwlArray, lwlArray, statistics } = xmrResults;
      
      // Detect special causes
      const specialCauses = detectXmRSpecialCauses(values, meanArray, uclArray, lclArray, uwlArray, lwlArray);
      
      // Determine point colors
      const pointColors = determinePointColors(
        values, 
        meanArray, 
        specialCauses, 
        improvementDirection, 
        targetValue
      );
      
      // Build chart using D3 or Chart.js
      this._renderChart({
        data: data,
        values: values,
        statistics: statistics,
        specialCauses: specialCauses,
        pointColors: pointColors,
        config: config,
        queryResponse: queryResponse
      });
      
      done();
    } catch (error) {
      console.error('XmR Chart Error:', error);
      this._container.innerHTML = `<div style="padding: 20px; color: red;">Error: ${error.message}</div>`;
      done();
    }
  },

  /**
   * Render the chart visualization
   * @private
   */
  _renderChart(params) {
    const { data, values, statistics, specialCauses, pointColors, config } = params;
    
    // Clear container
    this._container.innerHTML = '';
    
    // Create SVG element
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.backgroundColor = 'white';
    this._container.appendChild(svg);
    
    // Chart dimensions
    const margin = { top: 60, right: 40, bottom: 60, left: 80 };
    const containerRect = this._container.getBoundingClientRect();
    const width = containerRect.width - margin.left - margin.right;
    const height = containerRect.height - margin.top - margin.bottom;
    
    // Create chart group
    const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chartGroup.setAttribute('transform', `translate(${margin.left}, ${margin.top})`);
    svg.appendChild(chartGroup);
    
    // Create scales
    const xScale = this._createLinearScale([0, values.length - 1], [0, width]);
    const yMin = Math.min(...values, statistics.lcl) * 0.95;
    const yMax = Math.max(...values, statistics.ucl) * 1.05;
    const yScale = this._createLinearScale([yMin, yMax], [height, 0]);
    
    // Draw control limit lines
    if (config.show_control_limits !== false) {
      this._drawLine(chartGroup, xScale, yScale, values.length, statistics.ucl, NHS_COLORS.DARK_BLUE, '--');
      this._drawLine(chartGroup, xScale, yScale, values.length, statistics.lcl, NHS_COLORS.DARK_BLUE, '--');
    }
    
    // Draw warning limit lines
    if (config.show_warning_limits) {
      this._drawLine(chartGroup, xScale, yScale, values.length, statistics.uwl, NHS_COLORS.DARK_BLUE, '.');
      this._drawLine(chartGroup, xScale, yScale, values.length, statistics.lwl, NHS_COLORS.DARK_BLUE, '.');
    }
    
    // Draw center line
    if (config.show_center_line !== false) {
      this._drawLine(chartGroup, xScale, yScale, values.length, statistics.mean, NHS_COLORS.BLUE, '-');
    }
    
    // Draw target line
    if (config.show_target_line && config.target_value) {
      this._drawLine(chartGroup, xScale, yScale, values.length, config.target_value, NHS_COLORS.WARM_YELLOW, '--');
    }
    
    // Draw data points
    this._drawDataPoints(chartGroup, xScale, yScale, values, pointColors);
    
    // Draw axes
    this._drawAxes(chartGroup, xScale, yScale, width, height);
    
    // Add title
    this._addTitle(svg, config.chart_title || 'XmR Chart - Individual Measurements', containerRect.width);
    
    // Add legend
    this._addLegend(chartGroup, width, height, specialCauses, config);
  },

  /**
   * Create linear scale function
   * @private
   */
  _createLinearScale(domain, range) {
    const [d0, d1] = domain;
    const [r0, r1] = range;
    const scale = (value) => r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
    scale.invert = (value) => d0 + ((value - r0) / (r1 - r0)) * (d1 - d0);
    return scale;
  },

  /**
   * Draw a line on the chart
   * @private
   */
  _drawLine(group, xScale, yScale, length, yValue, color, strokeType) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', xScale(0));
    line.setAttribute('y1', yScale(yValue));
    line.setAttribute('x2', xScale(length - 1));
    line.setAttribute('y2', yScale(yValue));
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', strokeType === '-' ? '2' : '1');
    
    if (strokeType === '--') {
      line.setAttribute('stroke-dasharray', '5,5');
    } else if (strokeType === '.') {
      line.setAttribute('stroke-dasharray', '2,2');
    }
    
    group.appendChild(line);
  },

  /**
   * Draw data points
   * @private
   */
  _drawDataPoints(group, xScale, yScale, values, pointColors) {
    values.forEach((value, index) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', xScale(index));
      circle.setAttribute('cy', yScale(value));
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', pointColors[index]);
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '1');
      
      // Add tooltip
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `Point ${index + 1}: ${formatNumber(value)}`;
      circle.appendChild(title);
      
      group.appendChild(circle);
      
      // Connect points with lines
      if (index > 0) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', xScale(index - 1));
        line.setAttribute('y1', yScale(values[index - 1]));
        line.setAttribute('x2', xScale(index));
        line.setAttribute('y2', yScale(value));
        line.setAttribute('stroke', '#cccccc');
        line.setAttribute('stroke-width', '1');
        line.setAttribute('opacity', '0.7');
        group.insertBefore(line, circle);
      }
    });
  },

  /**
   * Draw chart axes
   * @private
   */
  _drawAxes(group, xScale, yScale, width, height) {
    // Y-axis
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', 0);
    yAxis.setAttribute('y1', 0);
    yAxis.setAttribute('x2', 0);
    yAxis.setAttribute('y2', height);
    yAxis.setAttribute('stroke', '#333');
    yAxis.setAttribute('stroke-width', '1');
    group.appendChild(yAxis);
    
    // X-axis
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', 0);
    xAxis.setAttribute('y1', height);
    xAxis.setAttribute('x2', width);
    xAxis.setAttribute('y2', height);
    xAxis.setAttribute('stroke', '#333');
    xAxis.setAttribute('stroke-width', '1');
    group.appendChild(xAxis);
  },

  /**
   * Add chart title
   * @private
   */
  _addTitle(svg, title, width) {
    const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    titleText.setAttribute('x', width / 2);
    titleText.setAttribute('y', 30);
    titleText.setAttribute('text-anchor', 'middle');
    titleText.setAttribute('font-family', 'Arial, sans-serif');
    titleText.setAttribute('font-size', '16');
    titleText.setAttribute('font-weight', 'bold');
    titleText.setAttribute('fill', '#333');
    titleText.textContent = title;
    svg.appendChild(titleText);
  },

  /**
   * Add legend to the chart
   * @private
   */
  _addLegend(group, width, height, specialCauses, config) {
    const legend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    legend.setAttribute('transform', `translate(${width - 150}, 20)`);
    
    const legendItems = [
      { color: POINT_COLORS.COMMON_CAUSE, label: 'Common Cause' },
      { color: POINT_COLORS.IMPROVEMENT, label: 'Improvement' },
      { color: POINT_COLORS.CONCERN, label: 'Concern' }
    ];
    
    legendItems.forEach((item, index) => {
      const y = index * 20;
      
      // Legend color circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', 8);
      circle.setAttribute('cy', y + 8);
      circle.setAttribute('r', 4);
      circle.setAttribute('fill', item.color);
      legend.appendChild(circle);
      
      // Legend text
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', 20);
      text.setAttribute('y', y + 12);
      text.setAttribute('font-family', 'Arial, sans-serif');
      text.setAttribute('font-size', '12');
      text.setAttribute('fill', '#333');
      text.textContent = item.label;
      legend.appendChild(text);
    });
    
    group.appendChild(legend);
  }
};

// Register with Looker
if (typeof looker !== 'undefined') {
  looker.plugins.visualizations.add(XmRChart);
}

export default XmRChart;