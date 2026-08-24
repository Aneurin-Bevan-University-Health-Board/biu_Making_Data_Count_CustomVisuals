# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Qlik Sense custom visual set** (`qliksense_extensions/`) for Qlik Sense
  Enterprise on Windows (client-managed / on-premise, 2024 releases):
  `nhs-mdc-spc-chart`, `nhs-mdc-summary-table` and `nhs-mdc-variation-icon`.
  The extensions share `shared/spc-engine.js`, a JavaScript port of
  `abspc/spc.py` covering XmR/I, p, p′, u, u′, c, t, g and run charts, MDC
  special-cause rules 1–4, run-chart signals, auto-rebasing (`rebaseOn` /
  `baseline`), variation and assurance classification, and chart-type
  auto-detection. Rendering is dependency-free SVG with NHS colours and MDC
  icons.
- **Laney p′ and u′ charts** for large denominators, where ordinary p and u
  limits are so tight that almost every point signals. Each subgroup sigma is
  scaled by σ(z), derived from the mean moving range of the z-transformed
  series, so the limits reflect the dispersion actually present between
  subgroups. σ(z) resolves to 1 when the data is not overdispersed, making the
  limits identical to p/u. Auto-detection never selects them; they must be
  chosen explicitly as `pprime` / `uprime` (or `p'`, `p-prime`, `p_prime` and
  the `u` equivalents in an expression).
- **Fixed or expression-driven settings** — chart type, improvement direction,
  target, rebase options and baseline can each be set from the property panel
  or driven by a Qlik variable or configuration table.
- **Time-varying target** — on the summary table and variation icon an optional
  third measure supplies a target per period, drawn as a stepped target line and
  used for assurance in the latest period.
- **Plain SPC charts** — setting the Qlik SPC chart's improvement direction to
  *Not set* (or returning `none` from its expression) drops the Making Data
  Count colours and icons while keeping every part of the SPC logic:
  special-cause points take the neutral NHS Dark Blue, the legend reads
  *Special cause*, and auto-rebasing falls back to any sustained shift.
- **Making Data Count compliance badge** — a tick beside the variation and
  assurance icons, NHS Green when the chart is MDC compliant (improvement
  direction set, process control limits present and at least 15 points) and
  grey with the reasons in its tooltip when it is not.
- **Zone C (1 sigma)** — `calculateControlLimits` now returns `uzc` / `lzc` for
  every chart type with limits (preserved through rebasing), and the SPC chart
  gained a **Show zone C (1 sigma)** option alongside the warning limits so a
  process hugging the centre line can be seen.
- **Qlik-native number formatting** — values follow the measure's own format
  (percentages, currency, durations), falling back to a decimal-places setting.
- **Summary table parity with `abspc.plot.plot_mdc_summary_table`**, plus an
  optional description column (third dimension) and a latest-period column so
  each row can be traced back to the data.
- **Generated stamp** on each visual recording when it was rendered, the
  signed-in user and the Qlik app it sits in, resolved through the Capability
  API and cached per session. The extension version and build date moved to the
  stamp's tooltip, and are still used as the fallback when the Qlik context
  cannot be read.
- **Improvement-direction icon** — an up or down arrow shown beside the
  variation and assurance icons on the SPC chart and KPI tile, mirroring
  `improvement_direction_high/low.png` in the Python package.
- **`qliksense_extensions/implementation.md`** — QMC/Dev Hub installation,
  configuration, upgrade, uninstall and troubleshooting guide for the
  on-premise Qlik Sense deployment.
- **Zero-dependency build (`npm run build`) and tests (`npm test`)** for the
  Qlik Sense extensions, producing importable `.zip` packages.

### Changed
- The Qlik SPC chart charts a **single measure**: a second measure is only ever
  the p/u denominator and a third is rejected with a message pointing at the
  target value / target expression. The target is no longer taken from a
  measure on that visual.
- The SPC chart legend and icons are placed below the rotated period labels,
  with the label band measured from the labels themselves, so long dates no
  longer collide with them. The icons are laid out as one group.

## [1.1.0] - 2026-06-15

### Added
- **I (Individuals) chart** as an alias of XmR. `chart_type="i"` / `"I"` is now
  accepted everywhere XmR is accepted (`calculate_control_limits`,
  `rebase_control_limits`, `plot_spc_chart`, `show_summary`) and is normalised
  to `"xmr"` internally. The I chart shares the XmR maths (`mean ± 2.66·MRbar`
  for 3-sigma limits, `± 1.77·MRbar` for 2-sigma warning limits) and is drawn
  with an *"I Chart (Individuals)"* title.
- **`rebase_on` parameter** on `rebase_control_limits()` and `plot_spc_chart()`
  controlling which direction of sustained shift triggers an auto-rebase:
  `"improvement"` (default — shifts in `improvement_direction`), `"worsening"`
  (shifts away from it), or `"any"` (a sustained run on either side of the mean,
  using the earliest qualifying shift). Invalid values raise `ValueError`.
- **`baseline` parameter** (default `15`) on `rebase_control_limits()` and
  `plot_spc_chart()` setting the minimum number of points that must accumulate
  within a phase before an auto-rebase is permitted. A larger baseline absorbs
  early shifts; `baseline=0` permits the earliest possible rebase. Must be a
  non-negative integer (otherwise `ValueError`).

### Changed
- `rebase_control_limits()` now auto-rebases on the configurable `rebase_on`
  direction (previously improvement-only) and respects the `baseline` offset.
  The default `baseline=15` means short series no longer rebase on very early
  shifts unless `baseline` is lowered.
- Documented the control-chart rules, the full parameter/variable reference,
  and a worked I-chart example in the README files; expanded NumPy-style
  docstrings for the modified functions.

### Fixed
- Added the required `version` field to `pyproject.toml` so the package builds
  under PEP 621 / setuptools.

## [1.0.0] - 2026-06-05

### Changed
- First stable release to PyPI and TestPyPI
- Version bump from 0.2.1 to 1.0.0

## [0.2.1] - 2026-04-22

### Fixed
- Synced `__version__` in `abspc/__init__.py` with `pyproject.toml` / `setup.py` (was reporting `0.1.5` while the package version was `0.2.0`)

### Changed
- Refreshed README documentation to reflect the current public API (including `show_summary` and `plot_mdc_summary_table`)
- Updated test-count references to match the current Python test suite (160 tests)
- Repackaged for a fresh PyPI release

## [0.2.0] - 2026-04-10

### Added
- New `show_summary()` function to generate programmatic analysis summaries with variation, assurance, statistics, rules triggered, and signal points
- Visual summary display when `show_summary=True` parameter is passed to `plot_spc_chart()` and `plot_run_chart()`
- Summary visualization includes formatted display of variation type, assurance status, data statistics, triggered rules, and signal point details

### Changed
- Improved change point visualization with dashed lines, lighter color (#768692), and rounded label boxes
- Repositioned legend to single-row layout below x-axis with improved spacing (bbox_to_anchor -0.25/-0.28)
- Increased bottom padding for better legend clearance (rect 0.12/0.13)
- Enhanced visual hierarchy and readability of all chart elements
- Version bump to 0.2.0

### Fixed
- Resolved syntax error in `plot_mdc_summary_table()` (unclosed bracket)
- Removed duplicate MDC summary table column definitions
- Fixed name conflict between `show_summary` function and parameter using aliased import

## [0.1.6] - 2025-04-07

### Fixed
- Fixed PyPI README path to use `abspc/README.md` instead of root `README.md`

### Added (Looker Visualizations)
- **LookML bundler** - Automated bundling of ES6 modules into standalone files for LookML projects
- GitHub Actions workflow (`bundle-lookml.yml`) to auto-generate LookML-ready visualizations on push to main
- New scrollable summary table visualization with per-measure targets
- Added `determineVariationType()` function to classify overall SPC variation patterns
- Added `determineAssuranceType()` function to evaluate target achievement likelihood
- Added viewport meta tag to preview.html for mobile compatibility
- Created `bundle-for-lookml.cjs` script to inline dependencies and generate `manifest.lkml`
- Added `npm run bundle` and `npm run deploy` scripts to package.json

### Fixed (Looker Visualizations)
- Fixed `determinePointColors` signature mismatch causing incorrect point colors in XmR, p, c, and u charts
- Fixed zero-dimension rendering bug that caused white/blank charts on initial load
- Optimized XmR chart rendering performance by using single SVG path instead of per-point elements

### Changed (DevOps)
- Enhanced .gitignore with Node.js and OS file patterns
- Created package.json with test, bundle, and deploy scripts
- Removed old manual dist/ files in favor of automated dist/lookml/ bundling

## [0.1.5] - 2025-XX-XX

### Added
- Python package (`abspc`) published to PyPI
- Looker Core custom visualizations (ES6 modules)
- Support for XmR, p, u, c, and Run charts
- Auto-chart with intelligent type detection
- NHS colour scheme and Making Data Count methodology
- 125 Python tests with pytest
- 17 JavaScript unit tests
- Interactive test notebook
- Comprehensive documentation with chart gallery

### Documentation
- Main README with multi-platform overview
- Python package guide (`abspc/README.md`)
- Looker visualizations guide (`looker_core_visuals/README.md`)
- Chart gallery with screenshots

## Legend

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Vulnerability fixes

[Unreleased]: https://github.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/compare/v0.1.6...v0.2.0
[0.1.6]: https://github.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/releases/tag/v0.1.5
