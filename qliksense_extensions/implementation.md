# Installing the NHS Making Data Count extensions on Qlik Sense (on-premise)

This guide covers **Qlik Sense Enterprise on Windows (client-managed)**,
February/May/August/November **2024** releases. It does **not** cover Qlik
Cloud / Qlik Sense SaaS (although the same extension packages work there via
*Administration > Extensions*).

Three visualisation extensions are provided:

| Extension | Folder / package | Purpose |
|-----------|------------------|---------|
| **NHS MDC SPC Chart** | `abspc-spc-chart` | Full SPC chart (XmR, p, p′, u, u′, c, t, g, run) |
| **NHS MDC Summary Table** | `abspc-summary-table` | Variation & assurance icons per measure |
| **NHS MDC Variation Icon** | `abspc-variation-icon` | Single-measure KPI tile with MDC icons |

---

## 1. Prerequisites

| Requirement | Detail |
|-------------|--------|
| Qlik Sense | Enterprise on Windows (client-managed), 2024 releases (also works from June 2018 onwards) |
| Permissions | A QMC account with the `RootAdmin` or `ContentAdmin` role (needed to import extensions) |
| Security rule | Users need the standard `Extension` read rule (`Extension_*`, enabled by default) |
| Build machine | Node.js 14.14 or later — only required if you build the packages yourself |
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
qliksense_extensions/dist/abspc-spc-chart.zip
qliksense_extensions/dist/abspc-summary-table.zip
qliksense_extensions/dist/abspc-variation-icon.zip
```

The build copies the shared modules (`spc-engine.js`, `spc-render.js`,
`qlik-data.js`, `props-ui.js`, `qlik-context.js` and `build-info.js`) from
`shared/` into each extension's `lib/` folder, so every package is completely
self-contained. The real version and build date are written into
`lib/build-info.js` at this point and shown in the stamp tooltip on each visual.

Optionally verify the SPC maths first:

```bash
npm test
```

### Option B — assemble a package by hand (no Node.js)

For each extension folder under `qliksense_extensions/src/`:

1. Copy the folder (for example `abspc-spc-chart`) to a working directory.
2. Create a `lib` sub-folder inside it.
3. Copy all six files from `qliksense_extensions/shared/` into that `lib`
   folder.
4. Zip the extension folder so the archive contains the folder itself, e.g.
   `abspc-spc-chart/abspc-spc-chart.qext`, `abspc-spc-chart/lib/...`.

The finished structure of each package must be:

```text
abspc-spc-chart/
├── abspc-spc-chart.qext       <- extension manifest (name shown in Qlik)
├── abspc-spc-chart.js         <- entry point loaded by Qlik Sense
├── properties.js              <- property panel definition
├── wbfolder.wbl               <- Dev Hub file list
└── lib/
    ├── spc-engine.js          <- SPC maths (port of the Python abspc package)
    ├── spc-render.js          <- SVG renderer and MDC icons
    ├── qlik-data.js           <- hypercube paging and number formatting
    ├── props-ui.js            <- fixed/expression property helpers
    ├── qlik-context.js        <- current user and app name for the generated stamp
    └── build-info.js          <- version and build date stamp
```

Built by hand, `build-info.js` keeps its placeholder values and the visuals
report `v dev (unbuilt)`.

---

## 3. Import into Qlik Sense Enterprise on Windows

1. Sign in to the **QMC** (`https://<your-server>/qmc`).
2. Open **Manage content > Extensions**.
3. Click **Import** (bottom right).
4. Choose `abspc-spc-chart.zip` and click **Import**.
   *If you are replacing an existing version, tick **Overwrite existing extension*.* 
5. Repeat for `abspc-summary-table.zip` and `abspc-variation-icon.zip`.
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
   file contents (including a `lib` folder for the five shared modules).

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

| Extension | Dimensions | Measures |
|-----------|------------|----------|
| SPC Chart | 1: time period | 1: value · 2: denominator |
| Summary Table | 1: measure / service name · 2: time period · 3: description | 1: value · 2: denominator · 3: target |
| Variation Icon | 1: time period | 1: value · 2: denominator · 3: target |

Only the first dimension and the first measure are required. **The Summary Table requires at least two dimensions** (measure/service name and time period).

* **Denominator** (measure 2) — the subgroup size for p and u charts.
* **Target** — on the SPC chart the target is set with the **Target value**
  property, or with a target expression, never as a measure: only one measure
  is charted, and a third measure is rejected with a message. On the summary
  table and variation icon, measure 3 still supplies a target per period and
  assurance is judged against the latest period.
* **Description** (summary table dimension 3) — shown as a column beside the
  measure name. It must be one-to-one with the measure name, otherwise Qlik
  splits that measure into several rows.

**Sort the time dimension ascending** (Sorting section of the property panel).
SPC rules are sequence-sensitive, so the row order controls the analysis. A
text period such as `Aug-25` sorts alphabetically, which silently produces the
wrong limits and the wrong "latest period" — sort on a real date field, or by
load order.

### Number formatting

Values use the measure's own Qlik number format, so percentages, currency and
durations display as they do elsewhere in the app. Where a measure has no
format, the **Decimal places** property applies. Setting the format on a
**master measure** is the simplest way to keep every visual consistent.

### Fixed values or expressions

Each analysis property has a **Fixed / Expression** switch. In expression mode
the value is evaluated at render time, so chart type, improvement direction and
target can be driven by a variable or a configuration table — useful when one
sheet object serves many measures. Note that Qlik expressions return `-1` for
true; the extensions handle this for the boolean settings.

### Property panel options (Appearance)

**NHS MDC analysis**

| Property | Default | Notes |
|----------|---------|-------|
| Chart type | Auto-detect | `auto`, XmR, p, p′, u, u′, c, t, g, run |
| Improvement direction | Higher is better | Drives improvement/concern colouring and the variation icon. *Not set* draws a plain SPC chart: no MDC colours or icons, all SPC logic retained |
| Use target / Target value | Off | Adds a target line and enables the assurance icon. Switch to Expression to drive it from a variable or configuration table |
| Auto-rebase on sustained shift | Off | Recalculates limits from the start of a sustained shift |
| Rebase on | Improvement only | `improvement`, `worsening`, or `any` |
| Baseline points before rebasing | 15 | Points that must accumulate in a phase before a rebase |
| Points required to confirm a shift | 8 | NHS MDC shift rule (Rule 2) run length |

**Display**

| Property | Default | Available on |
|----------|---------|--------------|
| Chart title (expression allowed) | measure name + chart type | Chart, Icon |
| Decimal places | 2 | All |
| Show control limits / warning limits (2σ) / zone C (1σ) / centre line / target line | on / off / off / on / on | Chart |
| Show legend | on | Chart |
| Show variation & assurance icons | on | Chart |
| MDC compliance badge | with the icons | Chart, Icon — green when compliant, grey with reasons when not |
| Show icon captions | on | Icon |
| Allow selections on click | on | Chart, Summary table |
| Show generated stamp (time, user, app) | on | All |
| Maximum data points / rows | 5000 | All |

The generated stamp records when the visual was rendered, the signed-in user
and the app it sits in, for example
`Generated 19/08/2026 15:50 • ABUHB\jsmith • Emergency Department SPC`. Hover
it to see the extension version and build date. If the Qlik context cannot be
read the stamp falls back to the version alone.

An improvement-direction arrow (blue, up or down) is drawn beside the
variation and assurance icons so a reader can see which way is good without
opening the properties.

### Chart type notes

* **p chart** — supply the denominator as the second measure. The first
  measure may be the numerator count *or* the pre-calculated proportion;
  values greater than 1 are treated as counts and converted automatically.
* **u chart** — supply the denominator as the second measure. Whole-number
  first measures are treated as counts and converted to rates per unit;
  fractional values are treated as rates that are already calculated.
* **p′ / u′ charts** — same inputs as p and u. Use them when the denominators
  are large (bed days, contacts, whole-population activity) and an ordinary
  p or u chart flags nearly every point: Laney's σ(z) correction widens the
  limits to match the dispersion actually present between subgroups. Where the
  data is not overdispersed σ(z) resolves to 1 and the limits match p/u
  exactly. Auto-detect never picks them — choose them explicitly. The
  expression form also accepts `p'`, `p-prime`, `p_prime` and the `u`
  equivalents.
* **t / g charts** — values must be non-negative (times or opportunities
  between rare events).
* **run chart** — median centre line, no control limits, shift and trend
  signals only.

### Summary table columns

`Measure | Description | Variation | Assurance | Target | Latest period |
Latest value`

The columns follow `abspc.plot.plot_mdc_summary_table`, with **Description**
appearing only when the third dimension is supplied, and **Latest period**
added so the row can be traced back to the data.

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

Re-import **all three** extensions together: they each carry their own copy of
the shared modules, so a change to the SPC engine or renderer affects all of
them. Confirm the upgrade landed by checking the build date shown in the
corner of a visual.

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
| "Add two dimensions … and at least one measure" | Summary table only: it needs the measure name **and** the time period as dimensions. |
| "requires a denominator (subgroup size) for every data point" | p/u (or p′/u′) chart selected without a valid second measure. Add the denominator measure or switch chart type. |
| Chart is empty but data exists | The measure returns null for every row, or the dimension is not sorted; check **Sorting**. |
| Limits look wrong and the periods are out of order | The time dimension is text (`Aug-25`) and sorting alphabetically. Sort on a date field or by load order. |
| "Latest period" is not the most recent period | Same cause — the last row in Qlik's sort order is treated as the latest. |
| Points look wrong / limits jump | Auto-rebase is enabled — turn it off, or raise the baseline. |
| Build date in the corner is older than expected | The browser cached the previous version, or only some extensions were re-imported. Hard-refresh and re-import all three. |
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
