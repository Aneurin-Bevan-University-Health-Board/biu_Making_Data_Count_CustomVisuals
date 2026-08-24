# abspc — Python SPC Charts

The `abspc` Python package provides publication-ready Statistical Process
Control (SPC) charts following the NHS
[Making Data Count](https://www.england.nhs.uk/publication/making-data-count/)
methodology.

Built on **matplotlib**, it produces high-quality static images suitable for
board reports, dashboards, and quality-improvement publications.

---

## Installation

```bash
pip install abspc
```

Or install the development version from source:

```bash
git clone https://github.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals
cd biu_Making_Data_Count_CustomVisuals
pip install -e ".[dev]"
```

---

## Quick Start

```python
import pandas as pd
from abspc import plot_spc_chart, plot_run_chart

# Minimal XmR chart
data = pd.DataFrame({"value": [48, 52, 49, 55, 47, 51, 53, 50, 48, 54]})
fig, ax = plot_spc_chart(data, chart_type="XmR")
fig.savefig("my_xmr_chart.png")
```

---

## Chart Types

### XmR Chart

The XmR (individuals / moving-range) chart is the most common SPC chart type.
It is suitable for individual measurements collected over time.

```python
import numpy as np
import pandas as pd
from abspc import plot_spc_chart

data = pd.DataFrame({"value": np.random.normal(50, 3, 24)})

fig, ax = plot_spc_chart(
    data,
    chart_type="XmR",
    title="XmR Chart – Individual Measurements",
    xlabel="Month",
    ylabel="Value",
    shade_band=True,
    improvement_direction="high",
)
```

![XmR Chart](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_xmr.png)

> **I (Individuals) chart** — `chart_type="i"` or `"I"` is an alias of XmR and
> produces identical control limits (`mean ± 2.66·MRbar` for the 3-sigma
> limits, `± 1.77·MRbar` for the 2-sigma warning limits). Only the default
> title changes to *"I Chart (Individuals)"*.

---

### p Chart

The p chart is for proportion data (e.g., percentage of patients waiting
> 4 hours). It requires a `subgroup_size` column containing the denominator.

```python
data = pd.DataFrame({
    "value": [0.10, 0.12, 0.08, 0.15, 0.09, 0.11, 0.10, 0.13, 0.07, 0.12,
              0.09, 0.11, 0.10, 0.08, 0.14, 0.12, 0.09, 0.11, 0.08, 0.10,
              0.12, 0.09, 0.11, 0.10],
    "subgroup_size": [200] * 24,
})

fig, ax = plot_spc_chart(
    data,
    chart_type="p",
    title="p Chart – Proportion",
    xlabel="Month",
    ylabel="Proportion",
    improvement_direction="low",
)
```

![p Chart](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_p.png)

You can also pass a **numerator column** and a **denominator column**:

```python
data = pd.DataFrame({
    "events":     [20, 24, 16, 30, 18],
    "population": [200, 200, 200, 200, 200],
})
fig, ax = plot_spc_chart(
    data,
    chart_type="p",
    value_col="population",
    numerator_col="events",
    improvement_direction="low",
)
```

---

### c Chart

The c chart is for counts of events in a fixed sample size (e.g., adverse
events per ward per month).

```python
data = pd.DataFrame({"value": [3, 5, 2, 6, 4, 3, 7, 5, 4, 6,
                                 5, 3, 4, 6, 5, 4, 3, 5, 6, 4,
                                 3, 5, 4, 6]})

fig, ax = plot_spc_chart(
    data,
    chart_type="c",
    title="c Chart – Count of Events",
    xlabel="Month",
    ylabel="Count",
    improvement_direction="low",
)
```

![c Chart](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_c.png)

---

### Run Chart

The run chart plots data against time with a **median** centre line and no
control limits. It uses run-chart rules to detect signals (8-point shift and
6-point trend).

```python
from abspc import plot_run_chart

data = pd.DataFrame({"value": np.random.normal(40, 4, 24)})

fig, ax = plot_run_chart(
    data,
    title="Run Chart – Median Centre Line",
    xlabel="Month",
    ylabel="Value",
    improvement_direction="high",
)
```

![Run Chart](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_run.png)

`plot_spc_chart` also accepts `chart_type="run"` and will automatically
delegate to `plot_run_chart`:

```python
fig, ax = plot_spc_chart(data, chart_type="run")
```

---

## Features

### Logo Placement

Pass any image (PNG, JPEG, etc.) via `logo_path` to display your
organisation's logo at the **top-right of the chart, level with the title**.

```python
fig, ax = plot_spc_chart(
    data,
    chart_type="XmR",
    title="A&E 4-Hour Waits – Aneurin Bevan UHB",
    logo_path="path/to/logo.png",
    logo_zoom=0.08,
)
```

![Chart with Logo](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_with_logo.png)

> **Note:** `logo_path` places the logo in the title margin (top-right).
> The legacy `nhs_logo_path` parameter places an image inside the plot area.

---

### Date Axis

All chart functions automatically detect datetime data on the x-axis and
apply smart date tick formatting.

**Option 1 — `DatetimeIndex` (auto-detected):**

```python
dates = pd.date_range("2022-01-01", periods=30, freq="MS")
data  = pd.DataFrame({"value": np.random.normal(75, 6, 30)}, index=dates)

fig, ax = plot_spc_chart(data, chart_type="XmR", title="Monthly Date Axis")
```

![Date Axis](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_date_axis.png)

**Option 2 — Explicit date column:**

```python
fig, ax = plot_run_chart(data, x_col="period", date_format="%b %Y")
```

| `date_format` | Example output |
|---------------|----------------|
| `"%b %Y"` | Jan 2024 |
| `"%Y-%m"` | 2024-01 |
| `"%d/%m/%Y"` | 01/01/2024 |
| `None` *(default)* | Auto (ConciseDateFormatter) |

---

### Change-Point Annotations

Mark known process changes with vertical lines and labels:

```python
fig, ax = plot_spc_chart(
    data,
    chart_type="XmR",
    change_points=[
        {"x": 9,  "label": "New protocol"},
        {"x": 20, "label": "Staff training"},
    ],
)
```

![Change Points](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_change_points.png)

---

### Auto-Rebase on a Sustained Shift

When a run of `min_phase_length` (default **8**) consecutive points falls on
one side of the mean — the NHS MDC **shift** rule — control limits can be
automatically recalculated for the new phase:

```python
fig, ax = plot_spc_chart(
    data,
    chart_type="XmR",          # or "I" — the Individuals chart, an alias of XmR
    improvement_direction="high",
    auto_rebase=True,
    rebase_on="any",            # "improvement" (default) | "worsening" | "any"
    baseline=15,                # min points per phase before a rebase is allowed
)
```

![Auto-Rebase](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_auto_rebase.png)

Use `rebase_control_limits` for programmatic access without plotting:

```python
from abspc import rebase_control_limits

result = rebase_control_limits(
    data, chart_type="XmR", improvement_direction="high",
    rebase_on="any", baseline=15,
)
```

* **`rebase_on`** — which direction of sustained shift triggers a rebase:
  `"improvement"` (in `improvement_direction`), `"worsening"` (away from it),
  or `"any"` (either side; the earliest qualifying shift is used).
* **`baseline`** — the minimum number of points that must accumulate within a
  phase before a rebase is permitted (default `15`). A larger baseline
  absorbs early shifts.

> Auto-rebase is supported for XmR / I, p, u, and c charts (not run charts).

---

### MDC Variation & Assurance Icons

Set `show_icons=True` to display the official Making Data Count variation and
assurance icons at the top-left of the chart:

```python
fig, ax = plot_spc_chart(
    data,
    chart_type="XmR",
    improvement_direction="high",
    target=60,
    show_target=True,
    show_icons=True,
)
```

**Programmatic access:**

```python
from abspc import (
    calculate_control_limits,
    detect_special_causes,
    determine_variation_type,
    determine_assurance_type,
)

result = detect_special_causes(calculate_control_limits(data, chart_type="XmR"))
variation = determine_variation_type(result, value_col="value", improvement_direction="high")
assurance = determine_assurance_type(result, target=60, improvement_direction="high")
```

A small **MDC compliance tick** is drawn immediately after the icons: NHS
Green when the chart is Making Data Count compliant and grey when it is not.
`determine_mdc_compliance(result, improvement_direction=...)` returns the same
assessment as `{"compliant": bool, "reasons": [...]}`.

Setting `improvement_direction=None` means no improvement direction has been
declared, so the chart is a plain SPC chart rather than a Making Data Count
chart: none of the icons are drawn and special-cause points use the neutral
NHS Dark Blue instead of the MDC improvement / concern colours.  All SPC logic
still applies.

> For run charts only the variation icon is shown (no control limits means
> assurance cannot be calculated).

---

### MDC Summary Table

`plot_mdc_summary_table` renders an NHS MDC-style summary table showing
multiple measures at a glance:

```python
from abspc import plot_mdc_summary_table

fig, ax = plot_mdc_summary_table(
    [
        {
            "data": df,
            "chart_type": "XmR",
            "measure": "A&E 4-Hour Waits",
            "description": "% patients seen within 4 hours",
            "value_col": "value",
            "improvement_direction": "high",
            "target": 95,
        },
        {
            "data": df_infections,
            "chart_type": "p",
            "measure": "Infection Rate",
            "description": "Proportion of infections per month",
            "value_col": "value",
            "improvement_direction": "low",
            "target": 0.05,
            "subgroup_col": "subgroup_size",
        },
    ],
    title="MDC Summary — Board Report",
)
```

---

## Special-Cause Rules

Four NHS MDC rules (aligned with NHSRplotthedots):

| Rule | Name | Description |
|------|------|-------------|
| **1** | Astronomical point | Single value outside 3σ limits |
| **2** | Shift | ≥ 8 consecutive points above or below the mean |
| **3** | Trend | ≥ 6 consecutive points all rising or all falling |
| **4** | Two-in-three | 2 of 3 consecutive points in the warning zone |

Use the detection functions directly:

```python
from abspc import calculate_control_limits, detect_special_causes

result = calculate_control_limits(data, chart_type="XmR")
flags  = detect_special_causes(result)
print(flags[["value", "mean", "ucl", "lcl", "rule1", "rule2", "rule3", "rule4", "special_cause"]])
```

---

## API Reference

### `plot_spc_chart`

```python
fig, ax = plot_spc_chart(
    data,
    chart_type,                     # "XmR" | "I" | "p" | "u" | "c" | "run"
    value_col="value",
    subgroup_col="subgroup_size",
    numerator_col=None,
    x_col=None,
    title=None,
    xlabel="Observation",
    ylabel="Value",
    improvement_direction="high",     # "high" | "low" | None (plain SPC chart)
    target=None,                      # value or target-column name
    show_target=None,                 # None = draw whenever target is set
    show_warning_limits=False,        # 2-sigma limits
    show_zone_c=False,                # 1-sigma (zone C) boundaries
    shade_band=False,
    shade_color="#41B6E6",
    nhs_logo_path=None,
    ax=None,
    figsize=(12, 5),
    show_legend=True,
    change_points=None,
    auto_rebase=False,
    rebase_on="improvement",        # "improvement" | "worsening" | "any"
    baseline=15,                    # min points per phase before rebasing
    date_format=None,
    logo_path=None,
    logo_zoom=0.07,
    show_icons=False,
    icon_zoom=0.06,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `data` | `pd.DataFrame` | *(required)* | Input DataFrame with at least the `value_col` column. |
| `chart_type` | `str` | *(required)* | `"XmR"`, `"i"` / `"I"` (alias of XmR), `"p"`, `"u"`, `"c"`, or `"run"` (case-insensitive). |
| `value_col` | `str` | `"value"` | Column containing the measured values. |
| `subgroup_col` | `str \| None` | `"subgroup_size"` | Column with subgroup sizes. Required for `"p"` and `"u"`. |
| `numerator_col` | `str \| None` | `None` | For `"p"` charts: column with event counts when `value_col` holds the denominator. |
| `x_col` | `str \| None` | `None` | Column for the x-axis. Auto-detects `DatetimeIndex` if `None`. |
| `title` | `str \| None` | `None` | Chart title. Auto-generated if omitted. |
| `xlabel` | `str` | `"Observation"` | X-axis label. |
| `ylabel` | `str` | `"Value"` | Y-axis label. |
| `improvement_direction` | `str \| None` | `"high"` | `"high"`, `"low"`, or `None`. Controls point colouring. `None` draws a plain SPC chart with no MDC colours or icons. |
| `target` | `float \| str \| None` | `None` | Optional target — a value, or the name of a column holding the target expression. Never supply a target as a second measure. |
| `show_target` | `bool \| None` | `None` | Draw the target line. `None` draws it automatically whenever `target` is set. |
| `show_warning_limits` | `bool` | `False` | Draw the 2-sigma warning limits (`uwl` / `lwl`). |
| `show_zone_c` | `bool` | `False` | Draw the 1-sigma zone-C boundaries (`uzc` / `lzc`). |
| `shade_band` | `bool` | `False` | Fill between UCL and LCL with a translucent band. |
| `shade_color` | `str` | `"#41B6E6"` | Colour for tolerance-band shading. |
| `nhs_logo_path` | `str \| None` | `None` | Logo inside the axes (legacy). Use `logo_path` instead. |
| `ax` | `Axes \| None` | `None` | Existing axes to draw on. Creates a new figure when `None`. |
| `figsize` | `tuple` | `(12, 5)` | Figure size in inches. Ignored when `ax` is provided. |
| `show_legend` | `bool` | `True` | Add a colour legend. |
| `change_points` | `list[dict] \| None` | `None` | Vertical annotation lines. Each dict needs `"x"` and `"label"`. |
| `auto_rebase` | `bool` | `False` | Auto-detect a sustained shift and recalculate limits. |
| `rebase_on` | `str` | `"improvement"` | Shift direction that triggers a rebase: `"improvement"`, `"worsening"`, or `"any"`. |
| `baseline` | `int` | `15` | Minimum points per phase before a rebase is permitted. |
| `date_format` | `str \| None` | `None` | `strftime`-style format for datetime x-axis. |
| `logo_path` | `str \| None` | `None` | Logo image at top-right of figure. |
| `logo_zoom` | `float` | `0.07` | Logo height as fraction of figure height. |
| `show_icons` | `bool` | `False` | Display the MDC variation, assurance and improvement-direction icons plus the MDC compliance tick. Ignored when `improvement_direction` is `None`. |
| `icon_zoom` | `float` | `0.06` | Icon height as fraction of figure height. |

**Returns:** `(fig, ax)` — `matplotlib.figure.Figure` and `matplotlib.axes.Axes`.

---

### `plot_run_chart`

```python
fig, ax = plot_run_chart(
    data,
    value_col="value",
    x_col=None,
    title=None,
    xlabel="Observation",
    ylabel="Value",
    improvement_direction="high",     # "high" | "low" | None (plain run chart)
    target=None,                      # value or target-column name
    show_target=None,                 # None = draw whenever target is set
    nhs_logo_path=None,
    ax=None,
    figsize=(12, 5),
    show_legend=True,
    change_points=None,
    date_format=None,
    logo_path=None,
    logo_zoom=0.07,
    show_icons=False,
    icon_zoom=0.06,
)
```

Same parameter semantics as `plot_spc_chart` (without `chart_type`,
`subgroup_col`, `numerator_col`, `shade_band`, `shade_color`, `auto_rebase`).

**Returns:** `(fig, ax)`.

---

### `calculate_control_limits`

Returns the input DataFrame extended with `mean`, `ucl`, `lcl`, `uwl`, `lwl`,
`uzc`, `lzc` columns (or just `mean` for run charts).  `uwl` / `lwl` are the
2-sigma warning limits and `uzc` / `lzc` the 1-sigma zone-C boundaries.

### `detect_special_causes`

Returns the DataFrame extended with boolean columns `rule1`, `rule2`, `rule3`,
`rule4`, and `special_cause`.

### `detect_run_chart_signals`

Returns the DataFrame extended with `run_shift`, `run_trend`, and `run_signal`.

### `rebase_control_limits`

Returns the DataFrame with limits recalculated per improvement phase and a
`rebase_phase` integer column.

### `show_summary`

Generates a programmatic summary dictionary for a chart, including variation
type, assurance status, descriptive statistics, triggered SPC rules, and a
list of signal points. Pass `show_summary=True` to `plot_spc_chart` or
`plot_run_chart` to render the summary as an additional figure.

```python
from abspc import show_summary

summary = show_summary(data, chart_type="XmR", improvement_direction="high", target=60)
print(summary["variation"], summary["assurance"])
```

### `plot_mdc_summary_table`

Renders an NHS MDC-style summary table for one or more measures (see the
[MDC Summary Table](#mdc-summary-table) section above).

---

## Running Tests

```bash
pip install -e ".[dev]"
pytest
```

160 unit tests covering all chart types, SPC rules, run-chart signals,
auto-rebase, change-point annotations, summary generation, and plotting.
