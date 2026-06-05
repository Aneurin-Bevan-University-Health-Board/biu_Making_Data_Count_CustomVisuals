/**
 * auto_chart.js
 * ==============
 * Smart NHS Making Data Count Auto-Chart for Looker Core
 * 
 * This visualization automatically determines the best chart type and calculates
 * all required parameters from minimal input: just date and value columns.
 * 
 * Features:
 * - Automatic chart type detection
 * - Intelligent data analysis
 * - Minimal configuration required
 * - NHS MDC methodology compliance
 */

import { XmRChart } from './xmr_chart.js';
import { PChart } from './p_chart.js';
import { UChart } from './u_chart.js';
import { CChart } from './c_chart.js';
import { TChart } from './t_chart.js';
import { GChart } from './g_chart.js';
import { RunChart } from './run_chart.js';
import { NHS_COLORS, formatNumber } from './spc_utils.js';

/**
 * Analyze data to determine the most appropriate chart type
 * @param {Array} data - Input data with date and value columns
 * @param {string} valueColumn - Name of the value column
 * @returns {Object} - Analysis results and recommendations
 */
function analyzeDataForChartType(data, valueColumn) {
  const values = data.map(row => Number(row[valueColumn])).filter(v => !isNaN(v));
  
  if (values.length === 0) {
    throw new Error('No valid numeric values found in data');
  }
  
  const analysis = {
    count: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    mean: values.reduce((sum, v) => sum + v, 0) / values.length,
    hasDecimals: values.some(v => v % 1 !== 0),
    allPositive: values.every(v => v >= 0),
    allIntegers: values.every(v => v % 1 === 0),
    range01: values.every(v => v >= 0 && v <= 1),
    smallIntegers: values.every(v => v >= 0 && v <= 50 && v % 1 === 0)
  };
  
  // Chart type decision logic
  let recommendedChart = 'xmr'; // Default fallback
  let confidence = 'medium';
  let reasoning = '';
  
  if (analysis.range01 && analysis.hasDecimals) {
    // Values between 0-1 with decimals = likely proportions
    recommendedChart = 'p';
    confidence = 'high';
    reasoning = 'Values appear to be proportions (0-1 range with decimals)';
  } else if (analysis.allIntegers && analysis.allPositive && analysis.smallIntegers) {
    // Small positive integers = likely counts
    if (analysis.max <= 10 && analysis.mean < 5) {
      recommendedChart = 'c';
      confidence = 'high';
      reasoning = 'Small integer counts suggest c-chart (fixed sample size)';
    } else {
      recommendedChart = 'u';
      confidence = 'medium';
      reasoning = 'Integer counts suggest u-chart (variable sample sizes)';
    }
  } else if (analysis.allPositive && !analysis.hasDecimals) {
    // Positive integers (larger range)
    recommendedChart = 'c';
    confidence = 'medium';
    reasoning = 'Positive integer values suggest count data (c-chart)';
  } else {
    // Continuous data or negative values = individual measurements
    recommendedChart = 'xmr';
    confidence = 'high';
    reasoning = 'Continuous or negative values suggest individual measurements (XmR)';
  }
  
  return {
    analysis,
    recommendedChart,
    confidence,
    reasoning,
    alternativeCharts: ['run'] // Run chart is always an alternative
  };
}

/**
 * Prepare data for the selected chart type
 * @param {Array} data - Original data
 * @param {string} valueColumn - Value column name
 * @param {string} chartType - Selected chart type
 * @returns {Array} - Prepared data with required columns
 */
function prepareDataForChart(data, valueColumn, chartType) {
  const preparedData = data.map(row => ({ ...row }));
  
  switch (chartType) {
    case 'p':
      // For p-chart, if we only have proportions, assume subgroup size of 100
      if (!preparedData[0].subgroup_size) {
        preparedData.forEach(row => {
          row.subgroup_size = 100; // Default assumption
        });
      }
      break;
      
    case 'u':
      // For u-chart, if we only have rates, assume area of opportunity = 1
      if (!preparedData[0].subgroup_size) {
        preparedData.forEach(row => {
          row.subgroup_size = 1; // Default assumption
        });
      }
      break;
      
    case 'xmr':
    case 'c':
    case 'run':
    default:
      // These charts only need the value column
      break;
  }
  
  return preparedData;
}

/**
 * Auto Chart Visualization - Smart NHS MDC Chart Selection
 */
export const AutoChart = {
  
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
    date_column: {
      type: 'string',
      label: 'Date Column (Optional)',
      section: 'Data',
      order: 2
    },
    chart_type: {
      type: 'string',
      label: 'Chart Type',
      display: 'select',
      values: [
        { 'Auto-Detect': 'auto' },
        { 'XmR Chart': 'xmr' },
        { 'p Chart (Proportion)': 'p' },
        { 'u Chart (Rate)': 'u' },
        { 'c Chart (Count)': 'c' },
        { 't Chart (Time Between Rare Events)': 't' },
        { 'g Chart (Opportunities Between Rare Events)': 'g' },
        { 'Run Chart': 'run' }
      ],
      default: 'auto',
      section: 'Chart',
      order: 1
    },
    chart_title: {
      type: 'string',
      label: 'Chart Title',
      section: 'Chart',
      order: 2
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
    show_analysis_info: {
      type: 'boolean',
      label: 'Show Data Analysis Info',
      default: true,
      section: 'Display',
      order: 1
    },
    subgroup_size: {
      type: 'number',
      label: 'Default Subgroup Size (p/u charts)',
      default: 100,
      section: 'Advanced',
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
    this._currentChart = null;
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
      const chartType = config.chart_type || 'auto';
      const defaultSubgroupSize = config.subgroup_size || 100;
      
      let selectedChartType = chartType;
      let dataAnalysis = null;
      
      // Auto-detect chart type if requested
      if (chartType === 'auto') {
        try {
          dataAnalysis = analyzeDataForChartType(data, valueColumn);
          selectedChartType = dataAnalysis.recommendedChart;
        } catch (error) {
          console.warn('Auto-detection failed, defaulting to XmR:', error);
          selectedChartType = 'xmr';
        }
      }
      
      // Prepare data for the selected chart type
      const preparedData = this._prepareDataForChart(data, valueColumn, selectedChartType, defaultSubgroupSize);
      
      // Generate appropriate title if not provided
      const chartTitle = config.chart_title || this._generateTitle(selectedChartType, dataAnalysis);
      
      // Create chart configuration
      const chartConfig = {
        ...config,
        chart_title: chartTitle,
        value_column: valueColumn
      };
      
      // Add chart-specific configurations
      if (selectedChartType === 'p' || selectedChartType === 'u') {
        chartConfig.subgroup_column = 'subgroup_size';
      }
      
      // Render the appropriate chart
      this._renderChart(selectedChartType, preparedData, chartConfig, queryResponse, dataAnalysis, done);
      
    } catch (error) {
      console.error('Auto Chart Error:', error);
      this._container.innerHTML = `<div style="padding: 20px; color: red;">Error: ${error.message}</div>`;
      done();
    }
  },

  /**
   * Prepare data for specific chart type
   * @private
   */
  _prepareDataForChart(data, valueColumn, chartType, defaultSubgroupSize) {
    const preparedData = data.map(row => ({ ...row }));
    
    switch (chartType) {
      case 'p':
        // Add default subgroup sizes for proportion data
        preparedData.forEach(row => {
          if (!row.subgroup_size) {
            row.subgroup_size = defaultSubgroupSize;
          }
        });
        break;
        
      case 'u':
        // Add default area of opportunity for rate data
        preparedData.forEach(row => {
          if (!row.subgroup_size) {
            row.subgroup_size = 1;
          }
        });
        break;
    }
    
    return preparedData;
  },

  /**
   * Generate appropriate title based on chart type and analysis
   * @private
   */
  _generateTitle(chartType, analysis) {
    const titles = {
      xmr: 'XmR Chart - Individual Measurements',
      p: 'p Chart - Proportions',
      u: 'u Chart - Rates per Unit',
      c: 'c Chart - Count of Events',
      t: 't Chart - Time Between Rare Events',
      g: 'g Chart - Opportunities Between Rare Events',
      run: 'Run Chart - Median Center Line'
    };
    
    let baseTitle = titles[chartType] || 'NHS MDC Chart';
    
    if (analysis && analysis.confidence === 'high') {
      baseTitle += ' (Auto-Detected)';
    }
    
    return baseTitle;
  },

  /**
   * Render the appropriate chart based on type
   * @private
   */
  _renderChart(chartType, data, config, queryResponse, analysis, done) {
    // Clear previous chart
    this._container.innerHTML = '';
    
    // Add analysis info if requested
    if (config.show_analysis_info && analysis) {
      this._addAnalysisInfo(analysis, chartType);
    }
    
    // Create chart container
    const chartContainer = document.createElement('div');
    chartContainer.style.width = '100%';
    chartContainer.style.height = config.show_analysis_info && analysis ? 'calc(100% - 60px)' : '100%';
    chartContainer.style.position = 'relative';
    this._container.appendChild(chartContainer);
    
    // Select and create the appropriate chart
    let chart;
    switch (chartType) {
      case 'p':
        chart = PChart;
        break;
      case 'u':
        chart = UChart;
        break;
      case 'c':
        chart = CChart;
        break;
      case 't':
        chart = TChart;
        break;
      case 'g':
        chart = GChart;
        break;
      case 'run':
        chart = RunChart;
        break;
      case 'xmr':
      default:
        chart = XmRChart;
        break;
    }
    
    // Initialize and update the chart
    chart.create(chartContainer, config);
    chart.updateAsync(data, chartContainer, config, queryResponse, done);
    
    this._currentChart = chart;
  },

  /**
   * Add data analysis information display
   * @private
   */
  _addAnalysisInfo(analysis, selectedChartType) {
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = `
      padding: 8px 12px;
      background-color: ${NHS_COLORS.PALE_GREY};
      border-left: 4px solid ${NHS_COLORS.BLUE};
      font-family: Arial, sans-serif;
      font-size: 12px;
      color: #333;
      margin-bottom: 8px;
    `;
    
    const confidenceColor = analysis.confidence === 'high' ? NHS_COLORS.BLUE : NHS_COLORS.ORANGE;
    
    infoDiv.innerHTML = `
      <strong>Auto-Analysis:</strong> 
      Selected <span style="color: ${NHS_COLORS.BLUE}; font-weight: bold;">${selectedChartType.toUpperCase()}</span> chart 
      (${analysis.confidence} confidence)
      <br>
      <em>${analysis.reasoning}</em>
      <span style="float: right; color: #666;">
        ${analysis.analysis.count} points | Range: ${formatNumber(analysis.analysis.min)} - ${formatNumber(analysis.analysis.max)}
      </span>
    `;
    
    this._container.appendChild(infoDiv);
  }
};

// Register with Looker
if (typeof looker !== 'undefined') {
  looker.plugins.visualizations.add(AutoChart);
}

export default AutoChart;