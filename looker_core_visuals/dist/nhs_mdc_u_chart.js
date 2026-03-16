/**
 * NHS Making Data Count - u Chart (Rates per Unit)
 * Standalone Looker Core Custom Visualization
 * 
 * Upload this single file to Looker Admin > Visualizations
 * 
 * DATA REQUIREMENTS:
 *   - Dimension: A date/time field (x-axis)
 *   - Measure 1: A count value
 *   - Measure 2 (optional): Subgroup/denominator size (area of opportunity)
 *   If no subgroup column is provided, a default of 1 is used.
 */
(function() {
  var NHS_BLUE='#005EB8',NHS_DARK_BLUE='#003087',NHS_ORANGE='#ED8B00',
      NHS_GREY='#768692',NHS_WARM_YELLOW='#FFB81C';
  var COLOUR_COMMON=NHS_GREY,COLOUR_IMPROVE=NHS_BLUE,COLOUR_CONCERN=NHS_ORANGE;

  function mean(a){if(!a.length)return 0;var s=0;for(var i=0;i<a.length;i++)s+=a[i];return s/a.length;}
  function rule1(v,u,l){return v.map(function(x,i){return x>u[i]||x<l[i];});}
  function rule2(v,c,r){r=r||7;var f=new Array(v.length);for(var i=0;i<f.length;i++)f[i]=false;
    for(var i=0;i<=v.length-r;i++){var a=0,b=0;for(var j=i;j<i+r;j++){if(v[j]>c[j])a++;else if(v[j]<c[j])b++;}
    if(a===r||b===r)for(var j=i;j<i+r;j++)f[j]=true;}return f;}
  function rule3(v,r){r=r||7;var f=new Array(v.length);for(var i=0;i<f.length;i++)f[i]=false;
    for(var i=0;i<=v.length-r;i++){var u=true,d=true;for(var j=i+1;j<i+r;j++){if(v[j]<=v[j-1])u=false;if(v[j]>=v[j-1])d=false;}
    if(u||d)for(var j=i;j<i+r;j++)f[j]=true;}return f;}
  function rule4(v,c,u,l,uw,lw){var n=v.length,f=new Array(n);for(var i=0;i<n;i++)f[i]=false;
    var close=new Array(n),rtm=new Array(n);
    for(var i=0;i<n;i++){var out=v[i]>u[i]||v[i]<l[i];close[i]=!out&&(v[i]>uw[i]||v[i]<lw[i]);
      rtm[i]=v[i]>c[i]?1:(v[i]<c[i]?-1:0);}
    for(var i=0;i<n;i++){if(!close[i])continue;
      var ws=[i-2,i-1,i];for(var wi=0;wi<3;wi++){var s=ws[wi],e=s+3;if(s<0||e>n)continue;
        var cc=0,rs=0;for(var j=s;j<e;j++){if(close[j])cc++;rs+=rtm[j];}
        if(cc>=2&&Math.abs(rs)===3){f[i]=true;break;}}}
    return f;}
  function ptCol(v,c,u,l,r1,sc,dir,tgt){return v.map(function(x,i){if(!sc[i])return COLOUR_COMMON;
    var isHigh=r1[i]?x>u[i]:x>c[i];var imp;
    if(tgt!==null&&tgt!==undefined){imp=Math.abs(x-tgt)<Math.abs(c[i]-tgt);}
    else{imp=dir==='high'?isHigh:!isHigh;}
    return imp?COLOUR_IMPROVE:COLOUR_CONCERN;});}

  var vis = {
    id:'nhs_mdc_u_chart', label:'NHS MDC u Chart',
    options:{
      chart_title:{type:'string',label:'Chart Title',default:'u Chart – Rates per Unit',section:'Chart',order:1},
      improvement_direction:{type:'string',label:'Improvement Direction',display:'select',
        values:[{'Higher is better':'high'},{'Lower is better':'low'}],default:'low',section:'Analysis',order:1},
      target_value:{type:'number',label:'Target Value (optional)',section:'Analysis',order:2},
      show_target_line:{type:'boolean',label:'Show Target Line',default:false,section:'Display',order:1},
      show_control_limits:{type:'boolean',label:'Show Control Limits',default:true,section:'Display',order:2},
      show_center_line:{type:'boolean',label:'Show Centre Line',default:true,section:'Display',order:3}
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
      if(!meas.length){this._container.textContent='Add a measure (count)';done();return;}
      var dimField=dims.length?dims[0].name:null;
      var valField=meas[0].name;
      var subField=meas.length>1?meas[1].name:null;

      var labels=[],counts=[],subs=[];
      for(var i=0;i<data.length;i++){
        labels.push(dimField?(data[i][dimField].rendered||data[i][dimField].value):(i+1));
        var v=Number(data[i][valField].value); if(isNaN(v))continue;
        counts.push(v);
        subs.push(subField?Number(data[i][subField].value)||1:1);
      }
      var n=counts.length;
      if(n<2){this._container.textContent='Need ≥ 2 data points';done();return;}

      // u-chart: rate = count/area, u-bar = total_count/total_area
      var rates=[];
      var totalC=0,totalA=0;
      for(var i=0;i<n;i++){rates.push(counts[i]/subs[i]);totalC+=counts[i];totalA+=subs[i];}
      var uBar=totalA>0?totalC/totalA:0;

      var cA=[],uA=[],lA=[],uwA=[],lwA=[];
      for(var i=0;i<n;i++){
        var se=Math.sqrt(uBar/subs[i]);
        cA.push(uBar);
        uA.push(uBar+3*se); lA.push(Math.max(uBar-3*se,0));
        uwA.push(uBar+2*se); lwA.push(Math.max(uBar-2*se,0));
      }

      var r1=rule1(rates,uA,lA),r2=rule2(rates,cA,7),r3=rule3(rates,7),
          r4=rule4(rates,cA,uA,lA,uwA,lwA);
      var sc=rates.map(function(_,i){return r1[i]||r2[i]||r3[i]||r4[i];});
      var dir=config.improvement_direction||'low';
      var tgt=config.target_value!=null?Number(config.target_value):null;
      var colours=ptCol(rates,cA,uA,lA,r1,sc,dir,tgt);

      // ── SVG ──
      var rect=this._container.getBoundingClientRect();
      var W=rect.width,H=rect.height,margin={t:50,r:30,b:60,l:65};
      var w=W-margin.l-margin.r, h=H-margin.t-margin.b;
      if(w<40||h<40){done();return;}

      var allY=rates.concat(uA).concat(lA);if(tgt!==null)allY.push(tgt);
      var yMin=Math.min.apply(null,allY),yMax=Math.max.apply(null,allY);
      var pad=(yMax-yMin)*0.08||0.1;yMin=Math.max(yMin-pad,0);yMax+=pad;

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
      title.textContent=config.chart_title||'u Chart – Rates per Unit';svg.appendChild(title);

      function addLine(x1,y1,x2,y2,col,sw,dash){
        var l=document.createElementNS(ns,'line');l.setAttribute('x1',x1);l.setAttribute('y1',y1);
        l.setAttribute('x2',x2);l.setAttribute('y2',y2);l.setAttribute('stroke',col);l.setAttribute('stroke-width',sw);
        if(dash)l.setAttribute('stroke-dasharray',dash);svg.appendChild(l);}
      function addPath(points,col,sw,dash){
        var d='M '+points[0];for(var i=1;i<points.length;i++)d+=' L '+points[i];
        var p=document.createElementNS(ns,'path');p.setAttribute('d',d);p.setAttribute('stroke',col);
        p.setAttribute('stroke-width',sw);p.setAttribute('fill','none');
        if(dash)p.setAttribute('stroke-dasharray',dash);svg.appendChild(p);}

      if(config.show_control_limits!==false){
        var uPts=[],lPts=[];
        for(var i=0;i<n;i++){uPts.push(sx(i)+' '+sy(uA[i]));lPts.push(sx(i)+' '+sy(lA[i]));}
        addPath(uPts,NHS_DARK_BLUE,1,'6,4'); addPath(lPts,NHS_DARK_BLUE,1,'6,4');
      }
      if(config.show_center_line!==false)addLine(margin.l,sy(uBar),margin.l+w,sy(uBar),NHS_BLUE,2,null);
      if(config.show_target_line&&tgt!==null)addLine(margin.l,sy(tgt),margin.l+w,sy(tgt),NHS_WARM_YELLOW,1.5,'4,4');

      var pts=[];for(var i=0;i<n;i++)pts.push(sx(i)+','+sy(rates[i]));
      var poly=document.createElementNS(ns,'polyline');poly.setAttribute('points',pts.join(' '));
      poly.setAttribute('fill','none');poly.setAttribute('stroke','#bbb');poly.setAttribute('stroke-width','1.2');svg.appendChild(poly);

      for(var i=0;i<n;i++){
        var c=document.createElementNS(ns,'circle');c.setAttribute('cx',sx(i));c.setAttribute('cy',sy(rates[i]));
        c.setAttribute('r','5');c.setAttribute('fill',colours[i]);c.setAttribute('stroke','#fff');
        c.setAttribute('stroke-width','1.5');c.setAttribute('data-idx',i);c.style.cursor='pointer';svg.appendChild(c);}

      addLine(margin.l,margin.t,margin.l,margin.t+h,'#666',1,null);
      addLine(margin.l,margin.t+h,margin.l+w,margin.t+h,'#666',1,null);
      var yTicks=5;for(var t=0;t<=yTicks;t++){
        var yv=yMin+(yMax-yMin)*(t/yTicks);
        var yt=document.createElementNS(ns,'text');yt.setAttribute('x',margin.l-8);yt.setAttribute('y',sy(yv)+4);
        yt.setAttribute('text-anchor','end');yt.setAttribute('font-size','11');yt.setAttribute('fill','#555');
        yt.textContent=yv.toFixed(2);svg.appendChild(yt);}
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
      info.textContent='Mean Rate: '+uBar.toFixed(3);svg.appendChild(info);

      this._container.appendChild(svg);

      var tooltip=document.createElement('div');tooltip.className='nhs-mdc-tooltip';tooltip.style.display='none';
      this._container.appendChild(tooltip);
      svg.addEventListener('mouseover',function(e){var idx=e.target.getAttribute('data-idx');if(idx===null)return;idx=Number(idx);
        var lines=[labels[idx],'Rate: '+rates[idx].toFixed(3),'n = '+subs[idx]];
        if(r1[idx])lines.push('⚠ Astronomical');if(r2[idx])lines.push('⚠ Shift');
        if(r3[idx])lines.push('⚠ Trend');if(r4[idx])lines.push('⚠ 2-in-3');
        tooltip.innerHTML=lines.join('<br>');tooltip.style.display='block';});
      svg.addEventListener('mousemove',function(e){var r=element.getBoundingClientRect();
        tooltip.style.left=(e.clientX-r.left+12)+'px';tooltip.style.top=(e.clientY-r.top-10)+'px';});
      svg.addEventListener('mouseout',function(e){if(e.target.getAttribute('data-idx')!==null)tooltip.style.display='none';});
      done();
    }
  };
  looker.plugins.visualizations.add(vis);
})();