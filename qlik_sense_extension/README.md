# ABSPC — Qlik Sense SPC Extension

A custom visualization extension for **Qlik Sense on-premises** that implements Statistical Process Control (SPC) charts following the NHS Making Data Count methodology. Part of the **abspc** family of SPC tools.

> 📖 **New to this extension?** See the full
> [Implementation Guide](implementation/IMPLEMENTATION_GUIDE.md) for a
> step-by-step walkthrough with screenshots-style instructions and
> healthcare examples.

## Chart Types

| Type | Description | Centre Line | Control Limits |
|------|-------------|-------------|----------------|
| **XmR** | Individual measurements over time | Mean | ± 2.66 × Mean Moving Range |
| **p** | Proportions (0–1) | Overall proportion | Variable per subgroup size |
| **u** | Rates per unit | Overall rate | Variable per denominator |
| **c** | Fixed count data | Mean count | ± 3 × √mean |
| **Run** | Median-based simple chart | Median | None |

## Special Cause Rules

The extension applies the same four rules as the Python (`abspc`) and Looker Core (`abspc_*`) implementations:

1. **Rule 1 — Astronomical Point**: single value outside 3-sigma control limits
2. **Rule 2 — Shift**: ≥ 7 consecutive points on the same side of the centre line
3. **Rule 3 — Trend**: ≥ 7 consecutive points all increasing or all decreasing
4. **Rule 4 — Two-in-Three**: 2 or more of 3 consecutive points in the warning zone (2–3 sigma), same side of the centre line

## NHS Colour Scheme

Points are coloured automatically:

| Colour | Hex | Meaning |
|--------|-----|---------|
| Grey | `#768692` | Common cause variation (no special cause) |
| Blue | `#005EB8` | Improvement (special cause in desired direction) |
| Orange | `#ED8B00` | Concern (special cause in undesired direction) |

## Installation on Qlik Sense On-Prem Server

### Prerequisites

- Qlik Sense Enterprise on Windows (September 2017 or later)
- Access to the Qlik Management Console (QMC)
- Local administrator or equivalent permissions on the Qlik Sense server

### Step 1 — Download the Extension

Download or clone the `qlik_sense_extension` folder from this repository. The folder contains:

```
qlik_sense_extension/
├── abspc_spc_chart.qext         # Extension metadata
├── abspc_spc_chart.js           # Main visualisation logic
├── abspc_spc_chart.css          # Styles
├── definition.js                # Property panel configuration
├── initialProperties.js         # Default settings
└── lib/
    └── spc_utils.js             # SPC calculation engine
```

### Step 2 — Create a ZIP Archive

Create a ZIP file containing the **contents** of the `qlik_sense_extension` folder (not the folder itself):

```
abspc_spc_chart.zip
├── abspc_spc_chart.qext
├── abspc_spc_chart.js
├── abspc_spc_chart.css
├── definition.js
├── initialProperties.js
└── lib/
    └── spc_utils.js
```

> **Tip:** On Windows, select all files/folders inside `qlik_sense_extension`, right-click and choose **Send to → Compressed (zipped) folder**.

### Step 3 — Import via Qlik Management Console (QMC)

1. Open the **QMC** — typically at `https://<your-server>/qmc`
2. Navigate to **Extensions** in the left-hand menu
3. Click **Import** (bottom-left)
4. Browse to the ZIP file created in Step 2
5. Click **Import**
6. The extension **ABSPC SPC Chart** should appear in the list

### Step 4 — Alternative: Manual File Copy

If you prefer, copy the folder directly to the Qlik Sense extensions directory:

```
C:\Program Files\Qlik\Sense\Client\Extensions\abspc_spc_chart\
```

Then restart the **Qlik Sense Repository Service** (QRS) or wait for the cache to refresh.

### Step 5 — Verify Installation

1. Open or create a Qlik Sense app
2. Edit a sheet
3. In the **Custom objects** panel on the left, expand **Extensions**
4. You should see **ABSPC SPC Chart** with a line-chart icon
5. Drag it onto the sheet canvas

## Usage in Qlik Sense

### Minimal Setup (Date + Value)

1. Add the extension to a sheet
2. Add **one dimension** — a date or time period field (e.g. `Month`, `WeekStart`)
3. Add **one measure** — the value to chart (e.g. `Avg(WaitTime)`, `Sum(Incidents)`)
4. The extension will render an **XmR chart** by default

### Configuration Options

Open the **Properties panel** (right-hand side) to configure:

#### Chart Settings

| Property | Options | Default |
|----------|---------|---------|
| Chart Type | XmR, p, u, c, Run | XmR |
| Chart Title | Free text (optional) | Auto-generated |

#### Analysis Settings

| Property | Options | Default |
|----------|---------|---------|
| Improvement Direction | High is Good / Low is Good | High is Good |
| Target Value | Any number (optional) | None |

#### Display Settings

| Property | Default | Description |
|----------|---------|-------------|
| Show Control Limits | ✅ On | UCL / LCL dashed lines |
| Show Warning Limits | ❌ Off | UWL / LWL dotted lines |
| Show Centre Line | ✅ On | Mean or median solid line |
| Show Target Line | ❌ Off | Horizontal target reference |

### Using p and u Charts

For **p charts** (proportions) and **u charts** (rates), add a **second measure** for the subgroup / denominator size.

| Dimension | Measure 1 | Measure 2 |
|-----------|-----------|-----------|
| Month | `Sum(Infections) / Sum(Patients)` | `Sum(Patients)` |

If no second measure is provided, the extension uses a default subgroup size (100 for p charts, 1 for u charts).

### Example Expressions

| Use Case | Dimension | Measure 1 | Measure 2 | Chart Type |
|----------|-----------|-----------|-----------|------------|
| A&E wait times | `MonthStart` | `Avg(WaitHours)` | — | XmR |
| Infection rate | `Month` | `Sum(Infections)/Sum(Admissions)` | `Sum(Admissions)` | p |
| Falls per 1000 bed-days | `Month` | `Sum(Falls)/Sum(BedDays)*1000` | `Sum(BedDays)` | u |
| Medication errors | `Month` | `Sum(Errors)` | — | c |
| Patient satisfaction | `Quarter` | `Avg(Score)` | — | Run |

## Data Requirements

- **Minimum data points**: 2 (though 15+ is recommended for meaningful SPC analysis)
- **Sorting**: Ensure data is sorted chronologically by the dimension
- **Null handling**: Null values in the measure are excluded from calculations

## Running Tests

The SPC calculation engine has a stand-alone test suite. Run from the repository root:

```bash
node qlik_sense_extension/tests/test_spc_calculations.js
```

This validates all four special-cause rules, control limit formulas, point-colouring logic and edge cases against the Python and Looker Core implementations.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Extension not visible in Qlik Sense | Check QMC → Extensions; ensure the ZIP structure is correct (no nested folder) |
| "No data" message | Verify the dimension and at least one measure are added |
| Incorrect chart type | Ensure the Chart Type dropdown in properties matches your data |
| Control limits look wrong for p/u charts | Add a second measure for the subgroup/denominator size |
| Extension not loading after manual copy | Restart the Qlik Sense Repository Service |

## References

- [NHS Making Data Count](https://www.england.nhs.uk/publication/making-data-count/)
- [NHSRplotthedots R package](https://github.com/nhs-r-community/NHSRplotthedots)
- [abspc Python package](https://pypi.org/project/abspc/)

## License

MIT — see the repository [LICENSE](../LICENSE) file.
