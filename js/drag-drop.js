/* ============================
   Drag and Drop Management
============================ */

// Global drag state tracking
let isDragging = false,
    draggedElement = null;

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
    // Check if dropping on a filled seat
    if (this.children.length > 0) {
      const existingGuest = this.children[0].querySelector('.guest-name')?.textContent || 'Unknown Guest';
      const newGuest = personElem.querySelector('.guest-name')?.textContent || 'Unknown Guest';
      
      // Clean guest names for comparison
      const cleanExistingGuest = existingGuest.replace(/[✎✖]/g, '').trim();
      const cleanNewGuest = newGuest.replace(/[✎✖]/g, '').trim();
      
      // Ask for confirmation before replacing
      if (!confirm(`Replace ${cleanExistingGuest} with ${cleanNewGuest} in this seat?`)) {
        return;
      }
      
      // Store the existing guest for potential swapping
      const existing = this.children[0];
      const existingSource = personElem.parentElement;
      
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
        existingGuestName = existingGuestName.replace(/[✎✖]/g, '').trim();
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
    const source = personElem.parentElement;
    if (source && source.classList.contains('seat')) {
      source.classList.remove('filled');
      // Clear tooltip and title from the source seat
      source.removeAttribute('data-tooltip');
      source.removeAttribute('title');
    }
    
    // Clean the guest name to remove any embedded edit buttons
    if (window.cleanGuestName) {
      window.cleanGuestName(personElem);
    }
    
    // Add to new seat
    this.innerHTML = '';
    this.appendChild(personElem);
    this.classList.add('filled');
    
    // Ensure the person element remains draggable
    personElem.draggable = true;
    personElem.addEventListener('dragstart', handleDragStart);
    personElem.addEventListener('dragend', handlePersonDragEnd);
    
    // Add tooltip to the seat element
    let guestName = personElem.querySelector('.guest-name')?.textContent || 'Unknown Guest';
    guestName = guestName.replace(/[✎✖]/g, '').trim();
    this.setAttribute('data-tooltip', `${guestName} (Click to edit, drag to move)`);
    this.title = `${guestName} (Click to edit, drag to move)`;
    
    // Force a reflow to ensure tooltip is properly set
    this.offsetHeight;
    
    // Add success animation
    this.style.animation = 'successPulse 0.6s ease';
    setTimeout(() => {
      this.style.animation = '';
    }, 600);
    
    // Clean all guest names to ensure consistency
    if (window.cleanAllGuestNames) {
      window.cleanAllGuestNames();
    }
    
    updateCounts();
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
    // Get the source seat before moving the person
    const source = personElem.parentElement;
    
    // Clean the guest name when moving to unassigned list
    if (window.cleanGuestName) {
      window.cleanGuestName(personElem);
    }
    this.appendChild(personElem); 
    
    // Clear the source seat if it was a seat
    if (source && source.classList.contains('seat')) {
      source.classList.remove('filled');
      source.removeAttribute('data-tooltip');
      source.removeAttribute('title');
    }
    
    // Clean all guest names to ensure consistency
    if (window.cleanAllGuestNames) {
      window.cleanAllGuestNames();
    }
    
    updateCounts(); 
  } else {
    // Handle dropping assigned guests from the aside menu
    const guestName = e.dataTransfer.getData('text/plain');
    if (guestName) {
      // Find the person element in the canvas and move it to unassigned
      const tables = document.querySelectorAll('#canvas .table.card');
      tables.forEach(table => {
        const seats = table.querySelectorAll('.card-body .seat');
        seats.forEach(seat => {
          if (seat.children.length > 0) {
            const person = seat.children[0];
            const nameSpan = person.querySelector('.guest-name');
            if (nameSpan && nameSpan.textContent === guestName) {
              // Remove from seat
              seat.innerHTML = '';
              seat.classList.remove('filled');
              seat.removeAttribute('data-tooltip');
              seat.removeAttribute('title');
              // Clean the guest name before adding to unassigned list
              if (window.cleanGuestName) {
                window.cleanGuestName(person);
              }
              // Add to unassigned list
              this.appendChild(person);
              updateCounts();
            }
          }
        });
      });
    }
  }
});

// Export drag and drop functions
window.dragDropModule = {
  handleDragStart,
  handlePersonDragEnd,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  isDragging,
  draggedElement
}; 