/**
 * p_chart.js
 * ===========
 * NHS Making Data Count p Chart (Proportion) for Looker Core
 * 
 * This visualization implements the p chart following NHS MDC methodology,
 * aligned with the NHS-R NHSRplotthedots package and custom_spc_mdc Python package.
 * 
 * p charts are suitable for proportion data (e.g., percentage of patients 
 * waiting > 4 hours) and require subgroup sizes for control limit calculations.
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
 * Calculate p chart control limits following NHS MDC methodology
 * @param {Array} data - Array of data objects
 * @param {string} valueColumn - Name of proportion/percentage column
 * @param {string} subgroupColumn - Name of subgroup size column
 * @param {string|null} numeratorColumn - Optional numerator column (if value is denominator)
 * @returns {Object} - Calculated limits and processed data
 */
export function calculatePChartLimits(data, valueColumn = 'value', subgroupColumn = 'subgroup_size', numeratorColumn = null) {
  validateData(data, 'p', valueColumn, subgroupColumn);
  
  let proportions = [];
  let subgroupSizes = [];
  
  // Handle two modes: direct proportions or numerator/denominator
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    
    if (numeratorColumn && row[numeratorColumn] !== null && row[numeratorColumn] !== undefined) {
      // Mode: numerator/denominator provided
      const numerator = Number(row[numeratorColumn]);
      const denominator = Number(row[valueColumn]); // valueColumn is denominator in this mode
      const proportion = denominator > 0 ? numerator / denominator : 0;
      proportions.push(proportion);
      subgroupSizes.push(denominator);
    } else {
      // Mode: direct proportion provided
      const proportion = Number(row[valueColumn]);
      const subgroupSize = Number(row[subgroupColumn]);
      proportions.push(proportion);
      subgroupSizes.push(subgroupSize);
    }
  }
  
  // Calculate overall proportion (center line)
  let totalNumerator = 0;
  let totalDenominator = 0;
  
  for (let i = 0; i < proportions.length; i++) {
    totalNumerator += proportions[i] * subgroupSizes[i];
    totalDenominator += subgroupSizes[i];
  }
  
  const meanProportion = totalDenominator > 0 ? totalNumerator / totalDenominator : 0;
  
  // Calculate variable control limits for each point
  const ucl = [];
  const lcl = [];
  const uwl = [];
  const lwl = [];
  const meanArray = [];
  
  for (let i = 0; i < proportions.length; i++) {
    const n = subgroupSizes[i];
    const p = meanProportion;
    
    // Standard error for proportion
    const standardError = Math.sqrt((p * (1 - p)) / n);
    
    // 3-sigma control limits
    const uclValue = p + (3 * standardError);
    const lclValue = p - (3 * standardError);
    
    // 2-sigma warning limits
    const uwlValue = p + (2 * standardError);
    const lwlValue = p - (2 * standardError);
    
    // Ensure limits are within [0, 1] bounds for proportions
    ucl.push(Math.min(uclValue, 1));
    lcl.push(Math.max(lclValue, 0));
    uwl.push(Math.min(uwlValue, 1));
    lwl.push(Math.max(lwlValue, 0));
    meanArray.push(meanProportion);
  }
  
  return {
    processedData: data.map((row, index) => ({
      ...row,
      proportion: proportions[index],
      subgroup_size: subgroupSizes[index],
      mean: meanArray[index],
      ucl: ucl[index],
      lcl: lcl[index],
      uwl: uwl[index],
      lwl: lwl[index]
    })),
    values: proportions,
    meanArray,
    uclArray: ucl,
    lclArray: lcl,
    uwlArray: uwl,
    lwlArray: lwl,
    subgroupSizes,
    statistics: {
      meanProportion: meanProportion,
      totalNumerator: totalNumerator,
      totalDenominator: totalDenominator
    }
  };
}

/**
 * Looker Core p Chart Visualization
 */
export const PChart = {
  
  /**
   * Configuration options for the visualization
   */
  options: {
    value_column: {
      type: 'string',
      label: 'Proportion Column',
      default: 'value',
      section: 'Data',
      order: 1
    },
    subgroup_column: {
      type: 'string',
      label: 'Subgroup Size Column',
      default: 'subgroup_size',
      section: 'Data',
      order: 2
    },
    numerator_column: {
      type: 'string',
      label: 'Numerator Column (Optional)',
      section: 'Data',
      order: 3
    },
    chart_title: {
      type: 'string',
      label: 'Chart Title',
      default: 'p Chart - Proportion',
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
    },
    display_as_percentage: {
      type: 'boolean',
      label: 'Display as Percentage',
      default: false,
      section: 'Format',
      order: 1
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
      const subgroupColumn = config.subgroup_column || 'subgroup_size';
      const numeratorColumn = config.numerator_column;
      const improvementDirection = config.improvement_direction || 'low';
      const targetValue = config.target_value ? Number(config.target_value) : null;
      const displayAsPercentage = config.display_as_percentage || false;
      
      // Calculate control limits
      const chartResults = calculatePChartLimits(data, valueColumn, subgroupColumn, numeratorColumn);
      const { values, meanArray, uclArray, lclArray, uwlArray, lwlArray, statistics } = chartResults;
      
      // Convert to percentage if requested
      let displayValues = values;
      let displayMean = meanArray;
      let displayUCL = uclArray;
      let displayLCL = lclArray;
      let displayUWL = uwlArray;
      let displayLWL = lwlArray;
      let displayTarget = targetValue;
      
      if (displayAsPercentage) {
        displayValues = values.map(v => v * 100);
        displayMean = meanArray.map(v => v * 100);
        displayUCL = uclArray.map(v => v * 100);
        displayLCL = lclArray.map(v => v * 100);
        displayUWL = uwlArray.map(v => v * 100);
        displayLWL = lwlArray.map(v => v * 100);
        displayTarget = targetValue ? targetValue * 100 : null;
      }
      
      // Detect special causes (use original proportions for rules)
      const rule1 = rule1Astronomical(values, uclArray, lclArray);
      const rule2 = rule2Shift(values, meanArray, 7);
      const rule3 = rule3Trend(values, 7);
      const rule4 = rule4TwoInThree(values, meanArray, uclArray, lclArray, uwlArray, lwlArray);
      const specialCause = rule1.map((r1, i) => r1 || rule2[i] || rule3[i] || rule4[i]);
      
      const specialCauses = { rule1, rule2, rule3, rule4, specialCause };
      
      // Determine point colors (use original values for analysis)
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
        values: displayValues,
        meanArray: displayMean,
        uclArray: displayUCL,
        lclArray: displayLCL,
        uwlArray: displayUWL,
        lwlArray: displayLWL,
        targetValue: displayTarget,
        statistics: statistics,
        specialCauses: specialCauses,
        pointColors: pointColors,
        config: config,
        displayAsPercentage: displayAsPercentage
      });
      
      done();
    } catch (error) {
      console.error('p Chart Error:', error);
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
      targetValue, statistics, specialCauses, pointColors, config, displayAsPercentage
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
    const allYValues = [...values, ...uclArray, ...lclArray];
    if (targetValue !== null) allYValues.push(targetValue);
    const yMin = Math.min(...allYValues) * 0.95;
    const yMax = Math.max(...allYValues) * 1.05;
    const yScale = this._createLinearScale([yMin, yMax], [height, 0]);
    
    // Draw control limit lines (variable limits)
    if (config.show_control_limits !== false) {
      this._drawVariableLine(chartGroup, xScale, yScale, uclArray, NHS_COLORS.DARK_BLUE, '--');
      this._drawVariableLine(chartGroup, xScale, yScale, lclArray, NHS_COLORS.DARK_BLUE, '--');
    }
    
    // Draw warning limit lines
    if (config.show_warning_limits) {
      this._drawVariableLine(chartGroup, xScale, yScale, uwlArray, NHS_COLORS.DARK_BLUE, '.');
      this._drawVariableLine(chartGroup, xScale, yScale, lwlArray, NHS_COLORS.DARK_BLUE, '.');
    }
    
    // Draw center line
    if (config.show_center_line !== false) {
      this._drawVariableLine(chartGroup, xScale, yScale, meanArray, NHS_COLORS.BLUE, '-');
    }
    
    // Draw target line
    if (config.show_target_line && targetValue !== null) {
      this._drawLine(chartGroup, xScale, yScale, values.length, targetValue, NHS_COLORS.WARM_YELLOW, '--');
    }
    
    // Draw data points
    this._drawDataPoints(chartGroup, xScale, yScale, values, pointColors, displayAsPercentage);
    
    // Draw axes
    this._drawAxes(chartGroup, xScale, yScale, width, height, displayAsPercentage);
    
    // Add title
    this._addTitle(svg, config.chart_title || 'p Chart - Proportion', svgWidth);
    
    // Add legend
    this._addLegend(chartGroup, width, height, specialCauses, config);
    
    // Add statistics summary
    this._addStatisticsSummary(chartGroup, width, height, statistics, displayAsPercentage);

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
   * Draw a fixed horizontal line
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
   * Draw a variable line (different y-value for each x-point)
   * @private
   */
  _drawVariableLine(group, xScale, yScale, yValues, color, strokeType) {
    if (yValues.length < 2) return;
    
    let pathData = `M ${xScale(0)} ${yScale(yValues[0])}`;
    for (let i = 1; i < yValues.length; i++) {
      pathData += ` L ${xScale(i)} ${yScale(yValues[i])}`;
    }
    
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', color);
    path.setAttribute('stroke-width', strokeType === '-' ? '2' : '1');
    path.setAttribute('fill', 'none');
    
    if (strokeType === '--') {
      path.setAttribute('stroke-dasharray', '5,5');
    } else if (strokeType === '.') {
      path.setAttribute('stroke-dasharray', '2,2');
    }
    
    group.appendChild(path);
  },

  /**
   * Draw data points with connecting line
   * @private
   */
  _drawDataPoints(group, xScale, yScale, values, pointColors, displayAsPercentage) {
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
      const displayValue = displayAsPercentage ? `${formatNumber(value, 1)}%` : formatNumber(value, 3);
      title.textContent = `Point ${index + 1}: ${displayValue}`;
      circle.appendChild(title);
      
      group.appendChild(circle);
    });
  },

  /**
   * Draw chart axes
   * @private
   */
  _drawAxes(group, xScale, yScale, width, height, displayAsPercentage) {
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
    yLabel.textContent = displayAsPercentage ? 'Proportion (%)' : 'Proportion';
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
  _addStatisticsSummary(group, width, height, statistics, displayAsPercentage) {
    const summary = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    summary.setAttribute('transform', `translate(10, ${height + 35})`);
    
    const meanValue = displayAsPercentage ? 
      `${formatNumber(statistics.meanProportion * 100, 1)}%` : 
      formatNumber(statistics.meanProportion, 3);
    
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', 0);
    text.setAttribute('y', 0);
    text.setAttribute('font-family', 'Arial, sans-serif');
    text.setAttribute('font-size', '11');
    text.setAttribute('fill', '#666');
    text.textContent = `Mean Proportion: ${meanValue} | Total Events: ${statistics.totalNumerator} | Total Population: ${statistics.totalDenominator}`;
    summary.appendChild(text);
    
    group.appendChild(summary);
  }
};

// Register with Looker
if (typeof looker !== 'undefined') {
  looker.plugins.visualizations.add(PChart);
}

export default PChart;