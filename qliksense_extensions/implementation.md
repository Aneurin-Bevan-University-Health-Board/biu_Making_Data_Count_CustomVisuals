# Installing the NHS Making Data Count extensions on Qlik Sense (on-premise)

This guide covers **Qlik Sense Enterprise on Windows (client-managed)**,
February/May/August/November **2024** releases. It does **not** cover Qlik
Cloud / Qlik Sense SaaS (although the same extension packages work there via
*Administration > Extensions*).

Three visualisation extensions are provided:

| Extension | Folder / package | Purpose |
|-----------|------------------|---------|
| **NHS MDC SPC Chart** | `nhs-mdc-spc-chart` | Full SPC chart (XmR, p, u, c, t, g, run) |
| **NHS MDC Summary Table** | `nhs-mdc-summary-table` | Variation & assurance icons per measure |
| **NHS MDC Variation Icon** | `nhs-mdc-variation-icon` | Single-measure KPI tile with MDC icons |

---

## 1. Prerequisites

| Requirement | Detail |
|-------------|--------|
| Qlik Sense | Enterprise on Windows (client-managed), 2024 releases (also works from June 2018 onwards) |
| Permissions | A QMC account with the `RootAdmin` or `ContentAdmin` role (needed to import extensions) |
| Security rule | Users need the standard `Extension` read rule (`Extension_*`, enabled by default) |
| Build machine | Node.js 14 or later — only required if you build the packages yourself |
| Browser | Chrome, Edge or Firefox (the extensions use SVG and ES5 JavaScript only) |

No internet access, CDN or third-party JavaScript library is required at
runtime: the extensions ship with everything they need and use only the Qlik
Sense RequireJS loader.

---

## 2. Get the extension packages

### Option A — build the `.zip` packages from this repository (recommended)

On any machine with Node.js installed:

```bash
git clone https://github.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals.git
cd biu_Making_Data_Count_CustomVisuals/qliksense_extensions
npm run build
```

This writes three importable archives (no npm dependencies are downloaded):

```text
qliksense_extensions/dist/nhs-mdc-spc-chart.zip
qliksense_extensions/dist/nhs-mdc-summary-table.zip
qliksense_extensions/dist/nhs-mdc-variation-icon.zip
```

The build copies the shared modules (`shared/spc-engine.js`,
`shared/spc-render.js`, `shared/qlik-data.js`) into each extension's `lib/`
folder, so every package is completely self-contained.

Optionally verify the SPC maths first:

```bash
npm test
```

### Option B — assemble a package by hand (no Node.js)

For each extension folder under `qliksense_extensions/src/`:

1. Copy the folder (for example `nhs-mdc-spc-chart`) to a working directory.
2. Create a `lib` sub-folder inside it.
3. Copy `qliksense_extensions/shared/spc-engine.js`, `spc-render.js` and
   `qlik-data.js` into that `lib` folder.
4. Zip the extension folder so the archive contains the folder itself, e.g.
   `nhs-mdc-spc-chart/nhs-mdc-spc-chart.qext`, `nhs-mdc-spc-chart/lib/...`.

The finished structure of each package must be:

```text
nhs-mdc-spc-chart/
├── nhs-mdc-spc-chart.qext     <- extension manifest (name shown in Qlik)
├── nhs-mdc-spc-chart.js       <- entry point loaded by Qlik Sense
├── properties.js              <- property panel definition
├── wbfolder.wbl               <- Dev Hub file list
└── lib/
    ├── spc-engine.js          <- SPC maths (port of the Python abspc package)
    ├── spc-render.js          <- SVG renderer and MDC icons
    └── qlik-data.js           <- hypercube paging helpers
```

---

## 3. Import into Qlik Sense Enterprise on Windows

1. Sign in to the **QMC** (`https://<your-server>/qmc`).
2. Open **Manage content > Extensions**.
3. Click **Import** (bottom right).
4. Choose `nhs-mdc-spc-chart.zip` and click **Import**.
   *If you are replacing an existing version, tick **Overwrite existing extension**.*
5. Repeat for `nhs-mdc-summary-table.zip` and `nhs-mdc-variation-icon.zip`.
6. Confirm the three extensions appear in the list with owner and date.

The files are deployed to the central node under:

```text
C:\ProgramData\Qlik\Sense\Repository\Extensions\<extension-name>\
```

and are synchronised to rim nodes automatically. Do **not** copy files into
that folder manually on a multi-node site — always import through the QMC so
the repository database stays in step.

### Alternative: Dev Hub (single-node / development sites)

1. Browse to `https://<your-server>/dev-hub/`.
2. Open the **Extension editor**.
3. Create a new extension with the same name as the folder, then paste in the
   file contents (including a `lib` folder for the three shared modules).

Dev Hub is convenient for testing changes, but QMC import is the supported
route for production.

---

## 4. Verify the installation

1. Open (or create) an app and edit a sheet.
2. In the assets panel, expand **Custom objects** — you should see
   **NHS MDC SPC Chart**, **NHS MDC Summary Table** and
   **NHS MDC Variation Icon**.
3. Drag **NHS MDC SPC Chart** onto the sheet.
4. Add one dimension (your time period, e.g. `MonthYear`) and one measure
   (e.g. `Sum(Attendances)`).
5. The chart should render with the NHS blue mean line, dark blue control
   limits and grey/blue/orange points.

If nothing renders, press `F12` in the browser and check the console; errors
are also displayed in the object itself (for example missing dimensions or a
chart type that needs a denominator).

---

## 5. Configuring the charts

### Data model

| Extension | Dimension 1 | Dimension 2 | Measure 1 | Measure 2 (optional) |
|-----------|-------------|-------------|-----------|----------------------|
| SPC Chart | Time period | — | Value | Denominator (p / u charts) |
| Summary Table | Measure / service name | Time period | Value | Denominator (p / u charts) |
| Variation Icon | Time period | — | Value | Denominator (p / u charts) |

**Sort the time dimension ascending** (Sorting section of the property panel).
SPC rules are sequence-sensitive, so the row order controls the analysis.

### Property panel options (Appearance)

**NHS MDC analysis**

| Property | Default | Notes |
|----------|---------|-------|
| Chart type | Auto-detect | `auto`, XmR, p, u, c, t, g, run |
| Improvement direction | Higher is better | Drives improvement/concern colouring and the variation icon |
| Use target / Target value | Off | Adds a target line and enables the assurance icon |
| Auto-rebase on sustained shift | Off | Recalculates limits from the start of a sustained shift |
| Rebase on | Improvement only | `improvement`, `worsening`, or `any` |
| Baseline points before rebasing | 15 | Points that must accumulate in a phase before a rebase |
| Points required to confirm a shift | 8 | NHS MDC shift rule (Rule 2) run length |

**Display**

| Property | Default |
|----------|---------|
| Chart title (expression allowed) | measure name + chart type |
| Decimal places | 2 |
| Show control limits / warning limits / centre line / target line | on / off / on / on |
| Show legend, Show variation & assurance icons | on |
| Allow selections on click | on |
| Maximum data points | 5000 |

### Chart type notes

* **p chart** — supply the denominator as the second measure. The first
  measure may be the numerator count *or* the pre-calculated proportion;
  values greater than 1 are treated as counts and converted automatically.
* **u chart** — supply the denominator as the second measure. Whole-number
  first measures are treated as counts and converted to rates per unit;
  fractional values are treated as rates that are already calculated.
* **t / g charts** — values must be non-negative (times or opportunities
  between rare events).
* **run chart** — median centre line, no control limits, shift and trend
  signals only.

---

## 6. Performance and data volume

* Data is fetched in pages of up to 10,000 cells (the Qlik Engine maximum) and
  capped by the **Maximum data points** property (default 5,000 rows).
* SPC is a time-series technique — aim for 15–100 points per chart. The chart
  displays a warning when fewer than 15 points are supplied.
* Reduce the point count with a coarser time dimension (month rather than day)
  rather than raising the row cap.

---

## 7. Upgrading

1. Rebuild (or re-download) the `.zip` packages.
2. QMC > **Extensions** > **Import**, tick **Overwrite existing extension**.
3. Ask users to hard-refresh the browser (`Ctrl` + `F5`) to clear cached
   JavaScript.

Existing sheet objects keep their settings: property names are stable across
versions.

---

## 8. Uninstalling

1. QMC > **Extensions**.
2. Select the extension and choose **Delete**.

Any sheet object still using it will show "Custom object not found" until the
extension is re-imported.

---

## 9. Troubleshooting

| Symptom | Likely cause / fix |
|---------|--------------------|
| Extension missing from **Custom objects** | Import failed, or the user lacks the extension security rule. Re-check QMC > Extensions and the `Extension` rule in **Security rules**. |
| "Add one dimension … and at least one measure" | The object has no dimension/measure yet — add them in the property panel. |
| "requires a denominator (subgroup size) for every data point" | p/u chart selected without a valid second measure. Add the denominator measure or switch chart type. |
| Chart is empty but data exists | The measure returns null for every row, or the dimension is not sorted; check **Sorting**. |
| Points look wrong / limits jump | Auto-rebase is enabled — turn it off, or raise the baseline. |
| 404 on `lib/spc-engine.js` in the browser console | The package was zipped without the `lib` folder. Rebuild with `npm run build`. |
| Import rejected by the QMC | The archive root must be the extension folder containing the `.qext` file, and the `.qext` name must match the folder name. |

---

## 10. Support and provenance

The SPC maths is a direct port of the Python
[`abspc`](https://pypi.org/project/abspc/) package in this repository
(`abspc/spc.py`), and is verified by `qliksense_extensions/tests/`. Rules are
aligned with the NHS-R community
[NHSRplotthedots](https://github.com/nhs-r-community/NHSRplotthedots) package.

Issues and enhancement requests:
<https://github.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/issues>
