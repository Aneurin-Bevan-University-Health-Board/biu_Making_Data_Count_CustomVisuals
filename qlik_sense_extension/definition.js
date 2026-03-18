/**
 * definition.js
 * ==============
 * Property panel definition for the NHS MDC SPC Chart extension.
 * Configures the Qlik Sense property panel with sections for
 * chart type, analysis settings and display options.
 */
define([], function () {
  'use strict';

  return {
    type: 'items',
    component: 'accordion',
    items: {
      dimensions: {
        uses: 'dimensions',
        min: 1,
        max: 1,
        description: 'Date / Time dimension (e.g. Month, Week)'
      },
      measures: {
        uses: 'measures',
        min: 1,
        max: 2,
        description: 'Value measure. For p/u charts an optional second measure provides the subgroup size.'
      },
      sorting: {
        uses: 'sorting'
      },
      chartSettings: {
        type: 'items',
        label: 'Chart Settings',
        items: {
          chartType: {
            type: 'string',
            component: 'dropdown',
            label: 'Chart Type',
            ref: 'chartType',
            defaultValue: 'xmr',
            options: [
              { value: 'xmr', label: 'XmR Chart (Individual Measurements)' },
              { value: 'p',   label: 'p Chart (Proportions)' },
              { value: 'u',   label: 'u Chart (Rates per Unit)' },
              { value: 'c',   label: 'c Chart (Counts)' },
              { value: 'run', label: 'Run Chart (Median)' }
            ]
          },
          chartTitle: {
            type: 'string',
            label: 'Chart Title (optional)',
            ref: 'chartTitle',
            defaultValue: '',
            expression: 'optional'
          }
        }
      },
      analysisSettings: {
        type: 'items',
        label: 'Analysis Settings',
        items: {
          improvementDirection: {
            type: 'string',
            component: 'dropdown',
            label: 'Improvement Direction',
            ref: 'improvementDirection',
            defaultValue: 'high',
            options: [
              { value: 'high', label: 'High is Good' },
              { value: 'low',  label: 'Low is Good' }
            ]
          },
          targetValue: {
            type: 'number',
            label: 'Target Value',
            ref: 'targetValue',
            defaultValue: null,
            expression: 'optional'
          }
        }
      },
      displaySettings: {
        type: 'items',
        label: 'Display Settings',
        items: {
          showControlLimits: {
            type: 'boolean',
            label: 'Show Control Limits (UCL / LCL)',
            ref: 'showControlLimits',
            defaultValue: true
          },
          showWarningLimits: {
            type: 'boolean',
            label: 'Show Warning Limits (UWL / LWL)',
            ref: 'showWarningLimits',
            defaultValue: false
          },
          showCenterLine: {
            type: 'boolean',
            label: 'Show Centre Line',
            ref: 'showCenterLine',
            defaultValue: true
          },
          showTargetLine: {
            type: 'boolean',
            label: 'Show Target Line',
            ref: 'showTargetLine',
            defaultValue: false
          }
        }
      },
      addons: {
        uses: 'addons'
      }
    }
  };
});
