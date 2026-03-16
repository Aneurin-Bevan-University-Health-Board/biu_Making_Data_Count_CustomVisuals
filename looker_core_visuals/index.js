/**
 * index.js
 * =========
 * Main entry point for NHS MDC Looker Core Visualizations
 * Registers all chart types with Looker Core
 */

// Import all chart types
import { AutoChart } from './src/auto_chart.js';
import { XmRChart } from './src/xmr_chart.js';
import { PChart } from './src/p_chart.js';
import { UChart } from './src/u_chart.js';
import { CChart } from './src/c_chart.js';
import { RunChart } from './src/run_chart.js';

// Chart metadata
const chartInfo = {
  auto: {
    id: 'nhs_mdc_auto_chart',
    label: 'NHS MDC Auto-Chart',
    description: 'Smart NHS Making Data Count chart with automatic type detection'
  },
  xmr: {
    id: 'nhs_mdc_xmr_chart',
    label: 'NHS MDC XmR Chart',
    description: 'Individual measurements (XmR) chart following NHS MDC methodology'
  },
  p: {
    id: 'nhs_mdc_p_chart',
    label: 'NHS MDC p Chart',
    description: 'Proportion (p) chart following NHS MDC methodology'
  },
  u: {
    id: 'nhs_mdc_u_chart',
    label: 'NHS MDC u Chart', 
    description: 'Counts per unit (u) chart following NHS MDC methodology'
  },
  c: {
    id: 'nhs_mdc_c_chart',
    label: 'NHS MDC c Chart',
    description: 'Count (c) chart following NHS MDC methodology'
  },
  run: {
    id: 'nhs_mdc_run_chart',
    label: 'NHS MDC Run Chart',
    description: 'Run chart following NHS MDC methodology'
  }
};

// Register visualizations with Looker if available
if (typeof looker !== 'undefined' && looker.plugins && looker.plugins.visualizations) {
  
  // Auto Chart (recommended starting point)
  looker.plugins.visualizations.add({
    ...AutoChart,
    id: chartInfo.auto.id,
    label: chartInfo.auto.label,
    description: chartInfo.auto.description
  });
  
  // Individual chart types
  looker.plugins.visualizations.add({
    ...XmRChart,
    id: chartInfo.xmr.id,
    label: chartInfo.xmr.label,
    description: chartInfo.xmr.description
  });
  
  looker.plugins.visualizations.add({
    ...PChart,
    id: chartInfo.p.id,
    label: chartInfo.p.label,
    description: chartInfo.p.description
  });
  
  looker.plugins.visualizations.add({
    ...UChart,
    id: chartInfo.u.id,
    label: chartInfo.u.label,
    description: chartInfo.u.description
  });
  
  looker.plugins.visualizations.add({
    ...CChart,
    id: chartInfo.c.id,
    label: chartInfo.c.label,
    description: chartInfo.c.description
  });
  
  looker.plugins.visualizations.add({
    ...RunChart,
    id: chartInfo.run.id,
    label: chartInfo.run.label,
    description: chartInfo.run.description
  });
  
  console.log('NHS Making Data Count visualizations registered with Looker Core');
}

// Export for direct use
export {
  AutoChart,
  XmRChart,
  PChart, 
  UChart,
  CChart,
  RunChart,
  chartInfo
};

// Export default auto chart for convenience
export default AutoChart;

/*
 * NHS Making Data Count - Looker Core Visualizations
 * ===================================================
 * 
 * Professional Statistical Process Control charts for healthcare data
 * following the NHS Making Data Count methodology.
 * 
 * Quick Start:
 * 1. Use AutoChart for automatic chart type detection
 * 2. Or choose specific chart types (XmR, p, u, c, run)
 * 3. Provide minimal data: just date and value columns
 * 4. System handles all NHS MDC calculations automatically
 * 
 * Features:
 * ✅ Automatic chart type detection based on data characteristics
 * ✅ Official NHS color scheme and formatting
 * ✅ Complete NHS MDC special cause rule implementation
 * ✅ Professional healthcare-ready visualizations
 * ✅ Minimal data requirements (date + value)
 * ✅ Intelligent defaults for all parameters
 * 
 * Built by Aneurin Bevan University Health Board
 * Licensed under NHS Open Source principles
 */