# Using `abspc` for Quality Improvement

This guide explains **how to use `abspc` in a Quality Improvement (QI)
project**, end-to-end. It is aimed at QI practitioners, improvement coaches,
and analysts in the NHS who want to apply the
[Making Data Count (MDC)](https://www.england.nhs.uk/publication/making-data-count/)
methodology in code.

> Looking for syntax? Read [`abspc/README.md`](../abspc/README.md).
> Need a 5-minute walk-through? Open [`quick_start.ipynb`](quick_start.ipynb).

---

## Contents

- [Why SPC for QI?](#why-spc-for-qi)
- [The QI lifecycle and where `abspc` fits](#the-qi-lifecycle-and-where-abspc-fits)
- [Choosing the right chart](#choosing-the-right-chart)
- [A worked example: A&E 4-hour waits](#a-worked-example-ae-4-hour-waits)
- [Reading the chart — variation & assurance](#reading-the-chart--variation--assurance)
- [Annotating change points](#annotating-change-points)
- [When to rebase the limits](#when-to-rebase-the-limits)
- [Building a QI dashboard with `plot_mdc_summary_table`](#building-a-qi-dashboard-with-plot_mdc_summary_table)
- [Common pitfalls](#common-pitfalls)
- [Governance & data handling](#governance--data-handling)
- [Further reading](#further-reading)

---

## Why SPC for QI?

A QI project lives or dies on the question *"did our change make a
difference?"*. Comparing two-period averages ("this month vs. last month")
or RAG-rated dashboards routinely **mistakes ordinary variation for signal**,
producing reactive management and improvement theatre.

SPC charts (and the Making Data Count rules) give you a defensible answer:

- Plot data over time, not as a snapshot.
- Distinguish **common-cause** variation (the noise of a stable process) from
  **special-cause** variation (a real signal worth investigating).
- Pair variation with **assurance** against a target, so leaders see at a
  glance whether the system *can* hit the target as currently designed.

`abspc` implements the Making Data Count rules and icons exactly as defined
by NHS England, aligned with the
[NHSRplotthedots](https://github.com/nhs-r-community/NHSRplotthedots) R
package, so charts are interchangeable across teams using either toolset.

---

## The QI lifecycle and where `abspc` fits

| QI activity | What you produce | `abspc` helper |
|-------------|------------------|----------------|
| Define your measure | A precise numerator / denominator and frequency | — |
| Baseline | Plot historical data to confirm the process is stable | `plot_spc_chart`, `show_summary` |
| Plan tests of change (PDSA) | Choose target & expected direction | `target=`, `improvement_direction=` |
| Run the test | Continue plotting; mark interventions on the chart | `change_points=[...]` |
| Decide if change is improvement | Look for special-cause **in the desired direction**, sustained | `auto_rebase=True`, `determine_variation_type` |
| Hold the gain | Recalculate limits for the new phase, then continue monitoring | `rebase_control_limits` |
| Spread / scale | Combine multiple measures into a single board-ready view | `plot_mdc_summary_table` |

Every helper is *also* available without plotting (`calculate_control_limits`,
`detect_special_causes`, `show_summary`, …) so you can drop the numbers into
Excel, Power BI, board papers, or unit tests.

---

## Choosing the right chart

| Your data | Use | Notes |
|---|---|---|
| Continuous, one value per period (waiting time, % seen) | `XmR` | The default. Handles almost any improvement measure. |
| Proportion, with a varying denominator | `p` | Pass `numerator_col` and `value_col=denominator`, or pre-compute the rate and pass `subgroup_col`. |
| Count of events, fixed exposure | `c` | Falls per ward-month, never-events per quarter. |
| Count of events, variable exposure | `u` | Incidents per 1,000 bed-days, complaints per 1,000 contacts. |
| Time / opportunities between rare events | `t`, `g` | For rare-event measures (e.g., days between never-events). |
| < 12–15 points or process visibly unstable | `run` | Median centre line, no control limits; uses the 8-point shift / 6-point trend rules. |

When in doubt, start with `XmR`. If the chart looks wrong (e.g., a `p` chart
with too many "astronomical" points because the denominator is huge), switch
chart type — don't change the data.

---

## A worked example: A&E 4-hour waits

A QI team wants to lift the proportion of A&E attendances seen within 4 hours
from a baseline of ~78% to a target of 80%. They run two PDSA cycles: a new
streaming protocol in month 9 and a staff-training rollout in month 16.

```python
import pandas as pd
from abspc import plot_spc_chart

df = pd.read_csv("ae_4hr_monthly.csv", parse_dates=["month"], index_col="month")

fig, ax = plot_spc_chart(
    df,
    chart_type="XmR",
    title="A&E 4-hour Performance",
    xlabel="Month",
    ylabel="% within 4 hours",
    improvement_direction="high",
    target=80,
    show_target=True,
    show_icons=True,
    change_points=[
        {"x": 9,  "label": "Streaming protocol"},
        {"x": 16, "label": "Staff training"},
    ],
    auto_rebase=True,
)
fig.savefig("board_pack/ae_4hr.png", dpi=200, bbox_inches="tight")
```

The same data set, drawn with **fake** numbers, looks like this:

![A&E 4-hour SPC](images/chart_with_logo.png)

---

## Reading the chart — variation & assurance

Every chart can render the official MDC icons (`show_icons=True`):

- **Variation** — *the type of variation in the latest data*:
  - common cause (no signal)
  - special-cause **improvement** (high or low)
  - special-cause **concern** (high or low)
- **Assurance** — *whether the target will be met*:
  - pass (target will consistently be met)
  - hit-or-miss (target sometimes met)
  - fail (target consistently not met)

You can also get these programmatically without rendering a chart:

```python
from abspc import (
    calculate_control_limits,
    detect_special_causes,
    determine_variation_type,
    determine_assurance_type,
)

result    = detect_special_causes(calculate_control_limits(df, chart_type="XmR"))
variation = determine_variation_type(result, value_col="value", improvement_direction="high")
assurance = determine_assurance_type(result, target=80, improvement_direction="high")
```

This is gold for QI reporting: you can drive RAG status, narrative text, or
escalation thresholds from `variation` and `assurance` rather than from
arbitrary period-over-period thresholds.

---

## Annotating change points

QI is about cause-and-effect. Annotate the **moment a change was made**, not
just where the chart shifts:

```python
change_points=[
    {"x": "2024-09-01", "label": "Streaming protocol"},
    {"x": "2025-04-01", "label": "Staff training"},
]
```

Future readers (and your future self) will thank you. If the signal arrives
weeks before or after the intervention, the annotation makes that obvious
and prompts a conversation about lag, confounders, or unintended effects.

---

## When to rebase the limits

When ≥ 8 consecutive points sit on the *improvement* side of the centre line,
the process has shifted and the old control limits no longer describe it.
At that point you should **rebase**:

```python
fig, ax = plot_spc_chart(df, chart_type="XmR",
                          improvement_direction="high",
                          auto_rebase=True)
```

Or, programmatically:

```python
from abspc import rebase_control_limits
phased = rebase_control_limits(df, chart_type="XmR", improvement_direction="high")
phased[["value", "rebase_phase", "mean", "ucl", "lcl"]].head()
```

Rebasing is what turns a one-off improvement into the **new normal** on the
chart. Don't rebase on a single excursion — wait for the 8-point sustained
shift, which is exactly what `auto_rebase=True` enforces.

---

## Building a QI dashboard with `plot_mdc_summary_table`

For board reports and programme-level views, render multiple measures in a
single MDC-style table:

```python
from abspc import plot_mdc_summary_table

fig, ax = plot_mdc_summary_table(
    [
        {"data": ae_df,     "chart_type": "XmR", "measure": "A&E 4-hr",
         "value_col": "value", "improvement_direction": "high", "target": 80},
        {"data": falls_df,  "chart_type": "p",   "measure": "Inpatient Falls",
         "value_col": "population", "numerator_col": "events",
         "improvement_direction": "low", "target": 0.05},
        {"data": pu_df,     "chart_type": "c",   "measure": "Pressure Ulcers",
         "value_col": "value", "improvement_direction": "low"},
    ],
    title="QI Programme — Monthly Summary",
)
```

Each row gets its own variation icon, assurance icon, and sparkline — exactly
the layout used in NHS MDC training materials.

---

## Common pitfalls

- **Stop using two-period comparisons.** Every chart in this package answers
  "is this signal real?" better than "this month vs. last month".
- **Pick `improvement_direction` deliberately.** It is *not* always "high".
  For falls, infections, or DNA rates it is `"low"`.
- **Don't rebase greedily.** Rebase only after a sustained shift. `auto_rebase`
  applies the 8-point rule for you.
- **Don't mix populations in one chart.** If a service reorganisation merges
  two units, start a new chart for the merged service.
- **Don't read trends from < 12 points.** Use a `run` chart and tell the
  reader the data are early.
- **Don't hand-pick limits.** The chart is only useful if the limits are
  computed from the data the same way every time.

---

## Governance & data handling

- `abspc` is a pure analytical library: it stores nothing and sends nothing
  externally. Patient-level data never leaves your environment.
- Charts are static PNGs — safe to embed in board papers and intranet pages.
- The MDC methodology and icons originate with NHS England; this package is
  an independent open-source implementation released under the MIT licence.
- When publishing externally, use **fake data** (as in this guide and in
  `screenshots.ipynb`) or aggregate to a level that cannot re-identify
  individuals.

---

## Further reading

- [NHS England — Making Data Count](https://www.england.nhs.uk/publication/making-data-count/)
- [NHSRplotthedots](https://github.com/nhs-r-community/NHSRplotthedots) — the
  reference R implementation of the same rules.
- [`abspc/README.md`](../abspc/README.md) — full API documentation.
- [`docs/quick_start.ipynb`](quick_start.ipynb) — runnable 5-minute quick start.
- [`docs/screenshots.ipynb`](screenshots.ipynb) — reproducible chart gallery.
