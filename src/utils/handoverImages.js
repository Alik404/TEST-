/**
 * Image work for handover notes, all in the browser:
 *  - preparePhoto: shrinks a camera photo before upload (longest side 1600px,
 *    JPEG 0.8) and makes a small thumbnail for the lists.
 *  - renderNoteImage: draws the export image (photo on top, information strip
 *    under it) straight onto a canvas, never through html2canvas.
 *  - shareFiles / downloadFiles: send the result to Viber or WhatsApp, or save it.
 */

const UPLOAD = { maxSide: 1600, quality: 0.8, thumbSide: 360, thumbQuality: 0.72 };

/* The export look is fixed by the project's spec. These are pixels inside a
   JPEG, not interface colors, so they do not follow the light/dark theme. */
const EXPORT = {
  width: 1080,
  quality: 0.88,
  maxPhotoHeight: 2160,
  pad: 40,
  rule: 10,
  navy: '#14304f',   // ds-allow-hardcode: export spec, strip background
  orange: '#d98b1c', // ds-allow-hardcode: export spec, rule above the strip
  badge: '#f3b44f',  // ds-allow-hardcode: export spec, note number box (navy on it 7.32:1)
  text: '#ffffff',   // ds-allow-hardcode: 13.41:1 on the navy strip
  label: '#b9c8da',  // ds-allow-hardcode: 7.88:1 on the navy strip
  divider: 'rgba(255, 255, 255, 0.18)',
};

const FONT_FAMILY = "Cairo, 'Segoe UI', Tahoma, sans-serif";
const font = (weight, size) => `${weight} ${size}px ${FONT_FAMILY}`;

// Arabic and Latin samples, so both unicode-range parts of Cairo are fetched.
const FONT_SAMPLE = 'رقم الملاحظة النزلة النوع التاريخ الجلي B37-D01 27/10/2026';

const toBlob = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('canvas.toBlob failed'))), 'image/jpeg', quality);
});

const decodeImage = async (blob) => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' });
    } catch {
      // Older engines: fall through to <img>.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const sizeOf = (img) => ({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });

const scaledJpeg = (img, maxSide, quality) => {
  const { w, h } = sizeOf(img);
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // ds-allow-hardcode: JPEG has no alpha; transparent PNG areas become white
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return toBlob(canvas, quality);
};

/** Camera or gallery file -> { full, thumb } JPEG blobs ready to upload. */
export async function preparePhoto(file) {
  const img = await decodeImage(file);
  try {
    const full = await scaledJpeg(img, UPLOAD.maxSide, UPLOAD.quality);
    const thumb = await scaledJpeg(img, UPLOAD.thumbSide, UPLOAD.thumbQuality);
    return { full, thumb };
  } finally {
    img.close?.();
  }
}

export const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

/** A stored photo, fetched fresh so the canvas stays exportable. */
export async function loadPhoto(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`photo ${res.status}`);
  return decodeImage(await res.blob());
}

/**
 * Waits for Cairo before any text is drawn. Without it the canvas silently
 * uses a fallback face. Returns false when the font could not be loaded.
 */
export async function ensureExportFonts() {
  if (!document.fonts?.load) return false;
  try {
    const loaded = await Promise.all([
      document.fonts.load(font(700, STRIP.valueSize), FONT_SAMPLE),
      document.fonts.load(font(600, STRIP.labelSize), FONT_SAMPLE),
      document.fonts.load(font(500, STRIP.bodySize), FONT_SAMPLE),
    ]);
    return loaded.every(faces => faces.length > 0);
  } catch {
    return false;
  }
}

// Shrinks the font until the text fits the width, down to a floor.
const fitFont = (ctx, text, weight, size, maxWidth, floor) => {
  let s = size;
  ctx.font = font(weight, s);
  while (s > floor && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = font(weight, s);
  }
  return s;
};

const wrapLines = (ctx, text, maxWidth) => {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (!line || ctx.measureText(next).width <= maxWidth) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
};

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Vertical rhythm of the strip, in pixels of the 1080px-wide image. A phone
// shows the image about 390px wide, so 46px here reads as about 16-17px there.
const STRIP = {
  metaTop: 40, labelSize: 32, labelGap: 14, valueRow: 88, valueSize: 50,
  dividerGap: 32, noteLabelGap: 16, bodySize: 46, bodyLine: 1.55, bodyMinSize: 38,
  maxLines: 12, bottom: 52,
};

const bodyLayout = (ctx, text) => {
  const maxWidth = EXPORT.width - EXPORT.pad * 2;
  let size = STRIP.bodySize;
  ctx.font = font(500, size);
  let lines = wrapLines(ctx, text, maxWidth);
  while (lines.length > 6 && size > STRIP.bodyMinSize) {
    size -= 2;
    ctx.font = font(500, size);
    lines = wrapLines(ctx, text, maxWidth);
  }
  if (lines.length > STRIP.maxLines) {
    lines = lines.slice(0, STRIP.maxLines);
    lines[lines.length - 1] = `${lines[lines.length - 1]} …`;
  }
  return { size, lines, lineHeight: Math.round(size * STRIP.bodyLine) };
};

/**
 * One export image: the photo (or nothing, for a note without photos) and,
 * under it, the strip with exactly: note number, level, type, date, and the
 * note text. No names of any person or company are drawn.
 */
export async function renderNoteImage({ photo, number, level, typeLabel, date, text }) {
  const { width: W, pad: P } = EXPORT;
  const measure = document.createElement('canvas').getContext('2d');
  const body = bodyLayout(measure, text);

  const metaLabelY = EXPORT.rule + STRIP.metaTop + STRIP.labelSize / 2;
  const valueY = metaLabelY + STRIP.labelSize / 2 + STRIP.labelGap + STRIP.valueRow / 2;
  const dividerY = valueY + STRIP.valueRow / 2 + STRIP.dividerGap;
  const noteLabelY = dividerY + STRIP.dividerGap + STRIP.labelSize / 2;
  const firstLineY = noteLabelY + STRIP.labelSize / 2 + STRIP.noteLabelGap + body.lineHeight / 2;
  const stripHeight = Math.ceil(firstLineY + (body.lines.length - 0.5) * body.lineHeight + STRIP.bottom);

  let photoH = 0;
  let drawW = W;
  if (photo) {
    const { w, h } = sizeOf(photo);
    const natural = Math.round(h * W / w);
    photoH = Math.min(natural, EXPORT.maxPhotoHeight);
    drawW = natural > photoH ? Math.round(w * photoH / h) : W;
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = photoH + stripHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = EXPORT.navy;
  ctx.fillRect(0, 0, W, canvas.height);

  if (photo) {
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(photo, Math.round((W - drawW) / 2), 0, drawW, photoH);
  }

  const top = photoH;
  ctx.fillStyle = EXPORT.orange;
  ctx.fillRect(0, top, W, EXPORT.rule);
  ctx.textBaseline = 'middle';

  // Four columns, read right to left: number, level, type, date.
  const colW = (W - P * 2) / 4;
  const columns = [
    { label: 'رقم الملاحظة', value: number, badge: true },
    { label: 'النزلة', value: level },
    { label: 'النوع', value: typeLabel, arabic: true },
    { label: 'التاريخ', value: date },
  ];

  columns.forEach((col, i) => {
    const cx = W - P - colW * (i + 0.5);

    ctx.direction = 'rtl';
    ctx.textAlign = 'center';
    ctx.fillStyle = EXPORT.label;
    ctx.font = font(600, STRIP.labelSize);
    ctx.fillText(col.label, cx, top + metaLabelY);

    // Latin values are drawn left to right on their own, so "B37-01" and
    // "27/10/2026" can never be reordered by the Arabic text around them.
    ctx.direction = col.arabic ? 'rtl' : 'ltr';
    const y = top + valueY;
    if (col.badge) {
      const padX = 24;
      const size = fitFont(ctx, col.value, 700, STRIP.valueSize, colW - 8 - padX * 2, 28);
      const boxW = Math.min(colW - 8, ctx.measureText(col.value).width + padX * 2);
      const boxH = STRIP.valueRow - 4;
      ctx.fillStyle = EXPORT.badge;
      roundRect(ctx, cx - boxW / 2, y - boxH / 2, boxW, boxH, 16);
      ctx.fill();
      ctx.fillStyle = EXPORT.navy;
      ctx.font = font(700, size);
      ctx.fillText(col.value, cx, y + 2);
    } else {
      fitFont(ctx, col.value, 700, STRIP.valueSize, colW - 16, 28);
      ctx.fillStyle = EXPORT.text;
      ctx.fillText(col.value, cx, y + 2);
    }
  });

  ctx.fillStyle = EXPORT.divider;
  ctx.fillRect(P, top + dividerY, W - P * 2, 2);

  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.fillStyle = EXPORT.label;
  ctx.font = font(600, STRIP.labelSize);
  ctx.fillText('الملاحظة', W - P, top + noteLabelY);

  ctx.fillStyle = EXPORT.text;
  ctx.font = font(500, body.size);
  body.lines.forEach((line, i) => {
    ctx.fillText(line, W - P, top + firstLineY + i * body.lineHeight);
  });

  return toBlob(canvas, EXPORT.quality);
}

/** Web Share with files is limited per call; larger sets go in batches. */
export const SHARE_BATCH = 10;

export const canShareFiles = (files) => {
  try {
    return typeof navigator.share === 'function' && Boolean(navigator.canShare?.({ files }));
  } catch {
    return false;
  }
};

export const shareFiles = (files) => navigator.share({ files });

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** Saves each image as its own file, in order, so the gallery lists them in sequence. */
export async function downloadFiles(items, onProgress) {
  for (let i = 0; i < items.length; i += 1) {
    const { blob, name } = items[i];
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    onProgress?.(i + 1);
    await wait(400);
  }
}
