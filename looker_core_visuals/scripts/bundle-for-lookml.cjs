#!/usr/bin/env node
/**
 * bundle-for-lookml.js
 * ====================
 * Bundles ES6 module chart files into standalone LookML-ready JavaScript files.
 * 
 * This script:
 * 1. Reads spc_utils.js and inlines all shared functions/constants
 * 2. For each chart file, removes ES6 imports and bundles with utils
 * 3. Outputs standalone files in dist/lookml/ ready to paste into LookML projects
 * 
 * Usage:
 *   node scripts/bundle-for-lookml.js
 */

const fs = require('fs');
const path = require('path');

// Paths
const SRC_DIR = path.join(__dirname, '../src');
const DIST_DIR = path.join(__dirname, '../dist/lookml');
const UTILS_FILE = path.join(SRC_DIR, 'spc_utils.js');

// Chart files to bundle (excluding spc_utils.js)
const CHART_FILES = [
  'xmr_chart.js',
  'p_chart.js',
  'u_chart.js',
  'c_chart.js',
  'run_chart.js',
  'auto_chart.js',
  'summary_table.js'
];

/**
 * Extract utilities code with export keywords removed
 */
function extractUtilsCode() {
  const utilsContent = fs.readFileSync(UTILS_FILE, 'utf8');
  
  // Remove all 'export ' keywords but keep the declarations
  let inlinedUtils = utilsContent
    .replace(/^export\s+(const|function|class)/gm, '$1')
    .replace(/^export\s+\{[^}]+\};?\s*$/gm, ''); // Remove export {} statements
  
  return `// ============================================================================
// NHS Making Data Count SPC Utilities (Inlined for LookML)
// ============================================================================
${inlinedUtils}

// ============================================================================
// Chart Implementation
// ============================================================================

`;
}

/**
 * Bundle a chart file with inlined utilities
 */
function bundleChartFile(chartFileName, utilsCode) {
  const chartPath = path.join(SRC_DIR, chartFileName);
  let chartContent = fs.readFileSync(chartPath, 'utf8');
  
  // Remove import statement(s)
  chartContent = chartContent.replace(/^import\s+\{[^}]+\}\s+from\s+['"]\.\/spc_utils\.js['"];?\s*$/gm, '');
  chartContent = chartContent.replace(/^import\s+.*\s+from\s+['"]\.\/spc_utils\.js['"];?\s*$/gm, '');
  
  // Combine: utils + chart code
  const bundled = `${utilsCode}${chartContent}`;
  
  // Output filename with abspc_ prefix for consistency
  const outputFileName = `abspc_${chartFileName}`;
  const outputPath = path.join(DIST_DIR, outputFileName);
  
  return { outputPath, content: bundled, fileName: outputFileName };
}

/**
 * Main bundling process
 */
function main() {
  console.log('🔧 Bundling Looker visualizations for LookML...\n');
  
  // Ensure dist directory exists
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }
  
  // Extract utilities code
  console.log('📦 Inlining spc_utils.js...');
  const utilsCode = extractUtilsCode();
  
  // Bundle each chart
  const bundledFiles = [];
  for (const chartFile of CHART_FILES) {
    const { outputPath, content, fileName } = bundleChartFile(chartFile, utilsCode);
    fs.writeFileSync(outputPath, content, 'utf8');
    bundledFiles.push(fileName);
    console.log(`✅ Created ${fileName}`);
  }
  
  // Create manifest.lkml template
  console.log('\n📝 Generating manifest.lkml template...');
  const manifestContent = generateManifestTemplate(bundledFiles);
  const manifestPath = path.join(DIST_DIR, 'manifest.lkml');
  fs.writeFileSync(manifestPath, manifestContent, 'utf8');
  console.log(`✅ Created manifest.lkml`);
  
  // Create README
  console.log('📝 Generating README.md...');
  const readmeContent = generateReadme(bundledFiles);
  const readmePath = path.join(DIST_DIR, 'README.md');
  fs.writeFileSync(readmePath, readmeContent, 'utf8');
  console.log(`✅ Created README.md`);
  
  console.log(`\n✨ Done! ${bundledFiles.length} files bundled in ${DIST_DIR}`);
  console.log('\n📋 To use in LookML:');
  console.log('   1. Copy all .js files to your LookML project\'s visualizations/ folder');
  console.log('   2. Add visualization entries from manifest.lkml to your project manifest');
  console.log('   3. Push to production and use in Looker dashboards\n');
}

/**
 * Generate LookML manifest template
 */
function generateManifestTemplate(fileNames) {
  const visualizations = fileNames.map(fileName => {
    const id = fileName.replace('.js', '');
    const label = formatVisualizationLabel(fileName);
    
    return `visualization: {
  id: "${id}"
  label: "${label}"
  file: "visualizations/${fileName}"
}`;
  }).join('\n\n');
  
  return `# ============================================================================
# NHS Making Data Count - Custom SPC Visualizations for LookML
# ============================================================================
# Add these visualization entries to your LookML project's manifest.lkml
# 
# Generated: ${new Date().toISOString()}
# Package: abspc v0.1.5
# Source: https://github.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals
# ============================================================================

${visualizations}
`;
}

/**
 * Format visualization label from filename
 */
function formatVisualizationLabel(fileName) {
  const baseName = fileName.replace('abspc_', '').replace('.js', '');
  
  const labels = {
    'xmr_chart': 'NHS MDC - XmR Chart (Individuals & Moving Range)',
    'p_chart': 'NHS MDC - P Chart (Proportions)',
    'u_chart': 'NHS MDC - U Chart (Rate per Unit)',
    'c_chart': 'NHS MDC - C Chart (Count of Events)',
    'run_chart': 'NHS MDC - Run Chart (Median)',
    'auto_chart': 'NHS MDC - Auto Chart (Auto-detect)',
    'summary_table': 'NHS MDC - Summary Table (All Measures)'
  };
  
  return labels[baseName] || baseName;
}

/**
 * Generate README for LookML bundle
 */
function generateReadme(fileNames) {
  return `# NHS Making Data Count - LookML Visualizations

**Ready-to-use Statistical Process Control (SPC) charts for Looker**

This bundle contains standalone JavaScript files that can be directly pasted into your LookML project for use in Looker dashboards.

## 📦 What's Included

${fileNames.map(f => `- **${f}** - ${formatVisualizationLabel(f).replace('NHS MDC - ', '')}`).join('\n')}
- **manifest.lkml** - LookML manifest entries (see below)

## 🚀 Installation

### Step 1: Add Files to Your LookML Project

1. In your LookML project, create a \`visualizations/\` folder if it doesn't exist
2. Copy all \`.js\` files from this bundle into \`visualizations/\`

### Step 2: Update Your Manifest

1. Open your project's \`manifest.lkml\` file
2. Add the visualization entries from the included \`manifest.lkml\` file
3. Example:

\`\`\`lkml
visualization: {
  id: "abspc_xmr_chart"
  label: "NHS MDC - XmR Chart (Individuals & Moving Range)"
  file: "visualizations/abspc_xmr_chart.js"
}
\`\`\`

### Step 3: Commit and Push

\`\`\`bash
git add visualizations/ manifest.lkml
git commit -m "Add NHS Making Data Count SPC visualizations"
git push origin main
\`\`\`

### Step 4: Use in Looker

1. Navigate to a dashboard or explore
2. Click **Edit** → **Add Visualization**
3. Select one of the NHS MDC chart types from the visualization picker
4. Configure your data fields according to the chart requirements

## 📊 Chart Types

### XmR Chart (Individuals & Moving Range)
- **Best for:** Individual measurements over time (e.g., wait times, lengths of stay)
- **Required fields:** Date/time dimension, numeric measure

### P Chart (Proportions)
- **Best for:** Percentages or proportions (e.g., infection rates, readmission rates)
- **Required fields:** Date/time dimension, numerator, denominator

### U Chart (Rate per Unit)
- **Best for:** Rates of occurrence (e.g., falls per 1000 patient days)
- **Required fields:** Date/time dimension, event count, exposure size

### C Chart (Count of Events)
- **Best for:** Count of events with consistent sample size (e.g., complaints per month)
- **Required fields:** Date/time dimension, count measure

### Run Chart
- **Best for:** Simple trend detection with median line
- **Required fields:** Date/time dimension, numeric measure

### Auto Chart
- **Best for:** Automatic chart type selection based on data characteristics
- **Required fields:** Date/time dimension, measure(s)

### Summary Table
- **Best for:** Multi-measure dashboard overview with variation/assurance icons
- **Required fields:** Multiple measures with targets

## 🏥 NHS Making Data Count (MDC)

These visualizations implement the NHS Making Data Count methodology:
- **Special Cause Variation Detection** (4 rules: astronomical, shift, trend, two-in-three)
- **Process Control Limits** (3-sigma based on natural process variation)
- **Improvement vs. Concern Classification** (direction-aware coloring)
- **Target-based Assurance** (pass/fail/hit-or-miss assessment)

## 📚 Documentation

- **Python Package:** [abspc on PyPI](https://pypi.org/project/abspc/)
- **GitHub Repository:** [biu_Making_Data_Count_CustomVisuals](https://github.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals)
- **NHS Making Data Count:** [NHS England](https://www.england.nhs.uk/publication/making-data-count/)

## 🤝 Support

For issues, questions, or contributions:
- **GitHub Issues:** [Report a bug or request a feature](https://github.com/Aneurin-Bevan-University-Health-Board/biu_Making_Data_Count_CustomVisuals/issues)
- **Email:** daniel.westwood@wales.nhs.uk

## 📝 License

MIT License - See LICENSE file in the repository

---

**Generated:** ${new Date().toISOString()}  
**Version:** 0.1.5  
**Package:** abspc (Aneurin Bevan University Health Board SPC)
`;
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { bundleChartFile, extractUtilsCode };
