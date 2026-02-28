// assets/app.js
// Frontend designer (vanilla JS) using interact.js and JsBarcode
const APPS_SCRIPT_URL = 'REPLACE_WITH_YOUR_APPS_SCRIPT_WEBAPP_URL'; // <<< IMPORTANT

// Utility
const mmToPx = mm => (mm * 96 / 25.4);
const pxToMm = px => (px * 25.4 / 96);

// State
let state = {
  pageW: 50, pageH: 38, margin: 2,
  elements: [], selectedId: null,
  undoStack: [], redoStack: [],
  grid: false, snap: false, zoom: 1
};
let activeCode = null, lastFetched = null, autoSyncTimer = null;

// DOM refs
const labelWrapper = document.getElementById('labelWrapper');
const pageWInput = document.getElementById('pageW');
const pageHInput = document.getElementById('pageH');
const pageMarginInput = document.getElementById('pageMargin');
const templateSelect = document.getElementById('templateSelect');
const zoomText = document.getElementById('zoomText');

function init() {
  // hookup toolbar
  document.getElementById('applyPage').onclick = applyPage;
  document.getElementById('addText').onclick = ()=>addElement('text','Sample',5,5,40,6,0);
  document.getElementById('addBarcode').onclick = ()=>addElement('barcode','8901234567890',5,28,40,10,0);
  document.getElementById('addBox').onclick = ()=>addElement('box','',5,5,40,30,0);
  document.getElementById('fetchBtn').onclick = fetchByCode;
  document.getElementById('saveBtn').onclick = saveTemplate;
  document.getElementById('openBtn').onclick = ()=>loadTemplate(templateSelect.value);
  document.getElementById('tplDelete').onclick = deleteTemplate;
  document.getElementById('printBtn').onclick = printPreview;
  document.getElementById('undoBtn').onclick = undo;
  document.getElementById('redoBtn').onclick = redo;
  document.getElementById('gridBtn').onclick = toggleGrid;
  document.getElementById('snapBtn').onclick = toggleSnap;
  document.getElementById('zoomIn').onclick = ()=>changeZoom(0.1);
  document.getElementById('zoomOut').onclick = ()=>changeZoom(-0.1);
  document.getElementById('applyProps').onclick = applyProps;

  // initial page size
  applyPage();
  loadTemplates();

  // setup interact delegation (make elements draggable/resizable)
  setupInteract();
}

function applyPage(){
  state.pageW = parseFloat(pageWInput.value) || 50;
  state.pageH = parseFloat(pageHInput.value) || 38;
  state.margin = parseFloat(pageMarginInput.value) || 2;
  labelWrapper.style.width = (mmToPx(state.pageW) * state.zoom) + 'px';
  labelWrapper.style.height = (mmToPx(state.pageH) * state.zoom) + 'px';
  renderAll();
}

function addElement(type, text, x=5, y=5, w=40, h=6, rotate=0){
  const id = 'el_' + Date.now() + Math.floor(Math.random()*999);
  const el = { id, type, x, y, w, h, rotate, props: { text: text||'', font:12 } };
  state.elements.push(el);
  saveUndo();
  renderElement(el);
  selectElement(id);
}

function renderAll(){
  labelWrapper.innerHTML = '';
  for(const el of state.elements) renderElement(el);
}

function renderElement(el){
  let elDom = document.querySelector(`[data-id="${el.id}"]`);
  if(elDom) elDom.remove();
  elDom = document.createElement('div');
  elDom.className = 'element';
  elDom.dataset.id = el.id;
  elDom.style.left = (mmToPx(el.x)*state.zoom) + 'px';
  elDom.style.top = (mmToPx(el.y)*state.zoom) + 'px';
  elDom.style.width = (mmToPx(el.w)*state.zoom) + 'px';
  elDom.style.height = (mmToPx(el.h)*state.zoom) + 'px';
  elDom.style.transform = `rotate(${el.rotate}deg)`;
  const inner = document.createElement('div');
  inner.className = 'el-inner';
  if(el.type === 'text') {
    inner.textContent = el.props.text || '';
    inner.style.fontSize = (el.props.font || 12) + 'px';
  } else if (el.type === 'barcode') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('width','100%'); svg.setAttribute('height','100%');
    try { JsBarcode(svg, String(el.props.text||''), { format:'CODE128', displayValue:false, height:mmToPx(el.h) }); } catch(e){}
    inner.appendChild(svg);
  } else if (el.type === 'box') {
    inner.style.width='100%'; inner.style.height='100%'; inner.style.border='1px solid #000';
  }
  elDom.appendChild(inner);
  elDom.addEventListener('pointerdown', e => { e.stopPropagation(); selectElement(el.id); });
  labelWrapper.appendChild(elDom);
}

function selectElement(id){
  state.selectedId = id;
  document.querySelectorAll('.element').forEach(d => d.classList.toggle('selected', d.dataset.id === id));
  // populate prop panel
  const el = state.elements.find(x=>x.id===id);
  if(!el) {
    document.getElementById('propType').textContent = 'No selection';
    ['propText','propFont','propX','propY','propW','propH','propRotate'].forEach(k => document.getElementById(k).value = '');
    return;
  }
  document.getElementById('propType').textContent = el.type;
  document.getElementById('propText').value = el.props.text||'';
  document.getElementById('propFont').value = el.props.font||12;
  document.getElementById('propX').value = el.x;
  document.getElementById('propY').value = el.y;
  document.getElementById('propW').value = el.w;
  document.getElementById('propH').value = el.h;
  document.getElementById('propRotate').value = el.rotate||0;
}

function applyProps(){
  if(!state.selectedId) return alert('Select element');
  const el = state.elements.find(x=>x.id===state.selectedId);
  el.props.text = document.getElementById('propText').value;
  el.props.font = parseInt(document.getElementById('propFont').value) || 12;
  el.x = parseFloat(document.getElementById('propX').value) || el.x;
  el.y = parseFloat(document.getElementById('propY').value) || el.y;
  el.w = parseFloat(document.getElementById('propW').value) || el.w;
  el.h = parseFloat(document.getElementById('propH').value) || el.h;
  el.rotate = parseFloat(document.getElementById('propRotate').value) || el.rotate;
  saveUndo(); renderAll(); selectElement(el.id);
}

function setupInteract(){
  // Use delegation - since elements are dynamic we attach interact to the container and select via selector
  interact('.element').draggable({
    listeners: {
      move(event) {
        const target = event.target;
        const id = target.dataset.id;
        const el = state.elements.find(x=>x.id===id);
        if(!el) return;
        const dx = event.dx / state.zoom;
        const dy = event.dy / state.zoom;
        el.x += pxToMm(dx);
        el.y += pxToMm(dy);
        target.style.left = (mmToPx(el.x)*state.zoom) + 'px';
        target.style.top = (mmToPx(el.y)*state.zoom) + 'px';
        selectElement(id);
      },
      end() { saveUndo(); }
    },
    modifiers: [ interact.modifiers.restrictRect({ restriction: labelWrapper }) ]
  });

  interact('.element').resizable({
    edges: { left:true, right:true, bottom:true, top:true },
    listeners: {
      move(event) {
        const target = event.target;
        const id = target.dataset.id;
        const el = state.elements.find(x=>x.id===id);
        if(!el) return;
        const width = event.rect.width / state.zoom;
        const height = event.rect.height / state.zoom;
        const left = (parseFloat(target.style.left) + event.deltaRect.left) || 0;
        const top = (parseFloat(target.style.top) + event.deltaRect.top) || 0;
        target.style.width = (width*state.zoom) + 'px';
        target.style.height = (height*state.zoom) + 'px';
        target.style.left = left + 'px';
        target.style.top = top + 'px';
        el.x = pxToMm(left);
        el.y = pxToMm(top);
        el.w = pxToMm(width*state.zoom); // careful conversion; store mm
        el.h = pxToMm(height*state.zoom);
        selectElement(id);
      },
      end() { saveUndo(); }
    },
    modifiers: [ interact.modifiers.restrictEdges({ outer: labelWrapper }) ],
    inertia: true
  });

  // deselect on container click
  labelWrapper.addEventListener('pointerdown', ()=>selectElement(null));
}

function saveTemplate(){
  const name = prompt('Template name (unique)');
  if(!name) return;
  const payload = { pageW: state.pageW, pageH: state.pageH, margin: state.margin, elements: state.elements };
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action:'saveTemplate', name, payload })
  }).then(r => r.json()).then(res => {
    alert('Saved: ' + (res.action || res.status));
    loadTemplates();
  }).catch(err => alert('Save failed: ' + err.message));
}

function loadTemplates(){
  fetch(`${APPS_SCRIPT_URL}?action=listTemplates`).then(r=>r.json()).then(list=>{
    templateSelect.innerHTML = '<option value="">--Select--</option>';
    const container = document.getElementById('templateList'); container.innerHTML = '';
    list.forEach(t=>{
      const opt = document.createElement('option'); opt.value = t.name; opt.textContent = t.name;
      templateSelect.appendChild(opt);
      const d = document.createElement('div'); d.textContent = t.name; container.appendChild(d);
    });
  });
}

function loadTemplate(name){
  if(!name) return alert('Select template');
  fetch(`${APPS_SCRIPT_URL}?action=loadTemplate&name=${encodeURIComponent(name)}`).then(r=>r.json()).then(t=>{
    if(!t) return alert('Template not found');
    state.pageW = t.pageW; state.pageH = t.pageH; state.margin = t.margin;
    state.elements = t.elements || [];
    pageWInput.value = state.pageW; pageHInput.value = state.pageH; pageMarginInput.value = state.margin;
    applyPage(); renderAll();
  });
}

function deleteTemplate(){
  const name = templateSelect.value;
  if(!name) return alert('Select template');
  if(!confirm('Delete template ' + name + '?')) return;
  fetch(`${APPS_SCRIPT_URL}?action=deleteTemplate&name=${encodeURIComponent(name)}`).then(r=>r.json()).then(res=>{
    if(res.status === 'ok') { alert('Deleted'); loadTemplates(); }
    else alert(JSON.stringify(res));
  });
}

function fetchByCode(){
  const code = document.getElementById('codeInput').value.trim();
  if(!code) return alert('Enter code');
  activeCode = code;
  fetch(`${APPS_SCRIPT_URL}?action=getByCode&code=${encodeURIComponent(code)}`).then(r=>r.json()).then(res=>{
    if(!res) return alert('No response');
    if(res.status === 'ok'){
      const d = res.data;
      // Auto populate standard fields
      state.elements = [];
      if(d['Product']) addElement('text', d['Product'], 5, 5, state.pageW - 6, 8, 0);
      if(d['Brand'] || d['Model']) addElement('text', (d['Brand']||'') + ' ' + (d['Model']||''), 5, 13, state.pageW - 6, 8, 0);
      if(d['MRP']) addElement('text', 'MRP: ' + d['MRP'], 5, 21, state.pageW - 6, 8, 0);
      if(d['Barcode No']) addElement('barcode', String(d['Barcode No']), 5, 29, state.pageW - 6, 10, 0);
      renderAll();
      lastFetched = d;
      startAutoSync();
    } else alert(res.message || 'Not found');
  });
}

function startAutoSync(){
  if(autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = setInterval(()=> {
    if(!activeCode) return;
    fetch(`${APPS_SCRIPT_URL}?action=getByCode&code=${encodeURIComponent(activeCode)}`).then(r=>r.json()).then(res=>{
      if(res && res.status === 'ok' && JSON.stringify(res.data) !== JSON.stringify(lastFetched)){
        lastFetched = res.data;
        fetchByCode(); // reload
        setTimeout(()=>alert('Data updated from sheet'), 500);
      }
    });
  }, 15000);
}

function printPreview(){
  const w = window.open('', '_blank');
  const html = ['<!doctype html><html><head><meta charset="utf-8"><title>Print</title><style>@page{size:' + state.pageW + 'mm ' + state.pageH + 'mm;margin:0}body{margin:0;padding:0} .label{position:relative;width:'+state.pageW+'mm;height:'+state.pageH+'mm}</style></head><body>'];
  html.push('<div class="label">');
  for(const el of state.elements){
    if(el.type === 'text'){
      html.push('<div style="position:absolute;left:'+el.x+'mm;top:'+el.y+'mm;width:'+el.w+'mm;height:'+el.h+'mm;font-size:'+ (el.props.font||12) +'px;">' + escapeHtml(el.props.text||'') + '</div>');
    } else if (el.type === 'barcode'){
      const id = 'bc'+Math.random().toString(36).slice(2,9);
      html.push('<svg id="'+id+'" style="position:absolute;left:'+el.x+'mm;top:'+el.y+'mm;width:'+el.w+'mm;height:'+el.h+'mm"></svg>');
      html.push('<script>try{JsBarcode("#'+id+'","'+escapeHtml(String(el.props.text||''))+'",{format:"CODE128",displayValue:false,height:' + (el.h*3) + '})}catch(e){}</' + 'script>');
    } else if (el.type === 'box'){
      html.push('<div style="position:absolute;left:'+el.x+'mm;top:'+el.y+'mm;width:'+el.w+'mm;height:'+el.h+'mm;border:1px solid #000"></div>');
    }
  }
  html.push('</div></body></html>');
  w.document.write(html.join(''));
  w.document.close();
  setTimeout(()=>{ try{ w.print(); }catch(e){} }, 600);
}

function saveUndo(){ state.undoStack.push(JSON.parse(JSON.stringify(state.elements))); if(state.undoStack.length>40) state.undoStack.shift(); state.redoStack=[]; }
function undo(){ if(!state.undoStack.length) return; state.redoStack.push(state.elements); state.elements = state.undoStack.pop() || []; renderAll(); }
function redo(){ if(!state.redoStack.length) return; state.undoStack.push(state.elements); state.elements = state.redoStack.pop() || []; renderAll(); }

function toggleGrid(){ state.grid = !state.grid; labelWrapper.classList.toggle('grid', state.grid); }
function toggleSnap(){ state.snap = !state.snap; alert('Snap ' + (state.snap ? 'on' : 'off')); }
function changeZoom(delta){ state.zoom = Math.max(0.5, Math.min(2, state.zoom + delta)); zoomText.textContent = Math.round(state.zoom*100) + '%'; applyPage(); }

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// init
window.addEventListener('DOMContentLoaded', ()=>{ init(); setupInteract(); });

// Note: need to call renderAll when DOM updates for draggable/resizing; setupInteract delegates to elements created
