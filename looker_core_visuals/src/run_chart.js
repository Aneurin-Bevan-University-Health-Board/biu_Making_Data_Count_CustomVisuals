/**
 * run_chart.js
 * =============
 * NHS Making Data Count Run Chart for Looker Core
 * 
 * This visualization implements the run chart following NHS MDC methodology,
 * aligned with the NHS-R NHSRplotthedots package and custom_spc_mdc Python package.
 * 
 * Run charts use median center line and detect signals using run-chart rules
 * (8-point shift and 6-point trend). No control limits are calculated.
 */

import { 
  NHS_COLORS, 
  POINT_COLORS, 
  calculateMedian,
  rule2Shift,
  rule3Trend,
  determinePointColors,
  validateData,
  formatNumber
} from './spc_utils.js';

/**
 * Calculate run chart center line (median) and detect signals
 * @param {Array} data - Array of data objects
 * @param {string} valueColumn - Name of the value column
 * @returns {Object} - Calculated median and processed data
 */
export function calculateRunChartSignals(data, valueColumn = 'value') {
  validateData(data, 'run', valueColumn);
  
  const values = data.map(row => Number(row[valueColumn]));
  
  // Calculate median (center line for run charts)
  const median = calculateMedian(values);
  
  // Create median array for each point
  const medianArray = new Array(values.length).fill(median);
  
  // Detect run chart signals (no Rule 1 or Rule 4 for run charts)
  const rule2 = rule2Shift(values, medianArray, 8);  // 8-point shift
  const rule3 = rule3Trend(values, 6);               // 6-point trend
  const specialCause = rule2.map((r2, i) => r2 || rule3[i]);
  
  return {
    processedData: data.map((row, index) => ({
      ...row,
      value: values[index],
      median: median
    })),
    values,
    medianArray,
    statistics: {
      median: median,
      minValue: Math.min(...values),
      maxValue: Math.max(...values)
    },
    signals: {
      rule2,
      rule3,
      specialCause
    }
  };
}

/**
 * Looker Core Run Chart Visualization
 */
export const RunChart = {
  
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
      default: 'Run Chart - Median Center Line',
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
    show_center_line: {
      type: 'boolean',
      label: 'Show Center Line (Median)',
      default: true,
      section: 'Display',
      order: 2
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
      const improvementDirection = config.improvement_direction || 'high';
      const targetValue = config.target_value ? Number(config.target_value) : null;
      
      // Calculate run chart signals
      const runResults = calculateRunChartSignals(data, valueColumn);
      const { values, medianArray, statistics, signals } = runResults;
      
      // Determine point colors (for run charts, use signals instead of control limits)
      const pointColors = this._determineRunChartColors(
        values, 
        medianArray, 
        signals, 
        improvementDirection, 
        targetValue
      );
      
      // Render chart
      this._renderChart({
        data: data,
        values: values,
        medianArray: medianArray,
        targetValue: targetValue,
        statistics: statistics,
        signals: signals,
        pointColors: pointColors,
        config: config
      });
      
      done();
    } catch (error) {
      console.error('Run Chart Error:', error);
      this._container.innerHTML = `<div style="padding: 20px; color: red;">Error: ${error.message}</div>`;
      done();
    }
  },

  /**
   * Determine point colors for run chart (simplified - no control limits)
   * @private
   */
  _determineRunChartColors(values, medianArray, signals, improvementDirection = 'high', target = null) {
    const colors = [];
    const { specialCause } = signals;
    
    for (let i = 0; i < values.length; i++) {
      if (!specialCause[i]) {
        // Common cause variation
        colors.push(POINT_COLORS.COMMON_CAUSE);
      } else {
        // Special cause - determine if improvement or concern
        const value = values[i];
        const median = medianArray[i];
        
        let isImprovement = false;
        
        if (target !== null) {
          // Use target to determine improvement
          if (improvementDirection === 'high') {
            isImprovement = value >= target;
          } else {
            isImprovement = value <= target;
          }
        } else {
          // Use median to determine improvement
          if (improvementDirection === 'high') {
            isImprovement = value > median;
          } else {
            isImprovement = value < median;
          }
        }
        
        colors.push(isImprovement ? POINT_COLORS.IMPROVEMENT : POINT_COLORS.CONCERN);
      }
    }
    
    return colors;
  },

  /**
   * Render the chart visualization
   * @private
   */
  _renderChart(params) {
    const { 
      data, values, medianArray, targetValue, statistics, 
      signals, pointColors, config
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
    const allYValues = [...values];
    if (targetValue !== null) allYValues.push(targetValue);
    const yMin = Math.min(...allYValues) * 0.95;
    const yMax = Math.max(...allYValues) * 1.05;
    const yScale = this._createLinearScale([yMin, yMax], [height, 0]);
    
    // Draw center line (median)
    if (config.show_center_line !== false) {
      this._drawLine(chartGroup, xScale, yScale, values.length, statistics.median, NHS_COLORS.BLUE, '-');
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
    this._addTitle(svg, config.chart_title || 'Run Chart - Median Center Line', svgWidth);
    
    // Add legend
    this._addLegend(chartGroup, width, height, signals, config);
    
    // Add statistics summary
    this._addStatisticsSummary(chartGroup, width, height, statistics);
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
      title.textContent = `Point ${index + 1}: ${formatNumber(value)}`;
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
    yLabel.textContent = 'Value';
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
  _addLegend(group, width, height, signals, config) {
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
    text.textContent = `Median: ${formatNumber(statistics.median)} | Min: ${formatNumber(statistics.minValue)} | Max: ${formatNumber(statistics.maxValue)}`;
    summary.appendChild(text);
    
    group.appendChild(summary);
  }
};

// Register with Looker
if (typeof looker !== 'undefined') {
  looker.plugins.visualizations.add(RunChart);
}

export default RunChart;