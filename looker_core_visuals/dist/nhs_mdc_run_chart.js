/**
 * NHS Making Data Count - Run Chart
 * Standalone Looker Core Custom Visualization
 * 
 * Upload this single file to Looker Admin > Visualizations
 * 
 * DATA REQUIREMENTS:
 *   - Dimension: A date/time field (x-axis)
 *   - Measure: A numeric value
 *   No control limits — uses median centre line with shift/trend signals.
 */
(function() {
  var NHS_BLUE='#005EB8',NHS_GREY='#768692',NHS_ORANGE='#ED8B00',NHS_WARM_YELLOW='#FFB81C';
  var COLOUR_COMMON=NHS_GREY,COLOUR_IMPROVE=NHS_BLUE,COLOUR_CONCERN=NHS_ORANGE;

  function median(a){
    var s=a.slice().sort(function(x,y){return x-y;}),m=Math.floor(s.length/2);
    return s.length%2===0?(s[m-1]+s[m])/2:s[m];
  }
  function rule2(v,c,r){r=r||7;var f=new Array(v.length);for(var i=0;i<f.length;i++)f[i]=false;
    for(var i=0;i<=v.length-r;i++){var a=0,b=0;for(var j=i;j<i+r;j++){if(v[j]>c[j])a++;else if(v[j]<c[j])b++;}
    if(a===r||b===r)for(var j=i;j<i+r;j++)f[j]=true;}return f;}
  function rule3(v,r){r=r||7;var f=new Array(v.length);for(var i=0;i<f.length;i++)f[i]=false;
    for(var i=0;i<=v.length-r;i++){var u=true,d=true;for(var j=i+1;j<i+r;j++){if(v[j]<=v[j-1])u=false;if(v[j]>=v[j-1])d=false;}
    if(u||d)for(var j=i;j<i+r;j++)f[j]=true;}return f;}
  function ptCol(v,c,sc,dir,tgt){return v.map(function(x,i){if(!sc[i])return COLOUR_COMMON;
    var imp;if(tgt!==null&&tgt!==undefined){imp=dir==='high'?x>=tgt:x<=tgt;}else{imp=dir==='high'?x>c[i]:x<c[i];}
    return imp?COLOUR_IMPROVE:COLOUR_CONCERN;});}

  var vis = {
    id:'nhs_mdc_run_chart', label:'NHS MDC Run Chart',
    options:{
      chart_title:{type:'string',label:'Chart Title',default:'Run Chart',section:'Chart',order:1},
      improvement_direction:{type:'string',label:'Improvement Direction',display:'select',
        values:[{'Higher is better':'high'},{'Lower is better':'low'}],default:'high',section:'Analysis',order:1},
      target_value:{type:'number',label:'Target Value (optional)',section:'Analysis',order:2},
      show_target_line:{type:'boolean',label:'Show Target Line',default:false,section:'Display',order:1},
      show_center_line:{type:'boolean',label:'Show Centre Line (Median)',default:true,section:'Display',order:2}
    },
    create:function(element,config){
      element.innerHTML='';
      var s=document.createElement('style');
      s.textContent='.nhs-mdc-tooltip{position:absolute;padding:6px 10px;background:#333;color:#fff;border-radius:4px;font:12px Arial,sans-serif;pointer-events:none;z-index:100;white-space:nowrap}';
      element.appendChild(s);
      this._container=element.appendChild(document.createElement('div'));
      this._container.style.cssText='width:100%;height:100%;position:relative;overflow:hidden';
    },
    updateAsync:function(data,element,config,queryResponse,details,done){
      this._container.innerHTML='';
      if(!data||!data.length){done();return;}
      var dims=queryResponse.fields.dimension_like, meas=queryResponse.fields.measure_like;
      if(!meas.length){this._container.textContent='Add a measure';done();return;}
      var dimField=dims.length?dims[0].name:null, valField=meas[0].name;

      var labels=[],vals=[];
      for(var i=0;i<data.length;i++){
        labels.push(dimField?(data[i][dimField].rendered||data[i][dimField].value):(i+1));
        var v=Number(data[i][valField].value); if(isNaN(v))continue; vals.push(v);
      }
      var n=vals.length;
      if(n<2){this._container.textContent='Need ≥ 2 data points';done();return;}

      var med=median(vals);
      var medArr=[];for(var i=0;i<n;i++)medArr.push(med);

      var r2f=rule2(vals,medArr,7),r3f=rule3(vals,7);
      var sc=vals.map(function(_,i){return r2f[i]||r3f[i];});
      var dir=config.improvement_direction||'high';
      var tgt=config.target_value!=null?Number(config.target_value):null;
      var colours=ptCol(vals,medArr,sc,dir,tgt);

      var rect=this._container.getBoundingClientRect();
      var W=rect.width,H=rect.height,margin={t:50,r:30,b:60,l:65};
      var w=W-margin.l-margin.r, h=H-margin.t-margin.b;
      if(w<40||h<40){done();return;}

      var allY=vals.slice();if(tgt!==null)allY.push(tgt);
      var yMin=Math.min.apply(null,allY),yMax=Math.max.apply(null,allY);
      var pad=(yMax-yMin)*0.08||1;yMin-=pad;yMax+=pad;

      function sx(i){return margin.l+(i/(n-1))*w;}
      function sy(v){return margin.t+(1-(v-yMin)/(yMax-yMin))*h;}

      var ns='http://www.w3.org/2000/svg';
      var svg=document.createElementNS(ns,'svg');
      svg.setAttribute('width',W);svg.setAttribute('height',H);
      svg.style.fontFamily='Arial, sans-serif';

      var title=document.createElementNS(ns,'text');
      title.setAttribute('x',W/2);title.setAttribute('y',28);
      title.setAttribute('text-anchor','middle');title.setAttribute('font-size','15');
      title.setAttribute('font-weight','bold');title.setAttribute('fill','#333');
      title.textContent=config.chart_title||'Run Chart';svg.appendChild(title);

      function addLine(x1,y1,x2,y2,col,sw,dash){
        var l=document.createElementNS(ns,'line');l.setAttribute('x1',x1);l.setAttribute('y1',y1);
        l.setAttribute('x2',x2);l.setAttribute('y2',y2);l.setAttribute('stroke',col);l.setAttribute('stroke-width',sw);
        if(dash)l.setAttribute('stroke-dasharray',dash);svg.appendChild(l);}

      if(config.show_center_line!==false)addLine(margin.l,sy(med),margin.l+w,sy(med),NHS_BLUE,2,null);
      if(config.show_target_line&&tgt!==null)addLine(margin.l,sy(tgt),margin.l+w,sy(tgt),NHS_WARM_YELLOW,1.5,'4,4');

      var pts=[];for(var i=0;i<n;i++)pts.push(sx(i)+','+sy(vals[i]));
      var poly=document.createElementNS(ns,'polyline');poly.setAttribute('points',pts.join(' '));
      poly.setAttribute('fill','none');poly.setAttribute('stroke','#bbb');poly.setAttribute('stroke-width','1.2');svg.appendChild(poly);

      for(var i=0;i<n;i++){
        var c=document.createElementNS(ns,'circle');c.setAttribute('cx',sx(i));c.setAttribute('cy',sy(vals[i]));
        c.setAttribute('r','5');c.setAttribute('fill',colours[i]);c.setAttribute('stroke','#fff');
        c.setAttribute('stroke-width','1.5');c.setAttribute('data-idx',i);c.style.cursor='pointer';svg.appendChild(c);}

      addLine(margin.l,margin.t,margin.l,margin.t+h,'#666',1,null);
      addLine(margin.l,margin.t+h,margin.l+w,margin.t+h,'#666',1,null);
      var yTicks=5;for(var t=0;t<=yTicks;t++){
        var yv=yMin+(yMax-yMin)*(t/yTicks);
        var yt=document.createElementNS(ns,'text');yt.setAttribute('x',margin.l-8);yt.setAttribute('y',sy(yv)+4);
        yt.setAttribute('text-anchor','end');yt.setAttribute('font-size','11');yt.setAttribute('fill','#555');
        yt.textContent=yv.toFixed(1);svg.appendChild(yt);}
      var step=Math.max(1,Math.ceil(n/12));
      for(var i=0;i<n;i+=step){
        var xt=document.createElementNS(ns,'text');xt.setAttribute('x',sx(i));xt.setAttribute('y',margin.t+h+18);
        xt.setAttribute('text-anchor','middle');xt.setAttribute('font-size','10');xt.setAttribute('fill','#555');
        xt.setAttribute('transform','rotate(45 '+sx(i)+' '+(margin.t+h+18)+')');
        var lbl=String(labels[i]);if(lbl.length>10)lbl=lbl.substring(0,10);xt.textContent=lbl;svg.appendChild(xt);}

      [{c:COLOUR_COMMON,t:'Common Cause'},{c:COLOUR_IMPROVE,t:'Improvement'},{c:COLOUR_CONCERN,t:'Concern'}]
      .forEach(function(item,li){
        var lx=margin.l+w-130,ly=margin.t+8+li*18;
        var lc=document.createElementNS(ns,'circle');lc.setAttribute('cx',lx);lc.setAttribute('cy',ly);
        lc.setAttribute('r','4');lc.setAttribute('fill',item.c);svg.appendChild(lc);
        var lt=document.createElementNS(ns,'text');lt.setAttribute('x',lx+10);lt.setAttribute('y',ly+4);
        lt.setAttribute('font-size','11');lt.setAttribute('fill','#555');lt.textContent=item.t;svg.appendChild(lt);});

      var info=document.createElementNS(ns,'text');info.setAttribute('x',margin.l+4);info.setAttribute('y',H-6);
      info.setAttribute('font-size','10');info.setAttribute('fill','#888');
      info.textContent='Median: '+med.toFixed(2)+' | Min: '+Math.min.apply(null,vals).toFixed(2)+' | Max: '+Math.max.apply(null,vals).toFixed(2);
      svg.appendChild(info);

      this._container.appendChild(svg);

      var tooltip=document.createElement('div');tooltip.className='nhs-mdc-tooltip';tooltip.style.display='none';
      this._container.appendChild(tooltip);
      svg.addEventListener('mouseover',function(e){var idx=e.target.getAttribute('data-idx');if(idx===null)return;idx=Number(idx);
        var lines=[labels[idx],'Value: '+vals[idx].toFixed(2)];
        if(r2f[idx])lines.push('⚠ Shift');if(r3f[idx])lines.push('⚠ Trend');
        tooltip.innerHTML=lines.join('<br>');tooltip.style.display='block';});
      svg.addEventListener('mousemove',function(e){var r=element.getBoundingClientRect();
        tooltip.style.left=(e.clientX-r.left+12)+'px';tooltip.style.top=(e.clientY-r.top-10)+'px';});
      svg.addEventListener('mouseout',function(e){if(e.target.getAttribute('data-idx')!==null)tooltip.style.display='none';});
      done();
    }
  };
  looker.plugins.visualizations.add(vis);
})();