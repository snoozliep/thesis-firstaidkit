// Firebase web client (modular) to mirror ESP32 /deviceData -> UI

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, onValue } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Refs
const deviceDataRef = ref(db, '/deviceData');
const logsRef = ref(db, '/logs');

// Helper: safe DOM getter
const $ = id => document.getElementById(id);

// Helper: normalize timestamp (seconds or ms) -> human string
function formatTimestamp(ts) {
  if (!ts) return 'N/A';
  // if ts looks like seconds (10 digits) convert to ms
  if (ts < 1e12) ts = ts * 1000;
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

// Update UI from deviceData snapshot
onValue(deviceDataRef, (snap) => {
  const data = snap.val();
  console.debug('deviceData:', data);

  const lastRfidEl = $('last-rfid');
  const userIdEl = $('user-id');
  const lcdEl = $('lcd-message');
  const headerStatusEl = $('device-status');
  const badgeEl = $('device-status-display');

  const rfid = data?.rfid ?? '— unknown —';
  const lcdMessage = data?.lcd || data?.lcdMessage || data?.message || '';
  const connected = !!data; // presence of data = connected

  if (lastRfidEl) lastRfidEl.textContent = rfid;
  if (userIdEl) userIdEl.textContent = rfid;
  if (lcdEl) lcdEl.textContent = lcdMessage || (connected ? 'ready' : 'No data');
  if (headerStatusEl) headerStatusEl.textContent = connected ? 'Connected' : 'Disconnected';

  if (badgeEl) {
    badgeEl.textContent = lcdMessage || (connected ? 'connected' : 'disconnected');
    badgeEl.classList.toggle('connected', connected);
    badgeEl.classList.toggle('disconnected', !connected);
  }
});

// Update dispense logs table
onValue(logsRef, (snap) => {
  const logs = snap.val();
  const tbody = $('log-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!logs) {
    tbody.innerHTML = '<tr class="empty"><td colspan="5">No dispense logs yet.</td></tr>';
    return;
  }

  // logs may be keyed by push id
  const rows = Object.values(logs);
  rows.forEach((log) => {
    const tr = document.createElement('tr');

    const user = log.user || log.rfid || 'N/A';
    const pillType = log.pillType || log.pill || 'N/A';
    const qty = log.quantity ?? log.qty ?? 1;
    const ts = log.timestamp ?? log.time ?? null;
    const status = log.status || log.result || 'N/A';

    tr.innerHTML = `
      <td>${user}</td>
      <td>${pillType}</td>
      <td>${qty}</td>
      <td>${formatTimestamp(ts)}</td>
      <td>${status}</td>
    `;
    tbody.appendChild(tr);
  });
});

// initial log message
window.addEventListener('load', () => {
  console.log('Script loaded — listening for device updates.');
});
