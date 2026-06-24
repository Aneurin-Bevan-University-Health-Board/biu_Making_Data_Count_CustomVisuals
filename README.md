# biu_Making_Data_Count_CustomVisuals
[![PyPI version](https://badge.fury.io/py/abspc.svg)](https://pypi.org/project/abspc/)
[![PyPI Downloads](https://img.shields.io/pypi/dm/abspc?label=downloads%2Fmonth)](https://pypistats.org/packages/abspc)
[![Python Versions](https://img.shields.io/pypi/pyversions/abspc)](https://pypi.org/project/abspc/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![NHS Wales](https://img.shields.io/badge/NHS%20Wales-ABUHB-005EB8?logo=data:image/svg+xml;base64,...)](https://abuhb.nhs.wales)

Custom visuals implementing the NHS
[Making Data Count](https://www.england.nhs.uk/publication/making-data-count/) (MDC)
methodology for Statistical Process Control (SPC) charts.

This repository provides **ready-to-deploy chart components** across multiple
platforms:

| Platform | Status | Location |
|----------|--------|----------|
| **Python** (`abspc` package) | Available | [`abspc/`](abspc/) |
| **Looker** (custom visualizations) | Available | [`looker_core_visuals/`](looker_core_visuals/) |
| **Looker Studio** (community viz) | 🔜 Planned | — |

SPC rules are aligned with the NHS-R community's
[NHSRplotthedots](https://github.com/nhs-r-community/NHSRplotthedots) R package.
The Making Data Count methodology is developed by
[NHS England](https://www.england.nhs.uk/publication/making-data-count/) —
this project is an **independent, open-source implementation** and is not
affiliated with or endorsed by NHS England.

---

## Contents

- [Python — `abspc`](#python--abspc)
- [Looker — Custom Visualizations](#looker--custom-visualizations)
- [Chart Types](#chart-types)
- [MDC Icons & Assurance](#mdc-icons--assurance)
- [NHS Colour Scheme](#nhs-colour-scheme)
- [Running Tests](#running-tests)
- [Licence & Attribution](#licence--attribution)

---

## Python — `abspc`

The [`abspc`](https://pypi.org/project/abspc/) Python package provides
publication-ready SPC charts via matplotlib. Install from PyPI:

```bash
pip install abspc
```

**Quick Start:**

```python
import pandas as pd
from abspc import plot_spc_chart

data = pd.DataFrame({"value": [48, 52, 49, 55, 47, 51, 53, 50, 48, 54]})
fig, ax = plot_spc_chart(data, chart_type="XmR")
fig.savefig("my_xmr_chart.png")
```

![XmR Chart](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_xmr.png)

Key features include date-axis auto-detection, logo placement, change-point
annotations, auto-rebase on sustained improvement, MDC variation & assurance
icons, and an MDC summary table.

**Full documentation:** [`abspc/README.md`](abspc/README.md)

### Chart Gallery

These are taken from the interactive test notebook (`tests/test_notebook.ipynb`),
which walks through every chart type and feature.

**Auto-Rebase** — detects sustained shifts and recalculates control limits per phase:

![Auto-Rebase](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_auto_rebase.png)

**p Chart** — proportion data with variable control limits:

![p Chart](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_p.png)

**c Chart** — count data with Poisson-based limits:

![c Chart](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_c.png)

**Run Chart** — median centre line, no control limits:

![Run Chart](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_run.png)

**Change-Point Annotations** — mark known process changes on the chart:

![Change Points](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_change_points.png)

**Date-Axis Formatting**:

![Date Axis](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_date_axis.png)

**Logo Placement**:

![Chart with Logo](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/docs/images/chart_with_logo.png)

---

## Looker — Custom Visualizations

The [`looker_core_visuals/`](looker_core_visuals/) directory contains
standalone JavaScript visualizations that plug directly into Looker dashboards.

Available visualizations:

| File | Chart Type |
|------|------------|
| `abspc_xmr_chart.js` | XmR (individuals / moving range) |
| `abspc_p_chart.js` | p chart (proportions) |
| `abspc_c_chart.js` | c chart (counts) |
| `abspc_u_chart.js` | u chart (rates) |
| `abspc_run_chart.js` | Run chart (median) |
| `abspc_summary_table.js` | MDC summary table |

Each visualization is a self-contained JS file that can be uploaded to Looker
via the **Visualization** admin panel. Features include NHS colour scheme,
MDC variation & assurance icons with tooltips, optional auto-rephasing, and
configurable improvement direction and targets.

**Full documentation:** [`looker_core_visuals/README.md`](looker_core_visuals/README.md)

---

## Chart Types

Both the Python package and Looker visualizations support the same core
chart types:

| Chart | Use Case | Centre Line | Control Limits |
|-------|----------|-------------|----------------|
| **XmR** | Individual measurements over time | Mean | UCL / LCL (3σ) |
| **I** | Individuals chart — **alias of XmR** (`chart_type="i"` / `"I"`) | Mean | UCL / LCL (3σ) |
| **p** | Proportions (with denominator) | Mean proportion | Variable limits |
| **c** | Counts in a fixed sample | Mean count | UCL / LCL (3σ) |
| **u** | Rates (count ÷ denominator) | Mean rate | Variable limits |
| **Run** | Simple median-based chart | Median | None |

> The **I (Individuals) chart** is mathematically identical to the XmR chart.
> Passing `chart_type="i"` or `"I"` anywhere XmR is accepted produces the same
> control limits; only the default chart title changes to *"I Chart
> (Individuals)"*.

### Control chart rules

For **XmR / I** charts the centre line is the mean of the values and the
3-sigma process control limits are estimated from the **average moving range**
(`MRbar`, the mean of the absolute differences between consecutive points):

```text
UCL / LCL = mean ± 2.66 · MRbar     (3-sigma process limits)
UWL / LWL = mean ± 1.77 · MRbar     (2-sigma warning limits)
```

The constant `2.66 = 3 / d2` with `d2 = 1.128` for a moving range of size 2;
the 2-sigma warning multiplier is `2/3 · 2.66 ≈ 1.77`. (This maths is shared by
the XmR and I charts and is unchanged by the alias.)

Special-cause detection follows four NHS MDC rules (aligned with
NHSRplotthedots):

| Rule | Name | Description |
|------|------|-------------|
| **1** | Astronomical point | Single value outside 3σ limits |
| **2** | Shift | ≥ 8 consecutive points above or below the mean |
| **3** | Trend | ≥ 6 consecutive points all rising or all falling |
| **4** | Two-in-three | 2 of 3 consecutive points in the warning zone |

**Auto-rebase trigger** — the **shift** rule (Rule 2) is also the auto-rebase
trigger. A run of `min_phase_length` (default **8**) consecutive points on one
side of the mean is treated as a sustained shift (the *NHS MDC shift rule*), at
which point the control limits are recalculated from the start of that run
forward. The `rebase_on` parameter selects which direction of shift counts
(`"improvement"`, `"worsening"`, or `"any"`), and `baseline` (default **15**)
sets how many points must accumulate within a phase before a rebase is
permitted.

Points are coloured by the NHS MDC scheme:

| Colour | Meaning |
|--------|---------|
| 🔵 NHS Blue `#005EB8` | Improvement (special cause in the desired direction) |
| 🟠 NHS Orange `#ED8B00` | Concern (special cause in the wrong direction) |
| ⬜ Grey `#768692` | Common cause (no signal) |

---

## Parameters / variables

### `calculate_control_limits(data, chart_type, ...)`

| Parameter | Default | Description |
|-----------|---------|-------------|
| `data` | — | Input `DataFrame` containing at least `value_col`. |
| `chart_type` | — | `"XmR"`, **`"i"` / `"I"`** (alias of XmR), `"p"`, `"u"`, `"c"`, `"t"`, `"g"`, `"run"` (case-insensitive). |
| `value_col` | `"value"` | Column holding the measured values. |
| `subgroup_col` | `"subgroup_size"` | Subgroup / denominator sizes (required for `p` / `u`). |
| `numerator_col` | `None` | Event-count column for `p` charts when `value_col` is the denominator. |

### `rebase_control_limits(data, chart_type, ...)`

| Parameter | Default | Description |
|-----------|---------|-------------|
| `data` | — | Input `DataFrame`. |
| `chart_type` | — | As above, plus **`"i"` / `"I"`**; `"run"` is not supported. |
| `improvement_direction` | `"high"` | `"high"` if higher is better, else `"low"`. |
| `value_col` | `"value"` | Column holding the measured values. |
| `subgroup_col` | `"subgroup_size"` | Subgroup sizes (for `p` / `u`). |
| `numerator_col` | `None` | Event-count column for `p` charts. |
| `min_phase_length` | `8` | Consecutive points one side of the mean that constitute a shift (NHS MDC shift rule). |
| **`rebase_on`** | **`"improvement"`** | Which shift direction triggers a rebase: `"improvement"`, `"worsening"`, or `"any"`. |
| **`baseline`** | **`15`** | Minimum points that must accumulate within a phase before a rebase is permitted. |

### `plot_spc_chart(data, chart_type, ...)`

Accepts the same chart-type and rebasing options, plus presentation controls.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `chart_type` | — | `"XmR"`, **`"i"` / `"I"`**, `"p"`, `"u"`, `"c"`, `"run"` (the `"I"` title is *"I Chart (Individuals)"*). |
| `value_col` | `"value"` | Column holding the measured values. |
| `subgroup_col` | `"subgroup_size"` | Subgroup sizes (for `p` / `u`). |
| `numerator_col` | `None` | Event-count column for `p` charts. |
| `x_col` | `None` | Column for the x-axis (auto-detects a `DatetimeIndex`). |
| `title` | `None` | Chart title (defaults from `chart_type`). |
| `improvement_direction` | `"high"` | `"high"` or `"low"`. |
| `target` | `None` | Optional target value / assurance line. |
| `auto_rebase` | `False` | Detect sustained shifts and recalculate limits per phase. |
| **`rebase_on`** | **`"improvement"`** | Shift direction that triggers a rebase: `"improvement"`, `"worsening"`, or `"any"`. |
| **`baseline`** | **`15`** | Minimum points per phase before a rebase is permitted. |
| `show_target`, `shade_band`, `show_legend`, `show_icons`, `show_summary`, … | various | Presentation options (see the package docstrings). |

Invalid values for `rebase_on` (not one of `improvement` / `worsening` /
`any`) or a negative / non-integer `baseline` raise `ValueError`.

### Worked example — I chart with flexible rebasing

```python
import pandas as pd
from abspc import plot_spc_chart

# 12 stable points, then a sustained downward shift
data = pd.DataFrame({"value": [50, 52, 49, 51, 50, 53, 48, 52, 51, 49, 50, 52,
                               30, 31, 29, 32, 30, 28, 31, 29, 30, 32, 29, 31]})

fig, ax = plot_spc_chart(
    data,
    chart_type="I",        # Individuals chart (alias of XmR)
    auto_rebase=True,       # split into phases on a sustained shift
    rebase_on="any",        # rebase on a shift in either direction
    baseline=15,            # require 15 points before a phase may rebase
    improvement_direction="low",
)
ax.set_title("I Chart with auto-rebase (rebase_on='any')")
fig.savefig("i_chart_rebase.png")
```

---

## MDC Icons & Assurance

Both platforms display the official Making Data Count variation and assurance
icons:

**Variation** (type of special-cause variation in the latest data):

| Type | Icon | Meaning |
|------|------|---------|
| Improvement (high) | ![improvement_high](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/abspc/icons/variation_improvement_high.png) | Special-cause improvement (higher) |
| Improvement (low) | ![improvement_low](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/abspc/icons/variation_improvement_low.png) | Special-cause improvement (lower) |
| Common cause | ![common_cause](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/abspc/icons/variation_common_cause.png) | No special-cause variation |
| Concern (high) | ![concern_high](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/abspc/icons/variation_concern_high.png) | Special-cause concern (higher) |
| Concern (low) | ![concern_low](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/abspc/icons/variation_concern_low.png) | Special-cause concern (lower) |

**Assurance** (whether the target will be met):

| Type | Icon | Meaning |
|------|------|---------|
| Pass | ![pass](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/abspc/icons/assurance_pass.png) | Target will consistently be met |
| Hit or miss | ![hit_or_miss](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/abspc/icons/assurance_hit_or_miss.png) | Target may or may not be met |
| Fail | ![fail](https://raw.githubusercontent.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/main/abspc/icons/assurance_fail.png) | Target will consistently not be met |

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

## Running Tests

### Python

```bash
pip install -e ".[dev]"
pytest
```

160 unit tests covering all chart types, SPC rules, run-chart signals,
auto-rebase, change-point annotations, summary generation, and plotting.

### Looker

See [`looker_core_visuals/README.md`](looker_core_visuals/README.md) for
browser-based testing instructions.

---

## Licence & Attribution

This project is released under the [MIT Licence](LICENSE).

The **Making Data Count** methodology is developed and maintained by
[NHS England](https://www.england.nhs.uk/publication/making-data-count/).
SPC rules implemented here are aligned with the
[NHSRplotthedots](https://github.com/nhs-r-community/NHSRplotthedots) R
package by the NHS-R Community.

This repository is an **independent, open-source implementation** created by
**Aneurin Bevan University Health Board** and is not affiliated with, endorsed
by, or officially connected to NHS England or the NHS-R Community.
