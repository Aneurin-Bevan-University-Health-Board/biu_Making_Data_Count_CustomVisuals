/**
 * properties.js
 * =============
 * Property panel definition for the NHS MDC Summary Table Qlik Sense extension.
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
    label: 'Target value (applies to every measure)',
    defaultValue: 0,
    extraShow: whenUseTarget
  }));

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

  return {
    type: 'items',
    component: 'accordion',
    items: {
      dimensions: {
        uses: 'dimensions',
        min: 2,
        max: 3,
        description: '1: measure name. 2: time period. 3: description shown beside the measure.'
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
          nhsMdcAnalysis: {
            type: 'items',
            label: 'NHS MDC analysis',
            items: analysisItems
          },
          nhsMdcDisplay: {
            type: 'items',
            label: 'Display',
            items: {
              decimals: {
                type: 'number',
                label: 'Decimal places',
                ref: 'props.decimals',
                defaultValue: 2
              },
              allowSelections: {
                type: 'boolean',
                label: 'Allow selections on row click',
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
                label: 'Maximum data rows',
                ref: 'props.maxRows',
                defaultValue: 5000
              }
            }
          }
        }
      }
    }
  };
});
