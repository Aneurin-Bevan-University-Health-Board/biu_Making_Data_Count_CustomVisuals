# NHS Making Data Count — Qlik Sense extensions

Statistical Process Control (SPC) visualisation extensions for **Qlik Sense
Enterprise on Windows (client-managed / on-premise)**, implementing the NHS
[Making Data Count](https://www.england.nhs.uk/publication/making-data-count/)
methodology.

The SPC maths is a direct port of the Python [`abspc`](../abspc/) package
(`abspc/spc.py`), so a chart drawn in Qlik matches the same data plotted in
Python or Looker.

> **Installing on your Qlik Sense server?** Follow
> [`implementation.md`](implementation.md).

## Extensions

| Extension | Description |
|-----------|-------------|
| `nhs-mdc-spc-chart` | SPC chart supporting XmR (I), p, p′, u, u′, c, t, g and run charts, with auto chart-type detection, all four MDC special-cause rules, optional auto-rebasing, a fixed or time-varying target line, and variation/assurance icons. |
| `nhs-mdc-summary-table` | MDC summary table: one row per measure with variation and assurance icons, target, latest period and latest value. Mirrors `abspc.plot.plot_mdc_summary_table`. |
| `nhs-mdc-variation-icon` | Compact KPI tile showing the latest value with the MDC variation and assurance icons. |

Every analysis setting can be entered as a **fixed value** or driven by a
**Qlik expression**, so chart type, improvement direction and target can come
from a variable or a configuration table instead of being set object by object.

## Repository layout

```text
qliksense_extensions/
├── implementation.md          <- installation guide (QMC import, Dev Hub, upgrades)
├── package.json               <- build + test scripts (no runtime dependencies)
├── shared/
│   ├── spc-engine.js          <- SPC calculations (port of abspc/spc.py)
│   ├── spc-render.js          <- dependency-free SVG rendering + MDC icons
│   ├── qlik-data.js           <- hypercube paging, series and number formatting
│   ├── props-ui.js            <- fixed/expression property panel helpers
│   ├── qlik-context.js        <- current user and app name for the generated stamp
│   └── build-info.js          <- version + build date (rewritten at build time)
├── src/
│   ├── nhs-mdc-spc-chart/
│   ├── nhs-mdc-summary-table/
│   └── nhs-mdc-variation-icon/
├── scripts/build.js           <- packages each extension into dist/<name>.zip
└── tests/test_spc_engine.js   <- unit tests for the SPC engine
```

The build copies all six shared modules into each extension's `lib/` folder,
so every package is self-contained — which also means a change under `shared/`
requires **all three** extensions to be rebuilt and re-imported.

## Build and test

```bash
npm run build   # writes dist/<extension>/ and dist/<extension>.zip
npm test        # runs the SPC engine unit tests
```

Both commands use only Node.js (14.14+) and its standard library — nothing is
downloaded, which keeps the packages usable inside restricted NHS networks.

Each visual prints its version and build date in the bottom corner (switch it
off with **Show extension build date**), so the build running in Qlik can be
checked against the `.zip` that was imported.

## Data model

| Extension | Dimensions | Measures |
|-----------|------------|----------|
| SPC Chart | 1: time period | 1: value · 2: denominator · 3: target |
| Summary Table | 1: measure name · 2: time period · 3: description | 1: value · 2: denominator · 3: target |
| Variation Icon | 1: time period | 1: value · 2: denominator · 3: target |

Only the first dimension and first measure are required. **The Summary Table requires at least two dimensions** (measure name and time period).

* **Denominator** — the subgroup size for p and u charts.
* **Target** — a third measure overrides the fixed target and lets the target
  line change over time; assurance is judged against the latest period.
* **Description** — optional third dimension on the summary table, shown as a
  column beside the measure name. It must be one-to-one with the measure name,
  otherwise Qlik splits the measure across several rows.

**Sort the time dimension ascending.** SPC rules are sequence-sensitive, so the
row order *is* the analysis. A text period such as `Aug-25` sorts
alphabetically and will silently produce the wrong answer — use a real date
field, or sort by load order.

Values are formatted with the measure's own Qlik number format (percentages and
durations included), falling back to the **Decimal places** property when no
format is available. Use a master measure to set the format once for every
visual.

## Summary table columns

| Column | Contents |
|--------|----------|
| Measure | Dimension 1 |
| Description | Dimension 3, when supplied |
| Variation | MDC icon and label |
| Assurance | MDC icon and label |
| Target | Target in the latest period, blank when no target is set |
| Latest period | Last value of dimension 2 — shows which period the row describes |
| Latest value | Measure 1 in that period |

## Chart types and rules

| Chart | Centre line | Limits |
|-------|-------------|--------|
| XmR (alias `i`) | Mean | `mean ± 2.66 · MRbar` (3σ), `± 1.77 · MRbar` (2σ) |
| p | Pooled proportion | `p̄ ± 3√(p̄(1−p̄)/n)` — varies with denominator |
| p′ (`pprime`) | Pooled proportion | as p, then each σ scaled by Laney's σ(z) |
| u | Pooled rate | `ū ± 3√(ū/n)` — varies with denominator |
| u′ (`uprime`) | Pooled rate | as u, then each σ scaled by Laney's σ(z) |
| c | Mean count | `c̄ ± 3√c̄` |
| t | Back-transformed mean | XmR limits on `Y^(1/3.6)`, back-transformed |
| g | Mean opportunities | `ḡ ± 3√(ḡ(ḡ+1))` |
| run | Median | none (shift and trend signals only) |

### When to use p′ and u′

With large denominators — bed days, contacts, whole-population activity — the
binomial or Poisson σ becomes tiny and ordinary p and u charts flag almost every
point as special cause. Laney's p′ and u′ charts measure the actual dispersion
between subgroups and widen the limits accordingly, so only genuine signals
remain. When the data is not overdispersed, σ(z) resolves to 1 and p′/u′ give
the same limits as p/u, so nothing is lost by choosing them.

Auto-detect never selects p′ or u′ — pick them explicitly. Alongside `pprime`
and `uprime`, the expression form also accepts `p'`, `p-prime`, `p_prime` and
the `u` equivalents.

Special-cause rules (aligned with
[NHSRplotthedots](https://github.com/nhs-r-community/NHSRplotthedots)):

| Rule | Description |
|------|-------------|
| 1 | Astronomical point outside the 3σ limits |
| 2 | Shift — 8+ consecutive points on one side of the centre line |
| 3 | Trend — 6+ consecutive points all rising or all falling |
| 4 | Two-in-three — 2 of 3 consecutive points in the warning zone, same side |

Point colours: NHS Blue `#005EB8` (improvement), NHS Orange `#ED8B00`
(concern), Grey `#768692` (common cause).

SPC needs history: aim for 15–100 points. Below 15 the chart shows a warning,
because limits calculated from fewer points are unreliable.

## Notes on parity with the Python package

* Qlik measures are always numeric, so counts are detected by value rather
  than by data type: for **p charts** any value greater than 1 is treated as a
  numerator count; for **u charts** whole numbers are treated as counts. Supply
  pre-calculated proportions/rates if you want to bypass the conversion.
* When a p or u chart is selected without a denominator measure, the engine
  falls back to the documented defaults (100 for p, 1 for u) instead of
  failing, matching the Looker visuals.
* Auto-rebasing uses the same phase logic, `rebase_on` options and `baseline`
  offset as `abspc.rebase_control_limits`.
* Numbers follow the Qlik measure format rather than the Python `%.4g`
  formatting, so a value shown in the visual matches the rest of the app.
* The summary table adds a **Latest period** column that the Python table does
  not have, so the data behind each row can be traced back.

## Licence

MIT — see [`LICENSE`](../LICENSE). Making Data Count is an NHS England
methodology; this is an independent open-source implementation.
