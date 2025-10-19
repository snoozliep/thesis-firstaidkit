// Import Firebase SDK (ensure this matches your HTML imports)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, onValue, get } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

// Firebase config (replace with your project's config from Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyDNneb6zniUzuIfrQYBrTWW2ZrZ7cetyyQ",
  authDomain: "final-pill.firebaseapp.com",
  databaseURL: "https://final-pill-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "final-pill",
  storageBucket: "final-pill.firebasestorage.app",
  messagingSenderId: "108593818831",
  appId: "1:108593818831:web:bd0af02600ab7a6b8d1bba",
  measurementId: "G-XJ7TBXB6LX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// References to database paths
const deviceDataRef = ref(database, '/deviceData');
const logsRef = ref(database, '/logs');

// Function to update device data (RFID, LCD, status)
onValue(deviceDataRef, (snapshot) => {
  const data = snapshot.val();
  if (data) {
    document.getElementById('last-rfid').textContent = data.rfid || 'No data';
    document.getElementById('lcd-message').textContent = data.lcdMessage || 'No data';
    document.getElementById('user-id').textContent = data.rfid || '— unknown —';
    document.getElementById('device-status-display').textContent = 'connected';
    document.getElementById('device-status').textContent = 'Connected';  // Update header status
  } else {
    document.getElementById('last-rfid').textContent = 'No data';
    document.getElementById('lcd-message').textContent = 'No data';
    document.getElementById('user-id').textContent = '— unknown —';
    document.getElementById('device-status-display').textContent = 'disconnected';
    document.getElementById('device-status').textContent = 'Disconnected';
  }
});

// Function to update dispense logs table
onValue(logsRef, (snapshot) => {
  const logs = snapshot.val();
  const tableBody = document.getElementById('log-table-body');
  tableBody.innerHTML = '';  // Clear existing rows

  if (logs) {
    Object.values(logs).forEach((log) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${log.user || 'N/A'}</td>
        <td>${log.pillType || 'N/A'}</td>
        <td class="text-center">${log.quantity || 1}</td>
        <td>${log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</td>
        <td class="text-right">
          <span class="${log.status === 'Success' ? 'text-green' : 'text-red'}">${log.status || 'N/A'}</span>
        </td>
      `;
      tableBody.appendChild(row);
    });
  } else {
    tableBody.innerHTML = '<tr class="empty"><td colspan="5">No dispense logs yet.</td></tr>';
  }
});

// Optional: Initial fetch on page load
window.addEventListener('load', () => {
  // Trigger initial updates if needed
  console.log('Firebase connected. Listening for updates...');
});