/**
 * spc-render.js
 * =============
 * Dependency-free SVG rendering helpers shared by the NHS Making Data Count
 * Qlik Sense extensions.
 *
 * Everything is drawn with plain DOM/SVG APIs so the extensions work on
 * Qlik Sense Enterprise on Windows (client-managed) without needing any
 * third-party charting library to be whitelisted on the server.
 */
(function (root, factory) {
  'use strict';
  if (typeof define === 'function' && define.amd) {
    define(['./spc-engine', './build-info'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./spc-engine'), require('./build-info'));
  } else {
    root.NhsMdcSpcRender = factory(root.NhsMdcSpcEngine, root.NhsMdcBuildInfo);
  }
}(typeof self !== 'undefined' ? self : this, function (engine, buildInfo) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var COLOURS = engine.NHS_COLOURS;
  var BUILD_LABEL = (buildInfo && buildInfo.label) || '';

  var CHART_TYPE_LABELS = {
    xmr: 'XmR chart',
    p: 'p chart',
    u: 'u chart',
    c: 'c chart',
    t: 't chart',
    g: 'g chart',
    run: 'Run chart'
  };

  // -------------------------------------------------------------------------
  // Generic helpers
  // -------------------------------------------------------------------------

  function svgEl(name, attributes) {
    var el = document.createElementNS(SVG_NS, name);
    if (attributes) {
      Object.keys(attributes).forEach(function (key) {
        el.setAttribute(key, attributes[key]);
      });
    }
    return el;
  }

  function text(parent, content, attributes) {
    var el = svgEl('text', attributes);
    el.textContent = content;
    parent.appendChild(el);
    return el;
  }

  // Shows which build of the extension is loaded, so it can be checked against
  // the zip that was imported into the QMC.
  function buildStampElement(opts) {
    if (!BUILD_LABEL || (opts && opts.showBuildStamp === false)) { return null; }
    var el = document.createElement('div');
    el.className = 'nhs-mdc-build-stamp';
    el.textContent = BUILD_LABEL;
    el.style.fontFamily = 'Arial, Helvetica, sans-serif';
    el.style.fontSize = '9px';
    el.style.color = '#768692';
    el.style.textAlign = 'right';
    el.style.padding = '2px 4px';
    return el;
  }

  function tooltip(el, content) {
    var title = svgEl('title');
    title.textContent = content;
    el.appendChild(title);
    return el;
  }

  function formatNumber(value, decimals) {
    if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
      return 'n/a';
    }
    var dp = (decimals === null || decimals === undefined) ? 2 : decimals;
    return Number(value).toFixed(dp);
  }

  /**
   * Resolve the value formatter for a render call: `opts.formatValue` when the
   * caller has one (built from the measure's own number format), otherwise a
   * plain fixed-decimal formatter.
   */
  function formatterFor(opts) {
    if (opts && typeof opts.formatValue === 'function') {
      return function (value) {
        if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
          return 'n/a';
        }
        return opts.formatValue(value);
      };
    }
    var decimals = opts ? opts.decimals : undefined;
    return function (value) { return formatNumber(value, decimals); };
  }

  function niceTicks(min, max, count) {
    if (!isFinite(min) || !isFinite(max)) { return [0, 1]; }
    if (min === max) { return [min]; }
    var span = max - min;
    var step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10));
    var error = span / count / step;
    if (error >= 7.5) { step *= 10; }
    else if (error >= 3) { step *= 5; }
    else if (error >= 1.5) { step *= 2; }

    var ticks = [];
    var start = Math.ceil(min / step) * step;
    for (var v = start; v <= max + step / 1000; v += step) {
      ticks.push(Math.abs(v) < step / 1e6 ? 0 : v);
    }
    return ticks;
  }

  function linearScale(domain, range) {
    var d0 = domain[0];
    var d1 = domain[1];
    var r0 = range[0];
    var r1 = range[1];
    var span = (d1 - d0) || 1;
    return function (value) {
      return r0 + ((value - d0) / span) * (r1 - r0);
    };
  }

  function clearElement(element) {
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  /**
   * Render a plain (escaped) message inside a container element.
   */
  function renderMessage(element, message, isError) {
    clearElement(element);
    var div = document.createElement('div');
    div.className = 'nhs-mdc-message' + (isError ? ' nhs-mdc-message--error' : '');
    div.style.padding = '16px';
    div.style.fontFamily = 'Arial, Helvetica, sans-serif';
    div.style.fontSize = '13px';
    div.style.color = isError ? '#8A1538' : '#425563';
    div.textContent = message;
    element.appendChild(div);
  }

  // -------------------------------------------------------------------------
  // NHS MDC variation / assurance icons (drawn as SVG, no binary assets)
  // -------------------------------------------------------------------------

  var VARIATION_ICON_COLOURS = {
    common_cause: COLOURS.GREY,
    improvement_high: COLOURS.BLUE,
    improvement_low: COLOURS.BLUE,
    concern_high: COLOURS.ORANGE,
    concern_low: COLOURS.ORANGE
  };

  var ASSURANCE_ICON_COLOURS = {
    pass: COLOURS.BLUE,
    hit_or_miss: COLOURS.WARM_YELLOW,
    fail: COLOURS.ORANGE,
    no_target: COLOURS.GREY
  };

  /**
   * Build a variation icon group: a circle with an up arrow, down arrow or
   * "common cause" tilde, coloured blue (improvement), orange (concern) or
   * grey (common cause).
   */
  function variationIcon(type, size) {
    var s = size || 34;
    var g = svgEl('g', { class: 'nhs-mdc-icon nhs-mdc-icon--variation' });
    var colour = VARIATION_ICON_COLOURS[type] || COLOURS.GREY;
    var r = s / 2;

    g.appendChild(svgEl('circle', {
      cx: r, cy: r, r: r - 1, fill: '#FFFFFF', stroke: colour, 'stroke-width': 2
    }));

    if (type === 'common_cause') {
      g.appendChild(svgEl('path', {
        d: 'M ' + (r - s * 0.26) + ' ' + r +
           ' q ' + (s * 0.13) + ' ' + (-s * 0.20) + ' ' + (s * 0.26) + ' 0' +
           ' q ' + (s * 0.13) + ' ' + (s * 0.20) + ' ' + (s * 0.26) + ' 0',
        fill: 'none', stroke: colour, 'stroke-width': 2.4, 'stroke-linecap': 'round'
      }));
    } else {
      var up = type === 'improvement_high' || type === 'concern_high';
      var tipY = up ? s * 0.26 : s * 0.74;
      var tailY = up ? s * 0.74 : s * 0.26;
      var headOffset = up ? s * 0.18 : -s * 0.18;
      g.appendChild(svgEl('path', {
        d: 'M ' + r + ' ' + tailY + ' L ' + r + ' ' + tipY,
        stroke: colour, 'stroke-width': 2.6, 'stroke-linecap': 'round'
      }));
      g.appendChild(svgEl('path', {
        d: 'M ' + (r - s * 0.16) + ' ' + (tipY + headOffset) +
           ' L ' + r + ' ' + tipY +
           ' L ' + (r + s * 0.16) + ' ' + (tipY + headOffset),
        fill: 'none', stroke: colour, 'stroke-width': 2.6,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
    }

    return g;
  }

  /**
   * Build an assurance icon group: a target-style circle containing a tick
   * (pass), a cross (fail), a question mark (hit or miss) or a dash.
   */
  function assuranceIcon(type, size) {
    var s = size || 34;
    var g = svgEl('g', { class: 'nhs-mdc-icon nhs-mdc-icon--assurance' });
    var colour = ASSURANCE_ICON_COLOURS[type] || COLOURS.GREY;
    var r = s / 2;

    g.appendChild(svgEl('polygon', {
      points: [
        r + ',' + (s * 0.04),
        (s * 0.96) + ',' + r,
        r + ',' + (s * 0.96),
        (s * 0.04) + ',' + r
      ].join(' '),
      fill: '#FFFFFF', stroke: colour, 'stroke-width': 2
    }));

    if (type === 'pass') {
      g.appendChild(svgEl('path', {
        d: 'M ' + (s * 0.30) + ' ' + (s * 0.52) +
           ' L ' + (s * 0.45) + ' ' + (s * 0.67) +
           ' L ' + (s * 0.72) + ' ' + (s * 0.36),
        fill: 'none', stroke: colour, 'stroke-width': 2.6,
        'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }));
    } else if (type === 'fail') {
      g.appendChild(svgEl('path', {
        d: 'M ' + (s * 0.34) + ' ' + (s * 0.34) + ' L ' + (s * 0.66) + ' ' + (s * 0.66) +
           ' M ' + (s * 0.66) + ' ' + (s * 0.34) + ' L ' + (s * 0.34) + ' ' + (s * 0.66),
        fill: 'none', stroke: colour, 'stroke-width': 2.6, 'stroke-linecap': 'round'
      }));
    } else if (type === 'hit_or_miss') {
      text(g, '?', {
        x: r, y: r + s * 0.16, 'text-anchor': 'middle',
        'font-family': 'Arial, Helvetica, sans-serif',
        'font-size': s * 0.48, 'font-weight': 'bold', fill: colour
      });
    } else {
      g.appendChild(svgEl('path', {
        d: 'M ' + (s * 0.32) + ' ' + r + ' L ' + (s * 0.68) + ' ' + r,
        stroke: colour, 'stroke-width': 2.6, 'stroke-linecap': 'round'
      }));
    }

    return g;
  }

  // -------------------------------------------------------------------------
  // SPC chart
  // -------------------------------------------------------------------------

  function stepPath(xScale, yScale, series) {
    var d = '';
    for (var i = 0; i < series.length; i++) {
      var x0 = i === 0 ? xScale(0) : (xScale(i - 1) + xScale(i)) / 2;
      var x1 = i === series.length - 1
        ? xScale(series.length - 1)
        : (xScale(i) + xScale(i + 1)) / 2;
      var y = yScale(series[i]);
      d += (i === 0 ? 'M ' : ' L ') + x0 + ' ' + y + ' L ' + x1 + ' ' + y;
    }
    return d;
  }

  function drawLimitSeries(group, xScale, yScale, series, colour, dash, width) {
    if (!series) { return; }
    var path = svgEl('path', {
      d: stepPath(xScale, yScale, series),
      fill: 'none',
      stroke: colour,
      'stroke-width': width || 1
    });
    if (dash) { path.setAttribute('stroke-dasharray', dash); }
    group.appendChild(path);
  }

  function legendItem(parent, x, y, colour, label, shape) {
    if (shape === 'line') {
      parent.appendChild(svgEl('line', {
        x1: x, y1: y, x2: x + 14, y2: y, stroke: colour, 'stroke-width': 2
      }));
    } else {
      parent.appendChild(svgEl('circle', { cx: x + 7, cy: y, r: 4, fill: colour }));
    }
    text(parent, label, {
      x: x + 20, y: y + 4,
      'font-family': 'Arial, Helvetica, sans-serif',
      'font-size': 11, fill: '#425563'
    });
  }

  /**
   * Render an NHS MDC SPC chart.
   *
   * @param {HTMLElement} element Container element (emptied before drawing).
   * @param {Object} analysis Output of `engine.analyse`.
   * @param {Object} options Rendering options:
   *   labels, width, height, title, decimals, formatValue, showControlLimits,
   *   showWarningLimits, showCentreLine, showTargetLine, showLegend,
   *   showIcons, onPointClick, valueLabel.
   */
  function renderChart(element, analysis, options) {
    var opts = options || {};
    clearElement(element);

    var labels = opts.labels || [];
    var fmt = formatterFor(opts);
    var width = Math.max(opts.width || element.clientWidth || 600, 240);
    var height = Math.max(opts.height || element.clientHeight || 360, 180);
    var isRun = analysis.chartType === 'run';

    var margin = {
      top: opts.title ? 46 : 24,
      right: 16,
      bottom: opts.showIcons === false ? 62 : 96,
      left: 62
    };
    var plotWidth = Math.max(width - margin.left - margin.right, 80);
    var plotHeight = Math.max(height - margin.top - margin.bottom, 80);

    var svg = svgEl('svg', {
      width: '100%',
      height: '100%',
      viewBox: '0 0 ' + width + ' ' + height,
      preserveAspectRatio: 'xMidYMid meet',
      class: 'nhs-mdc-chart'
    });
    svg.style.backgroundColor = '#FFFFFF';
    element.appendChild(svg);

    if (opts.title) {
      text(svg, opts.title, {
        x: width / 2, y: 26, 'text-anchor': 'middle',
        'font-family': 'Arial, Helvetica, sans-serif',
        'font-size': 15, 'font-weight': 'bold', fill: '#231F20'
      });
    }

    if (BUILD_LABEL && opts.showBuildStamp !== false) {
      text(svg, BUILD_LABEL, {
        x: width - 4, y: 11, 'text-anchor': 'end',
        'font-family': 'Arial, Helvetica, sans-serif',
        'font-size': 9, fill: '#768692'
      });
    }

    var plot = svgEl('g', { transform: 'translate(' + margin.left + ',' + margin.top + ')' });
    svg.appendChild(plot);

    // ---- scales -----------------------------------------------------------
    var values = analysis.values;
    var candidates = values.slice();
    if (analysis.mean) { candidates = candidates.concat(analysis.mean); }
    if (!isRun && opts.showControlLimits !== false) {
      candidates = candidates.concat(analysis.ucl || [], analysis.lcl || []);
    }
    if (opts.showWarningLimits) {
      candidates = candidates.concat(analysis.uwl || [], analysis.lwl || []);
    }
    if (opts.showTargetLine !== false && analysis.target !== null) {
      candidates = candidates.concat(analysis.target);
    }
    candidates = candidates.filter(function (v) { return typeof v === 'number' && isFinite(v); });

    var yMin = Math.min.apply(null, candidates);
    var yMax = Math.max.apply(null, candidates);
    var pad = (yMax - yMin) * 0.08 || Math.abs(yMax || 1) * 0.1 || 1;
    yMin -= pad;
    yMax += pad;

    var xScale = linearScale([0, Math.max(values.length - 1, 1)], [0, plotWidth]);
    var yScale = linearScale([yMin, yMax], [plotHeight, 0]);

    // ---- gridlines & axes -------------------------------------------------
    var ticks = niceTicks(yMin, yMax, 5);
    ticks.forEach(function (tick) {
      var y = yScale(tick);
      plot.appendChild(svgEl('line', {
        x1: 0, y1: y, x2: plotWidth, y2: y, stroke: COLOURS.PALE_GREY, 'stroke-width': 1
      }));
      text(plot, fmt(tick), {
        x: -8, y: y + 4, 'text-anchor': 'end',
        'font-family': 'Arial, Helvetica, sans-serif', 'font-size': 11, fill: '#425563'
      });
    });

    plot.appendChild(svgEl('line', {
      x1: 0, y1: plotHeight, x2: plotWidth, y2: plotHeight,
      stroke: '#768692', 'stroke-width': 1
    }));
    plot.appendChild(svgEl('line', {
      x1: 0, y1: 0, x2: 0, y2: plotHeight, stroke: '#768692', 'stroke-width': 1
    }));

    // ---- x labels ---------------------------------------------------------
    var maxLabels = Math.max(Math.floor(plotWidth / 70), 2);
    var labelStep = Math.max(Math.ceil(values.length / maxLabels), 1);
    for (var li = 0; li < values.length; li += labelStep) {
      var label = labels[li] === undefined || labels[li] === null ? String(li + 1) : String(labels[li]);
      var tick = text(plot, label, {
        x: xScale(li), y: plotHeight + 16,
        'text-anchor': 'end',
        transform: 'rotate(-40 ' + xScale(li) + ' ' + (plotHeight + 16) + ')',
        'font-family': 'Arial, Helvetica, sans-serif', 'font-size': 10, fill: '#425563'
      });
      tooltip(tick, label);
    }

    // ---- limits -----------------------------------------------------------
    if (!isRun && opts.showControlLimits !== false) {
      drawLimitSeries(plot, xScale, yScale, analysis.ucl, COLOURS.DARK_BLUE, '6,4');
      drawLimitSeries(plot, xScale, yScale, analysis.lcl, COLOURS.DARK_BLUE, '6,4');
    }
    if (!isRun && opts.showWarningLimits) {
      drawLimitSeries(plot, xScale, yScale, analysis.uwl, COLOURS.DARK_BLUE, '2,3');
      drawLimitSeries(plot, xScale, yScale, analysis.lwl, COLOURS.DARK_BLUE, '2,3');
    }
    if (opts.showCentreLine !== false) {
      drawLimitSeries(plot, xScale, yScale, analysis.mean, COLOURS.BLUE, null, 2);
    }
    if (opts.showTargetLine !== false && analysis.target !== null) {
      if (Array.isArray(analysis.target)) {
        drawLimitSeries(plot, xScale, yScale, analysis.target, COLOURS.WARM_YELLOW, '8,4', 1.6);
      } else {
        var ty = yScale(analysis.target);
        plot.appendChild(svgEl('line', {
          x1: 0, y1: ty, x2: plotWidth, y2: ty,
          stroke: COLOURS.WARM_YELLOW, 'stroke-width': 1.6, 'stroke-dasharray': '8,4'
        }));
      }
    }

    // ---- series -----------------------------------------------------------
    if (values.length > 1) {
      var d = '';
      for (var i = 0; i < values.length; i++) {
        d += (i === 0 ? 'M ' : ' L ') + xScale(i) + ' ' + yScale(values[i]);
      }
      plot.appendChild(svgEl('path', {
        d: d, fill: 'none', stroke: '#A8B0B5', 'stroke-width': 1.2
      }));
    }

    var ruleNames = { rule1: 'R1 astronomical', rule2: 'R2 shift', rule3: 'R3 trend', rule4: 'R4 two-in-three' };
    values.forEach(function (value, index) {
      var triggered = [];
      Object.keys(ruleNames).forEach(function (rule) {
        if (analysis.signals[rule] && analysis.signals[rule][index]) {
          triggered.push(ruleNames[rule]);
        }
      });

      var point = svgEl('circle', {
        cx: xScale(index),
        cy: yScale(value),
        r: analysis.signals.specialCause[index] ? 5 : 4,
        fill: analysis.colours[index],
        stroke: '#FFFFFF',
        'stroke-width': 1
      });

      var labelText = labels[index] === undefined || labels[index] === null
        ? 'Point ' + (index + 1)
        : String(labels[index]);
      tooltip(point, labelText + ': ' + fmt(value) +
        '\nCentre line: ' + fmt(analysis.mean[index]) +
        (analysis.ucl ? '\nUCL: ' + fmt(analysis.ucl[index]) : '') +
        (analysis.lcl ? '\nLCL: ' + fmt(analysis.lcl[index]) : '') +
        (triggered.length ? '\nSignals: ' + triggered.join(', ') : ''));

      if (typeof opts.onPointClick === 'function') {
        point.style.cursor = 'pointer';
        point.addEventListener('click', function () { opts.onPointClick(index); });
      }

      plot.appendChild(point);
    });

    // ---- rebase phase separators -----------------------------------------
    if (analysis.rebasePhase) {
      for (var r = 1; r < analysis.rebasePhase.length; r++) {
        if (analysis.rebasePhase[r] !== analysis.rebasePhase[r - 1]) {
          var x = (xScale(r - 1) + xScale(r)) / 2;
          plot.appendChild(svgEl('line', {
            x1: x, y1: 0, x2: x, y2: plotHeight,
            stroke: COLOURS.GREY, 'stroke-width': 1, 'stroke-dasharray': '3,3'
          }));
        }
      }
    }

    // ---- footer: legend + icons ------------------------------------------
    var footer = svgEl('g', {
      transform: 'translate(' + margin.left + ',' + (margin.top + plotHeight + 40) + ')'
    });
    svg.appendChild(footer);

    if (opts.showLegend !== false) {
      legendItem(footer, 0, 6, engine.POINT_COLOURS.COMMON_CAUSE, 'Common cause');
      legendItem(footer, 120, 6, engine.POINT_COLOURS.IMPROVEMENT, 'Improvement');
      legendItem(footer, 240, 6, engine.POINT_COLOURS.CONCERN, 'Concern');
      legendItem(footer, 350, 6, COLOURS.DARK_BLUE, 'Control limits', 'line');
      if (analysis.target !== null) {
        legendItem(footer, 480, 6, COLOURS.WARM_YELLOW, 'Target', 'line');
      }
    }

    if (opts.showIcons !== false) {
      var icons = svgEl('g', { transform: 'translate(0,20)' });
      footer.appendChild(icons);

      var variation = variationIcon(analysis.variation, 30);
      variation.setAttribute('transform', 'translate(0,0)');
      tooltip(variation, analysis.variationLabel);
      icons.appendChild(variation);
      text(icons, analysis.variationLabel, {
        x: 38, y: 20, 'font-family': 'Arial, Helvetica, sans-serif',
        'font-size': 11, fill: '#425563'
      });

      var assurance = assuranceIcon(analysis.assurance, 30);
      assurance.setAttribute('transform', 'translate(' + Math.max(plotWidth - 260, 300) + ',0)');
      tooltip(assurance, analysis.assuranceLabel);
      icons.appendChild(assurance);
      text(icons, analysis.assuranceLabel, {
        x: Math.max(plotWidth - 260, 300) + 38, y: 20,
        'font-family': 'Arial, Helvetica, sans-serif', 'font-size': 11, fill: '#425563'
      });
    }

    if (!analysis.hasEnoughData) {
      text(svg, 'Warning: SPC needs at least ' + engine.SPC_MIN_DATA_POINTS +
        ' data points (' + analysis.pointCount + ' supplied) \u2014 results may be unreliable.', {
        x: margin.left, y: margin.top + 12,
        'font-family': 'Arial, Helvetica, sans-serif', 'font-size': 11,
        'font-weight': 'bold', fill: COLOURS.ORANGE
      });
    }

    return svg;
  }

  // -------------------------------------------------------------------------
  // Summary table
  // -------------------------------------------------------------------------

  function iconCell(row, type, label, isVariation) {
    var cell = document.createElement('td');
    cell.className = 'nhs-mdc-cell nhs-mdc-cell--icon';
    cell.title = label;
    var svg = svgEl('svg', { width: 30, height: 30, viewBox: '0 0 30 30' });
    svg.appendChild(isVariation ? variationIcon(type, 30) : assuranceIcon(type, 30));
    cell.appendChild(svg);
    row.appendChild(cell);
    return cell;
  }

  function textCell(row, content, align) {
    var cell = document.createElement('td');
    cell.className = 'nhs-mdc-cell';
    cell.style.textAlign = align || 'left';
    cell.textContent = content;
    row.appendChild(cell);
    return cell;
  }

  // A dynamic target is an array, in which case the last period's target applies.
  function latestTarget(analysis, fmt) {
    var target = analysis.target;
    if (Array.isArray(target)) { target = target[target.length - 1]; }
    return (target === null || target === undefined || !isFinite(target)) ? '' : fmt(target);
  }

  /**
   * Render an NHS MDC summary table.
   *
   * Columns mirror `abspc.plot.plot_mdc_summary_table`, with the addition of
   * the latest period so the data behind each row can be checked.
   *
   * @param {HTMLElement} element Container element.
   * @param {Array} rows Array of `{label, description, latestLabel, analysis, error}` objects.
   * @param {Object} options `decimals`, `formatValue`, `onRowClick`, `showDescription`.
   */
  function renderSummaryTable(element, rows, options) {
    var opts = options || {};
    clearElement(element);

    var fmt = formatterFor(opts);

    var table = document.createElement('table');
    table.className = 'nhs-mdc-summary-table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontFamily = 'Arial, Helvetica, sans-serif';
    table.style.fontSize = '12px';

    var headings = ['Measure'];
    if (opts.showDescription) { headings.push('Description'); }
    headings = headings.concat([
      '', 'Variation', '', 'Assurance', 'Target', 'Latest period', 'Latest value'
    ]);

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    headings.forEach(function (heading) {
      var th = document.createElement('th');
      th.textContent = heading;
      th.style.textAlign = 'left';
      th.style.padding = '6px 8px';
      th.style.borderBottom = '2px solid ' + COLOURS.BLUE;
      th.style.color = COLOURS.DARK_BLUE;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid ' + COLOURS.PALE_GREY;

      textCell(tr, row.label);
      if (opts.showDescription) { textCell(tr, row.description || ''); }

      if (row.error || !row.analysis) {
        var errorCell = textCell(tr, row.error || 'No data');
        errorCell.colSpan = headings.length - (opts.showDescription ? 2 : 1);
        errorCell.style.color = COLOURS.ORANGE;
      } else {
        var analysis = row.analysis;
        iconCell(tr, analysis.variation, analysis.variationLabel, true);
        textCell(tr, analysis.variationLabel);
        iconCell(tr, analysis.assurance, analysis.assuranceLabel, false);
        textCell(tr, analysis.assuranceLabel);
        textCell(tr, latestTarget(analysis, fmt), 'right');
        textCell(tr, row.latestLabel || '', 'right');
        textCell(tr, fmt(analysis.latestValue), 'right');
      }

      if (typeof opts.onRowClick === 'function' && row.elemNumber !== undefined) {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', function () { opts.onRowClick(row); });
      }

      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    var wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';
    wrapper.style.overflow = 'auto';
    var stamp = buildStampElement(opts);
    if (stamp) { wrapper.appendChild(stamp); }
    wrapper.appendChild(table);
    element.appendChild(wrapper);
    return table;
  }

  // -------------------------------------------------------------------------
  // Variation / assurance KPI tile
  // -------------------------------------------------------------------------

  /**
   * Render a single-measure KPI tile with the MDC variation and assurance
   * icons plus the latest value.
   */
  function renderIconKpi(element, analysis, options) {
    var opts = options || {};
    clearElement(element);

    var fmt = formatterFor(opts);

    var wrapper = document.createElement('div');
    wrapper.className = 'nhs-mdc-kpi';
    wrapper.style.fontFamily = 'Arial, Helvetica, sans-serif';
    wrapper.style.padding = '10px';
    wrapper.style.height = '100%';
    wrapper.style.boxSizing = 'border-box';

    var kpiStamp = buildStampElement(opts);
    if (kpiStamp) {
      kpiStamp.style.padding = '0';
      wrapper.appendChild(kpiStamp);
    }

    if (opts.title) {
      var titleEl = document.createElement('div');
      titleEl.textContent = opts.title;
      titleEl.style.fontSize = '13px';
      titleEl.style.fontWeight = 'bold';
      titleEl.style.color = COLOURS.DARK_BLUE;
      titleEl.style.marginBottom = '6px';
      wrapper.appendChild(titleEl);
    }

    var valueEl = document.createElement('div');
    valueEl.textContent = fmt(analysis.latestValue);
    valueEl.style.fontSize = '28px';
    valueEl.style.fontWeight = 'bold';
    valueEl.style.color = '#231F20';
    wrapper.appendChild(valueEl);

    var meta = document.createElement('div');
    meta.style.fontSize = '11px';
    meta.style.color = '#425563';
    meta.style.marginBottom = '8px';
    meta.textContent = 'Mean ' + fmt(analysis.mean[analysis.mean.length - 1]) +
      ' \u2022 ' + analysis.pointCount + ' points \u2022 ' +
      (CHART_TYPE_LABELS[analysis.chartType] || analysis.chartType);
    wrapper.appendChild(meta);

    var iconRow = document.createElement('div');
    iconRow.style.display = 'flex';
    iconRow.style.alignItems = 'center';
    iconRow.style.gap = '14px';

    [
      { type: analysis.variation, label: analysis.variationLabel, variation: true },
      { type: analysis.assurance, label: analysis.assuranceLabel, variation: false }
    ].forEach(function (item) {
      var cell = document.createElement('div');
      cell.style.display = 'flex';
      cell.style.alignItems = 'center';
      cell.style.gap = '6px';
      cell.title = item.label;

      var svg = svgEl('svg', { width: 34, height: 34, viewBox: '0 0 34 34' });
      svg.appendChild(item.variation ? variationIcon(item.type, 34) : assuranceIcon(item.type, 34));
      cell.appendChild(svg);

      if (opts.showLabels !== false) {
        var caption = document.createElement('span');
        caption.textContent = item.label;
        caption.style.fontSize = '11px';
        caption.style.color = '#425563';
        cell.appendChild(caption);
      }

      iconRow.appendChild(cell);
    });

    wrapper.appendChild(iconRow);
    element.appendChild(wrapper);
    return wrapper;
  }

  return {
    CHART_TYPE_LABELS: CHART_TYPE_LABELS,
    formatNumber: formatNumber,
    clearElement: clearElement,
    renderMessage: renderMessage,
    renderChart: renderChart,
    renderSummaryTable: renderSummaryTable,
    renderIconKpi: renderIconKpi,
    variationIcon: variationIcon,
    assuranceIcon: assuranceIcon
  };
}));
