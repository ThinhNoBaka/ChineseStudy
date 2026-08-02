// handwriting.js
// A freehand drawing pad for practicing Chinese character strokes with
// mouse, pen, or touch. This is intentionally NOT handwriting recognition
// (OCR) — turning strokes into recognized text needs a trained model and a
// backend, which is outside this project's "no backend" constraint. What
// it gives instead is genuinely useful for memorization: draw the
// character stroke-by-stroke to build muscle memory, then type the
// answer (or use the Pinyin keyboard) to submit it.

/**
 * Wires up drawing behaviour on a canvas element.
 * @param {HTMLCanvasElement} canvas
 * @returns {{clear: () => void, destroy: () => void}}
 */
export function initHandwritingPad(canvas) {
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let lastPoint = null;

  function styleFromTheme() {
    const styles = getComputedStyle(document.documentElement);
    ctx.strokeStyle = styles.getPropertyValue('--ink').trim() || '#1e1c18';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function getPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches && e.touches.length ? e.touches[0] : e;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  function start(e) {
    e.preventDefault();
    styleFromTheme();
    drawing = true;
    lastPoint = getPoint(e);
  }

  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = getPoint(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint = p;
  }

  function end() {
    drawing = false;
    lastPoint = null;
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  function clear() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function destroy() {
    canvas.removeEventListener('mousedown', start);
    canvas.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', end);
    canvas.removeEventListener('touchstart', start);
    canvas.removeEventListener('touchmove', move);
    canvas.removeEventListener('touchend', end);
  }

  return { clear, destroy };
}
