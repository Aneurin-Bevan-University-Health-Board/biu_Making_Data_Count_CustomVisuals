/**
 * abspc_spc_chart.js
 * ===================
 * ABSPC SPC Chart — Qlik Sense On-Prem Extension
 *
 * Implements XmR, p, u, c and run charts following NHS Making Data Count
 * methodology, aligned with the NHS-R NHSRplotthedots package and the
 * abspc Python package.
 *
 * Data contract:
 *   Dimension 1 — date / time period label (e.g. Month)
 *   Measure 1  — the value to chart
 *   Measure 2  — (optional) subgroup size for p / u charts
 *
 * All SPC calculations are performed client-side by lib/spc_utils.js.
 */
define([
  'qlik',
  './definition',
  './initialProperties',
  './lib/spc_utils',
  'css!./abspc_spc_chart.css'
], function (qlik, definition, initialProperties, spc) {
  'use strict';

  // ── Default chart titles per type ──────────────────────────────────
  var DEFAULT_TITLES = {
    xmr: 'XmR Chart — Individual Measurements',
    p:   'p Chart — Proportions',
    u:   'u Chart — Rates per Unit',
    c:   'c Chart — Count of Events',
    run: 'Run Chart — Median Centre Line'
  };

  // ── SVG namespace shortcut ─────────────────────────────────────────
  var NS = 'http://www.w3.org/2000/svg';

  // ── Helper: create SVG element with attributes ─────────────────────
  function svgEl(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    if (attrs) {
      var keys = Object.keys(attrs);
      for (var i = 0; i < keys.length; i++) {
        el.setAttribute(keys[i], attrs[keys[i]]);
      }
    }
    return el;
  }

  // ── Helper: simple linear scale ────────────────────────────────────
  function linearScale(domain, range) {
    var d0 = domain[0], d1 = domain[1];
    var r0 = range[0],  r1 = range[1];
    var fn = function (v) { return r0 + ((v - d0) / (d1 - d0)) * (r1 - r0); };
    fn.invert = function (v) { return d0 + ((v - r0) / (r1 - r0)) * (d1 - d0); };
    return fn;
  }

  // ── Helper: nice tick values for an axis ───────────────────────────
  function niceTicks(min, max, count) {
    if (min === max) { return [min]; }
    count = count || 5;
    var range = max - min;
    var rough = range / count;
    var mag = Math.pow(10, Math.floor(Math.log10(rough)));
    var residual = rough / mag;
    var step;
    if (residual <= 1.5) step = mag;
    else if (residual <= 3) step = 2 * mag;
    else if (residual <= 7) step = 5 * mag;
    else step = 10 * mag;

    var start = Math.ceil(min / step) * step;
    var ticks = [];
    for (var t = start; t <= max; t += step) {
      ticks.push(+t.toFixed(10));
    }
    if (ticks.length === 0) ticks.push(min);
    return ticks;
  }

  // ── Extract data from Qlik hypercube ───────────────────────────────
  function extractData(layout) {
    var matrix = layout.qHyperCube.qDataPages[0].qMatrix;
    var labels = [];
    var values = [];
    var subgroups = [];
    var hasTwoMeasures = layout.qHyperCube.qMeasureInfo.length >= 2;

    for (var i = 0; i < matrix.length; i++) {
      var row = matrix[i];
      labels.push(row[0].qText || '');
      values.push(row[1].qNum);
      if (hasTwoMeasures && row[2] !== undefined) {
        subgroups.push(row[2].qNum);
      }
    }
    return { labels: labels, values: values, subgroups: subgroups, hasTwoMeasures: hasTwoMeasures };
  }

  // ── Compute SPC limits & flags for the chosen chart type ───────────
  function computeSPC(chartType, values, subgroups) {
    var limits, violations, colors;

    switch (chartType) {
      case 'p':
        var subs = subgroups.length === values.length ? subgroups : [];
        if (subs.length === 0) {
          for (var i = 0; i < values.length; i++) subs.push(100);
        }
        limits = spc.calculatePChartLimits(values, subs);
        violations = spc.detectSpecialCauses(
          limits.values, limits.meanArray, limits.uclArray,
          limits.lclArray, limits.uwlArray, limits.lwlArray);
        break;

      case 'u':
        var uSubs = subgroups.length === values.length ? subgroups : [];
        if (uSubs.length === 0) {
          for (var i = 0; i < values.length; i++) uSubs.push(1);
        }
        limits = spc.calculateUChartLimits(values, uSubs);
        violations = spc.detectSpecialCauses(
          limits.values, limits.meanArray, limits.uclArray,
          limits.lclArray, limits.uwlArray, limits.lwlArray);
        break;

      case 'c':
        limits = spc.calculateCChartLimits(values);
        violations = spc.detectSpecialCauses(
          limits.values, limits.meanArray, limits.uclArray,
          limits.lclArray, limits.uwlArray, limits.lwlArray);
        break;

      case 'run':
        var runResult = spc.detectRunChartSignals(values);
        limits = {
          values: values,
          meanArray: runResult.medianArray,
          uclArray: null,
          lclArray: null,
          uwlArray: null,
          lwlArray: null,
          statistics: { median: runResult.median }
        };
        violations = {
          rule1: [],
          rule2: runResult.rule2,
          rule3: runResult.rule3,
          rule4: [],
          specialCause: runResult.specialCause
        };
        for (var i = 0; i < values.length; i++) {
          violations.rule1.push(false);
          violations.rule4.push(false);
        }
        break;

      default: // xmr
        limits = spc.calculateXmRLimits(values);
        violations = spc.detectSpecialCauses(
          limits.values, limits.meanArray, limits.uclArray,
          limits.lclArray, limits.uwlArray, limits.lwlArray);
        break;
    }

    return { limits: limits, violations: violations };
  }

  // ── Draw the SPC chart into the given container ────────────────────
  function drawChart(container, data, result, layout) {
    var chartType = layout.chartType || 'xmr';
    var improvementDirection = layout.improvementDirection || 'high';
    var targetValue = (layout.targetValue !== null && layout.targetValue !== undefined && layout.targetValue !== '')
      ? Number(layout.targetValue) : null;
    var showControlLimits = layout.showControlLimits !== false;
    var showWarningLimits = !!layout.showWarningLimits;
    var showCenterLine = layout.showCenterLine !== false;
    var showTargetLine = !!layout.showTargetLine;
    var title = layout.chartTitle || DEFAULT_TITLES[chartType] || 'SPC Chart';

    var limits = result.limits;
    var violations = result.violations;

    // Determine point colours
    var uclForColor = limits.uclArray || limits.meanArray;
    var lclForColor = limits.lclArray || limits.meanArray;
    var pointColors = spc.determinePointColors(
      data.values, limits.meanArray, uclForColor, lclForColor,
      violations, improvementDirection, targetValue);

    // Chart dimensions
    var rect = container.getBoundingClientRect();
    var width  = rect.width  || 600;
    var height = rect.height || 400;
    var margin = { top: 48, right: 24, bottom: 56, left: 64 };
    var cw = width  - margin.left - margin.right;
    var ch = height - margin.top  - margin.bottom;

    // Y-domain
    var allY = data.values.slice();
    if (limits.uclArray) { for (var i = 0; i < limits.uclArray.length; i++) allY.push(limits.uclArray[i]); }
    if (limits.lclArray) { for (var i = 0; i < limits.lclArray.length; i++) allY.push(limits.lclArray[i]); }
    if (targetValue !== null) allY.push(targetValue);
    var yMin = Math.min.apply(null, allY);
    var yMax = Math.max.apply(null, allY);
    var yPad = (yMax - yMin) * 0.08 || 1;
    yMin -= yPad;
    yMax += yPad;

    var xScale = linearScale([0, data.values.length - 1], [0, cw]);
    var yScale = linearScale([yMin, yMax], [ch, 0]);

    // Build SVG
    var svg = svgEl('svg', { width: width, height: height });
    svg.style.backgroundColor = 'white';

    // Chart group
    var g = svgEl('g', { transform: 'translate(' + margin.left + ',' + margin.top + ')' });
    svg.appendChild(g);

    // ── Axes ──────────────────────────────────────────────────────────
    // Y-axis ticks
    var yTicks = niceTicks(yMin, yMax, 5);
    for (var i = 0; i < yTicks.length; i++) {
      var yy = yScale(yTicks[i]);
      g.appendChild(svgEl('line', { x1: 0, y1: yy, x2: cw, y2: yy, stroke: '#e0e0e0', 'stroke-width': '0.5' }));
      var label = svgEl('text', { x: -8, y: yy + 4, 'text-anchor': 'end', 'font-size': '11', fill: '#555', 'font-family': 'Arial, sans-serif' });
      label.textContent = spc.formatNumber(yTicks[i], 2);
      g.appendChild(label);
    }
    g.appendChild(svgEl('line', { x1: 0, y1: 0, x2: 0, y2: ch, stroke: '#333', 'stroke-width': '1' }));
    g.appendChild(svgEl('line', { x1: 0, y1: ch, x2: cw, y2: ch, stroke: '#333', 'stroke-width': '1' }));

    // X-axis labels (skip some if too many)
    var labelStep = Math.max(1, Math.ceil(data.labels.length / 12));
    for (var i = 0; i < data.labels.length; i += labelStep) {
      var xx = xScale(i);
      var tick = svgEl('line', { x1: xx, y1: ch, x2: xx, y2: ch + 5, stroke: '#333', 'stroke-width': '1' });
      g.appendChild(tick);
      var txt = svgEl('text', { x: xx, y: ch + 18, 'text-anchor': 'middle', 'font-size': '10', fill: '#555', 'font-family': 'Arial, sans-serif' });
      txt.textContent = data.labels[i];
      g.appendChild(txt);
    }

    // ── Reference lines ──────────────────────────────────────────────
    function drawHLine(yVal, color, dash) {
      var line = svgEl('line', { x1: xScale(0), y1: yScale(yVal), x2: xScale(data.values.length - 1), y2: yScale(yVal), stroke: color, 'stroke-width': dash === '-' ? '2' : '1' });
      if (dash === '--') line.setAttribute('stroke-dasharray', '5,5');
      if (dash === '.') line.setAttribute('stroke-dasharray', '2,2');
      g.appendChild(line);
    }

    function drawVarLine(arr, color, dash) {
      if (!arr || arr.length < 2) return;
      var d = 'M ' + xScale(0) + ' ' + yScale(arr[0]);
      for (var i = 1; i < arr.length; i++) {
        d += ' L ' + xScale(i) + ' ' + yScale(arr[i]);
      }
      var path = svgEl('path', { d: d, stroke: color, 'stroke-width': dash === '-' ? '2' : '1', fill: 'none' });
      if (dash === '--') path.setAttribute('stroke-dasharray', '5,5');
      if (dash === '.') path.setAttribute('stroke-dasharray', '2,2');
      g.appendChild(path);
    }

    // Control & warning limits
    if (chartType !== 'run') {
      if (showControlLimits && limits.uclArray) {
        var isConstant = limits.uclArray.every(function (v) { return v === limits.uclArray[0]; });
        if (isConstant) {
          drawHLine(limits.uclArray[0], spc.NHS_COLORS.DARK_BLUE, '--');
          drawHLine(limits.lclArray[0], spc.NHS_COLORS.DARK_BLUE, '--');
        } else {
          drawVarLine(limits.uclArray, spc.NHS_COLORS.DARK_BLUE, '--');
          drawVarLine(limits.lclArray, spc.NHS_COLORS.DARK_BLUE, '--');
        }
      }
      if (showWarningLimits && limits.uwlArray) {
        var isConstantW = limits.uwlArray.every(function (v) { return v === limits.uwlArray[0]; });
        if (isConstantW) {
          drawHLine(limits.uwlArray[0], spc.NHS_COLORS.DARK_BLUE, '.');
          drawHLine(limits.lwlArray[0], spc.NHS_COLORS.DARK_BLUE, '.');
        } else {
          drawVarLine(limits.uwlArray, spc.NHS_COLORS.DARK_BLUE, '.');
          drawVarLine(limits.lwlArray, spc.NHS_COLORS.DARK_BLUE, '.');
        }
      }
    }

    // Centre line
    if (showCenterLine) {
      var isConstantM = limits.meanArray.every(function (v) { return v === limits.meanArray[0]; });
      if (isConstantM) {
        drawHLine(limits.meanArray[0], spc.NHS_COLORS.BLUE, '-');
      } else {
        drawVarLine(limits.meanArray, spc.NHS_COLORS.BLUE, '-');
      }
    }

    // Target line
    if (showTargetLine && targetValue !== null) {
      drawHLine(targetValue, spc.NHS_COLORS.WARM_YELLOW, '--');
    }

    // ── Connecting line ──────────────────────────────────────────────
    if (data.values.length > 1) {
      var pathD = 'M ' + xScale(0) + ' ' + yScale(data.values[0]);
      for (var i = 1; i < data.values.length; i++) {
        pathD += ' L ' + xScale(i) + ' ' + yScale(data.values[i]);
      }
      g.appendChild(svgEl('path', { d: pathD, stroke: '#cccccc', 'stroke-width': '1', fill: 'none', opacity: '0.7' }));
    }

    // ── Data points ──────────────────────────────────────────────────
    for (var i = 0; i < data.values.length; i++) {
      var cx = xScale(i);
      var cy = yScale(data.values[i]);
      var circle = svgEl('circle', {
        cx: cx, cy: cy, r: '4',
        fill: pointColors[i],
        stroke: 'white',
        'stroke-width': '1',
        'class': 'data-point'
      });
      circle.setAttribute('data-index', i);
      var titleEl = svgEl('title');
      titleEl.textContent = data.labels[i] + ': ' + spc.formatNumber(data.values[i], 2);
      circle.appendChild(titleEl);
      g.appendChild(circle);
    }

    // ── Title ────────────────────────────────────────────────────────
    var titleText = svgEl('text', { x: width / 2, y: 24, 'text-anchor': 'middle', 'font-family': 'Arial, sans-serif', 'font-size': '15', 'font-weight': 'bold', fill: '#333' });
    titleText.textContent = title;
    svg.appendChild(titleText);

    // ── Legend ────────────────────────────────────────────────────────
    var legendG = svgEl('g', { transform: 'translate(' + (margin.left + cw - 160) + ',' + (margin.top + 8) + ')' });
    var items = [
      { color: spc.POINT_COLORS.COMMON_CAUSE, label: 'Common Cause' },
      { color: spc.POINT_COLORS.IMPROVEMENT, label: 'Improvement' },
      { color: spc.POINT_COLORS.CONCERN, label: 'Concern' }
    ];
    for (var i = 0; i < items.length; i++) {
      var ly = i * 18;
      legendG.appendChild(svgEl('circle', { cx: 6, cy: ly + 6, r: 4, fill: items[i].color }));
      var lt = svgEl('text', { x: 16, y: ly + 10, 'font-family': 'Arial, sans-serif', 'font-size': '11', fill: '#333' });
      lt.textContent = items[i].label;
      legendG.appendChild(lt);
    }
    svg.appendChild(legendG);

    // ── Statistics footer ────────────────────────────────────────────
    var stats = limits.statistics;
    var footerText = '';
    if (chartType === 'run') {
      footerText = 'Median: ' + spc.formatNumber(stats.median, 2);
    } else if (chartType === 'xmr') {
      footerText = 'Mean: ' + spc.formatNumber(stats.mean, 2) + ' | UCL: ' + spc.formatNumber(stats.ucl, 2) + ' | LCL: ' + spc.formatNumber(stats.lcl, 2);
    } else if (chartType === 'p') {
      footerText = 'Mean Proportion: ' + spc.formatNumber(stats.meanProportion, 4);
    } else if (chartType === 'u') {
      footerText = 'Mean Rate: ' + spc.formatNumber(stats.meanRate, 4);
    } else if (chartType === 'c') {
      footerText = 'Mean Count: ' + spc.formatNumber(stats.meanCount, 2) + ' | UCL: ' + spc.formatNumber(stats.ucl, 2) + ' | LCL: ' + spc.formatNumber(stats.lcl, 2);
    }
    var footer = svgEl('text', { x: margin.left + 4, y: height - 6, 'font-family': 'Arial, sans-serif', 'font-size': '11', fill: '#666' });
    footer.textContent = footerText;
    svg.appendChild(footer);

    // Replace contents
    container.innerHTML = '';
    container.appendChild(svg);
  }

  // ══════════════════════════════════════════════════════════════════════
  // Qlik Sense Extension entry point
  // ══════════════════════════════════════════════════════════════════════
  return {
    definition: definition,
    initialProperties: initialProperties,

    paint: function ($element, layout) {
      var container = $element[0];

      // Validate hypercube
      var hc = layout.qHyperCube;
      if (!hc || !hc.qDataPages || !hc.qDataPages.length || !hc.qDataPages[0].qMatrix || !hc.qDataPages[0].qMatrix.length) {
        container.innerHTML = '<div class="abspc-spc-chart-error">Add a date dimension and a value measure to display an SPC chart.</div>';
        return qlik.Promise.resolve();
      }

      try {
        var data = extractData(layout);
        if (data.values.length === 0) {
          container.innerHTML = '<div class="abspc-spc-chart-error">No valid data to display.</div>';
          return qlik.Promise.resolve();
        }

        var chartType = layout.chartType || 'xmr';
        var result = computeSPC(chartType, data.values, data.subgroups);

        // Wrap in the extension CSS class
        container.className = (container.className || '').replace(/abspc-spc-chart/g, '').trim();
        container.className += ' abspc-spc-chart';

        drawChart(container, data, result, layout);
      } catch (err) {
        container.innerHTML = '<div class="abspc-spc-chart-error error">Error: ' + (err.message || err) + '</div>';
      }

      return qlik.Promise.resolve();
    }
  };
});
