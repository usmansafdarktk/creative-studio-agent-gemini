"use client";

import { googleFontsHref, SLIDE_H, SLIDE_W, themeCss } from "./theme";
import type { Asset, Theme } from "./types";

/** Replace asset:ID references with the asset's data URL. */
export function resolveAssets(html: string, assets: Asset[]) {
  if (!assets.length) return html;
  const map = new Map(assets.map((a) => [a.id, a.dataUrl]));
  return html.replace(/asset:([A-Za-z0-9_-]+)/g, (m, id: string) => map.get(id) ?? m);
}

let eidCounter = 0;
const newEid = () => `e${Date.now().toString(36).slice(-4)}${(eidCounter++).toString(36)}`;

const SKIP_EID = new Set(["STYLE", "BR", "DEFS", "LINEARGRADIENT", "RADIALGRADIENT", "STOP", "CLIPPATH", "MASK", "FILTER"]);

/** Give every element a stable data-eid so it can be selected and edited. */
export function ensureEids(html: string) {
  if (!html) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.body.querySelectorAll("*").forEach((el) => {
    if (SKIP_EID.has(el.tagName.toUpperCase())) return;
    // Inside SVG, only tag top-level svg and text nodes.
    if (el.closest("svg") && el.tagName.toLowerCase() !== "svg" && el.tagName.toLowerCase() !== "text") return;
    if (!el.getAttribute("data-eid")) el.setAttribute("data-eid", newEid());
  });
  return doc.body.innerHTML;
}

function withDoc(html: string, fn: (doc: Document) => void) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  fn(doc);
  return doc.body.innerHTML;
}

export function replaceElement(html: string, eid: string, outerHtml: string) {
  return withDoc(html, (doc) => {
    const el = doc.querySelector(`[data-eid="${CSS.escape(eid)}"]`);
    if (el) el.outerHTML = outerHtml;
  });
}

export function setElementInner(html: string, eid: string, inner: string) {
  return withDoc(html, (doc) => {
    const el = doc.querySelector(`[data-eid="${CSS.escape(eid)}"]`);
    if (el) el.innerHTML = inner;
  });
}

export function removeElement(html: string, eid: string) {
  return withDoc(html, (doc) => {
    const el = doc.querySelector(`[data-eid="${CSS.escape(eid)}"]`);
    if (el && !el.classList.contains("slide")) el.remove();
  });
}

export function getElement(html: string, eid: string) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const el = doc.querySelector(`[data-eid="${CSS.escape(eid)}"]`);
  return el ? { outer: el.outerHTML, inner: el.innerHTML, text: (el.textContent ?? "").trim() } : null;
}

export function htmlText(html: string) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.querySelectorAll("style").forEach((s) => s.remove());
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * The persistent iframe document. Slide markup is pushed in via postMessage so updates
 * (including streaming partials) don't reload the frame.
 */
export function buildShell(theme: Theme, interactive: boolean) {
  const fonts = googleFontsHref(theme);
  return `<!doctype html><html><head><meta charset="utf-8">
${fonts ? `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${fonts}">` : ""}
<style>
html,body{width:${SLIDE_W}px;height:${SLIDE_H}px;overflow:hidden;background:var(--bg)}
${themeCss(theme)}
${
  interactive
    ? `[data-eid]{cursor:default}
.__hover{outline:2px dashed rgba(242,106,33,.85)!important;outline-offset:3px}
.__sel{outline:3px solid #f26a21!important;outline-offset:4px}
.slide.__sel,.slide.__hover{outline-offset:-6px}
[contenteditable=true]{outline:3px solid #2f6bff!important;outline-offset:4px;cursor:text}`
    : ""
}
</style></head><body><div id="root"></div>
<script>
(function(){
  var root=document.getElementById('root');
  var interactive=${interactive ? "true" : "false"};
  var selEl=null, hoverEl=null, editing=null;
  function post(m){parent.postMessage(Object.assign({__slide:true},m),'*')}
  function info(el){
    var r=el.getBoundingClientRect();
    var sel=window.getSelection(); var st=sel&&!sel.isCollapsed&&el.contains(sel.anchorNode)?String(sel).trim():'';
    return {eid:el.getAttribute('data-eid'),tag:el.tagName.toLowerCase(),text:(el.innerText||el.textContent||'').trim().slice(0,600),
      outerHtml:el.outerHTML.slice(0,6000),rect:{x:r.left,y:r.top,w:r.width,h:r.height},selectedText:st,isRoot:el.classList.contains('slide')};
  }
  function setSel(el){ if(selEl) selEl.classList.remove('__sel'); selEl=el; if(el) el.classList.add('__sel'); }
  function stopEditing(commit){
    if(!editing) return; var el=editing; editing=null;
    el.removeAttribute('contenteditable');
    if(commit){ el.classList.remove('__sel','__hover'); post({type:'text',eid:el.getAttribute('data-eid'),html:el.innerHTML}); el.classList.add('__sel'); }
  }
  window.addEventListener('message',function(e){
    var m=e.data||{};
    if(m.type==='render'){ stopEditing(false); root.innerHTML=m.html; selEl=null; hoverEl=null;
      if(m.selected){ var s=root.querySelector('[data-eid="'+m.selected+'"]'); if(s) setSel(s); } }
    else if(m.type==='clear'){ stopEditing(true); setSel(null); }
    else if(m.type==='edit-text'){ var el=root.querySelector('[data-eid="'+m.eid+'"]'); if(el) startEdit(el); }
  });
  function startEdit(el){
    if(el.classList.contains('slide')) return;
    stopEditing(true); editing=el; el.setAttribute('contenteditable','true'); el.focus();
    var range=document.createRange(); range.selectNodeContents(el); var s=window.getSelection(); s.removeAllRanges(); s.addRange(range);
  }
  if(interactive){
    // Decorative layers often sit on top of text; pick the most meaningful element under the pointer.
    function pick(e){
      var els=document.elementsFromPoint(e.clientX,e.clientY).filter(function(x){return x.hasAttribute&&x.hasAttribute('data-eid')});
      if(!els.length) return e.target.closest&&e.target.closest('[data-eid]');
      for(var i=0;i<els.length;i++){ var x=els[i]; if(x.classList.contains('slide')) break;
        var own=[].some.call(x.childNodes,function(n){return n.nodeType===3&&n.textContent.trim()});
        if(own||/^(img|svg|h1|h2|h3|h4|p|li|span|a|button)$/i.test(x.tagName)) return x; }
      var t=e.target.closest&&e.target.closest('[data-eid]');
      return t||els[0];
    }
    document.addEventListener('mouseover',function(e){ var el=pick(e); if(hoverEl&&hoverEl!==el) hoverEl.classList.remove('__hover'); hoverEl=el; if(el&&el!==selEl) el.classList.add('__hover'); });
    document.addEventListener('mouseleave',function(){ if(hoverEl) hoverEl.classList.remove('__hover'); hoverEl=null; });
    document.addEventListener('click',function(e){
      var el=pick(e); e.preventDefault();
      if(editing&&editing.contains(e.target)) return;
      stopEditing(true);
      if(!el){ setSel(null); post({type:'deselect'}); return; }
      el.classList.remove('__hover'); setSel(el); post(Object.assign({type:'select'},info(el)));
    });
    document.addEventListener('dblclick',function(e){ var el=pick(e); if(el) startEdit(el); });
    document.addEventListener('mouseup',function(){ setTimeout(function(){ var s=window.getSelection(); if(selEl&&s&&!s.isCollapsed&&!editing) post(Object.assign({type:'select'},info(selEl))); },0); });
    document.addEventListener('keydown',function(e){
      if(editing&&e.key==='Escape'){ e.preventDefault(); stopEditing(true); }
      if(editing&&e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); stopEditing(true); }
      if(!editing&&e.key==='Escape'){ setSel(null); post({type:'deselect'}); }
    });
    document.addEventListener('focusout',function(e){ if(editing&&e.target===editing) stopEditing(true); });
  }
  post({type:'ready'});
})();
</script></body></html>`;
}

/** A standalone, self-contained HTML presentation (arrow keys / click to navigate). */
export function buildStandaloneDeck(title: string, theme: Theme, slides: string[], assets: Asset[]) {
  const fonts = googleFontsHref(theme);
  const body = slides.map((h) => `<div class="page">${resolveAssets(h, assets)}</div>`).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title.replace(/</g, "&lt;")}</title>
${fonts ? `<link rel="stylesheet" href="${fonts}">` : ""}
<style>${themeCss(theme)}
[data-eid]{}
html,body{margin:0;height:100%;background:#000;overflow:hidden}
.page{position:absolute;left:50%;top:50%;width:${SLIDE_W}px;height:${SLIDE_H}px;transform-origin:center;display:none}
.page.on{display:block}
@media print{@page{size:${SLIDE_W}px ${SLIDE_H}px;margin:0}html,body{overflow:visible;background:none;height:auto}
.page{position:relative;left:0;top:0;display:block!important;transform:none!important;break-after:page;page-break-after:always}}
</style></head><body>${body}
<script>
var pages=[].slice.call(document.querySelectorAll('.page')),i=0;
function fit(){var s=Math.min(innerWidth/${SLIDE_W},innerHeight/${SLIDE_H});pages.forEach(function(p){p.style.transform='translate(-50%,-50%) scale('+s+')'})}
function show(n){i=Math.max(0,Math.min(pages.length-1,n));pages.forEach(function(p,k){p.classList.toggle('on',k===i)})}
addEventListener('resize',fit);addEventListener('keydown',function(e){if(['ArrowRight','ArrowDown',' ','PageDown'].indexOf(e.key)>=0)show(i+1);if(['ArrowLeft','ArrowUp','PageUp'].indexOf(e.key)>=0)show(i-1)});
addEventListener('click',function(e){show(e.clientX>innerWidth/2?i+1:i-1)});fit();show(0);
</script></body></html>`;
}

/** Print-ready document: one slide per page; the browser's "Save as PDF" does the rest. */
export function buildPrintDeck(title: string, theme: Theme, slides: string[], assets: Asset[]) {
  const fonts = googleFontsHref(theme);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title>
${fonts ? `<link rel="stylesheet" href="${fonts}">` : ""}
<style>${themeCss(theme)}
@page{size:${SLIDE_W}px ${SLIDE_H}px;margin:0}
html,body{margin:0;background:#fff}
.page{width:${SLIDE_W}px;height:${SLIDE_H}px;overflow:hidden;break-after:page;page-break-after:always}
</style></head><body>${slides.map((h) => `<div class="page">${resolveAssets(h, assets)}</div>`).join("")}
<script>document.fonts.ready.then(function(){setTimeout(function(){print()},400)})</script></body></html>`;
}
