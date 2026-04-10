/**
 * c_chart.js
 * ===========
 * NHS Making Data Count c Chart (Counts) for Looker Core
 * 
 * This visualization implements the c chart following NHS MDC methodology,
 * aligned with the NHS-R NHSRplotthedots package and custom_spc_mdc Python package.
 * 
 * c charts are suitable for count data with a constant sample size 
 * (e.g., number of adverse events per ward per month, defects per batch).
 */

import { 
  NHS_COLORS, 
  POINT_COLORS, 
  calculateMean,
  rule1Astronomical,
  rule2Shift,
  rule3Trend,
  rule4TwoInThree,
  determinePointColors,
  validateData,
  formatNumber,
  SPC_MIN_DATA_POINTS
} from './spc_utils.js';

/**
 * Calculate c chart control limits following NHS MDC methodology
 * @param {Array} data - Array of data objects
 * @param {string} valueColumn - Name of count column
 * @returns {Object} - Calculated limits and processed data
 */
export function calculateCChartLimits(data, valueColumn = 'value') {
  validateData(data, 'c', valueColumn);
  
  const counts = data.map(row => Number(row[valueColumn]));
  
  // Calculate mean count (center line)
  const meanCount = calculateMean(counts);
  
  // For c chart, standard error is sqrt(mean count) - Poisson distribution
  const standardError = Math.sqrt(meanCount);
  
  // Calculate control limits (constant for all points)
  const ucl = meanCount + (3 * standardError);
  const lcl = meanCount - (3 * standardError);
  
  // Calculate warning limits (2-sigma)
  const uwl = meanCount + (2 * standardError);
  const lwl = meanCount - (2 * standardError);
  
  // Ensure LCL and LWL are non-negative for count data
  const adjustedLCL = Math.max(lcl, 0);
  const adjustedLWL = Math.max(lwl, 0);
  
  // Create arrays for each point (constant values for c chart)
  const meanArray = new Array(counts.length).fill(meanCount);
  const uclArray = new Array(counts.length).fill(ucl);
  const lclArray = new Array(counts.length).fill(adjustedLCL);
  const uwlArray = new Array(counts.length).fill(uwl);
  const lwlArray = new Array(counts.length).fill(adjustedLWL);
  
  return {
    processedData: data.map((row, index) => ({
      ...row,
      count: counts[index],
      mean: meanCount,
      ucl: ucl,
      lcl: adjustedLCL,
      uwl: uwl,
      lwl: adjustedLWL
    })),
    values: counts,
    meanArray,
    uclArray,
    lclArray,
    uwlArray,
    lwlArray,
    statistics: {
      meanCount: meanCount,
      ucl: ucl,
      lcl: adjustedLCL,
      uwl: uwl,
      lwl: adjustedLWL,
      standardError: standardError
    }
  };
}

/**
 * Looker Core c Chart Visualization
 */
export const CChart = {
  
  /**
   * Configuration options for the visualization
   */
  options: {
    value_column: {
      type: 'string',
      label: 'Count Column',
      default: 'value',
      section: 'Data',
      order: 1
    },
    chart_title: {
      type: 'string',
      label: 'Chart Title',
      default: 'c Chart - Count of Events',
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
      default: 'low',
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
    }
  },

  /**
   * Create the visualization
   */
  create(element, config) {
    element.innerHTML = '';
    const container = element.appendChild(document.createElement('div'));
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.position = 'relative';
    this._container = container;
  },

  /**
   * Update the visualization with new data
   */
  updateAsync(data, element, config, queryResponse, done) {
    try {
      if (!data || data.length === 0) {
        this._container.innerHTML = '<div style="padding: 20px; text-align: center;">No data available</div>';
        done();
        return;
      }

      const valueColumn = config.value_column || 'value';
      const improvementDirection = config.improvement_direction || 'low';
      const targetValue = config.target_value ? Number(config.target_value) : null;
      
      // Calculate control limits
      const chartResults = calculateCChartLimits(data, valueColumn);
      const { values, meanArray, uclArray, lclArray, uwlArray, lwlArray, statistics } = chartResults;
      
      // Detect special causes
      const rule1 = rule1Astronomical(values, uclArray, lclArray);
      const rule2 = rule2Shift(values, meanArray, 8);
      const rule3 = rule3Trend(values, 6);
      const rule4 = rule4TwoInThree(values, meanArray, uclArray, lclArray, uwlArray, lwlArray);
      const specialCause = rule1.map((r1, i) => r1 || rule2[i] || rule3[i] || rule4[i]);
      
      const specialCauses = { rule1, rule2, rule3, rule4, specialCause };
      
      // Determine point colors
      const pointColors = determinePointColors(
        values, 
        meanArray, 
        uclArray,
        lclArray,
        specialCauses, 
        improvementDirection, 
        targetValue
      );
      
      // Render chart
      this._renderChart({
        data: data,
        values: values,
        meanArray: meanArray,
        uclArray: uclArray,
        lclArray: lclArray,
        uwlArray: uwlArray,
        lwlArray: lwlArray,
        targetValue: targetValue,
        statistics: statistics,
        specialCauses: specialCauses,
        pointColors: pointColors,
        config: config
      });
      
      done();
    } catch (error) {
      console.error('c Chart Error:', error);
      this._container.innerHTML = `<div style="padding: 20px; color: red;">Error: ${error.message}</div>`;
      done();
    }
  },

  /**
   * Render the chart visualization
   * @private
   */
  _renderChart(params) {
    const { 
      data, values, meanArray, uclArray, lclArray, uwlArray, lwlArray, 
      targetValue, statistics, specialCauses, pointColors, config
    } = params;
    
    // Clear container
    this._container.innerHTML = '';
    
    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.style.backgroundColor = 'white';
    this._container.appendChild(svg);
    
    // Chart dimensions
    const margin = { top: 60, right: 40, bottom: 60, left: 80 };
    const containerRect = this._container.getBoundingClientRect();
    const width = Math.max(containerRect.width - margin.left - margin.right, 200);
    const height = Math.max(containerRect.height - margin.top - margin.bottom, 120);
    const svgWidth = width + margin.left + margin.right;
    const svgHeight = height + margin.top + margin.bottom;
    svg.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    
    // Create chart group
    const chartGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    chartGroup.setAttribute('transform', `translate(${margin.left}, ${margin.top})`);
    svg.appendChild(chartGroup);
    
    // Create scales
    const xScale = this._createLinearScale([0, values.length - 1], [0, width]);
    
    // Calculate y-scale bounds
    const allYValues = [...values, statistics.ucl, statistics.lcl];
    if (targetValue !== null) allYValues.push(targetValue);
    const yMin = Math.min(...allYValues, 0) * 0.95;
    const yMax = Math.max(...allYValues) * 1.05;
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
      this._drawLine(chartGroup, xScale, yScale, values.length, statistics.meanCount, NHS_COLORS.BLUE, '-');
    }
    
    // Draw target line
    if (config.show_target_line && targetValue !== null) {
      this._drawLine(chartGroup, xScale, yScale, values.length, targetValue, NHS_COLORS.WARM_YELLOW, '--');
    }
    
    // Draw data points
    this._drawDataPoints(chartGroup, xScale, yScale, values, pointColors);
    
    // Draw axes
    this._drawAxes(chartGroup, xScale, yScale, width, height);
    
    // Add title
    this._addTitle(svg, config.chart_title || 'c Chart - Count of Events', svgWidth);
    
    // Add legend
    this._addLegend(chartGroup, width, height, specialCauses, config);
    
    // Add statistics summary
    this._addStatisticsSummary(chartGroup, width, height, statistics);

    // Insufficient data warning
    if (values.length < SPC_MIN_DATA_POINTS) {
      const warningText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      warningText.setAttribute('x', margin.left + width / 2);
      warningText.setAttribute('y', margin.top + height / 2 + 16);
      warningText.setAttribute('text-anchor', 'middle');
      warningText.setAttribute('font-family', 'Arial, sans-serif');
      warningText.setAttribute('font-size', '12');
      warningText.setAttribute('font-weight', 'bold');
      warningText.setAttribute('fill', NHS_COLORS.ORANGE);
      warningText.textContent = `Warning: SPC requires at least ${SPC_MIN_DATA_POINTS} data points (${values.length} provided). Results may be unreliable.`;

      const bbox = { width: 520, height: 30 };
      const warningRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      warningRect.setAttribute('x', margin.left + width / 2 - bbox.width / 2 - 10);
      warningRect.setAttribute('y', margin.top + height / 2 - 2);
      warningRect.setAttribute('width', bbox.width + 20);
      warningRect.setAttribute('height', bbox.height + 8);
      warningRect.setAttribute('rx', '6');
      warningRect.setAttribute('fill', '#FFF9E6');
      warningRect.setAttribute('stroke', NHS_COLORS.ORANGE);
      warningRect.setAttribute('stroke-width', '1.5');
      warningRect.setAttribute('opacity', '0.95');

      svg.appendChild(warningRect);
      svg.appendChild(warningText);
    }
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
   * Draw a horizontal line
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
   * Draw data points with connecting line
   * @private
   */
  _drawDataPoints(group, xScale, yScale, values, pointColors) {
    // Draw connecting line first
    if (values.length > 1) {
      let pathData = `M ${xScale(0)} ${yScale(values[0])}`;
      for (let i = 1; i < values.length; i++) {
        pathData += ` L ${xScale(i)} ${yScale(values[i])}`;
      }
      
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathData);
      path.setAttribute('stroke', '#cccccc');
      path.setAttribute('stroke-width', '1');
      path.setAttribute('fill', 'none');
      path.setAttribute('opacity', '0.7');
      group.appendChild(path);
    }
    
    // Draw points
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
      title.textContent = `Point ${index + 1}: ${value} events`;
      circle.appendChild(title);
      
      group.appendChild(circle);
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
    
    // Y-axis label
    const yLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    yLabel.setAttribute('x', -height / 2);
    yLabel.setAttribute('y', -50);
    yLabel.setAttribute('text-anchor', 'middle');
    yLabel.setAttribute('font-family', 'Arial, sans-serif');
    yLabel.setAttribute('font-size', '12');
    yLabel.setAttribute('fill', '#333');
    yLabel.setAttribute('transform', 'rotate(-90)');
    yLabel.textContent = 'Count of Events';
    group.appendChild(yLabel);
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
      
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', 8);
      circle.setAttribute('cy', y + 8);
      circle.setAttribute('r', 4);
      circle.setAttribute('fill', item.color);
      legend.appendChild(circle);
      
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
  },

  /**
   * Add statistics summary
   * @private
   */
  _addStatisticsSummary(group, width, height, statistics) {
    const summary = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    summary.setAttribute('transform', `translate(10, ${height + 35})`);
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', 0);
    text.setAttribute('y', 0);
    text.setAttribute('font-family', 'Arial, sans-serif');
    text.setAttribute('font-size', '11');
    text.setAttribute('fill', '#666');
    text.textContent = `Mean Count: ${formatNumber(statistics.meanCount, 1)} | UCL: ${formatNumber(statistics.ucl, 1)} | LCL: ${formatNumber(statistics.lcl, 1)}`;
    summary.appendChild(text);
    
    group.appendChild(summary);
  }
};

// Register with Looker
if (typeof looker !== 'undefined') {
  looker.plugins.visualizations.add(CChart);
}

export default CChart;