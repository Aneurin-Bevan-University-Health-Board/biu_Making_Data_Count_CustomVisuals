/**
 * NHS Making Data Count - XmR Chart
 * Standalone Looker Core Custom Visualization
 * 
 * Upload this single file to Looker Admin > Visualizations
 * 
 * DATA REQUIREMENTS:
 *   - Dimension: A date/time field (x-axis)
 *   - Measure: A numeric value (the measurement to chart)
 *   That's it! Control limits, special causes, and colors are calculated automatically.
 */
(function() {
  // ──────────────────────────── NHS COLOURS ────────────────────────────
  var NHS_BLUE       = '#005EB8';
  var NHS_DARK_BLUE  = '#003087';
  var NHS_ORANGE     = '#ED8B00';
  var NHS_GREY       = '#768692';
  var NHS_WARM_YELLOW= '#FFB81C';

  var COLOUR_COMMON  = NHS_GREY;
  var COLOUR_IMPROVE = NHS_BLUE;
  var COLOUR_CONCERN = NHS_ORANGE;

  // ──────────────────────────── SPC MATHS ──────────────────────────────
  var D2 = 1.128; // constant for moving range of 2

  function mean(arr) {
    if (!arr.length) return 0;
    var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  function movingRange(vals) {
    var mr = [];
    for (var i = 1; i < vals.length; i++) mr.push(Math.abs(vals[i] - vals[i-1]));
    return mr;
  }

  // Rule 1 – Astronomical point (outside 3-sigma)
  function rule1(vals, ucl, lcl) {
    return vals.map(function(v,i){ return v > ucl[i] || v < lcl[i]; });
  }

  // Rule 2 – Shift (7+ on same side of centre)
  function rule2(vals, centre, run) {
    run = run || 7;
    var flags = new Array(vals.length);
    for (var i = 0; i < flags.length; i++) flags[i] = false;
    for (var i = 0; i <= vals.length - run; i++) {
      var above = 0, below = 0;
      for (var j = i; j < i + run; j++) {
        if (vals[j] > centre[j]) above++;
        else if (vals[j] < centre[j]) below++;
      }
      if (above === run || below === run)
        for (var j = i; j < i + run; j++) flags[j] = true;
    }
    return flags;
  }

  // Rule 3 – Trend (7+ ascending or descending)
  function rule3(vals, run) {
    run = run || 7;
    var flags = new Array(vals.length);
    for (var i = 0; i < flags.length; i++) flags[i] = false;
    for (var i = 0; i <= vals.length - run; i++) {
      var up = true, down = true;
      for (var j = i + 1; j < i + run; j++) {
        if (vals[j] <= vals[j-1]) up = false;
        if (vals[j] >= vals[j-1]) down = false;
      }
      if (up || down)
        for (var j = i; j < i + run; j++) flags[j] = true;
    }
    return flags;
  }

  // Rule 4 – Two-in-three in warning zone
  // Rule 4 – Two-in-three: aligned with NHSRplotthedots ptd_two_in_three
  // Only flags points that are themselves in the warning zone, and requires
  // all 3 in the window on the same side of the centre line.
  function rule4(vals, centre, ucl, lcl, uwl, lwl) {
    var n = vals.length;
    var flags = new Array(n);
    for (var i = 0; i < n; i++) flags[i] = false;
    var close = new Array(n);
    var rtm = new Array(n);
    for (var i = 0; i < n; i++) {
      var outside = vals[i] > ucl[i] || vals[i] < lcl[i];
      close[i] = !outside && (vals[i] > uwl[i] || vals[i] < lwl[i]);
      rtm[i] = vals[i] > centre[i] ? 1 : (vals[i] < centre[i] ? -1 : 0);
    }
    for (var i = 0; i < n; i++) {
      if (!close[i]) continue;
      var windows = [i - 2, i - 1, i];
      for (var wi = 0; wi < 3; wi++) {
        var ws = windows[wi], we = ws + 3;
        if (ws < 0 || we > n) continue;
        var cc = 0, rs = 0;
        for (var j = ws; j < we; j++) { if (close[j]) cc++; rs += rtm[j]; }
        if (cc >= 2 && Math.abs(rs) === 3) { flags[i] = true; break; }
      }
    }
    return flags;
  }

  // Point colours: aligned with Python _is_high_signal / _towards_target
  function pointColours(vals, centre, ucl, lcl, r1, sc, direction, target) {
    return vals.map(function(v, i) {
      if (!sc[i]) return COLOUR_COMMON;
      var isHigh = r1[i] ? v > ucl[i] : v > centre[i];
      var isImp;
      if (target !== null && target !== undefined) {
        isImp = Math.abs(v - target) < Math.abs(centre[i] - target);
      } else {
        isImp = direction === 'high' ? isHigh : !isHigh;
      }
      return isImp ? COLOUR_IMPROVE : COLOUR_CONCERN;
    });
  }

  // ──────────────────────────── VARIATION & ASSURANCE ───────────────────
  // Aligned with Python determine_variation_type / determine_assurance_type

  function determineVariation(vals, centre, sc, direction) {
    // Find the most recent special-cause point
    var lastSC = -1;
    for (var i = vals.length - 1; i >= 0; i--) { if (sc[i]) { lastSC = i; break; } }
    if (lastSC === -1) return 'common_cause';
    var isHigh = vals[lastSC] > centre[lastSC];
    if (direction === 'high') return isHigh ? 'improvement_high' : 'concern_low';
    return isHigh ? 'concern_high' : 'improvement_low';
  }

  function determineAssurance(target, ucl, lcl, direction) {
    if (target === null || target === undefined) return 'no_target';
    // Use last values of UCL/LCL (most recent phase)
    var u = ucl[ucl.length - 1], l = lcl[lcl.length - 1];
    if (direction === 'high') {
      if (target <= l) return 'pass';
      if (target >= u) return 'fail';
      return 'hit_or_miss';
    } else {
      if (target >= u) return 'pass';
      if (target <= l) return 'fail';
      return 'hit_or_miss';
    }
  }

  // SVG icons rendered inline (no image files needed)
  function drawVariationIcon(svg, ns, x, y, type) {
    var g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', 'translate(' + x + ',' + y + ')');
    var map = {
      'improvement_high': { arrow: 'up',   colour: '#005EB8', label: 'Improvement ▲' },
      'improvement_low':  { arrow: 'down', colour: '#005EB8', label: 'Improvement ▼' },
      'concern_high':     { arrow: 'up',   colour: '#ED8B00', label: 'Concern ▲' },
      'concern_low':      { arrow: 'down', colour: '#ED8B00', label: 'Concern ▼' },
      'common_cause':     { arrow: 'none', colour: '#768692', label: 'Common Cause' }
    };
    var m = map[type] || map['common_cause'];

    // Icon background circle
    var bg = document.createElementNS(ns, 'circle');
    bg.setAttribute('cx', '10'); bg.setAttribute('cy', '10'); bg.setAttribute('r', '10');
    bg.setAttribute('fill', m.colour); bg.setAttribute('opacity', '0.15');
    g.appendChild(bg);

    // Arrow or dash
    if (m.arrow === 'up') {
      var p = document.createElementNS(ns, 'polygon');
      p.setAttribute('points', '10,3 16,14 4,14');
      p.setAttribute('fill', m.colour);
      g.appendChild(p);
    } else if (m.arrow === 'down') {
      var p = document.createElementNS(ns, 'polygon');
      p.setAttribute('points', '10,17 16,6 4,6');
      p.setAttribute('fill', m.colour);
      g.appendChild(p);
    } else {
      var r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', '4'); r.setAttribute('y', '8');
      r.setAttribute('width', '12'); r.setAttribute('height', '4');
      r.setAttribute('rx', '2'); r.setAttribute('fill', m.colour);
      g.appendChild(r);
    }

    // Label text
    var t = document.createElementNS(ns, 'text');
    t.setAttribute('x', '24'); t.setAttribute('y', '14');
    t.setAttribute('font-size', '10'); t.setAttribute('fill', m.colour);
    t.setAttribute('font-weight', 'bold');
    t.textContent = m.label;
    g.appendChild(t);

    svg.appendChild(g);
  }

  function drawAssuranceIcon(svg, ns, x, y, type) {
    var g = document.createElementNS(ns, 'g');
    g.setAttribute('transform', 'translate(' + x + ',' + y + ')');
    var map = {
      'pass':        { symbol: '✓', colour: '#005EB8', label: 'Will meet target' },
      'hit_or_miss': { symbol: '?', colour: '#ED8B00', label: 'May meet target' },
      'fail':        { symbol: '✗', colour: '#DA291C', label: 'Won\'t meet target' },
      'no_target':   { symbol: '–', colour: '#768692', label: 'No target set' }
    };
    var m = map[type] || map['no_target'];

    var bg = document.createElementNS(ns, 'circle');
    bg.setAttribute('cx', '10'); bg.setAttribute('cy', '10'); bg.setAttribute('r', '10');
    bg.setAttribute('fill', m.colour); bg.setAttribute('opacity', '0.15');
    g.appendChild(bg);

    var s = document.createElementNS(ns, 'text');
    s.setAttribute('x', '10'); s.setAttribute('y', '15');
    s.setAttribute('text-anchor', 'middle'); s.setAttribute('font-size', '14');
    s.setAttribute('font-weight', 'bold'); s.setAttribute('fill', m.colour);
    s.textContent = m.symbol;
    g.appendChild(s);

    var t = document.createElementNS(ns, 'text');
    t.setAttribute('x', '24'); t.setAttribute('y', '14');
    t.setAttribute('font-size', '10'); t.setAttribute('fill', m.colour);
    t.textContent = m.label;
    g.appendChild(t);

    svg.appendChild(g);
  }

  // ──────────────────────────── LOOKER VIS ─────────────────────────────
  var vis = {
    id: 'nhs_mdc_xmr_chart',
    label: 'NHS MDC XmR Chart',
    options: {
      chart_title:   { type: 'string',  label: 'Chart Title', default: 'XmR Chart', section: 'Chart', order: 1 },
      improvement_direction: {
        type: 'string', label: 'Improvement Direction', display: 'select',
        values: [{'Higher is better':'high'},{'Lower is better':'low'}],
        default: 'high', section: 'Analysis', order: 1
      },
      target_value:       { type: 'number',  label: 'Target Value (optional)',  section: 'Analysis', order: 2 },
      show_target_line:   { type: 'boolean', label: 'Show Target Line',        default: false, section: 'Display', order: 1 },
      show_control_limits:{ type: 'boolean', label: 'Show Control Limits',     default: true,  section: 'Display', order: 2 },
      show_center_line:   { type: 'boolean', label: 'Show Centre Line (Mean)', default: true,  section: 'Display', order: 3 },
      show_icons:         { type: 'boolean', label: 'Show Variation & Assurance Icons', default: true, section: 'Display', order: 4 }
    },

    create: function(element, config) {
      element.innerHTML = '';
      var style = document.createElement('style');
      style.textContent = '.nhs-mdc-tooltip{position:absolute;padding:6px 10px;background:#333;color:#fff;border-radius:4px;font:12px Arial,sans-serif;pointer-events:none;z-index:100;white-space:nowrap}';
      element.appendChild(style);
      this._container = element.appendChild(document.createElement('div'));
      this._container.style.cssText = 'width:100%;height:100%;position:relative;overflow:hidden';
    },

    updateAsync: function(data, element, config, queryResponse, details, done) {
      this._container.innerHTML = '';
      if (!data || !data.length) { done(); return; }

      // ── Extract fields from Looker query ──
      var dims = queryResponse.fields.dimension_like;
      var meas = queryResponse.fields.measure_like;
      if (!meas.length) { this._container.textContent = 'Add a measure'; done(); return; }

      var dimField = dims.length ? dims[0].name : null;
      var valField = meas[0].name;

      var labels = [], vals = [];
      for (var i = 0; i < data.length; i++) {
        labels.push(dimField ? (data[i][dimField].rendered || data[i][dimField].value) : (i + 1));
        var v = data[i][valField].value;
        if (v === null || v === undefined) continue;
        vals.push(Number(v));
      }
      if (vals.length < 2) { this._container.textContent = 'Need ≥ 2 data points'; done(); return; }

      // ── Calculate limits ──
      var mr   = movingRange(vals);
      var xBar = mean(vals);
      var mrBar= mean(mr);
      var sigma= mrBar / D2;

      var uclVal = xBar + 3 * sigma;
      var lclVal = xBar - 3 * sigma;
      var uwlVal = xBar + 2 * sigma;
      var lwlVal = xBar - 2 * sigma;

      var n = vals.length;
      var centreArr = [], uclArr = [], lclArr = [], uwlArr = [], lwlArr = [];
      for (var i = 0; i < n; i++) {
        centreArr.push(xBar); uclArr.push(uclVal); lclArr.push(lclVal);
        uwlArr.push(uwlVal); lwlArr.push(lwlVal);
      }

      // ── Detect special causes ──
      var r1 = rule1(vals, uclArr, lclArr);
      var r2 = rule2(vals, centreArr, 7);
      var r3 = rule3(vals, 7);
      var r4 = rule4(vals, centreArr, uclArr, lclArr, uwlArr, lwlArr);
      var sc = vals.map(function(_,i){ return r1[i]||r2[i]||r3[i]||r4[i]; });

      var direction = config.improvement_direction || 'high';
      var target    = config.target_value != null ? Number(config.target_value) : null;
      var colours   = pointColours(vals, centreArr, uclArr, lclArr, r1, sc, direction, target);

      // ── Build SVG ──
      var rect = this._container.getBoundingClientRect();
      var W = rect.width, H = rect.height;
      var margin = {t:50, r:30, b:60, l:65};
      var w = W - margin.l - margin.r, h = H - margin.t - margin.b;
      if (w < 40 || h < 40) { done(); return; }

      var allY = vals.concat([uclVal, lclVal]);
      if (target !== null) allY.push(target);
      var yMin = Math.min.apply(null, allY), yMax = Math.max.apply(null, allY);
      var pad = (yMax - yMin) * 0.08 || 1;
      yMin -= pad; yMax += pad;

      function sx(i) { return margin.l + (i / (n - 1)) * w; }
      function sy(v) { return margin.t + (1 - (v - yMin) / (yMax - yMin)) * h; }

      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      svg.style.fontFamily = 'Arial, sans-serif';

      // Title
      var title = document.createElementNS(ns, 'text');
      title.setAttribute('x', W/2); title.setAttribute('y', 28);
      title.setAttribute('text-anchor','middle');
      title.setAttribute('font-size','15'); title.setAttribute('font-weight','bold');
      title.setAttribute('fill','#333');
      title.textContent = config.chart_title || 'XmR Chart';
      svg.appendChild(title);

      // Helper: line
      function addLine(x1,y1,x2,y2,col,sw,dash) {
        var l = document.createElementNS(ns,'line');
        l.setAttribute('x1',x1); l.setAttribute('y1',y1);
        l.setAttribute('x2',x2); l.setAttribute('y2',y2);
        l.setAttribute('stroke',col); l.setAttribute('stroke-width',sw);
        if (dash) l.setAttribute('stroke-dasharray',dash);
        svg.appendChild(l);
      }

      // Control limits
      if (config.show_control_limits !== false) {
        addLine(margin.l, sy(uclVal), margin.l+w, sy(uclVal), NHS_DARK_BLUE, 1, '6,4');
        addLine(margin.l, sy(lclVal), margin.l+w, sy(lclVal), NHS_DARK_BLUE, 1, '6,4');
      }
      // Centre line
      if (config.show_center_line !== false) {
        addLine(margin.l, sy(xBar), margin.l+w, sy(xBar), NHS_BLUE, 2, null);
      }
      // Target line
      if (config.show_target_line && target !== null) {
        addLine(margin.l, sy(target), margin.l+w, sy(target), NHS_WARM_YELLOW, 1.5, '4,4');
      }

      // Data line
      var pts = [];
      for (var i = 0; i < n; i++) pts.push(sx(i)+','+sy(vals[i]));
      var polyline = document.createElementNS(ns,'polyline');
      polyline.setAttribute('points', pts.join(' '));
      polyline.setAttribute('fill','none');
      polyline.setAttribute('stroke','#bbb');
      polyline.setAttribute('stroke-width','1.2');
      svg.appendChild(polyline);

      // Data points
      for (var i = 0; i < n; i++) {
        var c = document.createElementNS(ns,'circle');
        c.setAttribute('cx', sx(i)); c.setAttribute('cy', sy(vals[i]));
        c.setAttribute('r', '5'); c.setAttribute('fill', colours[i]);
        c.setAttribute('stroke','#fff'); c.setAttribute('stroke-width','1.5');
        c.setAttribute('data-idx', i);
        c.style.cursor = 'pointer';
        svg.appendChild(c);
      }

      // Axes
      addLine(margin.l, margin.t, margin.l, margin.t+h, '#666', 1, null);
      addLine(margin.l, margin.t+h, margin.l+w, margin.t+h, '#666', 1, null);

      // Y tick labels
      var yTicks = 5;
      for (var t = 0; t <= yTicks; t++) {
        var yv = yMin + (yMax-yMin) * (t/yTicks);
        var yt = document.createElementNS(ns,'text');
        yt.setAttribute('x', margin.l - 8); yt.setAttribute('y', sy(yv)+4);
        yt.setAttribute('text-anchor','end'); yt.setAttribute('font-size','11'); yt.setAttribute('fill','#555');
        yt.textContent = yv.toFixed(1);
        svg.appendChild(yt);
        addLine(margin.l-3, sy(yv), margin.l, sy(yv), '#999', 0.5, null);
      }

      // X tick labels (show up to ~12 labels)
      var step = Math.max(1, Math.ceil(n / 12));
      for (var i = 0; i < n; i += step) {
        var xt = document.createElementNS(ns,'text');
        xt.setAttribute('x', sx(i)); xt.setAttribute('y', margin.t+h+18);
        xt.setAttribute('text-anchor','middle'); xt.setAttribute('font-size','10'); xt.setAttribute('fill','#555');
        xt.setAttribute('transform','rotate(45 '+sx(i)+' '+(margin.t+h+18)+')');
        var lbl = String(labels[i]);
        if (lbl.length > 10) lbl = lbl.substring(0,10);
        xt.textContent = lbl;
        svg.appendChild(xt);
      }

      // Legend
      var legend = [
        {c: COLOUR_COMMON, t:'Common Cause'},
        {c: COLOUR_IMPROVE, t:'Improvement'},
        {c: COLOUR_CONCERN, t:'Concern'}
      ];
      for (var li = 0; li < legend.length; li++) {
        var lx = margin.l + w - 130, ly = margin.t + 8 + li*18;
        var lc = document.createElementNS(ns,'circle');
        lc.setAttribute('cx',lx); lc.setAttribute('cy',ly);
        lc.setAttribute('r','4'); lc.setAttribute('fill',legend[li].c);
        svg.appendChild(lc);
        var lt = document.createElementNS(ns,'text');
        lt.setAttribute('x',lx+10); lt.setAttribute('y',ly+4);
        lt.setAttribute('font-size','11'); lt.setAttribute('fill','#555');
        lt.textContent = legend[li].t;
        svg.appendChild(lt);
      }

      // Info bar
      var info = document.createElementNS(ns,'text');
      info.setAttribute('x', margin.l+4); info.setAttribute('y', H-6);
      info.setAttribute('font-size','10'); info.setAttribute('fill','#888');
      info.textContent = 'Mean: '+xBar.toFixed(2)+' | UCL: '+uclVal.toFixed(2)+' | LCL: '+lclVal.toFixed(2);
      svg.appendChild(info);

      // Variation & Assurance icons
      if (config.show_icons !== false) {
        var variation = determineVariation(vals, centreArr, sc, direction);
        var assurance = determineAssurance(target, uclArr, lclArr, direction);
        drawVariationIcon(svg, ns, margin.l + 4, margin.t + 6, variation);
        drawAssuranceIcon(svg, ns, margin.l + 4, margin.t + 28, assurance);
      }

      this._container.appendChild(svg);

      // Tooltip on hover
      var tooltip = document.createElement('div');
      tooltip.className = 'nhs-mdc-tooltip';
      tooltip.style.display = 'none';
      this._container.appendChild(tooltip);

      svg.addEventListener('mouseover', function(e) {
        var idx = e.target.getAttribute('data-idx');
        if (idx === null) return;
        idx = Number(idx);
        var parts = [];
        parts.push(labels[idx]);
        parts.push('Value: ' + vals[idx].toFixed(2));
        if (r1[idx]) parts.push('⚠ Astronomical');
        if (r2[idx]) parts.push('⚠ Shift');
        if (r3[idx]) parts.push('⚠ Trend');
        if (r4[idx]) parts.push('⚠ 2-in-3');
        tooltip.innerHTML = parts.join('<br>');
        tooltip.style.display = 'block';
      });
      svg.addEventListener('mousemove', function(e) {
        var r = element.getBoundingClientRect();
        tooltip.style.left = (e.clientX - r.left + 12) + 'px';
        tooltip.style.top  = (e.clientY - r.top  - 10) + 'px';
      });
      svg.addEventListener('mouseout', function(e) {
        if (e.target.getAttribute('data-idx') !== null) tooltip.style.display = 'none';
      });

      done();
    }
  };

  looker.plugins.visualizations.add(vis);
})();