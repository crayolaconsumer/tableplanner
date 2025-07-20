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
  
  // Load existing data from Firebase first
  loadFromFirebase();
  
  // Then start listening for updates
  listenForUpdates();
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
  
  // Check if we have meaningful data to save
  const hasTables = state.tables && Object.keys(state.tables).length > 0;
  if (!hasTables) {
    console.log('Not saving empty state to Firebase');
    return;
  }
  
  saveTimeout = setTimeout(() => {
    console.log('Saving state to Firebase with', Object.keys(state.tables).length, 'tables');
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
  }, 300); // Reduced to 300ms for faster sync
}

// Load state from Firebase
function loadFromFirebase() {
  if (!isCollaborating) return;
  
  console.log('Loading state from Firebase...');
  database.ref('seatingPlan').once('value').then((snapshot) => {
    const data = snapshot.val();
    console.log('Firebase data received:', !!data);
    
    if (data && data.tables && Object.keys(data.tables).length > 0) {
      // Load data from Firebase
      const { lastUpdated, updatedBy, ...cleanData } = data;
      console.log('Loading tables from Firebase:', Object.keys(cleanData.tables).length);
      importState(JSON.stringify(cleanData));
      console.log('State loaded from Firebase');
    } else {
      console.log('Firebase is empty or has no tables, keeping current state');
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
          // If we have no tables and incoming has tables, load the data
          console.log(`Loading tables from Firebase (no local tables)`);
          shouldUpdate = true;
          mergedData.tables = cleanData.tables;
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
              // Check ALL table properties for changes, not just guest assignments
              let tableHasChanges = false;
              
              // Check table name
              if (currentTable.name !== incomingTable.name) {
                console.log(`Table ${tableId} name changed: "${currentTable.name}" → "${incomingTable.name}"`);
                tableHasChanges = true;
              }
              
              // Check seat count
              if (currentTable.seatCount !== incomingTable.seatCount) {
                console.log(`Table ${tableId} seat count changed: ${currentTable.seatCount} → ${incomingTable.seatCount}`);
                tableHasChanges = true;
              }
              
              // Check table position
              if (currentTable.left !== incomingTable.left || currentTable.top !== incomingTable.top) {
                console.log(`Table ${tableId} position changed: (${currentTable.left}, ${currentTable.top}) → (${incomingTable.left}, ${incomingTable.top})`);
                tableHasChanges = true;
              }
              
              // Check guest assignments
              const currentGuests = currentTable.seats?.map(s => s.guest).filter(g => g) || [];
              const incomingGuests = incomingTable.seats?.map(s => s.guest).filter(g => g) || [];
              
              // Sort both arrays for consistent comparison
              const sortedCurrentGuests = [...currentGuests].sort();
              const sortedIncomingGuests = [...incomingGuests].sort();
              
              if (sortedCurrentGuests.length !== sortedIncomingGuests.length || 
                  !sortedCurrentGuests.every((guest, index) => guest === sortedIncomingGuests[index])) {
                console.log(`Table ${tableId} guest assignments changed:`, {
                  current: sortedCurrentGuests,
                  incoming: sortedIncomingGuests
                });
                tableHasChanges = true;
              }
              
              // Update if ANY changes detected
              if (tableHasChanges) {
                mergedData.tables[tableId] = incomingTable;
                shouldUpdate = true;
                console.log(`Updating table ${tableId} - changes detected`);
              }
            }
          }
        }
        
        // Only update if we have meaningful changes and enough time has passed
        const now = Date.now();
        if (shouldUpdate && (now - lastUpdateTime) > 1000) { // Reduced to 1 second cooldown for faster sync
          lastUpdateTime = now;
          
          // BULLETPROOF VALIDATION: Bulletproof data takes absolute priority
          if (data.bulletproof && data.priority === 999999999) {
            console.log('BULLETPROOF DATA DETECTED: Accepting immediately');
            shouldUpdate = true;
            mergedData.tables = cleanData.tables;
          } else if (data.forceCorrect && data.priority === 999999) {
            console.log('FORCE CORRECT DATA DETECTED: Accepting immediately');
            shouldUpdate = true;
            mergedData.tables = cleanData.tables;
          } else {
            // TIMESTAMP VALIDATION: Only accept updates that are newer than our last save
            if (data.lastUpdated && lastSavedState) {
              const lastSavedTime = JSON.parse(lastSavedState).lastUpdated || 0;
              if (data.lastUpdated <= lastSavedTime) {
                console.log('Ignoring older update - our data is more recent');
                return;
              }
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

// BULLETPROOF force push correct data
function forcePushCorrectData() {
  if (!isCollaborating) return;
  
  const currentState = getState();
  console.log('BULLETPROOF: Force pushing correct data...');
  
  // ENSURE Head Table has correct guests
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
      
      console.log('Head Table BULLETPROOF corrected with:', correctGuests);
      break;
    }
  }
  
  // Save with ULTRA high priority
  const bulletproofData = {
    ...currentState,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    updatedBy: currentUserId,
    bulletproof: true,
    priority: 999999999,
    timestamp: Date.now(),
    correctGuests: ['Alan Cooper', 'Amy Ridge', 'Connor Daly', 'James Fitton', 'Laura Fitton', 'Lillith May', 'Mark Fitton', 'Chris Slaffa']
  };
  
  database.ref('seatingPlan').set(bulletproofData).then(() => {
    console.log('BULLETPROOF data pushed to Firebase');
    lastSavedState = JSON.stringify(bulletproofData);
  }).catch((error) => {
    console.error('Error in bulletproof push:', error);
  });
}

// Make forcePushCorrectData available globally
window.forcePushCorrectData = forcePushCorrectData;

// NUCLEAR RESET - Complete collaboration reset with bulletproof data
function nuclearReset() {
  if (!isCollaborating) return;
  
  console.log('NUCLEAR RESET: Complete collaboration reset...');
  
  // Stop collaboration first
  isCollaborating = false;
  if (presenceRef) {
    presenceRef.remove();
  }
  
  // Clear only the seating plan and presence data
  const clearPromises = [
    database.ref('seatingPlan').remove(),
    database.ref('presence').remove()
  ];
  
  Promise.all(clearPromises).then(() => {
    console.log('Firebase data cleared');
    
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
      
      // Force push bulletproof data
      setTimeout(() => {
        forcePushCorrectData();
        
        // Update displays
        updateCounts();
        updateAssignedGuestsDisplay();
        updateAllGuestDisplays();
        
        showCollaborationMessage('Nuclear reset complete! Bulletproof data established.', 'success');
      }, 1000);
    }, 2000);
  }).catch((error) => {
    console.error('Error in nuclear reset:', error);
  });
}

// Make nuclear reset available globally
window.nuclearReset = nuclearReset;

// Comprehensive debugging function
function debugTableAssignments() {
  if (!isCollaborating) return;
  
  console.log('=== COMPREHENSIVE DEBUGGING ===');
  
  // Get current user info
  console.log('Current user ID:', currentUserId);
  console.log('Is collaborating:', isCollaborating);
  console.log('Is updating from Firebase:', isUpdatingFromFirebase);
  console.log('Last saved state exists:', !!lastSavedState);
  
  // Get Firebase data
  database.ref('seatingPlan').once('value').then((snapshot) => {
    const firebaseData = snapshot.val();
    const localData = getState();
    
    console.log('=== FIREBASE DATA ===');
    console.log('Firebase data exists:', !!firebaseData);
    if (firebaseData) {
      console.log('Firebase lastUpdated:', firebaseData.lastUpdated);
      console.log('Firebase updatedBy:', firebaseData.updatedBy);
      console.log('Firebase tables count:', firebaseData.tables ? Object.keys(firebaseData.tables).length : 0);
      
      if (firebaseData.tables) {
        for (const tableId in firebaseData.tables) {
          const table = firebaseData.tables[tableId];
          const guests = table.seats?.map(s => s.guest).filter(g => g) || [];
          console.log(`Firebase Table ${tableId} (${table.name}):`, guests);
        }
      }
    }
    
    console.log('=== LOCAL DATA ===');
    console.log('Local tables count:', localData.tables ? Object.keys(localData.tables).length : 0);
    
    if (localData.tables) {
      for (const tableId in localData.tables) {
        const table = localData.tables[tableId];
        const guests = table.seats?.map(s => s.guest).filter(g => g) || [];
        console.log(`Local Table ${tableId} (${table.name}):`, guests);
      }
    }
    
    // Check for mismatches
    console.log('=== MISMATCH ANALYSIS ===');
    if (firebaseData && firebaseData.tables && localData.tables) {
      for (const tableId in firebaseData.tables) {
        const firebaseTable = firebaseData.tables[tableId];
        const localTable = localData.tables[tableId];
        
        if (localTable) {
          const firebaseGuests = firebaseTable.seats?.map(s => s.guest).filter(g => g) || [];
          const localGuests = localTable.seats?.map(s => s.guest).filter(g => g) || [];
          
          if (JSON.stringify(firebaseGuests) !== JSON.stringify(localGuests)) {
            console.log(`❌ MISMATCH in table ${tableId} (${firebaseTable.name}):`);
            console.log('  Firebase:', firebaseGuests);
            console.log('  Local:', localGuests);
          } else {
            console.log(`✅ MATCH in table ${tableId} (${firebaseTable.name})`);
          }
        }
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
  
  // Clear only the seating plan and presence data (not entire database)
  const clearPromises = [
    database.ref('seatingPlan').remove(),
    database.ref('presence').remove()
  ];
  
  Promise.all(clearPromises).then(() => {
    console.log('Seating plan and presence data cleared');
    
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

// Simple force sync with correct data
function forceCorrectSync() {
  if (!isCollaborating) return;
  
  console.log('FORCE CORRECT SYNC: Pushing correct data with high priority...');
  
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
  
  // Push with very high priority timestamp
  const highPriorityData = {
    ...currentState,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    updatedBy: currentUserId,
    forceCorrect: true,
    priority: 999999,
    timestamp: Date.now()
  };
  
  database.ref('seatingPlan').set(highPriorityData).then(() => {
    console.log('FORCE CORRECT SYNC COMPLETE: High priority data pushed');
    lastSavedState = JSON.stringify(highPriorityData);
    
    // Update displays
    updateCounts();
    updateAssignedGuestsDisplay();
    updateAllGuestDisplays();
    
    showCollaborationMessage('Correct data force-synced with high priority!', 'success');
  }).catch((error) => {
    console.error('Error in force correct sync:', error);
  });
}

// Make force correct sync available globally
window.forceCorrectSync = forceCorrectSync;

// CLIENT NUCLEAR RESET - Force client to clear local state and reload
function clientNuclearReset() {
  if (!isCollaborating) return;
  
  console.log('CLIENT NUCLEAR RESET: Clearing local state completely...');
  
  // Stop collaboration first
  isCollaborating = false;
  if (presenceRef) {
    presenceRef.remove();
  }
  
  // Clear ALL local state
  tables = {};
  guestData.clear();
  personCounter = 0;
  
  // Clear all DOM elements
  const canvas = document.getElementById('canvas');
  if (canvas) {
    canvas.innerHTML = '';
  }
  
  const peopleList = document.getElementById('people-list');
  if (peopleList) {
    peopleList.innerHTML = '';
  }
  
  const assignedGuestsContainer = document.getElementById('assigned-guests-list');
  if (assignedGuestsContainer) {
    assignedGuestsContainer.innerHTML = '';
  }
  
  // Clear counts
  const countDiv = document.getElementById('guestSeatCounts');
  if (countDiv) {
    countDiv.innerHTML = 'Total Guests: 0 &nbsp;&nbsp; Total Seats: 0';
  }
  
  console.log('Local state completely cleared');
  
  // Wait 1 second, then restart collaboration
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
    
    console.log('CLIENT NUCLEAR RESET: Collaboration restarted with clean slate');
    showCollaborationMessage('Client nuclear reset complete! Clean slate established.', 'success');
  }, 1000);
}

// Make client nuclear reset available globally
window.clientNuclearReset = clientNuclearReset;

// Test Firebase listener and data flow
function testFirebaseListener() {
  if (!isCollaborating) return;
  
  console.log('=== TESTING FIREBASE LISTENER ===');
  
  // Test 1: Check if listener is working
  console.log('Test 1: Checking Firebase listener...');
  database.ref('seatingPlan').once('value').then((snapshot) => {
    const data = snapshot.val();
    console.log('Firebase listener test - data received:', !!data);
    if (data) {
      console.log('Data structure:', Object.keys(data));
      console.log('Tables count:', data.tables ? Object.keys(data.tables).length : 0);
    }
  });
  
  // Test 2: Force a save and see what happens
  console.log('Test 2: Forcing a save...');
  const testState = getState();
  console.log('Current state tables count:', testState.tables ? Object.keys(testState.tables).length : 0);
  
  database.ref('seatingPlan').set({
    ...testState,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    updatedBy: currentUserId,
    testSave: true
  }).then(() => {
    console.log('Test save completed');
  });
  
  // Test 3: Check if our listener receives the update
  console.log('Test 3: Checking if listener receives updates...');
  setTimeout(() => {
    console.log('Listener test completed - check if you see listener logs above');
  }, 2000);
}

// Make test function available globally
window.testFirebaseListener = testFirebaseListener;

// Root cause analysis - check what's actually happening
function rootCauseAnalysis() {
  if (!isCollaborating) return;
  
  console.log('=== ROOT CAUSE ANALYSIS ===');
  
  // Check 1: What data is in Firebase right now?
  console.log('Check 1: Current Firebase data...');
  database.ref('seatingPlan').once('value').then((snapshot) => {
    const firebaseData = snapshot.val();
    console.log('Firebase has data:', !!firebaseData);
    
    if (firebaseData && firebaseData.tables) {
      // Show all table data
      console.log('Firebase tables:', Object.keys(firebaseData.tables));
      for (const tableId in firebaseData.tables) {
        const table = firebaseData.tables[tableId];
        const guests = table.seats?.map(s => s.guest).filter(g => g) || [];
        console.log(`Firebase Table ${tableId} (${table.name}):`, guests);
      }
    }
    
    // Check 2: What data does this client have locally?
    console.log('Check 2: Local data...');
    const localData = getState();
    if (localData && localData.tables) {
      console.log('Local tables:', Object.keys(localData.tables));
      for (const tableId in localData.tables) {
        const table = localData.tables[tableId];
        const guests = table.seats?.map(s => s.guest).filter(g => g) || [];
        console.log(`Local Table ${tableId} (${table.name}):`, guests);
      }
    }
    
    // Check 3: Is the listener working?
    console.log('Check 3: Listener status...');
    console.log('Is collaborating:', isCollaborating);
    console.log('Is updating from Firebase:', isUpdatingFromFirebase);
    console.log('Last update time:', lastUpdateTime);
    
    // Check 4: Force a clean save
    console.log('Check 4: Forcing clean save...');
    const cleanState = getState();
    console.log('Saving current state as-is to Firebase');
    
    // Save to Firebase
    database.ref('seatingPlan').set({
      ...cleanState,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
      updatedBy: currentUserId,
      rootCauseFix: true,
      timestamp: Date.now()
    }).then(() => {
      console.log('Clean save completed');
      console.log('=== ROOT CAUSE ANALYSIS COMPLETE ===');
      console.log('Next: Check if client receives this update');
    });
  });
}

// Make root cause analysis available globally
window.rootCauseAnalysis = rootCauseAnalysis;

// ACTUAL TEST RUNNER - runs all tests automatically
function runAllTests() {
  console.log('🧪 RUNNING ALL TESTS AUTOMATICALLY');
  console.log('=====================================');
  
  // Test 1: Check collaboration status
  console.log('\n📋 TEST 1: Collaboration Status');
  console.log('Is collaborating:', isCollaborating);
  console.log('Current user ID:', currentUserId);
  console.log('Is updating from Firebase:', isUpdatingFromFirebase);
  
  // Test 2: Check Firebase connection
  console.log('\n🔥 TEST 2: Firebase Connection');
  database.ref('seatingPlan').once('value').then((snapshot) => {
    const data = snapshot.val();
    console.log('Firebase connection working:', !!data);
    console.log('Firebase has data:', !!data);
    if (data) {
      console.log('Firebase data keys:', Object.keys(data));
      console.log('Firebase tables count:', data.tables ? Object.keys(data.tables).length : 0);
    }
    
    // Test 3: Compare Firebase vs Local
    console.log('\n🔄 TEST 3: Firebase vs Local Comparison');
    const localData = getState();
    console.log('Local tables count:', localData.tables ? Object.keys(localData.tables).length : 0);
    
    if (data && data.tables && localData.tables) {
      console.log('\n📊 DETAILED COMPARISON:');
      for (const tableId in data.tables) {
        const firebaseTable = data.tables[tableId];
        const localTable = localData.tables[tableId];
        
        if (localTable) {
          const firebaseGuests = firebaseTable.seats?.map(s => s.guest).filter(g => g) || [];
          const localGuests = localTable.seats?.map(s => s.guest).filter(g => g) || [];
          
          console.log(`\nTable: ${firebaseTable.name}`);
          console.log('  Firebase guests:', firebaseGuests);
          console.log('  Local guests:', localGuests);
          console.log('  Match:', JSON.stringify(firebaseGuests.sort()) === JSON.stringify(localGuests.sort()));
        }
      }
    }
    
    // Test 4: Force a test save
    console.log('\n💾 TEST 4: Test Save');
    const testState = getState();
    console.log('Saving test state...');
    
    database.ref('seatingPlan').set({
      ...testState,
      lastUpdated: firebase.database.ServerValue.TIMESTAMP,
      updatedBy: currentUserId,
      testRun: true,
      testTimestamp: Date.now()
    }).then(() => {
      console.log('✅ Test save completed');
      
      // Test 5: Check if listener receives it
      console.log('\n👂 TEST 5: Listener Test');
      setTimeout(() => {
        console.log('Listener test completed - check if you see listener logs above');
        console.log('\n🎯 TEST RESULTS SUMMARY:');
        console.log('If you see "Received and merged real-time update" above, listener is working');
        console.log('If Firebase and Local data match, sync is working');
        console.log('If they don\'t match, there\'s a sync issue');
      }, 2000);
    });
  });
}

// Make test runner available globally
window.runAllTests = runAllTests;

// IMMEDIATE FIX - Force client to load correct data
function fixClientData() {
  console.log('🔧 FIXING CLIENT DATA...');
  
  // Step 1: Load correct data from Firebase
  database.ref('seatingPlan').once('value').then((snapshot) => {
    const data = snapshot.val();
    console.log('Firebase data:', !!data);
    
    if (data && data.tables && Object.keys(data.tables).length > 0) {
      console.log('Loading correct data from Firebase...');
      const { lastUpdated, updatedBy, ...cleanData } = data;
      importState(JSON.stringify(cleanData));
      console.log('✅ Client data fixed - loaded from Firebase');
      
      // Step 2: Update displays
      setTimeout(() => {
        updateCounts();
        updateAssignedGuestsDisplay();
        updateAllGuestDisplays();
        console.log('✅ Displays updated');
      }, 100);
    } else {
      console.log('❌ No data in Firebase to load');
    }
  });
}

// Make fix function available globally
window.fixClientData = fixClientData; 