/* Zoom-aware name decluttering, intentionally independent from the graph's force layout. */
(()=>{
 "use strict";
 const svg=document.getElementById("graph"),mode=document.getElementById("labelMode"),status=document.getElementById("nameStat");
 if(!svg||!mode)return;
 let frame=0,lastDegreeEdges=null,degrees=new Map(),links=new Map();
 const canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");
 const clamp=(v,l,h)=>Math.max(l,Math.min(h,v));
 const overlapping=(a,b,spacing=4)=>a.x<b.x+b.w+spacing&&b.x<a.x+a.w+spacing&&a.y<b.y+b.h+spacing&&b.y<a.y+a.h+spacing;
 function state(){return typeof window.graphLabelState==="function"?window.graphLabelState():{selected:null,route:[],edges:[]}}
 function schedule(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;update()})}
 function update(){
   const nodes=[...svg.querySelectorAll("#nodes > .node")],rect=svg.getBoundingClientRect();
   if(!nodes.length||!rect.width||!rect.height)return;
   const [vx,vy,vw,vh]=svg.viewBox.baseVal?[svg.viewBox.baseVal.x,svg.viewBox.baseVal.y,svg.viewBox.baseVal.width,svg.viewBox.baseVal.height]:[-1280,-900,2560,1800];
   const scale=Math.min(rect.width/vw,rect.height/vh),mx=(rect.width-vw*scale)/2,my=(rect.height-vh*scale)/2,zoom=2560/vw;
   const mobile=rect.width<680,fontPx=mobile?13:14,minZoom=mobile?2.8:1.8,selection=state(),spot=selection.selected,route=new Set(selection.route||[]);
   if(lastDegreeEdges!==selection.edges){
     lastDegreeEdges=selection.edges;degrees=new Map();links=new Map();
     for(const e of selection.edges||[]){
       degrees.set(e.from,(degrees.get(e.from)||0)+1);degrees.set(e.to,(degrees.get(e.to)||0)+1);
       if(!links.has(e.from))links.set(e.from,new Set());if(!links.has(e.to))links.set(e.to,new Set());
       links.get(e.from).add(e.to);links.get(e.to).add(e.from);
     }
   }
   const near=new Set(links.get(spot)||[]);if(spot)near.add(spot);for(const id of route)near.add(id);
   const font="500 "+fontPx+"px system-ui, 'Noto Sans TC', sans-serif";if(ctx)ctx.font=font;
   const candidates=[];
   for(const g of nodes){
     const label=g.querySelector("text"),circle=g.querySelector("circle:not(.hitbox)"),hit=g.querySelector(".hitbox");
     if(!label||!circle||!hit)continue;
     label.style.display="none";
     if(g.style.display==="none")continue;
     const tr=g.getAttribute("transform")||"",match=tr.match(/translate\(\s*([-\d.eE]+)[,\s]+([-\d.eE]+)\s*\)/);
     if(!match)continue;
     const wx=+match[1],wy=+match[2],x=mx+(wx-vx)*scale,y=my+(wy-vy)*scale;
     circle.setAttribute("r",clamp(3.2/scale,8,25));
     hit.setAttribute("r",clamp(11/scale,9,39));
     if(x<-100||x>rect.width+100||y<-55||y>rect.height+55)continue;
     const id=g.dataset.id||"",forced=id===spot||route.has(id);
     candidates.push({g,label,id,wx,wy,x,y,forced,near:near.has(id),score:(id===spot?1e8:route.has(id)?5e7:near.has(id)?1e6:0)+(degrees.get(id)||0)*60-Math.hypot(x-rect.width/2,y-rect.height/2)*.08});
   }
   candidates.sort((a,b)=>b.score-a.score);
   const currentMode=mode.value,onlyFocus=!!spot||!!route.size;
   const limit=currentMode==="all"?Infinity:currentMode==="focus"?0:zoom<minZoom?0:Math.min(mobile?32:70,Math.max(6,Math.round(rect.width*rect.height/(zoom<5?25500:zoom<10?18000:13000))));
   const occupied=[];let count=0;
   for(const item of candidates){
     if(currentMode!=="all"&&onlyFocus&&!item.near&&!item.forced)continue;
     if(currentMode==="focus"&&!item.forced)continue;
     if(!item.forced&&currentMode!=="all"&&(zoom<minZoom||count>=limit))continue;
     const width=(ctx?ctx.measureText(item.label.textContent).width:Array.from(item.label.textContent).length*fontPx)+7;
     const tests=[
      {x:item.x+13,y:item.y+fontPx*.35,anchor:"start"},
      {x:item.x-13,y:item.y+fontPx*.35,anchor:"end"},
      {x:item.x,y:item.y-14,anchor:"middle"},
      {x:item.x,y:item.y+14+fontPx,anchor:"middle"},
      {x:item.x+13,y:item.y-14,anchor:"start"},
      {x:item.x-13,y:item.y-14,anchor:"end"}
     ];
     let chosen=null,box=null;
     for(const t of tests){
       const left=t.anchor==="start"?t.x:t.anchor==="end"?t.x-width:t.x-width/2;
       const b={x:left-3,y:t.y-fontPx-3,w:width+6,h:fontPx+6};
       if(b.x<5||b.y<5||b.x+b.w>rect.width-5||b.y+b.h>rect.height-5)continue;
       if(currentMode!=="all"&&occupied.some(o=>overlapping(o,b)))continue;
       if(currentMode!=="all"&&candidates.some(c=>c.id!==item.id&&c.x>b.x-5&&c.x<b.x+b.w+5&&c.y>b.y-5&&c.y<b.y+b.h+5))continue;
       chosen=t;box=b;break;
     }
     if(!chosen&&item.forced&&item.x>=0&&item.x<=rect.width&&item.y>=0&&item.y<=rect.height){
       const left=clamp(item.x+13,5,Math.max(5,rect.width-width-5));
       const baseline=clamp(item.y+fontPx*.35,fontPx+7,rect.height-5);
       chosen={x:left,y:baseline,anchor:"start"};
       box={x:left,y:baseline-fontPx-3,w:width,h:fontPx+6};
     }
     if(!chosen)continue;
     item.label.setAttribute("x",item.wx+(chosen.x-item.x)/scale);
     item.label.setAttribute("y",item.wy+(chosen.y-item.y)/scale);
     item.label.setAttribute("text-anchor",chosen.anchor);
     item.label.setAttribute("font-size",(fontPx/scale).toFixed(3));
     item.label.setAttribute("stroke-width",(2.4/scale).toFixed(3));
     item.label.setAttribute("font-weight",item.forced?"700":"500");
     item.label.style.display="inline";
     occupied.push(box);count++;
   }
   if(status)status.textContent=(currentMode==="all"?"全部姓名模式可能互相遮蓋":
     currentMode==="focus"?"只顯示選取人物與路徑的姓名":onlyFocus?"目前強調一度關係，其餘圓點仍可點擊":
     zoom<minZoom?"目前只顯示圓點，請放大看姓名":"標籤智慧避讓中，過近的名字會自動隱藏")+"｜目前顯示 "+count+" 個姓名";
 }
 mode.addEventListener("change",schedule);
 window.addEventListener("graph:view",schedule);
 window.addEventListener("resize",schedule);
 if("ResizeObserver" in window)new ResizeObserver(schedule).observe(svg);
 schedule();
})();
