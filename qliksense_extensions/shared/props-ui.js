/**
 * props-ui.js
 * ===========
 * Helpers for settings that can be picked from a dropdown *or* driven by a
 * Qlik expression. Each setting is stored as three properties:
 *
 *   props.<key>Mode        'fixed' | 'expression'
 *   props.<key>            the dropdown value (used when mode is 'fixed')
 *   props.<key>Expression  the evaluated expression (used when mode is 'expression')
 *
 * `modeSwitch` / `dropdown` / `expressionBox` build the property panel items;
 * `settingValue` / `settingText` read the effective value at paint time.
 */
(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NhsMdcPropsUi = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function isExpressionMode(props, key) {
    return !!props && props[key + 'Mode'] === 'expression';
  }

  function isFixedMode(props, key) {
    return !!props && props[key + 'Mode'] !== 'expression';
  }

  // `extraShow` lets a caller AND an additional condition (e.g. "only when
  // auto-rebase is on") onto the generated visibility rule.
  function visibility(key, wantExpression, extraShow) {
    return function (data) {
      if (extraShow && !extraShow(data)) { return false; }
      return wantExpression
        ? isExpressionMode(data.props, key)
        : isFixedMode(data.props, key);
    };
  }

  function modeSwitch(key, label, extraShow) {
    var item = {
      type: 'string',
      component: 'buttongroup',
      label: label,
      ref: 'props.' + key + 'Mode',
      options: [
        { value: 'fixed', label: 'Fixed' },
        { value: 'expression', label: 'Expression' }
      ],
      defaultValue: 'fixed'
    };
    if (extraShow) { item.show = extraShow; }
    return item;
  }

  function dropdown(key, label, options, defaultValue, extraShow) {
    return {
      type: 'string',
      component: 'dropdown',
      label: label,
      ref: 'props.' + key,
      options: options,
      defaultValue: defaultValue,
      show: visibility(key, false, extraShow)
    };
  }

  function expressionBox(key, label, extraShow) {
    return {
      type: 'string',
      label: label,
      ref: 'props.' + key + 'Expression',
      expression: 'optional',
      defaultValue: '',
      show: visibility(key, true, extraShow)
    };
  }

  function hint(key, text, extraShow) {
    return {
      type: 'string',
      component: 'text',
      label: text,
      show: visibility(key, true, extraShow)
    };
  }

  function numberBox(key, label, defaultValue, extraShow) {
    return {
      type: 'number',
      label: label,
      ref: 'props.' + key,
      defaultValue: defaultValue,
      show: visibility(key, false, extraShow)
    };
  }

  function switchBox(key, label, defaultValue, extraShow) {
    return {
      type: 'boolean',
      label: label,
      ref: 'props.' + key,
      defaultValue: !!defaultValue,
      show: visibility(key, false, extraShow)
    };
  }

  /**
   * Build the mode switch, dropdown, expression box and hint for one setting.
   *
   * @param {Object} spec `{key, label, options, defaultValue, allowed, extraShow}`
   * @returns {Object} Property panel items keyed by `<key>Mode`, `<key>`, etc.
   */
  function choiceItems(spec) {
    var items = {};
    items[spec.key + 'Mode'] = modeSwitch(spec.key, spec.label + ' source', spec.extraShow);
    items[spec.key] = dropdown(spec.key, spec.label, spec.options, spec.defaultValue, spec.extraShow);
    items[spec.key + 'Expression'] = expressionBox(spec.key, spec.label + ' expression', spec.extraShow);
    if (spec.allowed) {
      items[spec.key + 'ExpressionHint'] =
        hint(spec.key, 'Must return one of: ' + spec.allowed.join(', ') + '.', spec.extraShow);
    }
    return items;
  }

  /**
   * Same as `choiceItems` but the fixed input is a number rather than a
   * dropdown (used for the target value).
   */
  function numberItems(spec) {
    var items = {};
    items[spec.key + 'Mode'] = modeSwitch(spec.key, spec.label + ' source', spec.extraShow);
    items[spec.key] = numberBox(spec.key, spec.label, spec.defaultValue, spec.extraShow);
    items[spec.key + 'Expression'] = expressionBox(spec.key, spec.label + ' expression', spec.extraShow);
    return items;
  }

  /**
   * Same as `choiceItems` but the fixed input is an on/off switch. The
   * expression is truthy for -1, 1, 'true', 'yes' and 'on'.
   */
  function booleanItems(spec) {
    var items = {};
    items[spec.key + 'Mode'] = modeSwitch(spec.key, spec.label + ' source', spec.extraShow);
    items[spec.key] = switchBox(spec.key, spec.label, spec.defaultValue, spec.extraShow);
    items[spec.key + 'Expression'] = expressionBox(spec.key, spec.label + ' expression', spec.extraShow);
    items[spec.key + 'ExpressionHint'] =
      hint(spec.key, 'Return -1/true/yes/on to switch on, 0/false to switch off.', spec.extraShow);
    return items;
  }

  /**
   * Read the effective value of a setting, honouring its mode switch.
   */
  function settingValue(props, key, fallback) {
    var source = props || {};
    var value = source[key + 'Mode'] === 'expression'
      ? source[key + 'Expression']
      : source[key];
    if (typeof value === 'string') { value = value.trim(); }
    if (value === undefined || value === null || value === '') { return fallback; }
    return value;
  }

  /**
   * Read a setting constrained to a known set of lower-case keywords.
   */
  function settingText(props, key, fallback, allowed) {
    var value = settingValue(props, key, fallback);
    value = String(value).trim().toLowerCase();
    return allowed.indexOf(value) === -1 ? fallback : value;
  }

  /**
   * Read a setting as a boolean. Qlik expressions return -1 for true, so both
   * numeric and textual truthiness are accepted.
   */
  function settingBoolean(props, key, fallback) {
    var value = settingValue(props, key, undefined);
    if (value === undefined) { return !!fallback; }
    if (typeof value === 'boolean') { return value; }
    if (typeof value === 'number') { return value !== 0; }
    var text = String(value).trim().toLowerCase();
    if (['true', 'yes', 'on', '-1', '1'].indexOf(text) !== -1) { return true; }
    if (['false', 'no', 'off', '0'].indexOf(text) !== -1) { return false; }
    var num = Number(text);
    return isFinite(num) ? num !== 0 : !!fallback;
  }

  /**
   * Default props for a setting trio, for `initialProperties`.
   */
  function defaults(key, defaultValue) {
    var out = {};
    out[key + 'Mode'] = 'fixed';
    out[key] = defaultValue;
    out[key + 'Expression'] = '';
    return out;
  }

  return {
    CHART_TYPE_OPTIONS: [
      { value: 'auto', label: 'Auto-detect' },
      { value: 'xmr', label: 'XmR (individuals)' },
      { value: 'p', label: 'p (proportion)' },
      { value: 'u', label: 'u (rate per unit)' },
      { value: 'c', label: 'c (count)' },
      { value: 't', label: 't (time between rare events)' },
      { value: 'g', label: 'g (opportunities between rare events)' },
      { value: 'run', label: 'Run chart' }
    ],
    CHART_TYPE_VALUES: ['auto', 'xmr', 'p', 'u', 'c', 't', 'g', 'run'],
    DIRECTION_OPTIONS: [
      { value: 'high', label: 'Higher is better' },
      { value: 'low', label: 'Lower is better' }
    ],
    DIRECTION_VALUES: ['high', 'low'],
    REBASE_OPTIONS: [
      { value: 'improvement', label: 'Improvement only' },
      { value: 'worsening', label: 'Worsening only' },
      { value: 'any', label: 'Any sustained shift' }
    ],
    REBASE_VALUES: ['improvement', 'worsening', 'any'],
    choiceItems: choiceItems,
    numberItems: numberItems,
    booleanItems: booleanItems,
    settingValue: settingValue,
    settingText: settingText,
    settingBoolean: settingBoolean,
    defaults: defaults
  };
}));
