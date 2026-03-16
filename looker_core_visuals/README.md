# Looker Core Visuals — MDC SPC Charts

Standalone JavaScript visualizations implementing the NHS
[Making Data Count](https://www.england.nhs.uk/publication/making-data-count/)
(MDC) methodology for Looker dashboards.

Each visualization is a **single, self-contained JS file** that can be uploaded
directly to Looker via the admin panel — no build step or external dependencies
required.

---

## Available Visualizations

| File | Chart Type | Description |
|------|------------|-------------|
| `abspc_xmr_chart.js` | XmR | Individuals / moving-range chart |
| `abspc_p_chart.js` | p chart | Proportions (with denominator) |
| `abspc_c_chart.js` | c chart | Counts in a fixed sample |
| `abspc_u_chart.js` | u chart | Rates (count ÷ denominator) |
| `abspc_run_chart.js` | Run chart | Median centre line, no control limits |
| `abspc_summary_table.js` | Summary table | Multi-measure MDC overview table |

---

## Deployment

1. In your Looker instance, navigate to **Admin → Visualization**.
2. Click **Add Visualization**.
3. Give it a name (e.g. *MDC XmR Chart*) and paste the contents of the
   corresponding JS file, or upload the file directly.
4. Save. The visualization is now available in any Explore or dashboard.

Repeat for each chart type you need.

---

## Configuration Options

All chart visualizations expose the following options in the Looker
**Edit** panel:

### Common Options (all charts)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| **Title** | string | Auto | Chart title displayed above the plot |
| **Improvement Direction** | select | `"increase"` | Whether higher (`"increase"`) or lower (`"decrease"`) values represent improvement. Controls point colouring. |
| **Show Target** | boolean | `false` | Display a dashed target line |
| **Target Value** | number | — | The target value for the target line and assurance icon |
| **Show Icons** | boolean | `true` | Display MDC variation & assurance icons with hover tooltips |
| **Auto Rephase** | boolean | `true` | Automatically detect sustained shifts (≥ 8 points) and recalculate limits for each new phase |

### p Chart Additional Options

| Option | Type | Description |
|--------|------|-------------|
| **Numerator** | select | Dimension/measure containing the numerator (event count) |
| **Denominator** | select | Dimension/measure containing the denominator (population) |

### u Chart Additional Options

| Option | Type | Description |
|--------|------|-------------|
| **Numerator** | select | Count of events |
| **Denominator** | select | Sample size / exposure |

### Summary Table Options

The summary table supports up to **20 rows**, each independently configured:

| Option | Type | Description |
|--------|------|-------------|
| **Row N — Improvement Direction** | select | `"increase"` or `"decrease"` for row N |
| **Row N — Target** | number | Target value for row N |

---

## Features

### NHS Colour Scheme

All charts use the standard NHS identity palette:

| Colour | Hex | Usage |
|--------|-----|-------|
| NHS Blue | `#005EB8` | Mean / median line, improvement points |
| NHS Dark Blue | `#003087` | UCL / LCL lines |
| NHS Orange | `#ED8B00` | Concern points |
| Grey | `#768692` | Common-cause points, connector line |
| NHS Warm Yellow | `#FFB81C` | Target line |

### Special-Cause Rules

Four NHS MDC rules (aligned with NHSRplotthedots):

| Rule | Description |
|------|-------------|
| **1 — Astronomical point** | Single value outside 3σ limits |
| **2 — Shift** | ≥ 8 consecutive points above or below the mean |
| **3 — Trend** | ≥ 7 consecutive points all rising or all falling |
| **4 — Two-in-three** | 2 of 3 consecutive points in the warning zone |

### MDC Icons

When **Show Icons** is enabled, the chart displays:

- **Variation icon** (left) — the type of special-cause variation in the
  latest data (improvement, common cause, or concern).
- **Assurance icon** (right) — whether the process will consistently meet
  the target (pass, hit-or-miss, or fail).

Hovering over each icon shows a tooltip explaining its meaning.

> Run charts only display the variation icon (no control limits means
> assurance cannot be calculated).

### Auto-Rephasing

When **Auto Rephase** is enabled, the chart detects sustained shifts (≥ 8
consecutive points on one side of the mean) and automatically recalculates
the mean and control limits for each new phase. Phase boundaries are marked
with a dashed vertical line.

Toggle this off via the edit panel if you want fixed limits throughout.

### Legend

A horizontal legend is displayed below the title showing the meaning of each
line and point colour (Mean, UCL/LCL, Target, Improvement, Concern, Common
Cause).

---

## Data Requirements

### SPC Charts (XmR, p, c, u)

The visualization expects a Looker query with:

- **At least one dimension** — used as the x-axis (typically a date or
  sequential identifier).
- **At least one measure** — used as the y-axis values.

For **p** and **u** charts, two measures are required (numerator and
denominator), selectable via the edit panel.

### Run Chart

Same as SPC charts but with a single measure. The median is used as the
centre line instead of the mean.

### Summary Table

The summary table expects:

- **One dimension** — the row label (e.g., measure name).
- **One or more measures** — the values to display. Each row of data maps
  to one row in the summary table, with its own independently configured
  improvement direction and target.

---

## Browser Testing

Open `tests/preview.html` in a browser to test the visualizations locally
with sample data before deploying to Looker.
