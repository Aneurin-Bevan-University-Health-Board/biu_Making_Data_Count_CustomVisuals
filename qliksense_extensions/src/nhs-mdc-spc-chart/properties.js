/**
 * properties.js
 * =============
 * Property panel definition for the NHS MDC SPC Chart Qlik Sense extension.
 */
define([], function () {
  'use strict';

  var chartType = {
    type: 'string',
    component: 'dropdown',
    label: 'Chart type',
    ref: 'props.chartType',
    options: [
      { value: 'auto', label: 'Auto-detect' },
      { value: 'xmr', label: 'XmR (individuals)' },
      { value: 'p', label: 'p (proportion)' },
      { value: 'u', label: 'u (rate per unit)' },
      { value: 'c', label: 'c (count)' },
      { value: 't', label: 't (time between rare events)' },
      { value: 'g', label: 'g (opportunities between rare events)' },
      { value: 'run', label: 'Run chart' }
    ],
    defaultValue: 'auto'
  };

  var improvementDirection = {
    type: 'string',
    component: 'dropdown',
    label: 'Improvement direction',
    ref: 'props.improvementDirection',
    options: [
      { value: 'high', label: 'Higher is better' },
      { value: 'low', label: 'Lower is better' }
    ],
    defaultValue: 'high'
  };

  var analysisSection = {
    type: 'items',
    label: 'NHS MDC analysis',
    items: {
      chartType: chartType,
      improvementDirection: improvementDirection,
      useTarget: {
        type: 'boolean',
        label: 'Use target',
        ref: 'props.useTarget',
        defaultValue: false
      },
      target: {
        type: 'number',
        label: 'Target value',
        ref: 'props.target',
        defaultValue: 0,
        show: function (data) { return data.props && data.props.useTarget; }
      },
      autoRebase: {
        type: 'boolean',
        label: 'Auto-rebase on sustained shift',
        ref: 'props.autoRebase',
        defaultValue: false
      },
      rebaseOn: {
        type: 'string',
        component: 'dropdown',
        label: 'Rebase on',
        ref: 'props.rebaseOn',
        options: [
          { value: 'improvement', label: 'Improvement only' },
          { value: 'worsening', label: 'Worsening only' },
          { value: 'any', label: 'Any sustained shift' }
        ],
        defaultValue: 'improvement',
        show: function (data) { return data.props && data.props.autoRebase; }
      },
      baseline: {
        type: 'number',
        label: 'Baseline points before rebasing',
        ref: 'props.baseline',
        defaultValue: 15,
        show: function (data) { return data.props && data.props.autoRebase; }
      },
      minPhaseLength: {
        type: 'number',
        label: 'Points required to confirm a shift',
        ref: 'props.minPhaseLength',
        defaultValue: 8,
        show: function (data) { return data.props && data.props.autoRebase; }
      }
    }
  };

  var displaySection = {
    type: 'items',
    label: 'Display',
    items: {
      title: {
        type: 'string',
        label: 'Chart title',
        ref: 'props.title',
        expression: 'optional',
        defaultValue: ''
      },
      decimals: {
        type: 'number',
        label: 'Decimal places',
        ref: 'props.decimals',
        defaultValue: 2
      },
      showControlLimits: {
        type: 'boolean',
        label: 'Show control limits',
        ref: 'props.showControlLimits',
        defaultValue: true
      },
      showWarningLimits: {
        type: 'boolean',
        label: 'Show warning limits (2 sigma)',
        ref: 'props.showWarningLimits',
        defaultValue: false
      },
      showCentreLine: {
        type: 'boolean',
        label: 'Show centre line',
        ref: 'props.showCentreLine',
        defaultValue: true
      },
      showTargetLine: {
        type: 'boolean',
        label: 'Show target line',
        ref: 'props.showTargetLine',
        defaultValue: true
      },
      showLegend: {
        type: 'boolean',
        label: 'Show legend',
        ref: 'props.showLegend',
        defaultValue: true
      },
      showIcons: {
        type: 'boolean',
        label: 'Show variation / assurance icons',
        ref: 'props.showIcons',
        defaultValue: true
      },
      allowSelections: {
        type: 'boolean',
        label: 'Allow selections on click',
        ref: 'props.allowSelections',
        defaultValue: true
      },
      maxRows: {
        type: 'number',
        label: 'Maximum data points',
        ref: 'props.maxRows',
        defaultValue: 5000
      }
    }
  };

  return {
    type: 'items',
    component: 'accordion',
    items: {
      dimensions: {
        uses: 'dimensions',
        min: 1,
        max: 1,
        items: {
          dimensionLabel: {
            type: 'string',
            ref: 'qDef.qFieldLabels.0',
            label: 'Time period label',
            show: false
          }
        }
      },
      measures: { uses: 'measures', min: 1, max: 2 },
      sorting: { uses: 'sorting' },
      addons: { uses: 'addons' },
      appearance: {
        uses: 'settings',
        items: {
          nhsMdcAnalysis: analysisSection,
          nhsMdcDisplay: displaySection
        }
      }
    }
  };
});
