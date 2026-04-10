# NHS Making Data Count - Looker Core Visuals

JavaScript SPC chart implementations for Looker Core, based on the NHS Making Data Count methodology and the NHS-R [NHSRplotthedots](https://github.com/nhs-r-community/NHSRplotthedots) package.

Supports XmR, p, u, c, and Run charts with auto-detection, NHS colour scheme, and all four special cause rules. Pure JavaScript with no external dependencies.

## Supported Chart Types

| Chart Type | Use Case | Auto-Detection Criteria |
|------------|----------|------------------------|
| XmR | Individual measurements over time | Continuous data, negative values possible |
| p | Proportions (0-1 range) | Values between 0-1 with decimals |
| u | Rates per unit (varying denominators) | Integer counts, variable sample sizes |
| c | Counts (fixed sample size) | Small integer counts (0-50) |
| Run | Simple trend analysis | Any data type (alternative to SPC) |

## Quick Start

The simplest approach is to use the auto-chart, which picks the right chart type for you:

```javascript
const data = [
  { date: '2024-01-01', value: 23 },
  { date: '2024-01-02', value: 25 },
  { date: '2024-01-03', value: 21 },
  // ...
];

// AutoChart analyses the data, picks a chart type,
// calculates control limits, and applies NHS colours.
```

You can also force a specific chart type if you already know what you need:

```javascript
// Proportion data - system defaults subgroup_size to 100
const proportionData = [
  { date: '2024-01-01', value: 0.15 },
  { date: '2024-01-02', value: 0.12 },
];

// Count data
const countData = [
  { date: '2024-01-01', value: 3 },
  { date: '2024-01-02', value: 5 },
];
```

## Data Requirements

At minimum, you just need a `value` column. Dates are optional but recommended:

```javascript
// Minimal
const data = [
  { value: 23.5 },
  { value: 25.1 },
  { value: 21.8 }
];

// With dates
const data = [
  { date: '2024-01-01', value: 23.5 },
  { date: '2024-02-01', value: 25.1 },
  { date: '2024-03-01', value: 21.8 }
];

// With manual subgroup size (overrides auto-detection)
const data = [
  { date: '2024-01-01', value: 0.15, subgroup_size: 200 }
];
```

## Configuration

```javascript
// Auto-chart config
const config = {
  value_column: 'value',
  chart_type: 'auto',            // or 'xmr', 'p', 'u', 'c', 'run'
  improvement_direction: 'low',   // 'high' or 'low'
  target_value: 10,               // optional target line
  show_analysis_info: true        // show auto-detection reasoning
};

// Chart-specific options
const config = {
  chart_type: 'p',
  display_as_percentage: true,
  show_control_limits: true,
  show_warning_limits: false,
  subgroup_size: 150
};
```

## NHS Colour Scheme

Colours are applied automatically following the NHS identity:

| Colour | Hex | Used For |
|--------|-----|----------|
| NHS Blue | `#005EB8` | Centre lines, improvement points |
| NHS Dark Blue | `#003087` | Control limit lines |
| NHS Orange | `#ED8B00` | Concern/deterioration points |
| NHS Grey | `#768692` | Common cause variation |
| NHS Warm Yellow | `#FFB81C` | Target lines |

## Special Cause Rules

All four NHS MDC rules are applied automatically:

1. **Astronomical Point** - single point beyond 3-sigma limits
2. **Shift** - 8+ consecutive points on the same side of the centre line
3. **Trend** - 6+ consecutive points all increasing or all decreasing
4. **Two-in-Three** - 2 out of 3 consecutive points in the warning zone

## File Structure

```
looker_core_visuals/
├── src/
│   ├── auto_chart.js      # Auto-detection entry point
│   ├── xmr_chart.js
│   ├── p_chart.js
│   ├── u_chart.js
│   ├── c_chart.js
│   ├── run_chart.js
│   └── spc_utils.js       # Shared utilities and NHS colours
└── examples/
    ├── minimal_example.js
    └── healthcare_examples.js
```

## Examples

### ED Wait Times (XmR)
```javascript
const waitTimes = [
  { month: '2024-01', avg_wait_hours: 3.2 },
  { month: '2024-02', avg_wait_hours: 4.1 },
  { month: '2024-03', avg_wait_hours: 2.8 }
];
// Auto-detected as XmR (continuous measurements)
```

### Infection Rates (p-chart)
```javascript
const infectionRates = [
  { week: '2024-W01', infection_rate: 0.023 },
  { week: '2024-W02', infection_rate: 0.019 },
  { week: '2024-W03', infection_rate: 0.031 }
];
// Auto-detected as p-chart (values between 0 and 1)
// Defaults to subgroup_size: 100
```

### Medication Errors (c-chart)
```javascript
const medicationErrors = [
  { month: '2024-01', error_count: 2 },
  { month: '2024-02', error_count: 5 },
  { month: '2024-03', error_count: 1 }
];
// Auto-detected as c-chart (small integer counts)
```

## Looker Integration

```javascript
import { AutoChart } from './src/auto_chart.js';

// Looker handles passing query results, user config,
// responsive resizing, and export functionality.
```

## Troubleshooting

- **"No data available"** - check your value column contains numeric data and the column name matches your config.
- **"Auto-detection failed"** - falls back to XmR. You can set `chart_type` manually if needed.
- **"Invalid subgroup size"** - for p/u charts, make sure `subgroup_size` is greater than 0. The system uses defaults if it's missing.

General tips: remove nulls, keep data types consistent (all numbers), use ISO date format (`YYYY-MM-DD`) where possible, and avoid large gaps in the series.

## References

- [NHS Making Data Count](https://www.england.nhs.uk/publication/making-data-count/)
- [NHSRplotthedots](https://github.com/nhs-r-community/NHSRplotthedots)
- [SPC in Healthcare - NHS](https://improvement.nhs.uk/resources/statistical-process-control/)

Developed by Aneurin Bevan University Health Board.
