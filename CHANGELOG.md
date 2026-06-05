# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
