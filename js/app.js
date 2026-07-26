import { loadState, saveState, downloadJSON } from './storage.js';
import { extractSpectrum, drawSpectrum, spectrumToCsv } from './spectrum.js';

const $ = (id) => document.getElementById(id);
const canvas = $('imageCanvas');
const displayCtx = canvas.getContext('2d');
const sourceCanvas = document.createElement('canvas');
const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
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
  roi: { x: 0, y: 0, w: 0, h: 0, locked: false, initialized: false },
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

function downloadText(text, filename, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

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
  $('roiX').value = Math.round(roi.x || 0);
  $('roiY').value = Math.round(roi.y || 0);
  $('roiW').value = Math.round(roi.w || 0);
  $('roiH').value = Math.round(roi.h || 0);
  $('lockRoiBtn').textContent = roi.locked ? '🔒 크기 잠김' : '🔓 크기 잠금';
  ['roiX','roiY','roiW','roiH'].forEach(id => $(id).disabled = !image || (roi.locked && ['roiW','roiH'].includes(id)));
  $('lockRoiBtn').disabled = !image;
  $('roiSummary').textContent = roi.initialized ? `${Math.round(roi.w)} × ${Math.round(roi.h)}${roi.locked ? ' 🔒' : ''}` : '미설정';
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

function initializeOrClampRoi() {
  const roi = currentProject().roi;
  if (!roi.initialized || !roi.w || !roi.h) {
    // 요청사항: 첫 ROI 가로폭은 이미지 너비의 22%
    roi.w = Math.max(8, Math.round(canvas.width * 0.22));
    roi.h = Math.max(8, Math.round(canvas.height * 0.12));
    roi.x = Math.round((canvas.width - roi.w) / 2);
    roi.y = Math.round((canvas.height - roi.h) / 2);
    roi.initialized = true;
  }
  roi.w = clamp(roi.w, 8, canvas.width);
  roi.h = clamp(roi.h, 8, canvas.height);
  roi.x = clamp(roi.x, 0, canvas.width - roi.w);
  roi.y = clamp(roi.y, 0, canvas.height - roi.h);
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
      sourceCanvas.width = img.naturalWidth;
      sourceCanvas.height = img.naturalHeight;
      sourceCtx.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
      sourceCtx.drawImage(img, 0, 0);
      $('canvasWrap').classList.remove('empty');
      $('emptyGuide').style.display = 'none';
      initializeOrClampRoi();
      enableMeasurementControls(true);
      redraw();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function enableMeasurementControls(enabled) {
  $('profileMode').disabled = !enabled;
  $('channelMode').disabled = !enabled;
  $('saveMeasurementBtn').disabled = !enabled;
  $('exportSpectrumCsvBtn').disabled = !enabled;
  syncRoiInputs();
}

function redraw() {
  if (!image) return;
  const roi = currentProject().roi;

  // 핵심 수정: 주황색 ROI 표시를 그리기 전에 원본 전용 canvas에서 값을 추출
  try {
    spectrum = extractSpectrum(sourceCtx, roi, $('channelMode').value, $('profileMode').value);
  } catch (error) {
    console.error('Spectrum extraction failed:', error);
    spectrum = [];
    drawSpectrum(spectrumCanvas, []);
    $('spectrumLength').textContent = '포인트: 0';
    $('spectrumPeak').textContent = '최대값: 오류';
    $('spectrumRange').textContent = 'ROI 경계를 다시 확인하세요';
    return;
  }

  displayCtx.clearRect(0, 0, canvas.width, canvas.height);
  displayCtx.drawImage(image, 0, 0);
  displayCtx.save();
  displayCtx.strokeStyle = '#f97316';
  displayCtx.lineWidth = Math.max(2, canvas.width / 500);
  displayCtx.fillStyle = 'rgba(249,115,22,.12)';
  displayCtx.fillRect(roi.x, roi.y, roi.w, roi.h);
  displayCtx.strokeRect(roi.x, roi.y, roi.w, roi.h);
  if (!roi.locked) {
    const s = Math.max(12, canvas.width / 45);
    displayCtx.fillStyle = '#f97316';
    displayCtx.fillRect(roi.x + roi.w - s, roi.y + roi.h - s, s, s);
  }
  displayCtx.restore();

  drawSpectrum(spectrumCanvas, spectrum, { fixed255: $('profileMode').value !== 'sum' });
  const min = Math.min(...spectrum);
  const max = Math.max(...spectrum);
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
  e.preventDefault();
  const p = pointerToCanvas(e);
  const roi = currentProject().roi;
  const handle = Math.max(18, canvas.width / 35);
  const inHandle = !roi.locked && p.x >= roi.x + roi.w - handle && p.y >= roi.y + roi.h - handle && p.x <= roi.x + roi.w && p.y <= roi.y + roi.h;
  const inside = p.x >= roi.x && p.x <= roi.x + roi.w && p.y >= roi.y && p.y <= roi.y + roi.h;
  if (!inside) return;
  dragMode = inHandle ? 'resize' : 'move';
  dragStart = { p, roi: { ...roi } };
  if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragMode || !dragStart) return;
  e.preventDefault();
  const p = pointerToCanvas(e);
  const roi = currentProject().roi;
  const dx = p.x - dragStart.p.x;
  const dy = p.y - dragStart.p.y;
  if (dragMode === 'move') {
    roi.x = clamp(dragStart.roi.x + dx, 0, canvas.width - roi.w);
    roi.y = clamp(dragStart.roi.y + dy, 0, canvas.height - roi.h);
  } else {
    roi.w = clamp(dragStart.roi.w + dx, 8, canvas.width - roi.x);
    roi.h = clamp(dragStart.roi.h + dy, 8, canvas.height - roi.y);
  }
  redraw();
});
['pointerup','pointercancel','pointerleave'].forEach(name => canvas.addEventListener(name, (e) => {
  if (dragMode) {
    saveState(state);
    if (e?.pointerId != null && canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    dragMode = null;
    dragStart = null;
  }
}));

['cameraInput','galleryInput'].forEach(id => $(id).addEventListener('change', e => setImage(e.target.files[0])));
$('profileMode').addEventListener('change', redraw);
$('channelMode').addEventListener('change', redraw);
$('projectSelect').addEventListener('change', e => {
  state.currentProjectId = e.target.value;
  saveState(state);
  image = null;
  spectrum = [];
  $('canvasWrap').classList.add('empty');
  $('emptyGuide').style.display = '';
  displayCtx.clearRect(0, 0, canvas.width, canvas.height);
  drawSpectrum(spectrumCanvas, []);
  enableMeasurementControls(false);
  renderProjectSelect();
});

$('newProjectBtn').addEventListener('click', () => $('projectDialog').showModal());
$('createProjectConfirm').addEventListener('click', (e) => {
  e.preventDefault();
  const name = $('newProjectName').value.trim();
  if (!name) return;
  const p = defaultProject();
  p.name = name;
  p.lightSource = $('newLightSource').value.trim() || '미설정';
  state.projects.push(p);
  state.currentProjectId = p.id;
  saveState(state);
  $('projectDialog').close();
  $('projectForm').reset();
  renderProjectSelect();
});

$('lockRoiBtn').addEventListener('click', () => {
  const roi = currentProject().roi;
  roi.locked = !roi.locked;
  saveState(state);
  syncRoiInputs();
  redraw();
});
['roiX','roiY','roiW','roiH'].forEach(id => $(id).addEventListener('input', () => {
  if (!image) return;
  const roi = currentProject().roi;
  roi.x = clamp(Number($('roiX').value), 0, canvas.width - roi.w);
  roi.y = clamp(Number($('roiY').value), 0, canvas.height - roi.h);
  if (!roi.locked) {
    roi.w = clamp(Number($('roiW').value), 8, canvas.width - roi.x);
    roi.h = clamp(Number($('roiH').value), 8, canvas.height - roi.y);
  }
  saveState(state);
  redraw();
}));

document.querySelectorAll('.type-btn').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeType = btn.dataset.type;
  $('materialWrap').classList.toggle('hidden', activeType !== 'standard');
  updateAutoName();
}));
$('materialSelect').addEventListener('change', updateAutoName);

$('saveMeasurementBtn').addEventListener('click', () => {
  if (!image || !spectrum.length) return;
  const p = currentProject();
  const m = {
    id: crypto.randomUUID(),
    type: activeType,
    material: activeType === 'standard' ? $('materialSelect').value : null,
    name: $('sampleName').value.trim() || 'UNNAMED',
    memo: $('memo').value.trim(),
    createdAt: new Date().toISOString(),
    roi: { ...p.roi },
    channelMode: $('channelMode').value,
    profileMode: $('profileMode').value,
    rawSpectrum: spectrum.map(v => Number(v.toFixed(4))),
    device: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`
  };
  p.measurements.push(m);
  saveState(state);
  renderSession();
  updateAutoName();
  $('memo').value = '';
  alert(`${m.name} 저장 완료`);
});

$('exportSpectrumCsvBtn').addEventListener('click', () => {
  if (!spectrum.length) return;
  const p = currentProject();
  const name = $('sampleName').value.trim() || 'spectrum';
  const csv = spectrumToCsv(spectrum, {
    project: p.name,
    sample: name,
    channel: $('channelMode').value,
    vertical_reducer: $('profileMode').value,
    roi_x: Math.round(p.roi.x),
    roi_y: Math.round(p.roi.y),
    roi_width: Math.round(p.roi.w),
    roi_height: Math.round(p.roi.h),
    exported_at: new Date().toISOString()
  });
  downloadText(csv, `${name}_spectrum.csv`, 'text/csv;charset=utf-8');
});

$('exportBtn').addEventListener('click', () => {
  const p = currentProject();
  const safe = p.name.replace(/[^a-zA-Z0-9가-힣_-]+/g,'_');
  downloadJSON(p, `${safe}_MobileSpectrumLab.json`);
});
$('resetProjectBtn').addEventListener('click', () => {
  if (!confirm('현재 프로젝트의 모든 측정값을 삭제할까요?')) return;
  currentProject().measurements = [];
  saveState(state);
  renderSession();
  updateAutoName();
});

renderProjectSelect();
drawSpectrum(spectrumCanvas, []);
