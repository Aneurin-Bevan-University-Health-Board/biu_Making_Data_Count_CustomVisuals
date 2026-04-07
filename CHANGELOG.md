# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (Looker Visualizations)
- **LookML bundler** - Automated bundling of ES6 modules into standalone files for LookML projects
- GitHub Actions workflow to auto-generate LookML-ready visualizations on push to main
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

### Added (Looker Visualizations)
- New scrollable summary table visualization with per-measure targets
- Added `determineVariationType()` function to classify overall SPC variation patterns
- Added `determineAssuranceType()` function to evaluate target achievement likelihood
- Added viewport meta tag to preview.html for mobile compatibility

### Changed
- Updated deployment workflow to copy updated chart files with `abspc_` prefix

## [0.1.5] - 2026-XX-XX

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

[Unreleased]: https://github.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/compare/v0.1.5...HEAD
[0.1.5]: https://github.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/releases/tag/v0.1.5
