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
    startOffsetY = 0,
    lastWheelTime = 0,
    wheelTimeout = null;

const tablePlanEl = document.getElementById('table-plan');
const canvasEl = document.getElementById('canvas');

// Zoom limits
const MIN_SCALE = 0.3;
const MAX_SCALE = 3.0;

function updateCanvasTransform() {
  canvasEl.style.transform = `translate(${canvasOffsetX}px, ${canvasOffsetY}px) scale(${canvasScale})`;
}

// Improved zoom with momentum and bounds checking
function zoomCanvas(delta, clientX, clientY) {
  const zoomFactor = delta > 0 ? 0.95 : 1.05;
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, canvasScale * zoomFactor));
  
  if (newScale !== canvasScale) {
    // Calculate zoom center relative to canvas
    const rect = tablePlanEl.getBoundingClientRect();
    const centerX = clientX - rect.left;
    const centerY = clientY - rect.top;
    
    // Adjust offset to zoom towards mouse position
    const scaleRatio = newScale / canvasScale;
    canvasOffsetX = centerX - (centerX - canvasOffsetX) * scaleRatio;
    canvasOffsetY = centerY - (centerY - canvasOffsetY) * scaleRatio;
    
    canvasScale = newScale;
    updateCanvasTransform();
  }
}

// Smooth wheel handling with debouncing for trackpad
tablePlanEl.addEventListener('wheel', function(e) {
  e.preventDefault();
  
  const now = Date.now();
  const timeSinceLastWheel = now - lastWheelTime;
  lastWheelTime = now;
  
  // Clear existing timeout
  if (wheelTimeout) {
    clearTimeout(wheelTimeout);
  }
  
  // Adjust sensitivity based on device type and wheel delta
  let delta = e.deltaY;
  
  // Detect trackpad vs mouse wheel
  if (Math.abs(e.deltaY) < 50) {
    // Trackpad - reduce sensitivity
    delta = e.deltaY * 0.3;
  } else {
    // Mouse wheel - standard sensitivity
    delta = e.deltaY * 0.8;
  }
  
  // Apply zoom
  zoomCanvas(delta, e.clientX, e.clientY);
  
  // Debounce rapid wheel events
  wheelTimeout = setTimeout(() => {
    wheelTimeout = null;
  }, 50);
}, { passive: false });

// Improved panning with better sensitivity
tablePlanEl.addEventListener('mousedown', function(e) {
  if (e.target.closest('.table.card') || e.target.closest('.person') || isDragging) return;
  
  isPanning = true;
  panStartX = e.clientX;
  panStartY = e.clientY;
  startOffsetX = canvasOffsetX;
  startOffsetY = canvasOffsetY;
  
  // Add visual feedback
  tablePlanEl.style.cursor = 'grabbing';
  e.preventDefault();
});

document.addEventListener('mousemove', function(e) {
  if (!isPanning) return;
  
  // Calculate pan distance with reduced sensitivity for smoother movement
  const deltaX = (e.clientX - panStartX) * 0.8;
  const deltaY = (e.clientY - panStartY) * 0.8;
  
  canvasOffsetX = startOffsetX + deltaX;
  canvasOffsetY = startOffsetY + deltaY;
  
  updateCanvasTransform();
});

document.addEventListener('mouseup', function(e) {
  if (isPanning) {
    isPanning = false;
    tablePlanEl.style.cursor = 'grab';
  }
});

// Add keyboard shortcuts for zoom
document.addEventListener('keydown', function(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  switch(e.key) {
    case '+':
    case '=':
      e.preventDefault();
      zoomCanvas(-1, window.innerWidth / 2, window.innerHeight / 2);
      break;
    case '-':
      e.preventDefault();
      zoomCanvas(1, window.innerWidth / 2, window.innerHeight / 2);
      break;
    case '0':
      e.preventDefault();
      // Reset zoom and pan
      canvasScale = 1.0;
      canvasOffsetX = 0;
      canvasOffsetY = 0;
      updateCanvasTransform();
      break;
  }
});

// Enhanced touch support for mobile devices
let touchStartDistance = 0;
let touchStartScale = 1.0;
let lastTapTime = 0;
let touchStartTime = 0;

tablePlanEl.addEventListener('touchstart', function(e) {
  touchStartTime = Date.now();
  
  if (e.touches.length === 2) {
    // Pinch to zoom
    touchStartDistance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    touchStartScale = canvasScale;
  } else if (e.touches.length === 1) {
    // Single touch pan
    isPanning = true;
    panStartX = e.touches[0].clientX;
    panStartY = e.touches[0].clientY;
    startOffsetX = canvasOffsetX;
    startOffsetY = canvasOffsetY;
  }
}, { passive: false });

tablePlanEl.addEventListener('touchmove', function(e) {
  e.preventDefault();
  
  if (e.touches.length === 2) {
    // Handle pinch zoom with momentum
    const distance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    
    const scale = distance / touchStartDistance;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, touchStartScale * scale));
    
    if (newScale !== canvasScale) {
      canvasScale = newScale;
      updateCanvasTransform();
    }
  } else if (e.touches.length === 1 && isPanning) {
    // Handle pan with reduced sensitivity for mobile
    const deltaX = (e.touches[0].clientX - panStartX) * 0.6;
    const deltaY = (e.touches[0].clientY - panStartY) * 0.6;
    
    canvasOffsetX = startOffsetX + deltaX;
    canvasOffsetY = startOffsetY + deltaY;
    updateCanvasTransform();
  }
}, { passive: false });

tablePlanEl.addEventListener('touchend', function(e) {
  const touchDuration = Date.now() - touchStartTime;
  
  // Double tap to reset zoom (only if it's a quick tap)
  if (e.touches.length === 0 && touchDuration < 200) {
    const now = Date.now();
    if (now - lastTapTime < 300) {
      // Double tap detected - reset zoom and pan
      canvasScale = 1.0;
      canvasOffsetX = 0;
      canvasOffsetY = 0;
      updateCanvasTransform();
      lastTapTime = 0; // Prevent triple tap
    } else {
      lastTapTime = now;
    }
  }
  
  isPanning = false;
});

// Prevent context menu on long press for mobile
tablePlanEl.addEventListener('contextmenu', function(e) {
  e.preventDefault();
});

// Mobile-specific canvas enhancements
function enhanceMobileCanvas() {
  if (window.innerWidth <= 767) {
    // Add subtle visual feedback for mobile canvas
    const canvas = document.getElementById('canvas');
    if (canvas) {
      canvas.style.transition = 'transform 0.1s ease-out';
    }
  }
}

// Initialize mobile canvas enhancements
document.addEventListener('DOMContentLoaded', enhanceMobileCanvas);
window.addEventListener('resize', enhanceMobileCanvas);

// Export canvas functions
window.canvasModule = {
  updateCanvasTransform,
  canvasScale,
  canvasOffsetX,
  canvasOffsetY
}; 