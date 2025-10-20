// Import Firebase SDK (ensure this matches your HTML imports)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

// Firebase config (from your ESP32 code)
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
const deviceDataRef = ref(database, '/deviceData');  // ESP32 sends here
const logsRef = ref(database, '/logs');  // For dispense logs (if ESP32 sends)

// Function to update device data (from ESP32)
onValue(deviceDataRef, (snapshot) => {
  const data = snapshot.val();
  console.log('Received data from ESP32:', data);  // Debug: Check console for received data
  if (data) {
    document.getElementById('last-rfid').textContent = data.rfid || 'No RFID';
    document.getElementById('user-id').textContent = data.rfid || '— unknown —';
    document.getElementById('device-status-display').textContent = 'connected';
    document.getElementById('device-status').textContent = 'Connected';
    document.getElementById('lcd-message').textContent = 'RFID Scanned';  // Placeholder; ESP32 doesn't send this yet
  } else {
    document.getElementById('last-rfid').textContent = 'No data';
    document.getElementById('user-id').textContent = '— unknown —';
    document.getElementById('device-status-display').textContent = 'disconnected';
    document.getElementById('device-status').textContent = 'Disconnected';
    document.getElementById('lcd-message').textContent = 'No data';
  }
});

// Function to update dispense logs table (if ESP32 sends to /logs)
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

onValue(deviceDataRef, (snapshot) => {
  const data = snapshot.val();
  console.log('Snapshot received:', snapshot.exists(), data);  // Check if data exists
  if (data) {
    // ... your update code
  } else {
    console.log('No data in /deviceData');
  }
});

// Function to fetch data from the server
function fetchData() {
    fetch('https://studio--studio-5091213743-43b4f.us-central1.hosted.app/api/device-data')
        .then(response => response.json())
        .then(data => {
            document.getElementById('last-rfid').textContent = data.rfid || 'No data';
            document.getElementById('lcd-message').textContent = data.lcdMessage || 'No data';
            document.getElementById('user-id').textContent = data.rfid || '— unknown —';
            document.getElementById('device-status-display').textContent = data.rfid ? 'connected' : 'disconnected';
            document.getElementById('device-status').textContent = data.rfid ? 'Connected' : 'Disconnected';
            document.getElementById('servo-status').textContent = 'Idle';  // Placeholder
            document.getElementById('motor-status').textContent = 'Idle';  // Placeholder
            console.log('Data updated:', data);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            document.getElementById('device-status-display').textContent = 'error';
        });
}
// Fetch on load and poll every 5 seconds
fetchData();
setInterval(fetchData, 5000);

