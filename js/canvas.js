/* ============================
   Canvas Management and Controls
============================ */

// Global variables for canvas zoom and pan
let canvasScale = 1.0,
    canvasOffsetX = 0,
    canvasOffsetY = 0,
    isPanning = false,
    panStartX = 0,
    panStartY = 0,
    startOffsetX = 0,
    startOffsetY = 0;

const tablePlanEl = document.getElementById('table-plan');
const canvasEl = document.getElementById('canvas');

function updateCanvasTransform() {
  canvasEl.style.transform = `translate(${canvasOffsetX}px, ${canvasOffsetY}px) scale(${canvasScale})`;
}

// Use mouse wheel on the table plan area to zoom in and out
tablePlanEl.addEventListener('wheel', function(e) {
  e.preventDefault();
  const zoomFactor = 1.05;
  if (e.deltaY < 0) {
    canvasScale *= zoomFactor;
  } else {
    canvasScale /= zoomFactor;
  }
  updateCanvasTransform();
});

// Panning: click and drag on any blank area (not on a table)
tablePlanEl.addEventListener('mousedown', function(e) {
  if (e.target.closest('.table.card') || e.target.closest('.person') || isDragging) return;
  isPanning = true;
  panStartX = e.clientX;
  panStartY = e.clientY;
  startOffsetX = canvasOffsetX;
  startOffsetY = canvasOffsetY;
  e.preventDefault();
});

document.addEventListener('mousemove', function(e) {
  if (!isPanning) return;
  canvasOffsetX = startOffsetX + (e.clientX - panStartX);
  canvasOffsetY = startOffsetY + (e.clientY - panStartY);
  updateCanvasTransform();
});

document.addEventListener('mouseup', function(e) {
  isPanning = false;
});

// Export canvas functions
window.canvasModule = {
  updateCanvasTransform,
  canvasScale,
  canvasOffsetX,
  canvasOffsetY
}; 