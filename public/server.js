// --- Clean Firebase Client with Auth, UI, and Slot Status ---

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

// --- Firebase Config ---
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

// --- Firebase Init ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const deviceDataRef = ref(db, '/deviceData');
const logsRef = ref(db, '/logs');
const tagsRef = ref(db, '/tags');
const slotStatusRef = ref(db, '/slotStatus'); // ✅ NEW
const auth = getAuth(app);

// --- Utility ---
function formatTimestamp(ts) {
  if (!ts) return '—';
  if (ts < 1e12) ts = ts * 1000;
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}
const el = id => document.getElementById(id);

// --- DOM Ready ---
document.addEventListener('DOMContentLoaded', () => {
  // --- Elements ---
  const loginCard = el('loginCard');
  const loginForm = el('loginForm');
  const loginError = el('loginError');
  const pageContent = document.querySelector('.page');
  const userNameValue = el('user-name-value');
  const lastRfidTimeEl = el('last-rfid-time');
  const badgeEl = el('device-status-display');
  const userIdEl = el('user-id');
  const logTbody = el('log-table-body');
  const addTagForm = el('add-tag-form');
  const tagIdInput = el('tag-id');
  const tagNameInput = el('tag-name');
  const tagListDiv = el('tag-list');

  // --- Auth ---
  onAuthStateChanged(auth, user => {
    if (user) {
      if (loginCard) loginCard.style.display = 'none';
      if (pageContent) pageContent.style.display = '';
    } else {
      if (loginCard) loginCard.style.display = '';
      if (pageContent) pageContent.style.display = 'none';
    }
  });

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.textContent = '';
      const email = el('loginEmail').value;
      const password = el('loginPassword').value;
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (err) {
        loginError.textContent = err.message || 'Sign in failed';
      }
    });
  }

  // --- Device Data Listener ---
  onValue(deviceDataRef, (snap) => {
    const data = snap.val() ?? {};
    const name = data?.name ?? '—';
    const rfid = data?.rfid ?? '— unknown —';
    const rawTs = Number(data?.timestamp ?? 0);
    let tsMs = 0;
    if (rawTs > 1000000000 && rawTs < 2000000000) tsMs = rawTs * 1000;
    else if (rawTs > 1000000000000 && rawTs < 2000000000000) tsMs = rawTs;
    const now = Date.now();
    const FRESH_MS = 30000;
    const connected = tsMs && (now - tsMs >= 0) && (now - tsMs < FRESH_MS);

    if (userNameValue) userNameValue.textContent = name;
    if (lastRfidTimeEl) lastRfidTimeEl.textContent = tsMs ? new Date(tsMs).toLocaleString() : '—';
    if (badgeEl) {
      badgeEl.textContent = connected ? 'connected' : 'disconnected';
      badgeEl.classList.toggle('connected', connected);
      badgeEl.classList.toggle('disconnected', !connected);
    }
    if (userIdEl) userIdEl.textContent = rfid;
  });

  // --- Logs Listener ---
  onValue(logsRef, (snap) => {
    if (!logTbody) return;
    const obj = snap.val() || {};
    const rows = Object.entries(obj).map(([k, v]) => ({ id: k, ...v }));
    rows.sort((a, b) => {
      const ta = Number(a.timestamp ?? a.time ?? 0);
      const tb = Number(b.timestamp ?? b.time ?? 0);
      const aMs = ta && ta < 1e12 ? ta * 1000 : ta;
      const bMs = tb && tb < 1e12 ? tb * 1000 : tb;
      return (bMs || 0) - (aMs || 0);
    });

    if (rows.length === 0) {
      logTbody.innerHTML = '<tr class="empty"><td colspan="6">No dispense logs yet.</td></tr>';
      return;
    }

    logTbody.innerHTML = rows.map(row => {
      const user = escapeHtml(row.user || row.rfid || 'N/A');
      const pillType = escapeHtml(row.pill || 'N/A');
      const qty = escapeHtml(row.quantity ?? row.qty ?? 1);
      const ts = escapeHtml(formatTimestamp(row.timestamp ?? row.time ?? 0));
      const error = escapeHtml(row.pillType || 'N/A');
      const status = escapeHtml(row.status || row.result || 'N/A');
      const statusClass = status.toLowerCase().includes('fail')
        ? 'fail'
        : (status.toLowerCase().includes('ok') || status.toLowerCase().includes('success') ? 'ok' : 'pending');
      return `
        <tr data-id="${escapeHtml(row.id)}">
          <td data-label="User">${user}</td>
          <td data-label="Pill Type">${pillType}</td>
          <td data-label="Quantity">${qty}</td>
          <td data-label="Timestamp">${ts}</td>
          <td data-label="Error">${error}</td>
          <td data-label="Status"><span class="log-status ${statusClass}">${status}</span></td>
        </tr>
      `;
    }).join('');
  });

  // --- ✅ Slot Status Listener (Laser sensors / photoresistors) ---
  onValue(slotStatusRef, (snap) => {
    const data = snap.val() || {};
    const s1 = el("slot1-status");
    const s2 = el("slot2-status");
    const s3 = el("slot3-status");
    const s4 = el("slot4-status");
    const motor = el("motor-status");

    if (s1) s1.textContent = data.Slot1?.status || "unknown";
    if (s2) s2.textContent = data.Slot2?.status || "unknown";
    if (s3) s3.textContent = data.Slot3?.status || "unknown";
    if (s4) s4.textContent = data.Slot4?.status || "unknown";
    if (motor) motor.textContent = data.Motor1?.status || "unknown";
  });

  // --- RFID Tag Management ---
  if (addTagForm) {
    addTagForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rfid = tagIdInput.value.trim();
      const name = tagNameInput.value.trim();
      if (!rfid || !name) return;
      await set(ref(db, `/tags/${rfid}`), { name });
      tagIdInput.value = '';
      tagNameInput.value = '';
    });
  }

  onValue(tagsRef, (snap) => {
    const tags = snap.val() || {};
    if (!tagListDiv) return;
    if (Object.keys(tags).length === 0) {
      tagListDiv.innerHTML = '<div class="muted">No tags assigned.</div>';
      return;
    }
    tagListDiv.innerHTML = Object.entries(tags).map(([rfid, tag]) => `
      <div class="tag-row" data-rfid="${rfid}">
        <span class="tag-id">${rfid}</span>
        <span class="tag-name">${escapeHtml(tag.name || '')}</span>
        <button class="tag-remove-btn" data-rfid="${rfid}" style="margin-left:auto;">Remove</button>
      </div>
    `).join('');
  });

  if (tagListDiv) {
    tagListDiv.addEventListener('click', async (e) => {
      const target = e.target;
      if (target.classList.contains('tag-remove-btn')) {
        const rfid = target.getAttribute('data-rfid');
        if (confirm(`Remove tag ${rfid}?`)) {
          await remove(ref(db, `/tags/${rfid}`));
        }
      }
    });
  }
});

window.addEventListener('load', () => {
  console.log('Script loaded — listening for device updates including slot statuses.');
});

// Function to display alerts
function displayAlert(alertData) {
  const alertsContainer = document.getElementById('alerts-container');
  const alertDiv = document.createElement('div');
  alertDiv.className = 'alert-item';
  alertDiv.innerHTML = `
    <strong>Alert:</strong> ${alertData.message}<br>
    <small>Timestamp: ${new Date(alertData.timestamp * 1000).toLocaleString()}</small><br>
    <small>Status: ${alertData.status}</small>
  `;
  alertsContainer.appendChild(alertDiv);
}
// Listen for new alerts from ESP32 button presses
const alertsRef = database.ref('/alerts');
alertsRef.on('child_added', (snapshot) => {
  const alertData = snapshot.val();
  displayAlert(alertData);
  console.log('New alert received:', alertData);
});
// Optional: Clear old alerts after a certain time or on page load
// Example: Remove alerts older than 1 hour
setInterval(() => {
  const now = Date.now() / 1000;
  alertsRef.once('value', (snapshot) => {
    snapshot.forEach((childSnapshot) => {
      const alertData = childSnapshot.val();
      if (now - alertData.timestamp > 3600) {  // 1 hour in seconds
        childSnapshot.ref.remove();
      }
    });
  });
}, 60000);  // Check every minute

// Example function to acknowledge an alert
function acknowledgeAlert() {
    const acknowledgmentRef = ref(db, '/acknowledgment');
    set(acknowledgmentRef, 'acknowledged')
        .then(() => {
            console.log('Alert acknowledged.');
        })
        .catch((error) => {
            console.error('Error acknowledging alert:', error);
        });
}

// Call this function when the user acknowledges an alert
document.getElementById('acknowledge-button').addEventListener('click', acknowledgeAlert);

