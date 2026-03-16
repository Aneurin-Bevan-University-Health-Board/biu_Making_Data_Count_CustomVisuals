/**
 * healthcare_examples.js
 * =======================
 * Real-world healthcare examples using NHS MDC Auto-Chart
 * Demonstrates common healthcare metrics with minimal data requirements
 */

import { AutoChart } from '../src/auto_chart.js';

// 🏥 Example 1: A&E 4-Hour Wait Performance
// Just percentages - system auto-detects p-chart
const ae4HourWaits = [
  { month: '2024-01', percentage_within_4hrs: 0.76 },  // 76%
  { month: '2024-02', percentage_within_4hrs: 0.82 },  // 82%
  { month: '2024-03', percentage_within_4hrs: 0.74 },  // 74%
  { month: '2024-04', percentage_within_4hrs: 0.89 },  // 89%
  { month: '2024-05', percentage_within_4hrs: 0.85 },  // 85%
  { month: '2024-06', percentage_within_4hrs: 0.78 },  // 78%
  { month: '2024-07', percentage_within_4hrs: 0.91 },  // 91%
  { month: '2024-08', percentage_within_4hrs: 0.87 },  // 87%
  { month: '2024-09', percentage_within_4hrs: 0.83 },  // 83%
  { month: '2024-10', percentage_within_4hrs: 0.96 },  // 96% - special cause improvement
  { month: '2024-11', percentage_within_4hrs: 0.94 },  // 94%
  { month: '2024-12', percentage_within_4hrs: 0.92 }   // 92%
];

const ae4HourConfig = {
  value_column: 'percentage_within_4hrs',
  chart_type: 'auto',                    // Will detect p-chart
  improvement_direction: 'high',          // Higher % = better
  target_value: 0.95,                    // 95% NHS target
  show_target_line: true,
  chart_title: 'A&E 4-Hour Wait Performance',
  display_as_percentage: true            // Show as 76% instead of 0.76
};

// 🦠 Example 2: Hospital-Acquired Infections
// Count data - system auto-detects c-chart
const haiCounts = [
  { month: '2024-01', hai_count: 3 },
  { month: '2024-02', hai_count: 2 },
  { month: '2024-03', hai_count: 5 },    // Potential concern
  { month: '2024-04', hai_count: 1 },
  { month: '2024-05', hai_count: 4 },
  { month: '2024-06', hai_count: 2 },
  { month: '2024-07', hai_count: 1 },
  { month: '2024-08', hai_count: 0 },    // Improvement
  { month: '2024-09', hai_count: 1 },
  { month: '2024-10', hai_count: 0 },    // Continued improvement
  { month: '2024-11', hai_count: 0 },
  { month: '2024-12', hai_count: 1 }
];

const haiConfig = {
  value_column: 'hai_count',
  chart_type: 'auto',                    // Will detect c-chart
  improvement_direction: 'low',           // Lower count = better
  chart_title: 'Monthly Hospital-Acquired Infections',
  target_value: 2                        // Target max 2 per month
};

// 🩺 Example 3: Patient Satisfaction Scores
// Continuous data - system auto-detects XmR chart
const satisfactionScores = [
  { quarter: '2023-Q1', avg_score: 7.2 },
  { quarter: '2023-Q2', avg_score: 7.5 },
  { quarter: '2023-Q3', avg_score: 7.1 },
  { quarter: '2023-Q4', avg_score: 7.8 },
  { quarter: '2024-Q1', avg_score: 8.1 },   // Improvement trend
  { quarter: '2024-Q2', avg_score: 8.3 },
  { quarter: '2024-Q3', avg_score: 8.0 },
  { quarter: '2024-Q4', avg_score: 8.5 }
];

const satisfactionConfig = {
  value_column: 'avg_score',
  chart_type: 'auto',                    // Will detect XmR chart
  improvement_direction: 'high',          // Higher score = better
  chart_title: 'Patient Satisfaction Scores (1-10 scale)',
  target_value: 8.0                     // Target score
};

// 🚪 Example 4: Readmission Rates
// Rate data - system auto-detects u-chart
const readmissionRates = [
  { month: '2024-01', readmissions_per_100: 8.5 },
  { month: '2024-02', readmissions_per_100: 7.2 },
  { month: '2024-03', readmissions_per_100: 9.1 },
  { month: '2024-04', readmissions_per_100: 6.8 },
  { month: '2024-05', readmissions_per_100: 7.5 },
  { month: '2024-06', readmissions_per_100: 8.0 },
  { month: '2024-07', readmissions_per_100: 5.9 },   // Improvement
  { month: '2024-08', readmissions_per_100: 6.2 },
  { month: '2024-09', readmissions_per_100: 5.5 },   // Continued improvement
  { month: '2024-10', readmissions_per_100: 6.1 }
];

const readmissionConfig = {
  value_column: 'readmissions_per_100',
  chart_type: 'auto',                    // Will detect u-chart
  improvement_direction: 'low',           // Lower rate = better
  chart_title: '30-Day Readmission Rate (per 100 discharges)',
  target_value: 6.0,                     // Target rate
  subgroup_size: 100                     // Per 100 discharges
};

// 💉 Example 5: Medication Administration Errors
// Very simple - just error counts
const medicationErrors = [
  { value: 2 }, { value: 1 }, { value: 4 }, { value: 0 },
  { value: 3 }, { value: 2 }, { value: 1 }, { value: 0 },
  { value: 0 }, { value: 1 }, { value: 2 }, { value: 3 }
];

const medicationConfig = {
  value_column: 'value',
  chart_type: 'auto',                    // Will detect c-chart
  improvement_direction: 'low',
  chart_title: 'Weekly Medication Errors'
};

// 🏃‍♀️ Example 6: Average Length of Stay
// Continuous measurements - XmR chart
const lengthOfStay = [
  { week: 'W01', avg_los_days: 4.2 },
  { week: 'W02', avg_los_days: 3.8 },
  { week: 'W03', avg_los_days: 4.5 },
  { week: 'W04', avg_los_days: 3.9 },
  { week: 'W05', avg_los_days: 4.1 },
  { week: 'W06', avg_los_days: 3.6 },    // Improvement
  { week: 'W07', avg_los_days: 3.4 },
  { week: 'W08', avg_los_days: 3.7 },
  { week: 'W09', avg_los_days: 3.5 },
  { week: 'W10', avg_los_days: 3.3 }     // Sustained improvement
];

const losConfig = {
  value_column: 'avg_los_days',
  chart_type: 'auto',                    // Will detect XmR chart
  improvement_direction: 'low',           // Shorter stay = better
  chart_title: 'Average Length of Stay (Days)',
  target_value: 3.5
};

// Helper function to create charts
function createHealthcareChart(containerId, data, config) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }
  
  AutoChart.create(container, config);
  AutoChart.updateAsync(data, container, config, null, () => {
    console.log(`Healthcare chart created: ${config.chart_title}`);
  });
}

// Export healthcare examples
export const healthcareExamples = {
  createAE4HourChart() {
    createHealthcareChart('ae-chart', ae4HourWaits, ae4HourConfig);
  },
  
  createHAIChart() {
    createHealthcareChart('hai-chart', haiCounts, haiConfig);
  },
  
  createSatisfactionChart() {
    createHealthcareChart('satisfaction-chart', satisfactionScores, satisfactionConfig);
  },
  
  createReadmissionChart() {
    createHealthcareChart('readmission-chart', readmissionRates, readmissionConfig);
  },
  
  createMedicationErrorChart() {
    createHealthcareChart('medication-chart', medicationErrors, medicationConfig);
  },
  
  createLengthOfStayChart() {
    createHealthcareChart('los-chart', lengthOfStay, losConfig);
  }
};

export default healthcareExamples;

/*
 * Key Healthcare Benefits:
 * 
 * ✅ Quality Metrics: Automatically detect improvement/deterioration
 * ✅ Patient Safety: Flag unusual patterns requiring investigation  
 * ✅ Performance Management: Track against NHS targets
 * ✅ Statistical Rigor: NHS MDC methodology built-in
 * ✅ Professional Presentation: NHS color scheme and formatting
 * ✅ Minimal Setup: Just provide your data - system does the rest
 */