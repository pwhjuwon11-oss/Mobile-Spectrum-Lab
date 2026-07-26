const CHANNELS = {
  gray: (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b,
  red: (r) => r,
  green: (_r, g) => g,
  blue: (_r, _g, b) => b
};

export function extractSpectrum(sourceCtx, roi, channel = 'gray', reducer = 'mean') {
  const canvasW = sourceCtx.canvas.width;
  const canvasH = sourceCtx.canvas.height;
  const x = Math.max(0, Math.min(canvasW - 1, Math.floor(Number(roi.x) || 0)));
  const y = Math.max(0, Math.min(canvasH - 1, Math.floor(Number(roi.y) || 0)));
  const requestedW = Math.max(1, Math.round(Number(roi.w) || 1));
  const requestedH = Math.max(1, Math.round(Number(roi.h) || 1));
  const w = Math.max(1, Math.min(requestedW, canvasW - x));
  const h = Math.max(1, Math.min(requestedH, canvasH - y));
  const pixels = sourceCtx.getImageData(x, y, w, h).data;
  const toValue = CHANNELS[channel] || CHANNELS.gray;
  const result = new Array(w).fill(0);

  for (let col = 0; col < w; col += 1) {
    const column = reducer === 'median' ? [] : null;
    let total = 0;
    let maximum = -Infinity;
    for (let row = 0; row < h; row += 1) {
      const i = (row * w + col) * 4;
      const value = toValue(pixels[i], pixels[i + 1], pixels[i + 2]);
      total += value;
      if (value > maximum) maximum = value;
      if (column) column.push(value);
    }
    if (reducer === 'sum') result[col] = total;
    else if (reducer === 'max') result[col] = maximum;
    else if (reducer === 'median') {
      column.sort((a, b) => a - b);
      const mid = Math.floor(column.length / 2);
      result[col] = column.length % 2 ? column[mid] : (column[mid - 1] + column[mid]) / 2;
    } else result[col] = total / h;
  }
  return result;
}

export function extractRgbSpectra(sourceCtx, roi, reducer = 'mean') {
  return {
    red: extractSpectrum(sourceCtx, roi, 'red', reducer),
    green: extractSpectrum(sourceCtx, roi, 'green', reducer),
    blue: extractSpectrum(sourceCtx, roi, 'blue', reducer)
  };
}

const STYLES = {
  gray: { line: '#475569', fillTop: 'rgba(71,85,105,.20)', fillBottom: 'rgba(71,85,105,.02)', label: 'Gray' },
  red: { line: '#dc2626', fillTop: 'rgba(220,38,38,.16)', fillBottom: 'rgba(220,38,38,.01)', label: 'Red' },
  green: { line: '#16a34a', fillTop: 'rgba(22,163,74,.16)', fillBottom: 'rgba(22,163,74,.01)', label: 'Green' },
  blue: { line: '#2563eb', fillTop: 'rgba(37,99,235,.16)', fillBottom: 'rgba(37,99,235,.01)', label: 'Blue' }
};

export function drawSpectrum(canvas, data, { fixed255 = true, channel = 'gray', visibleChannels = ['red','green','blue'] } = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const left = 62, right = 24, top = 30, bottom = 48;
  const plotW = w - left - right;
  const plotH = h - top - bottom;
  const isOverlay = channel === 'rgbOverlay' || (data && !Array.isArray(data));
  const series = isOverlay
    ? visibleChannels.filter(k => data?.[k]?.length).map(k => ({ key:k, values:data[k], style:STYLES[k] }))
    : [{ key:channel, values:Array.isArray(data) ? data : [], style:STYLES[channel] || STYLES.gray }];
  const allValues = series.flatMap(s => s.values);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, w, h);
  ctx.font = '14px system-ui';
  const yMin = 0;
  const actualMax = allValues.length ? Math.max(...allValues) : 255;
  const yMax = fixed255 ? 255 : Math.max(1, actualMax * 1.05);

  ctx.strokeStyle = '#dbe3ec';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const y = top + (plotH * i) / 5;
    const label = yMax - ((yMax - yMin) * i) / 5;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w-right, y); ctx.stroke();
    ctx.fillStyle = '#64748b'; ctx.fillText(label.toFixed(0), 12, y + 5);
  }
  const pointCount = series[0]?.values.length || 0;
  for (let i = 0; i <= 5; i += 1) {
    const x = left + (plotW * i) / 5;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, h-bottom); ctx.stroke();
    if (pointCount) {
      const label = Math.round(((pointCount - 1) * i) / 5);
      ctx.fillStyle = '#64748b';
      ctx.fillText(String(label), x - 8, h - 24);
    }
  }
  ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, h-bottom); ctx.lineTo(w-right, h-bottom); ctx.stroke();

  series.forEach(({values, style}) => {
    if (!values.length) return;
    if (!isOverlay) {
      const gradient = ctx.createLinearGradient(0, top, 0, h-bottom);
      gradient.addColorStop(0, style.fillTop); gradient.addColorStop(1, style.fillBottom);
      ctx.beginPath();
      values.forEach((value, i) => {
        const x = left + (i / Math.max(1, values.length-1)) * plotW;
        const clipped = Math.max(yMin, Math.min(yMax, value));
        const y = top + (1 - (clipped-yMin)/(yMax-yMin))*plotH;
        i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
      });
      ctx.lineTo(w-right,h-bottom); ctx.lineTo(left,h-bottom); ctx.closePath();
      ctx.fillStyle = gradient; ctx.fill();
    }
    ctx.strokeStyle = style.line; ctx.lineWidth = isOverlay ? 2.2 : 2.6;
    ctx.beginPath();
    values.forEach((value, i) => {
      const x = left + (i / Math.max(1, values.length-1)) * plotW;
      const clipped = Math.max(yMin, Math.min(yMax, value));
      const y = top + (1 - (clipped-yMin)/(yMax-yMin))*plotH;
      i ? ctx.lineTo(x,y) : ctx.moveTo(x,y);
    });
    ctx.stroke();
  });

  ctx.fillStyle = '#334155'; ctx.font = '15px system-ui';
  ctx.fillText('Intensity', left, 20); ctx.fillText('Pixel', w-62, h-10);
  let lx = w - 210;
  series.forEach(({style}) => {
    ctx.strokeStyle = style.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(lx,16); ctx.lineTo(lx+20,16); ctx.stroke();
    ctx.fillStyle = '#334155'; ctx.font = 'bold 13px system-ui'; ctx.fillText(style.label, lx+26,20);
    lx += style.label.length > 4 ? 76 : 62;
  });
}

export function spectrumToCsv(data, metadata = {}) {
  const metaLines = Object.entries(metadata).map(([key, value]) => `# ${key},${String(value).replaceAll(',', ' ')}`);
  if (data && !Array.isArray(data)) {
    const keys = ['red','green','blue'].filter(k => data[k]?.length);
    const n = Math.max(0, ...keys.map(k => data[k].length));
    const rows = [`pixel,${keys.join(',')}`];
    for (let i=0;i<n;i+=1) rows.push(`${i},${keys.map(k => Number(data[k][i] ?? '').toFixed(6)).join(',')}`);
    return [...metaLines, ...rows].join('\n');
  }
  const values = Array.isArray(data) ? data : [];
  return [...metaLines, 'pixel,intensity', ...values.map((v,i)=>`${i},${Number(v).toFixed(6)}`)].join('\n');
}
