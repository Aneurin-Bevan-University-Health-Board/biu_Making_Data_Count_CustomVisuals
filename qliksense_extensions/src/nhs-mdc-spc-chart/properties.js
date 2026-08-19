/**
 * properties.js
 * =============
 * Property panel definition for the NHS MDC SPC Chart Qlik Sense extension.
 *
 * Chart type, improvement direction, target, rebase behaviour, baseline and
 * minimum phase length each offer a Fixed / Expression switch, so they can be
 * set from the UI or driven by a variable or configuration table.
 */
define(['./lib/props-ui'], function (propsUi) {
  'use strict';

  // In expression mode the panel cannot evaluate the expression, so the target
  // inputs stay visible and the runtime decides whether to use them.
  function whenUseTarget(data) {
    var props = data.props || {};
    return props.useTargetMode === 'expression' || !!props.useTarget;
  }
  function whenAutoRebase(data) { return !!(data.props && data.props.autoRebase); }

  function merge(target, source) {
    Object.keys(source).forEach(function (key) { target[key] = source[key]; });
    return target;
  }

  var analysisItems = {};

  merge(analysisItems, propsUi.choiceItems({
    key: 'chartType',
    label: 'Chart type',
    options: propsUi.CHART_TYPE_OPTIONS,
    defaultValue: 'auto',
    allowed: propsUi.CHART_TYPE_VALUES
  }));

  merge(analysisItems, propsUi.choiceItems({
    key: 'improvementDirection',
    label: 'Improvement direction',
    options: propsUi.DIRECTION_OPTIONS,
    defaultValue: 'high',
    allowed: propsUi.DIRECTION_VALUES
  }));

  merge(analysisItems, propsUi.booleanItems({
    key: 'useTarget',
    label: 'Use target',
    defaultValue: false
  }));

  merge(analysisItems, propsUi.numberItems({
    key: 'target',
    label: 'Target value',
    defaultValue: 0,
    extraShow: whenUseTarget
  }));

  analysisItems.targetHelp = {
    type: 'string',
    component: 'text',
    label: 'A third measure, when supplied, overrides the target above and lets the target line change over time.'
  };

  analysisItems.autoRebase = {
    type: 'boolean',
    label: 'Auto-rebase on sustained shift',
    ref: 'props.autoRebase',
    defaultValue: false
  };

  merge(analysisItems, propsUi.choiceItems({
    key: 'rebaseOn',
    label: 'Rebase on',
    options: propsUi.REBASE_OPTIONS,
    defaultValue: 'improvement',
    allowed: propsUi.REBASE_VALUES,
    extraShow: whenAutoRebase
  }));

  merge(analysisItems, propsUi.numberItems({
    key: 'baseline',
    label: 'Baseline points before rebasing',
    defaultValue: 15,
    extraShow: whenAutoRebase
  }));

  merge(analysisItems, propsUi.numberItems({
    key: 'minPhaseLength',
    label: 'Points required to confirm a shift',
    defaultValue: 8,
    extraShow: whenAutoRebase
  }));

  var analysisSection = {
    type: 'items',
    label: 'NHS MDC analysis',
    items: analysisItems
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
      showBuildStamp: {
        type: 'boolean',
        label: 'Show extension build date',
        ref: 'props.showBuildStamp',
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
      measures: {
        uses: 'measures',
        min: 1,
        max: 3,
        description: '1: value (required). 2: denominator for p/u charts. 3: target per time period.'
      },
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
