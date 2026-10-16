/* Network zoom and pan: self-contained, no external dependencies. */
(() => {
  "use strict";
  const toolbar = document.getElementById("net-zoom-toolbar");
  if (!toolbar) return;
  const states = new WeakMap();
  const minimum = 1, maximum = 40;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const midpoint = (p, q) => ({x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, d: Math.hypot(p.x-q.x, p.y-q.y)});
  function active() {
    const view = [...document.querySelectorAll(".views > .view")].find(v => getComputedStyle(v).display !== "none");
    const plot = view && view.querySelector(".plot-wrap");
    return plot && states.has(plot) ? plot : null;
  }
  function label() {
    const plot = active();
    document.getElementById("net-zoom-value").textContent = plot ? Math.round(states.get(plot).scale*100) + "%" : "100%";
  }
  function zoom(plot, scale, clientX, clientY) {
    const state = states.get(plot);
    const newScale = clamp(scale, minimum, maximum);
    if (Math.abs(newScale - state.scale) < 0.0001) return;
    const b = plot.getBoundingClientRect();
    const x = (clientX === undefined ? b.left + b.width/2 : clientX) - b.left;
    const y = (clientY === undefined ? b.top + b.height/2 : clientY) - b.top;
    const ratio = newScale/state.scale;
    const left = (plot.scrollLeft + x)*ratio - x;
    const top = (plot.scrollTop + y)*ratio - y;
    state.scale = newScale;
    state.graph.style.transform = "scale(" + newScale + ")";
    plot.scrollLeft = Math.max(0, left);
    plot.scrollTop = Math.max(0, top);
    label();
  }
  function reset(plot) {
    const state=states.get(plot);
    state.scale=1;
    state.graph.style.transform="none";
    plot.scrollLeft=0; plot.scrollTop=0;
    label();
  }
  document.querySelectorAll(".views .plot-wrap").forEach(plot => {
    const graph=plot.querySelector(".graph");
    if (!graph) return;
    const state={graph,scale:1,pointers:new Map(),pinch:null,moved:false};
    states.set(plot,state);
    plot.classList.add("zoom-enabled");
    plot.addEventListener("wheel", e => {
      e.preventDefault();
      zoom(plot, state.scale * (e.deltaY < 0 ? 1.18 : 1/1.18), e.clientX, e.clientY);
    }, {passive:false});
    plot.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (!state.pointers.size) state.moved = false;
      state.pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
      if (state.pointers.size === 2) state.pinch=midpoint(...[...state.pointers.values()].slice(0,2));
    });
    plot.addEventListener("pointermove", e => {
      const old=state.pointers.get(e.pointerId);
      if (!old) return;
      const next={x:e.clientX,y:e.clientY};
      state.pointers.set(e.pointerId,next);
      if (state.pointers.size >= 2) {
        const a=[...state.pointers.values()];
        const now=midpoint(a[0],a[1]);
        if (state.pinch && state.pinch.d > 0 && now.d > 0) {
          zoom(plot, state.scale*now.d/state.pinch.d, now.x, now.y);
          plot.scrollLeft-=now.x-state.pinch.x;
          plot.scrollTop-=now.y-state.pinch.y;
          state.moved = true;
          e.preventDefault();
        }
        state.pinch=now;
      } else {
        const dx=next.x-old.x,dy=next.y-old.y;
        if (Math.abs(dx)+Math.abs(dy)>2) {
          plot.scrollLeft-=dx;plot.scrollTop-=dy;
          if (!state.moved && plot.setPointerCapture) {
            try {plot.setPointerCapture(e.pointerId);} catch {}
          }
          state.moved=true;
          e.preventDefault();
        }
      }
    });
    function end(e) {
      state.pointers.delete(e.pointerId);
      if (plot.hasPointerCapture && plot.hasPointerCapture(e.pointerId)) {
        try {plot.releasePointerCapture(e.pointerId);} catch {}
      }
      state.pinch=null;
      if (state.pointers.size === 2) state.pinch=midpoint(...[...state.pointers.values()].slice(0,2));
    }
    plot.addEventListener("pointerup",end);
    plot.addEventListener("pointercancel",end);
    plot.addEventListener("click",e=>{
      if (state.moved) {
        e.preventDefault();e.stopPropagation();state.moved=false;
      }
    },true);
    plot.addEventListener("dblclick",e=>{
      e.preventDefault();
      zoom(plot,state.scale*1.5,e.clientX,e.clientY);
    });
  });
  toolbar.style.display = "flex";
  const oldZoomLabel = document.querySelector('label[for="zoomgraph"]');
  if (oldZoomLabel) oldZoomLabel.style.display = "none";
  document.querySelectorAll("#net-zoom-toolbar button[data-action]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const plot=active();
      if(!plot)return;
      const action=btn.dataset.action;
      if (action==="reset")reset(plot);
      else zoom(plot,states.get(plot).scale*(action==="in"?1.6:1/1.6));
    });
  });
  document.querySelectorAll(".explorer input[name=view]").forEach(el=>el.addEventListener("change",()=>{requestAnimationFrame(label)}));
  label();
})();