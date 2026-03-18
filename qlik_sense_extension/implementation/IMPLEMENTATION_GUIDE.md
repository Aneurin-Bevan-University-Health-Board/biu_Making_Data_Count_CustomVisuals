# ABSPC SPC Chart — Qlik Sense Implementation Guide

A complete, step-by-step guide for installing and using the **ABSPC SPC Chart**
custom visualization in **Qlik Sense Enterprise on Windows** (on-premises).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Download the Extension](#2-download-the-extension)
3. [Package the Extension as a ZIP](#3-package-the-extension-as-a-zip)
4. [Import into Qlik Sense via QMC](#4-import-into-qlik-sense-via-qmc)
5. [Alternative — Manual File Copy](#5-alternative--manual-file-copy)
6. [Verify the Installation](#6-verify-the-installation)
7. [Create Your First SPC Chart](#7-create-your-first-spc-chart)
8. [Configure Chart Settings](#8-configure-chart-settings)
9. [Choose the Right Chart Type](#9-choose-the-right-chart-type)
10. [Set Up p and u Charts (Two Measures)](#10-set-up-p-and-u-charts-two-measures)
11. [Interpret the Chart Output](#11-interpret-the-chart-output)
12. [Real-World Healthcare Examples](#12-real-world-healthcare-examples)
13. [Data Requirements and Best Practices](#13-data-requirements-and-best-practices)
14. [Troubleshooting](#14-troubleshooting)
15. [Uninstalling the Extension](#15-uninstalling-the-extension)
16. [References](#16-references)

---

## 1. Prerequisites

Before you start, ensure you have the following:

| Requirement | Details |
|-------------|---------|
| **Qlik Sense version** | Enterprise on Windows — September 2017 or later |
| **Access** | Qlik Management Console (QMC) — typically `https://<server>/qmc` |
| **Permissions** | QMC admin role **or** the _Extensions_ privilege on the server |
| **Browser** | A supported browser for Qlik Sense Hub (Chrome, Edge, Firefox) |

> **Tip:** If you do not have QMC access, ask your Qlik administrator to
> import the extension on your behalf — it takes less than a minute.

---

## 2. Download the Extension

### Option A — Clone the repository

```bash
git clone https://github.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals.git
```

The extension files are inside the `qlik_sense_extension/` directory.

### Option B — Download as ZIP from GitHub

1. Go to the repository page on GitHub
2. Click **Code → Download ZIP**
3. Extract the ZIP
4. Navigate to the `qlik_sense_extension/` folder inside the extracted directory

### What you should have

After downloading you should have a folder containing these files:

```
qlik_sense_extension/
├── abspc_spc_chart.qext         ← Extension metadata (required)
├── abspc_spc_chart.js           ← Main chart logic (required)
├── abspc_spc_chart.css          ← Stylesheet (required)
├── definition.js                ← Property panel (required)
├── initialProperties.js         ← Default settings (required)
├── lib/
│   └── spc_utils.js             ← SPC calculation engine (required)
├── implementation/              ← This guide (not deployed)
├── tests/                       ← Test suite (not deployed)
└── README.md                    ← Documentation (not deployed)
```

---

## 3. Package the Extension as a ZIP

Qlik Sense imports extensions as ZIP files. The ZIP must contain the extension
files **at the root level** (no enclosing folder).

### Step-by-step

1. Open the `qlik_sense_extension/` folder
2. Select **only** these items:
   - `abspc_spc_chart.qext`
   - `abspc_spc_chart.js`
   - `abspc_spc_chart.css`
   - `definition.js`
   - `initialProperties.js`
   - `lib/` folder (containing `spc_utils.js`)
3. Right-click → **Send to → Compressed (zipped) folder** (Windows)
   — or use your preferred ZIP tool
4. Name the file `abspc_spc_chart.zip`

> **Important:** Do **not** include the `tests/`, `implementation/` or
> `README.md` in the ZIP — only the six items listed above.

### Correct ZIP structure

```
abspc_spc_chart.zip
├── abspc_spc_chart.qext
├── abspc_spc_chart.js
├── abspc_spc_chart.css
├── definition.js
├── initialProperties.js
└── lib/
    └── spc_utils.js
```

### Incorrect ZIP structure (common mistake)

```
abspc_spc_chart.zip
└── qlik_sense_extension/       ← ❌ extra nested folder
    ├── abspc_spc_chart.qext
    └── ...
```

If Qlik Sense does not recognise the extension after import, double-check
that there is no extra nested folder inside the ZIP.

---

## 4. Import into Qlik Sense via QMC

1. Open a browser and go to the **Qlik Management Console**:
   ```
   https://<your-qlik-server>/qmc
   ```
2. In the left-hand navigation, click **Extensions**
3. Click the **Import** button (bottom-left of the page)
4. In the file dialog, select `abspc_spc_chart.zip`
5. Click **Open** / **Import**
6. Wait for the confirmation message — the extension **ABSPC SPC Chart**
   should now appear in the list
7. Verify the **Name** column shows `ABSPC SPC Chart` and the
   **Type** column shows `visualization`

> **Tip:** If you see a warning about an existing extension with the same ID,
> choose **Replace** to update to the latest version.

---

## 5. Alternative — Manual File Copy

If you prefer not to use the QMC import, you can copy files directly to the
server filesystem.

### Steps

1. On the Qlik Sense server, navigate to:
   ```
   C:\Program Files\Qlik\Sense\Client\Extensions\
   ```
2. Create a new folder called `abspc_spc_chart`
3. Copy the six items from [Step 3](#3-package-the-extension-as-a-zip) into
   this folder so the layout is:
   ```
   C:\Program Files\Qlik\Sense\Client\Extensions\abspc_spc_chart\
   ├── abspc_spc_chart.qext
   ├── abspc_spc_chart.js
   ├── abspc_spc_chart.css
   ├── definition.js
   ├── initialProperties.js
   └── lib\
       └── spc_utils.js
   ```
4. Restart the **Qlik Sense Repository Service** (QRS) from the Windows
   Services console — or wait up to 60 seconds for the cache to refresh

---

## 6. Verify the Installation

1. Open **Qlik Sense Hub** in your browser:
   ```
   https://<your-qlik-server>/hub
   ```
2. Open any existing app, or create a new one
3. Enter **Edit** mode on a sheet
4. In the left-hand panel, expand **Custom objects → Extensions**
5. You should see **ABSPC SPC Chart** with a line-chart icon
6. If it does not appear, try:
   - Hard-refresh the browser (`Ctrl + Shift + R`)
   - Clear the browser cache
   - Check the QMC Extensions page to confirm the import was successful

---

## 7. Create Your First SPC Chart

Follow these steps to build an XmR chart — the simplest chart type that
requires just a date column and a value column.

### Step 1 — Add the extension to a sheet

1. Open an app and enter **Edit** mode
2. Drag **ABSPC SPC Chart** from the Extensions panel onto the sheet canvas
3. An empty chart placeholder will appear with the message:
   _"Add a date dimension and a value measure to display an SPC chart."_

### Step 2 — Add a dimension (date)

1. In the **Properties panel** (right-hand side), click **Add dimension**
2. Select your date or time-period field, for example:
   - `Month`
   - `WeekStart`
   - `=MonthStart(Date)`
3. The dimension defines the x-axis labels

### Step 3 — Add a measure (value)

1. Click **Add measure**
2. Enter the expression for the value you want to chart, for example:
   - `Avg(WaitTimeHours)`
   - `Sum(Incidents)`
   - `Count(Patients)`
3. The chart will render immediately with:
   - A **blue centre line** (mean)
   - **Dashed control limits** (UCL / LCL)
   - **Coloured data points** (grey, blue or orange)

### Step 4 — Set the improvement direction

1. In the Properties panel, expand **Analysis Settings**
2. Set **Improvement Direction** to:
   - **High is Good** — e.g. patient satisfaction, compliance rate
   - **Low is Good** — e.g. wait times, infection rate, falls
3. This controls whether special-cause points above the mean are coloured
   blue (improvement) or orange (concern)

> **Tip:** If you're unsure, think about what direction a "better" value
> would be. For most safety metrics, "Low is Good".

---

## 8. Configure Chart Settings

All settings are in the **Properties panel** on the right-hand side of the
sheet editor.

### Chart Settings

| Setting | How to Set | Effect |
|---------|-----------|--------|
| **Chart Type** | Dropdown | Switches between XmR, p, u, c, run |
| **Chart Title** | Text box | Overrides the auto-generated title |

### Analysis Settings

| Setting | How to Set | Effect |
|---------|-----------|--------|
| **Improvement Direction** | Dropdown | Controls blue vs orange colouring |
| **Target Value** | Number | Optional target for improvement assessment |

### Display Settings

| Setting | Default | Effect |
|---------|---------|--------|
| **Show Control Limits** | ✅ On | Draws UCL / LCL dashed lines |
| **Show Warning Limits** | ❌ Off | Draws UWL / LWL dotted lines (2-sigma) |
| **Show Centre Line** | ✅ On | Draws the mean (or median for run charts) |
| **Show Target Line** | ❌ Off | Draws a horizontal line at the target value |

---

## 9. Choose the Right Chart Type

Use this decision guide to pick the correct chart type for your data:

| Your Data Looks Like… | Chart Type | Example |
|------------------------|------------|---------|
| Continuous measurements (decimals, can be negative) | **XmR** | Average wait time, temperature |
| Proportions between 0 and 1 (with a denominator) | **p** | Infection rate, compliance % |
| Rates per unit (count ÷ area of opportunity) | **u** | Falls per 1000 bed-days |
| Small integer counts with fixed sample size | **c** | Number of medication errors per month |
| Any data — simple median-based view | **Run** | Quick overview before choosing an SPC chart |

### When to use each

- **XmR** is the default and works for most individual measurements
- **p chart** requires a second measure for the denominator (subgroup size)
- **u chart** requires a second measure for the area of opportunity
- **c chart** only needs a single count measure
- **Run chart** is the simplest — median line only, no control limits

---

## 10. Set Up p and u Charts (Two Measures)

p charts and u charts need **two measures**: a value and a denominator.

### p Chart Example — Surgical Site Infection Rate

| Property | Value |
|----------|-------|
| **Dimension** | `Month` |
| **Measure 1** | `Sum(Infections) / Sum(Procedures)` |
| **Measure 2** | `Sum(Procedures)` |
| **Chart Type** | p |
| **Improvement Direction** | Low is Good |

### u Chart Example — Falls per 1000 Bed-Days

| Property | Value |
|----------|-------|
| **Dimension** | `Month` |
| **Measure 1** | `Sum(Falls) / Sum(BedDays) * 1000` |
| **Measure 2** | `Sum(BedDays)` |
| **Chart Type** | u |
| **Improvement Direction** | Low is Good |

> **Tip:** If you do not add a second measure, the extension uses a default
> subgroup size (100 for p charts, 1 for u charts). For accurate control
> limits, always provide the real denominator.

---

## 11. Interpret the Chart Output

### Point Colours

| Colour | What It Means | Action |
|--------|---------------|--------|
| ⬜ **Grey** | Common cause variation — the process is behaving as expected | No action needed |
| 🔵 **Blue** | Special cause — improvement in the desired direction | Investigate what went well and sustain it |
| 🟠 **Orange** | Special cause — concern in the undesired direction | Investigate the root cause and take corrective action |

### Reference Lines

| Line | Colour | Style | Meaning |
|------|--------|-------|---------|
| **Centre line** | Blue (`#005EB8`) | Solid | Mean (or median for run charts) |
| **UCL / LCL** | Dark blue (`#003087`) | Dashed | 3-sigma control limits |
| **UWL / LWL** | Dark blue (`#003087`) | Dotted | 2-sigma warning limits (optional) |
| **Target** | Yellow (`#FFB81C`) | Dashed | Target value (optional) |

### Special Cause Rules

The extension flags a point as a special cause if **any** of these rules fire:

| Rule | Name | What It Detects |
|------|------|-----------------|
| **1** | Astronomical point | A single value outside the control limits (UCL/LCL) |
| **2** | Shift | 7 or more consecutive points on the same side of the centre line |
| **3** | Trend | 7 or more consecutive points all going up or all going down |
| **4** | Two-in-three | 2 out of 3 consecutive points in the warning zone, same side |

---

## 12. Real-World Healthcare Examples

### 🏥 A&E 4-Hour Performance

| Setting | Value |
|---------|-------|
| Dimension | `MonthStart` |
| Measure 1 | `Avg(WaitTimeHours)` |
| Chart Type | XmR |
| Improvement Direction | Low is Good |
| Target Value | `4` |
| Show Target Line | ✅ On |

**What to look for:** Orange points above the target indicate months where
the 4-hour standard is consistently breached.

---

### 🦠 Healthcare-Associated Infections

| Setting | Value |
|---------|-------|
| Dimension | `Month` |
| Measure 1 | `Sum(Infections) / Sum(Admissions)` |
| Measure 2 | `Sum(Admissions)` |
| Chart Type | p |
| Improvement Direction | Low is Good |

**What to look for:** A shift of 7+ blue points below the mean indicates a
sustained reduction in infection rate.

---

### 💊 Medication Errors

| Setting | Value |
|---------|-------|
| Dimension | `Month` |
| Measure 1 | `Sum(MedicationErrors)` |
| Chart Type | c |
| Improvement Direction | Low is Good |

**What to look for:** An astronomical point (orange, above UCL) suggests an
unusual spike that requires investigation.

---

### 🛏️ Pressure Ulcers per 1000 Bed-Days

| Setting | Value |
|---------|-------|
| Dimension | `Month` |
| Measure 1 | `Sum(PressureUlcers) / Sum(BedDays) * 1000` |
| Measure 2 | `Sum(BedDays)` |
| Chart Type | u |
| Improvement Direction | Low is Good |

**What to look for:** Variable control limits (wavy UCL/LCL lines) reflect
months with different numbers of bed-days.

---

### 😊 Patient Satisfaction Score

| Setting | Value |
|---------|-------|
| Dimension | `Quarter` |
| Measure 1 | `Avg(SatisfactionScore)` |
| Chart Type | Run |
| Improvement Direction | High is Good |

**What to look for:** A run chart shows the median and detects shifts/trends
without control limits — useful as a quick first look at the data.

---

## 13. Data Requirements and Best Practices

### Minimum requirements

| Requirement | Detail |
|-------------|--------|
| **Data points** | At least 2 (15+ recommended for meaningful SPC analysis) |
| **Sorting** | Data **must** be sorted chronologically by the dimension |
| **Nulls** | Null measure values are excluded from calculations |

### Best practices

- **Use 20–30+ data points** for reliable control limits
- **Sort by date** — Qlik's default dimension sorting usually works, but
  verify that the x-axis labels are in chronological order
- **Avoid aggregating too broadly** — monthly data works well; annual data
  gives too few points for SPC rules
- **Avoid mixing processes** — if a known process change occurred, consider
  splitting the data or using separate charts for before/after
- **Review regularly** — SPC charts are most useful when reviewed at regular
  intervals (e.g. monthly board reports)

---

## 14. Troubleshooting

| Problem | Likely Cause | Solution |
|---------|-------------|----------|
| Extension not visible in the Extensions panel | Import failed or ZIP structure wrong | Open QMC → Extensions and confirm import; re-ZIP without nested folder |
| Chart shows _"Add a date dimension and a value measure"_ | No dimension or measure added | Add at least one dimension and one measure in the Properties panel |
| Chart shows _"No valid data to display"_ | Measure returns no rows or all nulls | Check that your dimension/measure combination returns data |
| Control limits look flat when they should vary | p/u chart without second measure | Add a second measure for the subgroup/denominator size |
| All points are grey (no special causes) | Data has only common cause variation | This is normal — the process is stable |
| Points are the wrong colour (blue should be orange) | Improvement direction is inverted | Switch the Improvement Direction setting |
| Extension not loading after manual file copy | QRS cache stale | Restart the Qlik Sense Repository Service, or wait 60 seconds |
| Chart looks squashed or labels overlap | Too many data points for the object size | Resize the chart object, or reduce the date range |

---

## 15. Uninstalling the Extension

### Via QMC

1. Open `https://<your-qlik-server>/qmc`
2. Navigate to **Extensions**
3. Select **ABSPC SPC Chart**
4. Click **Delete** (bottom-left)
5. Confirm the deletion

### Via file system

1. Delete the folder:
   ```
   C:\Program Files\Qlik\Sense\Client\Extensions\abspc_spc_chart\
   ```
2. Restart the Qlik Sense Repository Service

> **Note:** Deleting the extension will cause any sheets using it to show an
> error. Remove the chart objects from affected sheets before uninstalling.

---

## 16. References

- [NHS Making Data Count](https://www.england.nhs.uk/publication/making-data-count/) — the methodology behind these charts
- [NHSRplotthedots](https://github.com/nhs-r-community/NHSRplotthedots) — R package with the same SPC rules
- [abspc Python package](https://pypi.org/project/abspc/) — Python implementation from the same repository
- [Qlik Sense Extension Documentation](https://help.qlik.com/en-US/sense-developer/Content/Sense_Helpsites/Home-developer.htm) — Qlik's official extension development guide

---

_ABSPC SPC Chart — built by Aneurin Bevan University Health Board. Licensed under MIT._
