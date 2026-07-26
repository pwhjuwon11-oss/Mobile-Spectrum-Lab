import { loadState, saveState, downloadJSON } from './storage.js';
import { extractSpectrum, drawSpectrum } from './spectrum.js';

const $ = (id) => document.getElementById(id);
const canvas = $('imageCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const spectrumCanvas = $('spectrumCanvas');

let image = null;
let spectrum = [];
let activeType = 'blank';
let dragMode = null;
let dragStart = null;

const defaultProject = () => ({
  id: crypto.randomUUID(),
  name: '기본 프로젝트',
  lightSource: '미설정',
  createdAt: new Date().toISOString(),
  roi: { x: 20, y: 20, w: 260, h: 60, locked: false },
  measurements: []
});

let state = loadState() || { currentProjectId: null, projects: [] };
if (!state.projects.length) {
  const p = defaultProject();
  state.projects.push(p);
  state.currentProjectId = p.id;
  saveState(state);
}

const currentProject = () => state.projects.find(p => p.id === state.currentProjectId) || state.projects[0];
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function renderProjectSelect() {
  $('projectSelect').innerHTML = state.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  $('projectSelect').value = state.currentProjectId;
  const p = currentProject();
  $('projectLightSource').textContent = `광원: ${p.lightSource || '미설정'}`;
  $('projectCreatedAt').textContent = `생성일: ${new Date(p.createdAt).toLocaleDateString('ko-KR')}`;
  syncRoiInputs();
  renderSession();
  updateAutoName();
}

function syncRoiInputs() {
  const roi = currentProject().roi;
  $('roiX').value = Math.round(roi.x);
  $('roiY').value = Math.round(roi.y);
  $('roiW').value = Math.round(roi.w);
  $('roiH').value = Math.round(roi.h);
  $('lockRoiBtn').textContent = roi.locked ? '🔒 크기 잠김' : '🔓 크기 잠금';
  ['roiX','roiY','roiW','roiH'].forEach(id => $(id).disabled = !image || (roi.locked && ['roiW','roiH'].includes(id)));
  $('lockRoiBtn').disabled = !image;
  $('roiSummary').textContent = `${Math.round(roi.w)} × ${Math.round(roi.h)}${roi.locked ? ' 🔒' : ''}`;
}

function renderSession() {
  const ms = currentProject().measurements;
  $('blankCount').textContent = ms.filter(m => m.type === 'blank').length;
  $('standardCount').textContent = ms.filter(m => m.type === 'standard').length;
  $('unknownCount').textContent = ms.filter(m => m.type === 'unknown').length;
  const counts = {};
  ms.filter(m => m.type === 'standard').forEach(m => counts[m.material] = (counts[m.material] || 0) + 1);
  $('materialCounts').innerHTML = Object.entries(counts).map(([k,v]) => `<span>${k} ${v}</span>`).join('');
}

function updateAutoName() {
  const ms = currentProject().measurements;
  let prefix = 'BLANK';
  let count = ms.filter(m => m.type === activeType).length + 1;
  if (activeType === 'standard') {
    prefix = $('materialSelect').value;
    count = ms.filter(m => m.type === 'standard' && m.material === prefix).length + 1;
  } else if (activeType === 'unknown') prefix = 'UNKNOWN';
  $('sampleName').value = `${prefix}-${String(count).padStart(3, '0')}`;
}

function setImage(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      image = img;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      $('canvasWrap').classList.remove('empty');
      $('emptyGuide').style.display = 'none';
      const roi = currentProject().roi;
      roi.w = clamp(roi.w, 8, canvas.width);
      roi.h = clamp(roi.h, 8, canvas.height);
      roi.x = clamp(roi.x, 0, canvas.width - roi.w);
      roi.y = clamp(roi.y, 0, canvas.height - roi.h);
      enableMeasurementControls(true);
      redraw();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function enableMeasurementControls(enabled) {
  $('profileMode').disabled = !enabled;
  $('saveMeasurementBtn').disabled = !enabled;
  syncRoiInputs();
}

function redraw() {
  if (!image) return;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image, 0, 0);
  const roi = currentProject().roi;
  ctx.save();
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = Math.max(2, canvas.width / 500);
  ctx.fillStyle = 'rgba(249,115,22,.12)';
  ctx.fillRect(roi.x, roi.y, roi.w, roi.h);
  ctx.strokeRect(roi.x, roi.y, roi.w, roi.h);
  if (!roi.locked) {
    const s = Math.max(12, canvas.width / 45);
    ctx.fillStyle = '#f97316';
    ctx.fillRect(roi.x + roi.w - s, roi.y + roi.h - s, s, s);
  }
  ctx.restore();
  spectrum = extractSpectrum(ctx, roi, $('profileMode').value);
  drawSpectrum(spectrumCanvas, spectrum);
  const min = Math.min(...spectrum), max = Math.max(...spectrum);
  $('spectrumLength').textContent = `포인트: ${spectrum.length}`;
  $('spectrumPeak').textContent = `최대값: ${max.toFixed(2)}`;
  $('spectrumRange').textContent = `범위: ${(max-min).toFixed(2)}`;
  syncRoiInputs();
}

function pointerToCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
}

canvas.addEventListener('pointerdown', (e) => {
  if (!image) return;
  const p = pointerToCanvas(e);
  const roi = currentProject().roi;
  const handle = Math.max(18, canvas.width / 35);
  const inHandle = !roi.locked && p.x >= roi.x + roi.w - handle && p.y >= roi.y + roi.h - handle && p.x <= roi.x + roi.w && p.y <= roi.y + roi.h;
  const inside = p.x >= roi.x && p.x <= roi.x + roi.w && p.y >= roi.y && p.y <= roi.y + roi.h;
  if (!inside) return;
  dragMode = inHandle ? 'resize' : 'move';
  dragStart = { p, roi: { ...roi } };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragMode || !dragStart) return;
  const p = pointerToCanvas(e);
  const roi = currentProject().roi;
  const dx = p.x - dragStart.p.x, dy = p.y - dragStart.p.y;
  if (dragMode === 'move') {
    roi.x = clamp(dragStart.roi.x + dx, 0, canvas.width - roi.w);
    roi.y = clamp(dragStart.roi.y + dy, 0, canvas.height - roi.h);
  } else {
    roi.w = clamp(dragStart.roi.w + dx, 8, canvas.width - roi.x);
    roi.h = clamp(dragStart.roi.h + dy, 8, canvas.height - roi.y);
  }
  redraw();
});
['pointerup','pointercancel'].forEach(name => canvas.addEventListener(name, () => {
  if (dragMode) { saveState(state); dragMode = null; dragStart = null; }
}));

['cameraInput','galleryInput'].forEach(id => $(id).addEventListener('change', e => setImage(e.target.files[0])));
$('profileMode').addEventListener('change', redraw);
$('projectSelect').addEventListener('change', e => { state.currentProjectId = e.target.value; saveState(state); image = null; spectrum = []; $('canvasWrap').classList.add('empty'); $('emptyGuide').style.display = ''; ctx.clearRect(0,0,canvas.width,canvas.height); drawSpectrum(spectrumCanvas, []); enableMeasurementControls(false); renderProjectSelect(); });

$('newProjectBtn').addEventListener('click', () => $('projectDialog').showModal());
$('createProjectConfirm').addEventListener('click', (e) => {
  e.preventDefault();
  const name = $('newProjectName').value.trim();
  if (!name) return;
  const p = defaultProject(); p.name = name; p.lightSource = $('newLightSource').value.trim() || '미설정';
  state.projects.push(p); state.currentProjectId = p.id; saveState(state);
  $('projectDialog').close(); $('projectForm').reset(); renderProjectSelect();
});

$('lockRoiBtn').addEventListener('click', () => { const roi = currentProject().roi; roi.locked = !roi.locked; saveState(state); syncRoiInputs(); redraw(); });
['roiX','roiY','roiW','roiH'].forEach(id => $(id).addEventListener('input', () => {
  if (!image) return;
  const roi = currentProject().roi;
  roi.x = clamp(Number($('roiX').value), 0, canvas.width - roi.w);
  roi.y = clamp(Number($('roiY').value), 0, canvas.height - roi.h);
  if (!roi.locked) {
    roi.w = clamp(Number($('roiW').value), 8, canvas.width - roi.x);
    roi.h = clamp(Number($('roiH').value), 8, canvas.height - roi.y);
  }
  saveState(state); redraw();
}));

document.querySelectorAll('.type-btn').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active'); activeType = btn.dataset.type;
  $('materialWrap').classList.toggle('hidden', activeType !== 'standard'); updateAutoName();
}));
$('materialSelect').addEventListener('change', updateAutoName);

$('saveMeasurementBtn').addEventListener('click', () => {
  if (!image || !spectrum.length) return;
  const p = currentProject();
  const m = {
    id: crypto.randomUUID(), type: activeType,
    material: activeType === 'standard' ? $('materialSelect').value : null,
    name: $('sampleName').value.trim() || 'UNNAMED', memo: $('memo').value.trim(),
    createdAt: new Date().toISOString(), roi: { ...p.roi }, profileMode: $('profileMode').value,
    rawSpectrum: spectrum.map(v => Number(v.toFixed(4))),
    device: navigator.userAgent, viewport: `${window.innerWidth}x${window.innerHeight}`
  };
  p.measurements.push(m); saveState(state); renderSession(); updateAutoName(); $('memo').value = '';
  alert(`${m.name} 저장 완료`);
});

$('exportBtn').addEventListener('click', () => {
  const p = currentProject();
  const safe = p.name.replace(/[^a-zA-Z0-9가-힣_-]+/g,'_');
  downloadJSON(p, `${safe}_MobileSpectrumLab.json`);
});
$('resetProjectBtn').addEventListener('click', () => {
  if (!confirm('현재 프로젝트의 모든 측정값을 삭제할까요?')) return;
  currentProject().measurements = []; saveState(state); renderSession(); updateAutoName();
});

renderProjectSelect();
drawSpectrum(spectrumCanvas, []);
