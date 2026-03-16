/**
 * minimal_example.js
 * ===================
 * Minimal example showing how to use NHS MDC Auto-Chart with just date and value
 */

import { AutoChart } from '../src/auto_chart.js';

// Example 1: Minimal data - system calculates everything else
const minimalData = [
  { date: '2024-01-01', value: 23.5 },
  { date: '2024-01-02', value: 25.1 },
  { date: '2024-01-03', value: 21.8 },
  { date: '2024-01-04', value: 26.3 },
  { date: '2024-01-05', value: 24.0 },
  { date: '2024-01-06', value: 22.7 },
  { date: '2024-01-07', value: 28.1 },
  { date: '2024-01-08', value: 23.9 },
  { date: '2024-01-09', value: 25.5 },
  { date: '2024-01-10', value: 24.2 }
];

// Minimal configuration - let the system decide everything
const autoConfig = {
  value_column: 'value',
  chart_type: 'auto',              // 🎯 Let system choose best chart
  improvement_direction: 'high',    // Higher values = better
  show_analysis_info: true         // Show why this chart was chosen
};

// Example 2: Even more minimal - just values, no dates
const justValues = [
  { value: 15.2 },
  { value: 18.1 },
  { value: 14.8 },
  { value: 17.3 },
  { value: 16.0 },
  { value: 15.7 },
  { value: 19.1 },
  { value: 16.8 },
  { value: 17.5 },
  { value: 15.9 }
];

// System will auto-detect XmR chart for continuous data
const minimalConfig = {
  value_column: 'value',
  chart_type: 'auto'
};

// Example 3: Proportion data - auto-detects p-chart
const proportionData = [
  { month: '2024-01', compliance_rate: 0.85 },  // 85%
  { month: '2024-02', compliance_rate: 0.92 },  // 92%
  { month: '2024-03', compliance_rate: 0.78 },  // 78%
  { month: '2024-04', compliance_rate: 0.89 },  // 89%
  { month: '2024-05', compliance_rate: 0.91 },  // 91%
  { month: '2024-06', compliance_rate: 0.84 },  // 84%
  { month: '2024-07', compliance_rate: 0.96 },  // 96%
  { month: '2024-08', compliance_rate: 0.87 },  // 87%
];

// System auto-detects p-chart and adds default subgroup_size
const proportionConfig = {
  value_column: 'compliance_rate',
  chart_type: 'auto',
  improvement_direction: 'high',
  target_value: 0.90,              // 90% target
  show_target_line: true
};

// Example 4: Count data - auto-detects c-chart
const incidentCounts = [
  { week: 'W01', incidents: 2 },
  { week: 'W02', incidents: 4 },
  { week: 'W03', incidents: 1 },
  { week: 'W04', incidents: 3 },
  { week: 'W05', incidents: 0 },
  { week: 'W06', incidents: 5 },
  { week: 'W07', incidents: 2 },
  { week: 'W08', incidents: 1 },
  { week: 'W09', incidents: 3 },
  { week: 'W10', incidents: 2 }
];

// System auto-detects c-chart for small integer counts
const countConfig = {
  value_column: 'incidents',
  chart_type: 'auto',
  improvement_direction: 'low',     // Fewer incidents = better
  chart_title: 'Weekly Safety Incidents'
};

// Usage Example - How to implement in Looker
function createAutoChart(containerId, data, config) {
  const container = document.getElementById(containerId);
  
  // Create the visualization
  AutoChart.create(container, config);
  
  // Update with data
  AutoChart.updateAsync(data, container, config, null, () => {
    console.log(`Auto-chart created in ${containerId}`);
  });
}

// Example implementations
export const examples = {
  // Example 1: Basic continuous data
  createBasicChart() {
    createAutoChart('chart1', minimalData, autoConfig);
  },
  
  // Example 2: Just values
  createMinimalChart() {
    createAutoChart('chart2', justValues, minimalConfig);
  },
  
  // Example 3: Proportion data
  createProportionChart() {
    createAutoChart('chart3', proportionData, proportionConfig);
  },
  
  // Example 4: Count data
  createCountChart() {
    createAutoChart('chart4', incidentCounts, countConfig);
  }
};

// Key Benefits Demonstrated:
// ✅ No need to calculate control limits manually
// ✅ No need to determine chart type - system analyzes your data
// ✅ No need to specify subgroup sizes - intelligent defaults applied
// ✅ No need to implement special cause rules - automatically applied
// ✅ No need to apply NHS colors - built-in color scheme
// ✅ No need to format tooltips/legends - professional presentation included

export default examples;