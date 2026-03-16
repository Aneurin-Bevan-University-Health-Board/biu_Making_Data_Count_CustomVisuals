# NHS Making Data Count - Looker Core Visuals

JavaScript implementations of NHS Making Data Count (MDC) Statistical Process Control charts for Looker Core, following the methodology from the NHS-R NHSRplotthedots package.

## ✨ Key Features

- **Minimal Data Requirements**: Just provide date and value columns - the system automatically calculates everything else
- **Smart Auto-Detection**: Automatically selects the best chart type based on your data characteristics
- **NHS MDC Compliant**: Follows official NHS Making Data Count methodology and color scheme
- **All Chart Types**: XmR, p, u, c, and Run charts
- **Special Cause Detection**: Implements all four NHS MDC rules for identifying special cause variation

## 📊 Supported Chart Types

| Chart Type | Use Case | Required Data | Auto-Detection |
|------------|----------|---------------|----------------|
| **XmR** | Individual measurements over time | `value` | Continuous data, negative values possible |
| **p** | Proportions (0-1 range) | `value` | Values between 0-1 with decimals |
| **u** | Rates per unit (varying denominators) | `value` | Integer counts, variable sample sizes |
| **c** | Counts (fixed sample size) | `value` | Small integer counts (0-50) |
| **Run** | Simple trend analysis | `value` | Any data type (alternative to SPC) |

## 🚀 Quick Start

### Option 1: Auto-Chart (Recommended)
Let the system automatically detect the best chart type:

```javascript
// Your Looker data only needs two columns:
const data = [
  { date: '2024-01-01', value: 23 },
  { date: '2024-01-02', value: 25 },
  { date: '2024-01-03', value: 21 },
  // ... more data points
];

// The AutoChart will:
// 1. Analyze your data characteristics
// 2. Select the appropriate chart type (XmR, p, u, c, or run)
// 3. Calculate all control limits and special cause rules
// 4. Apply NHS color scheme and formatting
```

### Option 2: Specific Chart Types
If you know which chart type you need:

```javascript
// For proportion data (percentages, rates between 0-1)
const proportionData = [
  { date: '2024-01-01', value: 0.15 },  // 15%
  { date: '2024-01-02', value: 0.12 },  // 12%
  // System automatically adds subgroup_size: 100
];

// For count data
const countData = [
  { date: '2024-01-01', value: 3 },     // 3 incidents
  { date: '2024-01-02', value: 5 },     // 5 incidents
  // System automatically calculates control limits
];
```

## 📈 Data Requirements

### Minimal Requirements (All Charts)
```javascript
const minimalData = [
  { value: 23.5 },
  { value: 25.1 },
  { value: 21.8 }
  // That's it! Date column is optional
];
```

### With Dates (Recommended)
```javascript
const dataWithDates = [
  { date: '2024-01-01', value: 23.5 },
  { date: '2024-02-01', value: 25.1 },
  { date: '2024-03-01', value: 21.8 }
];
```

### Advanced: Manual Subgroup Sizes
```javascript
// Only needed if you want to override auto-detection
const advancedData = [
  { date: '2024-01-01', value: 0.15, subgroup_size: 200 }
];
```

## 🎨 Configuration Options

### Auto-Chart Configuration
```javascript
const autoChartConfig = {
  value_column: 'value',           // Your value column name
  chart_type: 'auto',              // Let system choose
  improvement_direction: 'low',     // 'high' or 'low'
  target_value: 10,                // Optional target line
  show_analysis_info: true         // Show auto-detection reasoning
};
```

### Chart-Specific Configurations
```javascript
const specificConfig = {
  chart_type: 'p',                 // Force specific chart type
  display_as_percentage: true,     // p-chart: show as %
  show_control_limits: true,       // Show UCL/LCL lines
  show_warning_limits: false,      // Show 2-sigma limits
  subgroup_size: 150              // Default for p/u charts
};
```

## 🏥 NHS Color Scheme

The visuals automatically apply the official NHS color scheme:

- **NHS Blue** (`#005EB8`) - Center lines, improvement points
- **NHS Dark Blue** (`#003087`) - Control limit lines  
- **NHS Orange** (`#ED8B00`) - Concern/deterioration points
- **NHS Grey** (`#768692`) - Common cause variation
- **NHS Warm Yellow** (`#FFB81C`) - Target lines

## 📊 Special Cause Rules (NHS MDC)

All four NHS Making Data Count rules are automatically applied:

1. **Astronomical Point** - Single point outside 3-sigma limits
2. **Shift** - 7+ consecutive points on same side of center line
3. **Trend** - 7+ consecutive points all increasing or decreasing  
4. **Two-in-Three** - 2 of 3 consecutive points in warning zone

## 📁 File Structure

```
looker_core_visuals/
├── src/
│   ├── auto_chart.js      # 🎯 Smart auto-detection (start here!)
│   ├── xmr_chart.js       # Individual measurements
│   ├── p_chart.js         # Proportions 
│   ├── u_chart.js         # Rates per unit
│   ├── c_chart.js         # Counts
│   ├── run_chart.js       # Run charts
│   └── spc_utils.js       # Shared utilities & NHS colors
└── examples/
    ├── minimal_example.js
    ├── proportion_example.js
    └── count_example.js
```

## 💡 Usage Examples

### Example 1: Emergency Department Wait Times
```javascript
// Just your basic data
const waitTimes = [
  { month: '2024-01', avg_wait_hours: 3.2 },
  { month: '2024-02', avg_wait_hours: 4.1 },
  { month: '2024-03', avg_wait_hours: 2.8 }
];

// AutoChart will:
// ✅ Detect: XmR chart (continuous measurements)
// ✅ Calculate: Mean, control limits, special causes
// ✅ Color: Points based on improvement direction
// ✅ Display: Professional NHS-styled chart
```

### Example 2: Infection Rates
```javascript
// Proportion data (percentages as decimals)
const infectionRates = [
  { week: '2024-W01', infection_rate: 0.023 }, // 2.3%
  { week: '2024-W02', infection_rate: 0.019 }, // 1.9%
  { week: '2024-W03', infection_rate: 0.031 }  // 3.1%
];

// AutoChart will:
// ✅ Detect: p-chart (proportion data 0-1 range)
// ✅ Assume: Subgroup size 100 (configurable)
// ✅ Calculate: Variable control limits per point
// ✅ Apply: NHS color scheme for improvement/concern
```

### Example 3: Medication Errors
```javascript
// Count data
const medicationErrors = [
  { month: '2024-01', error_count: 2 },
  { month: '2024-02', error_count: 5 },
  { month: '2024-03', error_count: 1 }
];

// AutoChart will:
// ✅ Detect: c-chart (small integer counts)
// ✅ Calculate: Poisson-based control limits
// ✅ Flag: Special causes using NHS rules
```

## 🔧 Integration with Looker Core

Add to your Looker visualization:

```javascript
import { AutoChart } from './src/auto_chart.js';

// Looker will automatically:
// - Pass your query results as data
// - Handle user configuration options
// - Manage responsive resizing
// - Provide download/export functionality
```

## ⚡ Performance & Browser Support

- **Lightweight**: Pure JavaScript, no external dependencies
- **Fast**: Efficient algorithms optimized for healthcare data volumes
- **Compatible**: Modern browsers (ES2020+)
- **Responsive**: Automatically adapts to container sizing

## 🔍 Troubleshooting

### Common Issues

1. **"No data available"**
   - Check your value column contains numeric data
   - Ensure column name matches configuration

2. **"Auto-detection failed"**
   - Falls back to XmR chart
   - Manually specify chart_type if needed

3. **"Invalid subgroup size"**
   - For p/u charts, ensure subgroup_size > 0
   - System will use defaults if missing

### Data Quality Tips

- Remove null/empty values before charting
- Ensure consistent data types (all numbers)
- For dates, use ISO format (YYYY-MM-DD) when possible
- Keep data points sequential (no large gaps)

---

## 📚 References

- [NHS Making Data Count](https://www.england.nhs.uk/publication/making-data-count/)
- [NHS-R NHSRplotthedots](https://github.com/nhs-r-community/NHSRplotthedots)
- [Statistical Process Control in Healthcare](https://improvement.nhs.uk/resources/statistical-process-control/)

Built with ❤️ for the NHS by Aneurin Bevan University Health Board
