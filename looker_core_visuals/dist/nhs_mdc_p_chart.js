/**
 * NHS Making Data Count - p Chart (Proportions)
 * Standalone Looker Core Custom Visualization
 * 
 * Upload this single file to Looker Admin > Visualizations
 * 
 * DATA REQUIREMENTS:
 *   - Dimension: A date/time field (x-axis)
 *   - Measure 1: A numeric proportion/percentage value
 *   - Measure 2 (optional): Subgroup/denominator size
 *   If no subgroup column is provided, a default of 100 is used.
 */
(function() {
  var NHS_BLUE       = '#005EB8';
  var NHS_DARK_BLUE  = '#003087';
  var NHS_ORANGE     = '#ED8B00';
  var NHS_GREY       = '#768692';
  var NHS_WARM_YELLOW= '#FFB81C';
  var COLOUR_COMMON  = NHS_GREY;
  var COLOUR_IMPROVE = NHS_BLUE;
  var COLOUR_CONCERN = NHS_ORANGE;

  function mean(arr) {
    if (!arr.length) return 0;
    var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i]; return s / arr.length;
  }

  function rule1(vals, ucl, lcl) {
    return vals.map(function(v,i){ return v > ucl[i] || v < lcl[i]; });
  }
  function rule2(vals, centre, run) {
    run = run || 7;
    var f = new Array(vals.length); for(var i=0;i<f.length;i++) f[i]=false;
    for(var i=0;i<=vals.length-run;i++){
      var a=0,b=0;
      for(var j=i;j<i+run;j++){ if(vals[j]>centre[j])a++; else if(vals[j]<centre[j])b++; }
      if(a===run||b===run) for(var j=i;j<i+run;j++) f[j]=true;
    } return f;
  }
  function rule3(vals, run) {
    run = run || 7;
    var f = new Array(vals.length); for(var i=0;i<f.length;i++) f[i]=false;
    for(var i=0;i<=vals.length-run;i++){
      var u=true,d=true;
      for(var j=i+1;j<i+run;j++){ if(vals[j]<=vals[j-1])u=false; if(vals[j]>=vals[j-1])d=false; }
      if(u||d) for(var j=i;j<i+run;j++) f[j]=true;
    } return f;
  }
  function rule4(vals,centre,ucl,lcl,uwl,lwl){
    var f=new Array(vals.length);for(var i=0;i<f.length;i++)f[i]=false;
    for(var i=0;i<=vals.length-3;i++){
      var uC=0,lC=0;
      for(var j=i;j<i+3;j++){
        if(vals[j]>uwl[j]&&vals[j]<=ucl[j]&&vals[j]>centre[j])uC++;
        if(vals[j]<lwl[j]&&vals[j]>=lcl[j]&&vals[j]<centre[j])lC++;
      }
      if(uC>=2||lC>=2)for(var j=i;j<i+3;j++)f[j]=true;
    } return f;
  }

  function pointColours(vals,centre,sc,dir,target){
    return vals.map(function(v,i){
      if(!sc[i])return COLOUR_COMMON;
      var imp;
      if(target!==null&&target!==undefined){imp=dir==='high'?v>=target:v<=target;}
      else{imp=dir==='high'?v>centre[i]:v<centre[i];}
      return imp?COLOUR_IMPROVE:COLOUR_CONCERN;
    });
  }

  var vis = {
    id: 'nhs_mdc_p_chart',
    label: 'NHS MDC p Chart',
    options: {
      chart_title: { type:'string', label:'Chart Title', default:'p Chart – Proportions', section:'Chart', order:1 },
      improvement_direction: {
        type:'string', label:'Improvement Direction', display:'select',
        values:[{'Higher is better':'high'},{'Lower is better':'low'}],
        default:'low', section:'Analysis', order:1
      },
      target_value:       { type:'number',  label:'Target Value (optional)',  section:'Analysis', order:2 },
      show_target_line:   { type:'boolean', label:'Show Target Line',        default:false, section:'Display', order:1 },
      show_control_limits:{ type:'boolean', label:'Show Control Limits',     default:true,  section:'Display', order:2 },
      show_center_line:   { type:'boolean', label:'Show Centre Line',        default:true,  section:'Display', order:3 },
      display_as_percentage:{ type:'boolean', label:'Display as Percentage', default:false, section:'Display', order:4 },
      default_subgroup_size:{ type:'number', label:'Default Subgroup Size',  default:100,   section:'Advanced', order:1 }
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

      var dims = queryResponse.fields.dimension_like;
      var meas = queryResponse.fields.measure_like;
      if (!meas.length) { this._container.textContent = 'Add a measure (proportion)'; done(); return; }

      var dimField = dims.length ? dims[0].name : null;
      var valField = meas[0].name;
      var subField = meas.length > 1 ? meas[1].name : null;
      var defSub   = config.default_subgroup_size || 100;
      var isPct    = config.display_as_percentage || false;

      var labels = [], props = [], subs = [];
      for (var i = 0; i < data.length; i++) {
        labels.push(dimField ? (data[i][dimField].rendered || data[i][dimField].value) : (i+1));
        var v = Number(data[i][valField].value);
        if (isNaN(v)) continue;
        props.push(v);
        subs.push(subField ? Number(data[i][subField].value) || defSub : defSub);
      }
      var n = props.length;
      if (n < 2) { this._container.textContent = 'Need ≥ 2 data points'; done(); return; }

      // Calculate overall p-bar
      var totalNum = 0, totalDen = 0;
      for (var i = 0; i < n; i++) { totalNum += props[i] * subs[i]; totalDen += subs[i]; }
      var pBar = totalDen > 0 ? totalNum / totalDen : 0;

      var centreArr=[], uclArr=[], lclArr=[], uwlArr=[], lwlArr=[];
      for (var i = 0; i < n; i++) {
        var se = Math.sqrt(pBar * (1 - pBar) / subs[i]);
        centreArr.push(pBar);
        uclArr.push(Math.min(pBar + 3*se, 1));
        lclArr.push(Math.max(pBar - 3*se, 0));
        uwlArr.push(Math.min(pBar + 2*se, 1));
        lwlArr.push(Math.max(pBar - 2*se, 0));
      }

      var r1 = rule1(props, uclArr, lclArr);
      var r2 = rule2(props, centreArr, 7);
      var r3 = rule3(props, 7);
      var r4 = rule4(props, centreArr, uclArr, lclArr, uwlArr, lwlArr);
      var sc = props.map(function(_,i){ return r1[i]||r2[i]||r3[i]||r4[i]; });

      var dir    = config.improvement_direction || 'low';
      var target = config.target_value != null ? Number(config.target_value) : null;
      var colours= pointColours(props, centreArr, sc, dir, target);

      // Optionally scale for display
      var mult = isPct ? 100 : 1;
      var dispVals = props.map(function(v){return v*mult;});
      var dispCentre = centreArr.map(function(v){return v*mult;});
      var dispUCL = uclArr.map(function(v){return v*mult;});
      var dispLCL = lclArr.map(function(v){return v*mult;});
      var dispTarget = target !== null ? target*mult : null;

      // ── SVG ──
      var rect = this._container.getBoundingClientRect();
      var W = rect.width, H = rect.height;
      var margin = {t:50,r:30,b:60,l:65};
      var w = W-margin.l-margin.r, h = H-margin.t-margin.b;
      if (w < 40 || h < 40) { done(); return; }

      var allY = dispVals.concat(dispUCL).concat(dispLCL);
      if (dispTarget !== null) allY.push(dispTarget);
      var yMin = Math.min.apply(null,allY), yMax = Math.max.apply(null,allY);
      var pad = (yMax-yMin)*0.08||0.01; yMin-=pad; yMax+=pad;

      function sx(i){return margin.l+(i/(n-1))*w;}
      function sy(v){return margin.t+(1-(v-yMin)/(yMax-yMin))*h;}

      var ns='http://www.w3.org/2000/svg';
      var svg=document.createElementNS(ns,'svg');
      svg.setAttribute('width',W); svg.setAttribute('height',H);
      svg.style.fontFamily='Arial, sans-serif';

      // Title
      var title=document.createElementNS(ns,'text');
      title.setAttribute('x',W/2); title.setAttribute('y',28);
      title.setAttribute('text-anchor','middle'); title.setAttribute('font-size','15');
      title.setAttribute('font-weight','bold'); title.setAttribute('fill','#333');
      title.textContent = config.chart_title || 'p Chart – Proportions';
      svg.appendChild(title);

      function addLine(x1,y1,x2,y2,col,sw,dash){
        var l=document.createElementNS(ns,'line');
        l.setAttribute('x1',x1);l.setAttribute('y1',y1);l.setAttribute('x2',x2);l.setAttribute('y2',y2);
        l.setAttribute('stroke',col);l.setAttribute('stroke-width',sw);
        if(dash)l.setAttribute('stroke-dasharray',dash);
        svg.appendChild(l);
      }
      function addPath(points,col,sw,dash){
        var d='M '+points[0]; for(var i=1;i<points.length;i++) d+=' L '+points[i];
        var p=document.createElementNS(ns,'path');
        p.setAttribute('d',d); p.setAttribute('stroke',col); p.setAttribute('stroke-width',sw);
        p.setAttribute('fill','none'); if(dash)p.setAttribute('stroke-dasharray',dash);
        svg.appendChild(p);
      }

      // Variable control limits (curved lines)
      if (config.show_control_limits !== false) {
        var uPts=[],lPts=[];
        for(var i=0;i<n;i++){uPts.push(sx(i)+' '+sy(dispUCL[i]));lPts.push(sx(i)+' '+sy(dispLCL[i]));}
        addPath(uPts,NHS_DARK_BLUE,1,'6,4');
        addPath(lPts,NHS_DARK_BLUE,1,'6,4');
      }
      // Centre line
      if(config.show_center_line!==false){
        addLine(margin.l,sy(dispCentre[0]),margin.l+w,sy(dispCentre[0]),NHS_BLUE,2,null);
      }
      // Target line
      if(config.show_target_line && dispTarget!==null){
        addLine(margin.l,sy(dispTarget),margin.l+w,sy(dispTarget),NHS_WARM_YELLOW,1.5,'4,4');
      }

      // Data line + points
      var pts=[];
      for(var i=0;i<n;i++) pts.push(sx(i)+','+sy(dispVals[i]));
      var poly=document.createElementNS(ns,'polyline');
      poly.setAttribute('points',pts.join(' ')); poly.setAttribute('fill','none');
      poly.setAttribute('stroke','#bbb'); poly.setAttribute('stroke-width','1.2');
      svg.appendChild(poly);

      for(var i=0;i<n;i++){
        var c=document.createElementNS(ns,'circle');
        c.setAttribute('cx',sx(i));c.setAttribute('cy',sy(dispVals[i]));
        c.setAttribute('r','5');c.setAttribute('fill',colours[i]);
        c.setAttribute('stroke','#fff');c.setAttribute('stroke-width','1.5');
        c.setAttribute('data-idx',i); c.style.cursor='pointer';
        svg.appendChild(c);
      }

      // Axes
      addLine(margin.l,margin.t,margin.l,margin.t+h,'#666',1,null);
      addLine(margin.l,margin.t+h,margin.l+w,margin.t+h,'#666',1,null);
      var yTicks=5;
      for(var t=0;t<=yTicks;t++){
        var yv=yMin+(yMax-yMin)*(t/yTicks);
        var yt=document.createElementNS(ns,'text');
        yt.setAttribute('x',margin.l-8);yt.setAttribute('y',sy(yv)+4);
        yt.setAttribute('text-anchor','end');yt.setAttribute('font-size','11');yt.setAttribute('fill','#555');
        yt.textContent = isPct ? yv.toFixed(1)+'%' : yv.toFixed(3);
        svg.appendChild(yt);
      }
      var step=Math.max(1,Math.ceil(n/12));
      for(var i=0;i<n;i+=step){
        var xt=document.createElementNS(ns,'text');
        xt.setAttribute('x',sx(i));xt.setAttribute('y',margin.t+h+18);
        xt.setAttribute('text-anchor','middle');xt.setAttribute('font-size','10');xt.setAttribute('fill','#555');
        xt.setAttribute('transform','rotate(45 '+sx(i)+' '+(margin.t+h+18)+')');
        var lbl=String(labels[i]); if(lbl.length>10)lbl=lbl.substring(0,10);
        xt.textContent=lbl; svg.appendChild(xt);
      }

      // Legend
      [{c:COLOUR_COMMON,t:'Common Cause'},{c:COLOUR_IMPROVE,t:'Improvement'},{c:COLOUR_CONCERN,t:'Concern'}]
      .forEach(function(item,li){
        var lx=margin.l+w-130, ly=margin.t+8+li*18;
        var lc=document.createElementNS(ns,'circle');
        lc.setAttribute('cx',lx);lc.setAttribute('cy',ly);lc.setAttribute('r','4');lc.setAttribute('fill',item.c);
        svg.appendChild(lc);
        var lt=document.createElementNS(ns,'text');
        lt.setAttribute('x',lx+10);lt.setAttribute('y',ly+4);
        lt.setAttribute('font-size','11');lt.setAttribute('fill','#555');
        lt.textContent=item.t; svg.appendChild(lt);
      });

      // Info
      var info=document.createElementNS(ns,'text');
      info.setAttribute('x',margin.l+4);info.setAttribute('y',H-6);
      info.setAttribute('font-size','10');info.setAttribute('fill','#888');
      info.textContent='Mean p: '+(isPct?(pBar*100).toFixed(1)+'%':pBar.toFixed(3));
      svg.appendChild(info);

      this._container.appendChild(svg);

      // Tooltip
      var tooltip=document.createElement('div');
      tooltip.className='nhs-mdc-tooltip'; tooltip.style.display='none';
      this._container.appendChild(tooltip);
      svg.addEventListener('mouseover',function(e){
        var idx=e.target.getAttribute('data-idx'); if(idx===null)return; idx=Number(idx);
        var lines=[labels[idx]];
        lines.push('Value: '+(isPct?(props[idx]*100).toFixed(1)+'%':props[idx].toFixed(3)));
        lines.push('n = '+subs[idx]);
        if(r1[idx])lines.push('⚠ Astronomical');if(r2[idx])lines.push('⚠ Shift');
        if(r3[idx])lines.push('⚠ Trend');if(r4[idx])lines.push('⚠ 2-in-3');
        tooltip.innerHTML=lines.join('<br>'); tooltip.style.display='block';
      });
      svg.addEventListener('mousemove',function(e){
        var r=element.getBoundingClientRect();
        tooltip.style.left=(e.clientX-r.left+12)+'px'; tooltip.style.top=(e.clientY-r.top-10)+'px';
      });
      svg.addEventListener('mouseout',function(e){if(e.target.getAttribute('data-idx')!==null)tooltip.style.display='none';});

      done();
    }
  };

  looker.plugins.visualizations.add(vis);
})();