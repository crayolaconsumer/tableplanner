/* ============================
   Drag and Drop Management
============================ */

// Global drag state tracking
let isDragging = false,
    draggedElement = null,
    touchStartX = 0,
    touchStartY = 0,
    isTouchDragging = false,
    touchDragElement = null;

// Guest (Person) drag handlers
function handleDragStart(e) {
  e.dataTransfer.setData('text/plain', this.id);
  this.classList.add('dragging');
  isDragging = true;
  draggedElement = this;
  
  // Set a custom drag image to prevent glitching
  const dragImage = this.cloneNode(true);
  dragImage.style.opacity = '0.8';
  dragImage.style.transform = 'rotate(3deg) scale(1.1)';
  dragImage.style.position = 'absolute';
  dragImage.style.top = '-1000px';
  dragImage.style.left = '-1000px';
  document.body.appendChild(dragImage);
  e.dataTransfer.setDragImage(dragImage, 20, 20);
  
  // Remove the drag image after a short delay
  setTimeout(() => {
    if (document.body.contains(dragImage)) {
      document.body.removeChild(dragImage);
    }
  }, 100);
}

function handlePersonDragEnd(e) {
  this.classList.remove('dragging');
  isDragging = false;
  draggedElement = null;
}

// Mobile touch handlers
function handleTouchStart(e) {
  if (e.touches.length !== 1) return; // Only handle single touch
  
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  isTouchDragging = false;
  touchDragElement = this;
  
  // Prevent default to avoid scrolling during drag
  e.preventDefault();
}

function handleTouchMove(e) {
  if (e.touches.length !== 1 || !touchDragElement) return;
  
  const touch = e.touches[0];
  const deltaX = Math.abs(touch.clientX - touchStartX);
  const deltaY = Math.abs(touch.clientY - touchStartY);
  
  // Start dragging after a small movement threshold
  if (!isTouchDragging && (deltaX > 10 || deltaY > 10)) {
    isTouchDragging = true;
    touchDragElement.classList.add('dragging');
    touchDragElement.classList.add('touch-dragging');
    
    // Create a visual drag indicator
    const dragIndicator = document.createElement('div');
    dragIndicator.className = 'touch-drag-indicator';
    dragIndicator.innerHTML = `
      <div class="drag-indicator-content">
        <span class="drag-indicator-icon">👤</span>
        <span class="drag-indicator-text">${touchDragElement.querySelector('.guest-name')?.textContent.replace(/[✎✖🥗]/g, '').trim() || 'Guest'}</span>
      </div>
    `;
    document.body.appendChild(dragIndicator);
    
    // Position the indicator at touch point
    updateTouchDragIndicator(touch.clientX, touch.clientY);
  }
  
  if (isTouchDragging) {
    e.preventDefault();
    updateTouchDragIndicator(touch.clientX, touch.clientY);
    
    // Find drop targets
    const dropTarget = findDropTarget(touch.clientX, touch.clientY);
    highlightDropTarget(dropTarget);
  }
}

function handleTouchEnd(e) {
  if (!isTouchDragging || !touchDragElement) {
    isTouchDragging = false;
    touchDragElement = null;
    return;
  }
  
  const touch = e.changedTouches[0];
  const dropTarget = findDropTarget(touch.clientX, touch.clientY);
  
  if (dropTarget) {
    handleTouchDrop(touchDragElement, dropTarget);
  }
  
  // Clean up
  touchDragElement.classList.remove('dragging', 'touch-dragging');
  isTouchDragging = false;
  touchDragElement = null;
  
  // Remove drag indicator
  const dragIndicator = document.querySelector('.touch-drag-indicator');
  if (dragIndicator) {
    document.body.removeChild(dragIndicator);
  }
  
  // Clear all highlights
  clearAllHighlights();
}

function updateTouchDragIndicator(x, y) {
  const dragIndicator = document.querySelector('.touch-drag-indicator');
  if (dragIndicator) {
    dragIndicator.style.left = (x - 40) + 'px';
    dragIndicator.style.top = (y - 40) + 'px';
  }
}

function findDropTarget(x, y) {
  const elements = document.elementsFromPoint(x, y);
  for (let element of elements) {
    if (element.classList.contains('seat')) {
      return element;
    }
    if (element.id === 'people-list') {
      return element;
    }
  }
  return null;
}

function highlightDropTarget(target) {
  // Clear previous highlights
  clearAllHighlights();
  
  if (target) {
    if (target.classList.contains('seat')) {
      target.classList.add('over', 'touch-over');
      if (target.children.length === 0) {
        target.classList.add('drop-zone');
      }
    } else if (target.id === 'people-list') {
      target.style.background = '#e7f3ff';
      target.style.border = '2px dashed #007bff';
    }
  }
}

function clearAllHighlights() {
  // Clear seat highlights
  document.querySelectorAll('.seat').forEach(seat => {
    seat.classList.remove('over', 'touch-over', 'drop-zone');
  });
  
  // Clear people list highlights
  const peopleList = document.getElementById('people-list');
  if (peopleList) {
    peopleList.style.background = '';
    peopleList.style.border = '';
  }
}

function handleTouchDrop(personElement, dropTarget) {
  if (dropTarget.classList.contains('seat')) {
    // Handle seat drop
    handleSeatDrop(personElement, dropTarget);
  } else if (dropTarget.id === 'people-list') {
    // Handle unassigned list drop
    handleUnassignedDrop(personElement);
  }
}

function handleSeatDrop(personElement, seat) {
  // Check if dropping on a filled seat
  if (seat.children.length > 0) {
    const existingGuest = seat.children[0].querySelector('.guest-name')?.textContent || 'Unknown Guest';
    const newGuest = personElement.querySelector('.guest-name')?.textContent || 'Unknown Guest';
    
    // Clean guest names for comparison
    const cleanExistingGuest = existingGuest.replace(/[✎✖🥗]/g, '').trim();
    const cleanNewGuest = newGuest.replace(/[✎✖🥗]/g, '').trim();
    
    // Ask for confirmation before replacing
    if (!confirm(`Replace ${cleanExistingGuest} with ${cleanNewGuest} in this seat?`)) {
      return;
    }
    
    // Store the existing guest for potential swapping
    const existing = seat.children[0];
    const existingSource = personElement.parentElement;
    
    // Check if we're doing a swap (both guests are from seats)
    if (existingSource && existingSource.classList.contains('seat')) {
      // This is a swap - move existing guest to the source seat
      existingSource.innerHTML = '';
      existingSource.appendChild(existing);
      existingSource.classList.add('filled');
      
      // Clean and update tooltip for the source seat
      if (window.cleanGuestName) {
        window.cleanGuestName(existing);
      }
      let existingGuestName = existing.querySelector('.guest-name')?.textContent || 'Unknown Guest';
      existingGuestName = existingGuestName.replace(/[✎✖🥗]/g, '').trim();
      existingSource.setAttribute('data-tooltip', `${existingGuestName} (Click to edit, drag to move)`);
      existingSource.title = `${existingGuestName} (Click to edit, drag to move)`;
    } else {
      // This is a replacement - move existing guest to unassigned list
      if (window.cleanGuestName) {
        window.cleanGuestName(existing);
      }
      document.getElementById('people-list').appendChild(existing);
    }
  }
  
  // Remove from source if it was in a seat
  const source = personElement.parentElement;
  if (source && source.classList.contains('seat')) {
    source.classList.remove('filled');
    // Clear tooltip and title from the source seat
    source.removeAttribute('data-tooltip');
    source.removeAttribute('title');
  }
  
  // Clean the guest name to remove any embedded edit buttons
  if (window.cleanGuestName) {
    window.cleanGuestName(personElement);
  }
  
  // Add to new seat
  seat.innerHTML = '';
  seat.appendChild(personElement);
  seat.classList.add('filled');
  
  // Ensure the person element remains draggable and touchable
  personElement.draggable = true;
  personElement.addEventListener('dragstart', handleDragStart);
  personElement.addEventListener('dragend', handlePersonDragEnd);
  addTouchListeners(personElement);
  
  // Add tooltip to the seat element
  let guestName = personElement.querySelector('.guest-name')?.textContent || 'Unknown Guest';
  guestName = guestName.replace(/[✎✖🥗]/g, '').trim();
  seat.setAttribute('data-tooltip', `${guestName} (Click to edit, drag to move)`);
  seat.title = `${guestName} (Click to edit, drag to move)`;
  
  // Force a reflow to ensure tooltip is properly set
  seat.offsetHeight;
  
  // Add success animation
  seat.style.animation = 'successPulse 0.6s ease';
  setTimeout(() => {
    seat.style.animation = '';
  }, 600);
  
  // Clean all guest names to ensure consistency
  if (window.cleanAllGuestNames) {
    window.cleanAllGuestNames();
  }
  
  updateCounts();
}

function handleUnassignedDrop(personElement) {
  // Get the source seat before moving the person
  const source = personElement.parentElement;
  
  // Clean the guest name when moving to unassigned list
  if (window.cleanGuestName) {
    window.cleanGuestName(personElement);
  }
  document.getElementById('people-list').appendChild(personElement);
  
  // Clear the source seat if it was a seat
  if (source && source.classList.contains('seat')) {
    source.classList.remove('filled');
    source.removeAttribute('data-tooltip');
    source.removeAttribute('title');
  }
  
  // Ensure the person element remains draggable and touchable
  personElement.draggable = true;
  personElement.addEventListener('dragstart', handleDragStart);
  personElement.addEventListener('dragend', handlePersonDragEnd);
  addTouchListeners(personElement);
  
  updateCounts();
}

// Function to add touch listeners to a person element
function addTouchListeners(element) {
  element.addEventListener('touchstart', handleTouchStart, { passive: false });
  element.addEventListener('touchmove', handleTouchMove, { passive: false });
  element.addEventListener('touchend', handleTouchEnd, { passive: false });
}

// Seat drag and drop handlers
function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // Only show drop zone for seats and only if we're dragging a person
  if (this.classList.contains('seat') && isDragging && draggedElement && draggedElement !== this) {
    this.classList.add('over');
    
    // Add drop zone effect for empty seats
    if (this.children.length === 0) {
      this.classList.add('drop-zone');
    }
  }
}

function handleDragLeave(e) {
  // Only remove classes if we're actually leaving the element
  if (!this.contains(e.relatedTarget)) {
    this.classList.remove('over');
    this.classList.remove('drop-zone');
  }
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  this.classList.remove('over');
  this.classList.remove('drop-zone');
  
  const personId = e.dataTransfer.getData('text/plain');
  const personElem = document.getElementById(personId);
  
  if (personElem && this.classList.contains('seat') && isDragging) {
    handleSeatDrop(personElem, this);
  }
}

// People list drag handlers
const peopleList = document.getElementById('people-list');

peopleList.addEventListener('dragover', function(e) {
  e.preventDefault();
  e.stopPropagation();
  if (isDragging && draggedElement) {
    this.style.background = '#e7f3ff';
    this.style.border = '2px dashed #007bff';
  }
});

peopleList.addEventListener('dragleave', function(e) {
  if (!this.contains(e.relatedTarget)) {
    this.style.background = '';
    this.style.border = '';
  }
});

peopleList.addEventListener('drop', function(e) {
  this.style.background = '';
  this.style.border = '';
  e.preventDefault();
  e.stopPropagation();
  const personId = e.dataTransfer.getData('text/plain');
  const personElem = document.getElementById(personId);
  if (personElem && isDragging) {
    handleUnassignedDrop(personElem);
  }
});

// Export the module
window.dragDropModule = {
  isDragging: () => isDragging,
  handleDragStart,
  handlePersonDragEnd,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  addTouchListeners
}; 