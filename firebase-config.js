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
          // If we have no tables and incoming has tables, use incoming
          shouldUpdate = true;
          mergedData.tables = cleanData.tables;
          console.log(`Loading tables from Firebase (no local tables)`);
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