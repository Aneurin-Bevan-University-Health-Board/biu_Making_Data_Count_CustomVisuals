/**
 * properties.js
 * =============
 * Property panel definition for the NHS MDC Variation Icon Qlik Sense extension.
 */
define([], function () {
  'use strict';

  return {
    type: 'items',
    component: 'accordion',
    items: {
      dimensions: { uses: 'dimensions', min: 1, max: 1 },
      measures: { uses: 'measures', min: 1, max: 2 },
      sorting: { uses: 'sorting' },
      addons: { uses: 'addons' },
      appearance: {
        uses: 'settings',
        items: {
          nhsMdcAnalysis: {
            type: 'items',
            label: 'NHS MDC analysis',
            items: {
              chartType: {
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
              },
              improvementDirection: {
                type: 'string',
                component: 'dropdown',
                label: 'Improvement direction',
                ref: 'props.improvementDirection',
                options: [
                  { value: 'high', label: 'Higher is better' },
                  { value: 'low', label: 'Lower is better' }
                ],
                defaultValue: 'high'
              },
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
              }
            }
          },
          nhsMdcDisplay: {
            type: 'items',
            label: 'Display',
            items: {
              title: {
                type: 'string',
                label: 'Title',
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
              showLabels: {
                type: 'boolean',
                label: 'Show icon captions',
                ref: 'props.showLabels',
                defaultValue: true
              },
              maxRows: {
                type: 'number',
                label: 'Maximum data points',
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
