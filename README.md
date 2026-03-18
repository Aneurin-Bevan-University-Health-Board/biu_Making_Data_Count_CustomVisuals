# biu_Making_Data_Count_CustomVisuals

Custom visuals implementing the NHS
[Making Data Count](https://www.england.nhs.uk/publication/making-data-count/) (MDC)
methodology for Statistical Process Control (SPC) charts.

This repository provides **ready-to-deploy chart components** across multiple
platforms:

| Platform | Status | Location |
|----------|--------|----------|
| **Python** (`abspc` package) | ✅ Available | [`abspc/`](abspc/) |
| **Looker** (custom visualizations) | ✅ Available | [`looker_core_visuals/`](looker_core_visuals/) |
| **Qlik Sense** (on-prem extension) | ✅ Available | [`qlik_sense_extension/`](qlik_sense_extension/) |
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
- [Qlik Sense — On-Prem Extension](#qlik-sense--on-prem-extension)
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

## Qlik Sense — On-Prem Extension

The [`qlik_sense_extension/`](qlik_sense_extension/) directory contains a
Qlik Sense custom visualization extension that provides the same abspc SPC
charts inside Qlik Sense on-premises dashboards.

**Minimal data requirement** — add a single date dimension and value measure;
the extension performs all SPC calculations automatically.

Supported chart types: XmR, p, u, c and run charts with full abspc
special-cause detection (all four rules) and the NHS colour scheme.

### Quick Start

1. ZIP the contents of `qlik_sense_extension/`
2. Import via the Qlik Management Console (**QMC → Extensions → Import**)
3. Drag **ABSPC SPC Chart** onto any sheet
4. Add a date dimension and a value measure

**Full documentation:** [`qlik_sense_extension/README.md`](qlik_sense_extension/README.md)

---

## Chart Types

Both the Python package and Looker visualizations support the same core
chart types:

| Chart | Use Case | Centre Line | Control Limits |
|-------|----------|-------------|----------------|
| **XmR** | Individual measurements over time | Mean | UCL / LCL (3σ) |
| **p** | Proportions (with denominator) | Mean proportion | Variable limits |
| **c** | Counts in a fixed sample | Mean count | UCL / LCL (3σ) |
| **u** | Rates (count ÷ denominator) | Mean rate | Variable limits |
| **Run** | Simple median-based chart | Median | None |

Special-cause detection follows four NHS MDC rules (aligned with
NHSRplotthedots):

| Rule | Name | Description |
|------|------|-------------|
| **1** | Astronomical point | Single value outside 3σ limits |
| **2** | Shift | ≥ 7 consecutive points above or below the mean |
| **3** | Trend | ≥ 7 consecutive points all rising or all falling |
| **4** | Two-in-three | 2 of 3 consecutive points in the warning zone |

Points are coloured by the NHS MDC scheme:

| Colour | Meaning |
|--------|---------|
| 🔵 NHS Blue `#005EB8` | Improvement (special cause in the desired direction) |
| 🟠 NHS Orange `#ED8B00` | Concern (special cause in the wrong direction) |
| ⬜ Grey `#768692` | Common cause (no signal) |

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

125 unit tests covering all chart types, SPC rules, run-chart signals,
auto-rebase, change-point annotations, and plotting.

### Looker

See [`looker_core_visuals/README.md`](looker_core_visuals/README.md) for
browser-based testing instructions.

### Qlik Sense

```bash
node qlik_sense_extension/tests/test_spc_calculations.js
```

65 unit tests covering all chart types, SPC rules, point-colouring logic,
edge cases and NHS colour constants.

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
