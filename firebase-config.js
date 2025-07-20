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

// Save state to Firebase
function saveToFirebase(state) {
  if (!isCollaborating) return;
  
  database.ref('seatingPlan').set({
    ...state,
    lastUpdated: firebase.database.ServerValue.TIMESTAMP,
    updatedBy: currentUserId
  }).then(() => {
    console.log('State saved to Firebase');
  }).catch((error) => {
    console.error('Error saving to Firebase:', error);
  });
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
        importState(JSON.stringify(cleanData));
        console.log('Received real-time update from another user');
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