const CHANNELS = {
  gray: (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b,
  red: (r) => r,
  green: (_r, g) => g,
  blue: (_r, _g, b) => b,
  meanRgb: (r, g, b) => (r + g + b) / 3
};

/**
 * FIJI Plot Profile 방식과 같이 ROI의 각 x열에서 세로 방향 값을 집계합니다.
 * channel: gray | red | green | blue | meanRgb
 * reducer: mean | median | max | sum
 */
export function extractSpectrum(sourceCtx, roi, channel = 'gray', reducer = 'mean') {
  const x = Math.round(roi.x);
  const y = Math.round(roi.y);
  const w = Math.max(1, Math.round(roi.w));
  const h = Math.max(1, Math.round(roi.h));
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
      result[col] = column.length % 2
        ? column[mid]
        : (column[mid - 1] + column[mid]) / 2;
    } else result[col] = total / h;
  }

  return result;
}

export function drawSpectrum(canvas, values, { fixed255 = true } = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const left = 58;
  const right = 18;
  const top = 22;
  const bottom = 42;
  const plotW = w - left - right;
  const plotH = h - top - bottom;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, w, h);
  ctx.font = '15px system-ui';
  ctx.fillStyle = '#475569';

  const yMin = 0;
  const actualMax = values.length ? Math.max(...values) : 255;
  const yMax = fixed255 ? 255 : Math.max(1, actualMax * 1.05);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const y = top + (plotH * i) / 5;
    const label = yMax - ((yMax - yMin) * i) / 5;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(w - right, y);
    ctx.stroke();
    ctx.fillText(label.toFixed(0), 8, y + 5);
  }

  ctx.strokeStyle = '#64748b';
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, h - bottom);
  ctx.lineTo(w - right, h - bottom);
  ctx.stroke();

  if (values.length) {
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    values.forEach((value, i) => {
      const x = left + (i / Math.max(1, values.length - 1)) * plotW;
      const clipped = Math.max(yMin, Math.min(yMax, value));
      const y = top + (1 - (clipped - yMin) / (yMax - yMin)) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  ctx.fillStyle = '#334155';
  ctx.fillText('Intensity', left, 16);
  ctx.fillText('Pixel', w - 55, h - 10);
  if (values.length) {
    ctx.fillText('0', left - 4, h - 18);
    ctx.fillText(String(values.length - 1), w - right - 32, h - 18);
  }
}

export function spectrumToCsv(values, metadata = {}) {
  const metaLines = Object.entries(metadata)
    .map(([key, value]) => `# ${key},${String(value).replaceAll(',', ' ')}`);
  const rows = ['pixel,intensity', ...values.map((v, i) => `${i},${Number(v).toFixed(6)}`)];
  return [...metaLines, ...rows].join('\n');
}
