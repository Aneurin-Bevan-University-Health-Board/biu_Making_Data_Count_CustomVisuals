# biu_Making_Data_Count_CustomVisuals

A Python package – **`custom_spc_mdc`** – for Statistical Process Control (SPC)
charts following the NHS [Making Data Count](https://www.england.nhs.uk/publication/making-data-count/)
(MDC) methodology.  Rules are aligned with the NHS-R community's
[NHSRplotthedots](https://github.com/nhs-r-community/NHSRplotthedots) package.

---

## Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Chart Types](#chart-types)
  - [XmR Chart](#xmr-chart)
  - [p Chart](#p-chart)
  - [c Chart](#c-chart)
  - [Run Chart](#run-chart)
- [Special-Cause Rules](#special-cause-rules)
- [Change-Point Annotations](#change-point-annotations)
- [Auto-Rebase on Sustained Improvement](#auto-rebase-on-sustained-improvement)
- [NHS Colour Scheme](#nhs-colour-scheme)
- [API Reference](#api-reference)

---

## Installation

```bash
pip install custom_spc_mdc
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
from custom_spc_mdc import plot_spc_chart, plot_run_chart

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
from custom_spc_mdc import plot_spc_chart

data = pd.DataFrame({"value": np.random.normal(50, 3, 24)})

fig, ax = plot_spc_chart(
    data,
    chart_type="XmR",
    title="XmR Chart – Individual Measurements",
    xlabel="Month",
    ylabel="Value",
    shade_band=True,            # shade between UCL and LCL
    improvement_direction="high",
)
```

![XmR Chart](docs/images/chart_xmr.png)

---

### p Chart

The p chart is for proportion data (e.g., percentage of patients waiting > 4 hours).
It requires a `subgroup_size` column containing the denominator for each period.

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
    improvement_direction="low",   # lower proportion = improvement
)
```

![p Chart](docs/images/chart_p.png)

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

The c chart is for counts of events in a fixed sample size (e.g., number of
adverse events per ward per month).

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

![c Chart](docs/images/chart_c.png)

---

### Run Chart

The run chart is a simpler chart that plots data against time with a **median**
centre line and no control limits.  It uses run-chart rules to detect signals
(7-point shift and 7-point trend).

```python
from custom_spc_mdc import plot_run_chart

data = pd.DataFrame({"value": np.random.normal(40, 4, 24)})

fig, ax = plot_run_chart(
    data,
    title="Run Chart – Median Centre Line",
    xlabel="Month",
    ylabel="Value",
    improvement_direction="high",
)
```

![Run Chart](docs/images/chart_run.png)

`plot_spc_chart` also accepts `chart_type="run"` and will automatically
delegate to `plot_run_chart`:

```python
fig, ax = plot_spc_chart(data, chart_type="run")
```

---

## Special-Cause Rules

The package implements four NHS MDC rules (aligned with NHSRplotthedots):

| Rule | Name | Description |
|------|------|-------------|
| **Rule 1** | Astronomical point | Single value outside the 3σ control limits (UCL/LCL) |
| **Rule 2** | Shift | ≥ 7 consecutive points all above **or** all below the mean |
| **Rule 3** | Trend | ≥ 7 consecutive points all going up **or** all going down |
| **Rule 4** | Two-in-three | 2 out of 3 consecutive points in the 2σ–3σ warning zone, on the same side of the mean |

Points are coloured according to the NHS MDC scheme:

| Colour | Meaning |
|--------|---------|
| 🔵 NHS Blue `#005EB8` | Improvement (special cause in the improvement direction) |
| 🟠 NHS Orange `#ED8B00` | Concern (special cause in the wrong direction) |
| ⬜ Grey `#768692` | Common cause (no signal) |

### Using the detection functions directly

```python
from custom_spc_mdc import calculate_control_limits, detect_special_causes

result = calculate_control_limits(data, chart_type="XmR")
flags  = detect_special_causes(result)

# flags contains: rule1, rule2, rule3, rule4, special_cause
print(flags[["value", "mean", "ucl", "lcl", "rule1", "rule2", "rule3", "rule4", "special_cause"]])
```

---

## Change-Point Annotations

Use `change_points` to mark known process changes (protocol updates, staff
changes, equipment replacements, etc.) with vertical lines and labels.

```python
fig, ax = plot_spc_chart(
    data,
    chart_type="XmR",
    title="XmR Chart with Change-Point Annotations",
    change_points=[
        {"x": 9,  "label": "New protocol"},
        {"x": 20, "label": "Staff training"},
    ],
)
```

![Change-Point Annotations](docs/images/chart_change_points.png)

The `x` value can be a numeric index or a date if your x-axis uses dates via
`x_col`.  Each dict requires `"x"` and `"label"` keys.

`change_points` is also supported by `plot_run_chart`:

```python
fig, ax = plot_run_chart(
    data,
    change_points=[{"x": 12, "label": "Intervention"}],
)
```

---

## Auto-Rebase on Sustained Improvement

When **statistical improvement** has been sustained (≥ 7 consecutive points in
the improvement direction relative to the current mean), the control limits can
be automatically recalculated for the new phase.

Set `auto_rebase=True` to enable this.  When a phase boundary is detected, a
dashed vertical line is drawn and the mean/UCL/LCL are recalculated from that
point forward.

```python
fig, ax = plot_spc_chart(
    data,
    chart_type="XmR",
    title="XmR Chart with Auto-Rebase on Sustained Improvement",
    improvement_direction="high",
    auto_rebase=True,        # ← enable auto-rebase
)
```

![Auto-Rebase](docs/images/chart_auto_rebase.png)

You can also use `rebase_control_limits` directly to get the phase-annotated
DataFrame without plotting:

```python
from custom_spc_mdc import rebase_control_limits

result = rebase_control_limits(
    data,
    chart_type="XmR",
    improvement_direction="high",
    min_phase_length=7,        # minimum points to trigger a rebase (default 7)
)

# result contains: mean, ucl, lcl, uwl, lwl, rebase_phase
print(result[["value", "mean", "ucl", "rebase_phase"]])
```

> **Note:** Auto-rebase is supported for `XmR`, `p`, `u`, and `c` charts.
> It is not available for run charts (use `plot_run_chart` instead).

---

## NHS Colour Scheme

All charts use the NHS identity palette:

| Colour | Hex | Usage |
|--------|-----|-------|
| NHS Blue | `#005EB8` | Mean / median line, improvement points |
| NHS Dark Blue | `#003087` | UCL / LCL lines |
| NHS Orange | `#ED8B00` | Concern points |
| Grey | `#768692` | Common-cause points, data connector line |
| NHS Warm Yellow | `#FFB81C` | Optional target line |
| NHS Light Blue | `#41B6E6` | Optional tolerance-band shading |
| NHS Pale Grey | `#E8EDEE` | Alternate tolerance-band shading |

---

## API Reference

### `plot_spc_chart`

```python
plot_spc_chart(
    data,
    chart_type,           # "XmR" | "p" | "u" | "c" | "run"
    value_col="value",
    subgroup_col="subgroup_size",
    numerator_col=None,
    x_col=None,
    title=None,
    xlabel="Observation",
    ylabel="Value",
    improvement_direction="high",   # "high" | "low"
    target=None,
    show_target=False,
    shade_band=False,
    shade_color="#41B6E6",
    nhs_logo_path=None,
    ax=None,
    figsize=(12, 5),
    show_legend=True,
    change_points=None,   # [{"x": ..., "label": "..."}, ...]
    auto_rebase=False,
)
```

### `plot_run_chart`

```python
plot_run_chart(
    data,
    value_col="value",
    x_col=None,
    title=None,
    xlabel="Observation",
    ylabel="Value",
    improvement_direction="high",
    target=None,
    show_target=False,
    nhs_logo_path=None,
    ax=None,
    figsize=(12, 5),
    show_legend=True,
    change_points=None,   # [{"x": ..., "label": "..."}, ...]
)
```

### `calculate_control_limits`

Returns the input DataFrame extended with `mean`, `ucl`, `lcl`, `uwl`, `lwl`
columns (or just `mean` for run charts).

### `detect_special_causes`

Returns the DataFrame from `calculate_control_limits` extended with boolean
columns `rule1`, `rule2`, `rule3`, `rule4`, and `special_cause`.

### `detect_run_chart_signals`

Returns the DataFrame from `calculate_control_limits(chart_type="run")`
extended with `run_shift`, `run_trend`, and `run_signal`.

### `rebase_control_limits`

Returns the DataFrame from `calculate_control_limits` with limits recalculated
per improvement phase and a `rebase_phase` integer column.

---

## Running Tests

```bash
pip install -e ".[dev]"
pytest
```

106 unit tests covering all chart types, SPC rules, run-chart signals,
auto-rebase, change-point annotations, and plotting.
