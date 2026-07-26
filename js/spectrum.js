export function extractSpectrum(ctx, roi, mode = 'mean') {
  const { x, y, w, h } = roi;
  const imageData = ctx.getImageData(x, y, w, h).data;
  const result = new Array(w).fill(0);

  for (let col = 0; col < w; col += 1) {
    const values = [];
    let total = 0;
    let max = 0;
    for (let row = 0; row < h; row += 1) {
      const i = (row * w + col) * 4;
      const gray = 0.2126 * imageData[i] + 0.7152 * imageData[i + 1] + 0.0722 * imageData[i + 2];
      total += gray;
      if (gray > max) max = gray;
      if (mode === 'median') values.push(gray);
    }
    if (mode === 'sum') result[col] = total;
    else if (mode === 'max') result[col] = max;
    else if (mode === 'median') {
      values.sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      result[col] = values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    } else result[col] = total / h;
  }
  return result;
}

export function drawSpectrum(canvas, values) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i += 1) {
    const y = 20 + ((h - 50) * i) / 5;
    ctx.beginPath(); ctx.moveTo(44, y); ctx.lineTo(w - 14, y); ctx.stroke();
  }
  if (!values.length) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1e-9, max - min);
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 3;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = 44 + (i / Math.max(1, values.length - 1)) * (w - 60);
    const y = h - 30 - ((v - min) / range) * (h - 55);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.fillStyle = '#475569';
  ctx.font = '18px system-ui';
  ctx.fillText('Intensity', 10, 18);
  ctx.fillText('Pixel', w - 55, h - 8);
}
