// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

// Firebase config
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

// References
const deviceDataRef = ref(database, '/deviceData');
const logsRef = ref(database, '/logs');

// Update device data
onValue(deviceDataRef, (snapshot) => {
  const data = snapshot.val();
  console.log('Snapshot exists:', snapshot.exists(), 'Data:', data);
  if (data) {
    document.getElementById('last-rfid').textContent = data.rfid || 'No RFID';
    document.getElementById('user-id').textContent = data.rfid || '— unknown —';
    document.getElementById('device-status-display').textContent = 'connected';
    document.getElementById('device-status').textContent = 'Connected';
    document.getElementById('lcd-message').textContent = 'RFID Scanned';
  } else {
    document.getElementById('last-rfid').textContent = 'No data';
    document.getElementById('user-id').textContent = '— unknown —';
    document.getElementById('device-status-display').textContent = 'disconnected';
    document.getElementById('device-status').textContent = 'Disconnected';
    document.getElementById('lcd-message').textContent = 'No data';
  }
});

// Update logs
onValue(logsRef, (snapshot) => {
  const logs = snapshot.val();
  const tableBody = document.getElementById('log-table-body');
  tableBody.innerHTML = '';
  if (logs) {
    Object.values(logs).forEach((log) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${log.user || 'N/A'}</td>
        <td>${log.pillType || 'N/A'}</td>
        <td class="text-center">${log.quantity || 1}</td>
        <td>${log.timestamp ? new Date(log.timestamp * 1000).toLocaleString() : 'N/A'}</td>
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

// Initial load
window.addEventListener('load', () => {
  console.log('Firebase connected. Listening for ESP32 data...');
});