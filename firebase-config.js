// Firebase configuration for real-time collaboration
// This is a free Firebase project for wedding seating plan collaboration

const firebaseConfig = {
  apiKey: "AIzaSyC1ZbgTbTBAHwM_IHauYndbUVX7_N85t4s",
  authDomain: "wedding-seating-plan.firebaseapp.com",
  databaseURL: "https://wedding-seating-plan-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "wedding-seating-plan",
  storageBucket: "wedding-seating-plan.firebasestorage.app",
  messagingSenderId: "755299077157",
  appId: "1:755299077157:web:7459c9a4141d18479a83cc",
  measurementId: "G-9006PNJC25"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get database reference
const database = firebase.database();

// Collaboration state
let isCollaborating = false;
let currentUserId = null;
let presenceRef = null;

// Generate unique user ID for this session
function generateUserId() {
  return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Initialize collaboration
function initCollaboration() {
  if (isCollaborating) return;
  
  isCollaborating = true;
  currentUserId = generateUserId();
  
  // Set up presence
  presenceRef = database.ref('presence/' + currentUserId);
  presenceRef.set({
    online: true,
    lastSeen: firebase.database.ServerValue.TIMESTAMP,
    userAgent: navigator.userAgent
  });
  
  // Clean up presence when user leaves
  window.addEventListener('beforeunload', () => {
    if (presenceRef) {
      presenceRef.remove();
    }
  });
  
  console.log('Collaboration initialized for user:', currentUserId);
}

// Debounce save operations to prevent feedback loops
let saveTimeout = null;
let lastSavedState = null;
let isUpdatingFromFirebase = false; // Flag to prevent save loops
let lastUpdateTime = 0; // Track when we last received an update
let isInitialLoad = false; // Flag to prevent conflicting messages during initial load

// Save state to Firebase
function saveToFirebase(state) {
  if (!isCollaborating || isUpdatingFromFirebase) return;
  
  // Debounce saves to prevent rapid-fire updates
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }
  
  // Only save if state actually changed
  const stateString = JSON.stringify(state);
  if (stateString === lastSavedState) {
    return;
  }
  
  saveTimeout = setTimeout(() => {
    database.ref('seatingPlan').set({
      ...state,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
      updatedBy: currentUserId
    }).then(() => {
      console.log('State saved to Firebase');
      lastSavedState = stateString;
    }).catch((error) => {
      console.error('Error saving to Firebase:', error);
    });
  }, 1000); // Wait 1 second before saving - faster sync
}

// Load state from Firebase
function loadFromFirebase() {
  if (!isCollaborating) return;
  
  database.ref('seatingPlan').once('value').then((snapshot) => {
    const data = snapshot.val();
    if (data && data.tables && Object.keys(data.tables).length > 0) {
      // Only load if there's meaningful data in Firebase
      const { lastUpdated, updatedBy, ...cleanData } = data;
      importState(JSON.stringify(cleanData));
      console.log('State loaded from Firebase');
    } else {
      console.log('Firebase is empty, keeping current state');
    }
  }).catch((error) => {
    console.error('Error loading from Firebase:', error);
  });
}

// Listen for real-time updates
function listenForUpdates() {
  if (!isCollaborating) return;
  
  database.ref('seatingPlan').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data && data.tables && Object.keys(data.tables).length > 0 && data.lastUpdated) {
      // Only update if it's not our own update
      if (data.updatedBy !== currentUserId) {
        const { lastUpdated, updatedBy, ...cleanData } = data;
        
        // Get current state
        const currentState = getState();
        
        // Smart merge: only update if there are meaningful differences
        let shouldUpdate = false;
        let mergedData = { ...currentState };
        
        // Check if the overall structure is significantly different
        const currentTablesCount = Object.keys(currentState.tables).length;
        const incomingTablesCount = Object.keys(cleanData.tables).length;
        
        // Only proceed if table counts are different or if we have new tables
        if (currentTablesCount !== incomingTablesCount) {
          shouldUpdate = true;
          mergedData.tables = cleanData.tables;
          console.log(`Updating all tables - count changed from ${currentTablesCount} to ${incomingTablesCount}`);
        } else if (currentTablesCount === 0 && incomingTablesCount > 0) {
          // If we have no tables and incoming has tables, validate the data first
          console.log(`Validating incoming data before initial load...`);
          
          // Check if incoming data has wrong guest assignments
          let hasWrongData = false;
          for (const tableId in cleanData.tables) {
            const table = cleanData.tables[tableId];
            if (table.name === 'Head Table - Long Way') {
              const guests = table.seats?.map(s => s.guest).filter(g => g) || [];
              const wrongGuestSet = ['Matthew Molnar', 'Sophie Osborne', 'Shamaurie Cunningham', 'Ameera Khan', 'Harry May', 'Callum Day', 'Ross Phelps', 'Ronnie Morgan'].sort();
              const incomingGuests = [...guests].sort();
              
              if (JSON.stringify(incomingGuests) === JSON.stringify(wrongGuestSet)) {
                console.log('BLOCKING INITIAL LOAD: Firebase contains wrong Head Table data');
                console.log('Wrong guests detected:', incomingGuests);
                hasWrongData = true;
                break;
              }
            }
          }
          
          if (hasWrongData) {
            console.log('Rejecting initial load due to wrong data - keeping empty state');
            return; // Don't load the wrong data
          }
          
          // Data is valid, proceed with load
          shouldUpdate = true;
          mergedData.tables = cleanData.tables;
          console.log(`Loading tables from Firebase (no local tables) - data validated`);
        } else {
          // Check each table for significant changes (not just minor differences)
          for (const tableId in cleanData.tables) {
            const incomingTable = cleanData.tables[tableId];
            const currentTable = currentState.tables[tableId];
            
            if (!currentTable) {
              // New table added
              mergedData.tables[tableId] = incomingTable;
              shouldUpdate = true;
              console.log(`Adding new table ${tableId}`);
            } else {
              // Compare guest assignments (the important part)
              const currentGuests = currentTable.seats?.map(s => s.guest).filter(g => g) || [];
              const incomingGuests = incomingTable.seats?.map(s => s.guest).filter(g => g) || [];
              
              // Sort both arrays for consistent comparison
              const sortedCurrentGuests = [...currentGuests].sort();
              const sortedIncomingGuests = [...incomingGuests].sort();
              
              // Only update if guest assignments are significantly different
              if (sortedCurrentGuests.length !== sortedIncomingGuests.length || 
                  !sortedCurrentGuests.every((guest, index) => guest === sortedIncomingGuests[index])) {
                
                // DATA VALIDATION: Don't overwrite correct data with wrong data
                // Check if current data has meaningful guest assignments
                const currentHasRealGuests = sortedCurrentGuests.length > 0 && 
                  sortedCurrentGuests.some(guest => guest && guest.trim() !== '');
                const incomingHasRealGuests = sortedIncomingGuests.length > 0 && 
                  sortedIncomingGuests.some(guest => guest && guest.trim() !== '');
                
                // ADVANCED VALIDATION: Check for specific known correct vs wrong guest sets
                const correctGuestSet = ['Alan Cooper', 'Amy Ridge', 'Connor Daly', 'James Fitton', 'Laura Fitton', 'Lillith May', 'Mark Fitton', 'Chris Slaffa'].sort();
                const wrongGuestSet = ['Matthew Molnar', 'Sophie Osborne', 'Shamaurie Cunningham', 'Ameera Khan', 'Harry May', 'Callum Day', 'Ross Phelps', 'Ronnie Morgan'].sort();
                
                // If current has correct guests and incoming has wrong guests, keep current
                const currentHasCorrectGuests = JSON.stringify(sortedCurrentGuests) === JSON.stringify(correctGuestSet);
                const incomingHasWrongGuests = JSON.stringify(sortedIncomingGuests) === JSON.stringify(wrongGuestSet);
                
                if (currentHasCorrectGuests && incomingHasWrongGuests) {
                  console.log(`BLOCKING WRONG DATA: Keeping correct guests for table ${tableId}`);
                  console.log('Current (correct):', sortedCurrentGuests);
                  console.log('Incoming (wrong):', sortedIncomingGuests);
                  continue; // Skip this table update
                }
                
                // If current has real guests and incoming doesn't, or if current has more guests, keep current
                if (currentHasRealGuests && (!incomingHasRealGuests || sortedCurrentGuests.length > sortedIncomingGuests.length)) {
                  console.log(`Keeping current guest assignments for table ${tableId} - current data is more complete`);
                  console.log('Current guests:', sortedCurrentGuests);
                  console.log('Incoming guests:', sortedIncomingGuests);
                  continue; // Skip this table update
                }
                
                mergedData.tables[tableId] = incomingTable;
                shouldUpdate = true;
                console.log(`Updating table ${tableId} - guest assignments changed`);
                console.log('Current guests:', sortedCurrentGuests);
                console.log('Incoming guests:', sortedIncomingGuests);
              }
            }
          }
        }
        
        // Only update if we have meaningful changes and enough time has passed
        const now = Date.now();
        if (shouldUpdate && (now - lastUpdateTime) > 1000) { // Reduced to 1 second cooldown for faster sync
          lastUpdateTime = now;
          
          // TIMESTAMP VALIDATION: Only accept updates that are newer than our last save
          if (data.lastUpdated && lastSavedState) {
            const lastSavedTime = JSON.parse(lastSavedState).lastUpdated || 0;
            if (data.lastUpdated <= lastSavedTime) {
              console.log('Ignoring older update - our data is more recent');
              return;
            }
          }
          
          // Set flag to prevent saving during update
          isUpdatingFromFirebase = true;
          
          try {
            importState(JSON.stringify(mergedData));
            console.log('Received and merged real-time update from another user');
            
            // Force update all displays after collaboration sync
            setTimeout(() => {
              updateCounts();
              updateAssignedGuestsDisplay();
              updateAllGuestDisplays();
            }, 100);
            
            // Update our last saved state to prevent re-saving
            lastSavedState = JSON.stringify(mergedData);
          } catch (error) {
            console.error('Error applying update:', error);
          } finally {
            // Clear flag after update
            setTimeout(() => {
              isUpdatingFromFirebase = false;
            }, 1000);
          }
        } else if (shouldUpdate) {
          console.log('Update skipped - too soon since last update');
        } else {
          // Only log if not during initial load to prevent conflicting messages
          if (!window.isInitialLoad) {
            console.log('No meaningful changes detected in incoming data');
          }
        }
      }
    }
  });
}

// Get online users
function getOnlineUsers() {
  return new Promise((resolve) => {
    database.ref('presence').once('value').then((snapshot) => {
      const users = [];
      snapshot.forEach((childSnapshot) => {
        const userData = childSnapshot.val();
        if (userData && userData.online) {
          users.push({
            id: childSnapshot.key,
            lastSeen: userData.lastSeen,
            userAgent: userData.userAgent
          });
        }
      });
      resolve(users);
    });
  });
}

// Update presence
function updatePresence() {
  if (presenceRef) {
    presenceRef.update({
      lastSeen: firebase.database.ServerValue.TIMESTAMP
    });
  }
}

// Clean up old presence data
function cleanupPresence() {
  const cutoff = Date.now() - (5 * 60 * 1000); // 5 minutes ago
  database.ref('presence').orderByChild('lastSeen').endAt(cutoff).once('value').then((snapshot) => {
    const updates = {};
    snapshot.forEach((childSnapshot) => {
      updates[childSnapshot.key] = null;
    });
    if (Object.keys(updates).length > 0) {
      database.ref('presence').update(updates);
    }
  });
}

// Start presence cleanup every minute
setInterval(cleanupPresence, 60000);

// Update presence every 30 seconds
setInterval(updatePresence, 30000);

// Force sync function to ensure correct guest assignments
function forceSyncGuestAssignments() {
  if (!isCollaborating) return;
  
  const currentState = getState();
  console.log('Force syncing guest assignments to Firebase...');
  
  // Save current state immediately
  database.ref('seatingPlan').set({
    ...currentState,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    updatedBy: currentUserId
  }).then(() => {
    console.log('Force sync completed - guest assignments saved');
    lastSavedState = JSON.stringify(currentState);
  }).catch((error) => {
    console.error('Error during force sync:', error);
  });
}

// Make forceSyncGuestAssignments available globally
window.forceSyncGuestAssignments = forceSyncGuestAssignments;

// Force push correct data to override wrong data
function forcePushCorrectData() {
  if (!isCollaborating) return;
  
  const currentState = getState();
  console.log('Force pushing correct data to override wrong data...');
  
  // Save current state with high priority timestamp
  database.ref('seatingPlan').set({
    ...currentState,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    updatedBy: currentUserId,
    forceOverride: true // Flag to indicate this is authoritative data
  }).then(() => {
    console.log('Correct data force-pushed to Firebase');
    lastSavedState = JSON.stringify(currentState);
  }).catch((error) => {
    console.error('Error force-pushing data:', error);
  });
}

// Make forcePushCorrectData available globally
window.forcePushCorrectData = forcePushCorrectData;

// Debug function to check all table guest assignments
function debugTableAssignments() {
  if (!isCollaborating) return;
  
  console.log('=== DEBUGGING TABLE ASSIGNMENTS ===');
  
  database.ref('seatingPlan').once('value').then((snapshot) => {
    const firebaseData = snapshot.val();
    const localData = getState();
    
    console.log('Firebase data:', firebaseData);
    console.log('Local data:', localData);
    
    if (firebaseData && firebaseData.tables) {
      console.log('=== FIREBASE TABLE ASSIGNMENTS ===');
      for (const tableId in firebaseData.tables) {
        const table = firebaseData.tables[tableId];
        const guests = table.seats?.map(s => s.guest).filter(g => g) || [];
        console.log(`Table ${tableId} (${table.name}):`, guests);
      }
    }
    
    if (localData && localData.tables) {
      console.log('=== LOCAL TABLE ASSIGNMENTS ===');
      for (const tableId in localData.tables) {
        const table = localData.tables[tableId];
        const guests = table.seats?.map(s => s.guest).filter(g => g) || [];
        console.log(`Table ${tableId} (${table.name}):`, guests);
      }
    }
  });
}

// Make debug function available globally
window.debugTableAssignments = debugTableAssignments;

// Force override specific table with correct data
function forceOverrideHeadTable() {
  if (!isCollaborating) return;
  
  const currentState = getState();
  console.log('Force overriding Head Table with correct guest assignments...');
  
  // Find the Head Table and ensure it has correct guests
  for (const tableId in currentState.tables) {
    const table = currentState.tables[tableId];
    if (table.name === 'Head Table - Long Way') {
      // Set correct guest assignments
      const correctGuests = ['Alan Cooper', 'Amy Ridge', 'Connor Daly', 'James Fitton', 'Laura Fitton', 'Lillith May', 'Mark Fitton', 'Chris Slaffa'];
      
      // Clear existing assignments
      table.seats.forEach(seat => {
        seat.guest = null;
      });
      
      // Assign correct guests
      correctGuests.forEach((guest, index) => {
        if (table.seats[index]) {
          table.seats[index].guest = guest;
        }
      });
      
      console.log('Head Table updated with correct guests:', correctGuests);
      break;
    }
  }
  
  // Save to Firebase immediately
  database.ref('seatingPlan').set({
    ...currentState,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    updatedBy: currentUserId,
    forceOverride: true
  }).then(() => {
    console.log('Head Table force-overridden in Firebase');
    lastSavedState = JSON.stringify(currentState);
    
    // Update displays
    updateCounts();
    updateAssignedGuestsDisplay();
    updateAllGuestDisplays();
  }).catch((error) => {
    console.error('Error force-overriding Head Table:', error);
  });
}

// Make force override function available globally
window.forceOverrideHeadTable = forceOverrideHeadTable;

// Emergency fix: Clear Firebase and force correct data
function emergencyFixFirebase() {
  if (!isCollaborating) return;
  
  console.log('EMERGENCY FIX: Clearing Firebase and forcing correct data...');
  
  // First, clear Firebase completely
  database.ref('seatingPlan').remove().then(() => {
    console.log('Firebase cleared');
    
    // Wait a moment, then push correct data
    setTimeout(() => {
      const currentState = getState();
      
      // Ensure Head Table has correct guests
      for (const tableId in currentState.tables) {
        const table = currentState.tables[tableId];
        if (table.name === 'Head Table - Long Way') {
          const correctGuests = ['Alan Cooper', 'Amy Ridge', 'Connor Daly', 'James Fitton', 'Laura Fitton', 'Lillith May', 'Mark Fitton', 'Chris Slaffa'];
          
          // Clear and reassign
          table.seats.forEach(seat => { seat.guest = null; });
          correctGuests.forEach((guest, index) => {
            if (table.seats[index]) {
              table.seats[index].guest = guest;
            }
          });
          
          console.log('Head Table corrected with:', correctGuests);
          break;
        }
      }
      
      // Push to Firebase
      database.ref('seatingPlan').set({
        ...currentState,
        lastUpdated: firebase.database.ServerValue.TIMESTAMP,
        updatedBy: currentUserId,
        emergencyFix: true
      }).then(() => {
        console.log('EMERGENCY FIX COMPLETE: Correct data pushed to Firebase');
        lastSavedState = JSON.stringify(currentState);
        
        // Update displays
        updateCounts();
        updateAssignedGuestsDisplay();
        updateAllGuestDisplays();
      }).catch((error) => {
        console.error('Error in emergency fix:', error);
      });
    }, 1000);
  }).catch((error) => {
    console.error('Error clearing Firebase:', error);
  });
}

// Make emergency fix available globally
window.emergencyFixFirebase = emergencyFixFirebase;

// Nuclear option: Complete collaboration reset
function nuclearReset() {
  if (!isCollaborating) return;
  
  console.log('NUCLEAR RESET: Complete collaboration reset...');
  
  // Stop collaboration first
  isCollaborating = false;
  if (presenceRef) {
    presenceRef.remove();
  }
  
  // Clear all Firebase data
  database.ref().remove().then(() => {
    console.log('All Firebase data cleared');
    
    // Wait 2 seconds for complete clear
    setTimeout(() => {
      // Restart collaboration
      initCollaboration();
      listenForUpdates();
      
      // Update UI
      document.getElementById('collaborateIcon').textContent = '🟢';
      document.getElementById('collaborateText').textContent = 'Collaborating';
      document.getElementById('collaborateBtn').classList.remove('btn-primary');
      document.getElementById('collaborateBtn').classList.add('btn-success');
      document.getElementById('syncBtn').style.display = 'inline-block';
      
      // Force push correct data
      setTimeout(() => {
        const currentState = getState();
        
        // Ensure Head Table has correct guests
        for (const tableId in currentState.tables) {
          const table = currentState.tables[tableId];
          if (table.name === 'Head Table - Long Way') {
            const correctGuests = ['Alan Cooper', 'Amy Ridge', 'Connor Daly', 'James Fitton', 'Laura Fitton', 'Lillith May', 'Mark Fitton', 'Chris Slaffa'];
            
            // Clear and reassign
            table.seats.forEach(seat => { seat.guest = null; });
            correctGuests.forEach((guest, index) => {
              if (table.seats[index]) {
                table.seats[index].guest = guest;
              }
            });
            
            console.log('Head Table corrected with:', correctGuests);
            break;
          }
        }
        
        // Push to Firebase with nuclear flag
        database.ref('seatingPlan').set({
          ...currentState,
          lastUpdated: firebase.database.ServerValue.TIMESTAMP,
          updatedBy: currentUserId,
          nuclearReset: true,
          resetTimestamp: Date.now()
        }).then(() => {
          console.log('NUCLEAR RESET COMPLETE: Clean state pushed to Firebase');
          lastSavedState = JSON.stringify(currentState);
          
          // Update displays
          updateCounts();
          updateAssignedGuestsDisplay();
          updateAllGuestDisplays();
          
          showCollaborationMessage('Nuclear reset complete! Clean state established.', 'success');
        }).catch((error) => {
          console.error('Error in nuclear reset:', error);
        });
      }, 1000);
    }, 2000);
  }).catch((error) => {
    console.error('Error clearing Firebase:', error);
  });
}

// Make nuclear reset available globally
window.nuclearReset = nuclearReset;

// Force client to reload from Firebase
function forceClientReload() {
  if (!isCollaborating) return;
  
  console.log('FORCE CLIENT RELOAD: Clearing local state and reloading from Firebase...');
  
  // Clear local state completely
  tables = {};
  guestData = new Map();
  
  // Clear all table containers from DOM
  const tableContainers = document.querySelectorAll('.table-container');
  tableContainers.forEach(container => container.remove());
  
  // Clear assigned guests display
  const assignedGuestsContainer = document.getElementById('assignedGuestsContainer');
  if (assignedGuestsContainer) {
    assignedGuestsContainer.innerHTML = '';
  }
  
  // Force reload from Firebase
  database.ref('seatingPlan').once('value').then((snapshot) => {
    const data = snapshot.val();
    if (data && data.tables && Object.keys(data.tables).length > 0) {
      const { lastUpdated, updatedBy, nuclearReset, resetTimestamp, ...cleanData } = data;
      
      // Import the clean data
      importState(JSON.stringify(cleanData));
      console.log('Client state reloaded from Firebase');
      
      // Update displays
      updateCounts();
      updateAssignedGuestsDisplay();
      updateAllGuestDisplays();
      
      showCollaborationMessage('Client state reloaded from Firebase!', 'success');
    } else {
      console.log('No data in Firebase to reload');
    }
  }).catch((error) => {
    console.error('Error reloading from Firebase:', error);
  });
}

// Make force reload available globally
window.forceClientReload = forceClientReload; 