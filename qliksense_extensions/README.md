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
| `nhs-mdc-spc-chart` | SPC chart supporting XmR (I), p, u, c, t, g and run charts, with auto chart-type detection, all four MDC special-cause rules, optional auto-rebasing, target line, and variation/assurance icons. |
| `nhs-mdc-summary-table` | MDC summary table: one row per measure with variation and assurance icons, latest value, mean, point count and chart type. |
| `nhs-mdc-variation-icon` | Compact KPI tile showing the latest value with the MDC variation and assurance icons. |

## Repository layout

```text
qliksense_extensions/
├── implementation.md          <- installation guide (QMC import, Dev Hub, upgrades)
├── package.json               <- build + test scripts (no runtime dependencies)
├── shared/
│   ├── spc-engine.js          <- SPC calculations (port of abspc/spc.py)
│   ├── spc-render.js          <- dependency-free SVG rendering + MDC icons
│   └── qlik-data.js           <- hypercube paging and series helpers
├── src/
│   ├── nhs-mdc-spc-chart/
│   ├── nhs-mdc-summary-table/
│   └── nhs-mdc-variation-icon/
├── scripts/build.js           <- packages each extension into dist/<name>.zip
└── tests/test_spc_engine.js   <- unit tests for the SPC engine
```

## Build and test

```bash
npm run build   # writes dist/<extension>/ and dist/<extension>.zip
npm test        # runs the SPC engine unit tests
```

Both commands use only Node.js (14+) and its standard library — nothing is
downloaded, which keeps the packages usable inside restricted NHS networks.

## Data model

| Extension | Dimension 1 | Dimension 2 | Measure 1 | Measure 2 (optional) |
|-----------|-------------|-------------|-----------|----------------------|
| SPC Chart | Time period | — | Value | Denominator (p/u charts) |
| Summary Table | Measure name | Time period | Value | Denominator (p/u charts) |
| Variation Icon | Time period | — | Value | Denominator (p/u charts) |

Sort the time dimension ascending — SPC rules depend on the row order.

## Chart types and rules

| Chart | Centre line | Limits |
|-------|-------------|--------|
| XmR (alias `i`) | Mean | `mean ± 2.66 · MRbar` (3σ), `± 1.77 · MRbar` (2σ) |
| p | Pooled proportion | `p̄ ± 3√(p̄(1−p̄)/n)` — varies with denominator |
| u | Pooled rate | `ū ± 3√(ū/n)` — varies with denominator |
| c | Mean count | `c̄ ± 3√c̄` |
| t | Back-transformed mean | XmR limits on `Y^(1/3.6)`, back-transformed |
| g | Mean opportunities | `ḡ ± 3√(ḡ(ḡ+1))` |
| run | Median | none (shift and trend signals only) |

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

## Licence

MIT — see [`LICENSE`](../LICENSE). Making Data Count is an NHS England
methodology; this is an independent open-source implementation.
