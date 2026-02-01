// --- Firebase Client Setup ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, onValue, set, remove, onChildAdded } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

// --- Firebase Configuration ---
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

// Secret key for HMAC (store securely in production, e.g., environment variable)
const secretKey = "82cf459c4f576c3a075ab02b2963b240a692dac7";

// HMAC Computation Function
async function computeHMAC(data, key) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const dataBuffer = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- Database References ---
const deviceDataRef = ref(db, '/deviceData');
const logsRef = ref(db, '/logs');
const tagsRef = ref(db, '/tags');
const alertsRef = ref(db, '/alerts');

// --- Utility Functions ---
const el = id => document.getElementById(id);

function formatTimestamp(ts) {
  const date = new Date(ts * 1000);
  return date.toLocaleString();
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[s]));
}

// --- DOM Ready Event ---
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
  const tagPinInput = el('tag-pin');
  const tagListDiv = el('tag-list');

  // --- Authentication Handling ---
  onAuthStateChanged(auth, user => {
    if (user) {
      loginCard.style.display = 'none';
      pageContent.style.display = '';
    } else {
      loginCard.style.display = '';
      pageContent.style.display = 'none';
    }
  });

  // --- Login Form Submission ---
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
    const tsMs = (rawTs > 1e12) ? rawTs : rawTs * 1000;
    const now = Date.now();
    // Updated: Check if timestamp is within 5 minutes (300000 ms) for "connected" status
    const connected = tsMs && (now - tsMs < 300000);  // 5 minutes threshold

    userNameValue.textContent = name;
    lastRfidTimeEl.textContent = tsMs ? new Date(tsMs).toLocaleString() : '—';
    badgeEl.textContent = connected ? 'connected' : 'disconnected';
    badgeEl.classList.toggle('connected', connected);
    badgeEl.classList.toggle('disconnected', !connected);
    userIdEl.textContent = rfid;

    // Update device status card
    el('device-temp').textContent = data.temperature ?? '--';
    el('device-humidity').textContent = data.humidity ?? '--';
    el("slot1-status").textContent = data.slot1 ?? "unknown";
    el("slot2-status").textContent = data.slot2 ?? "unknown";
    el("slot3-status").textContent = data.slot3 ?? "unknown";
    el("slot4-status").textContent = data.slot4 ?? "unknown";
    el("motor-status").textContent = data.motor ?? "unknown";

    // Display last RFID and tag scanned
    if (el('last-rfid')) el('last-rfid').textContent = data.rfid ?? '--';
    if (el('last-tag')) el('last-tag').textContent = data.name ?? '--';
    if (el('last-temp')) el('last-temp').textContent = data.temperature ?? '--';
    if (el('last-humidity')) el('last-humidity').textContent = data.humidity ?? '--';
  });

  // --- Logs Listener ---
  onValue(logsRef, (snap) => {
    if (!logTbody) return;
    const obj = snap.val() || {};
    const rows = Object.entries(obj).map(([k, v]) => ({ id: k, ...v }));
    rows.sort((a, b) => (b.timestamp ?? b.time ?? 0) - (a.timestamp ?? a.time ?? 0));

    logTbody.innerHTML = rows.length === 0 
      ? '<tr class="empty"><td colspan="7">No dispense logs yet.</td></tr>'
      : rows.map(row => {
        const user = escapeHtml(row.user || '');
        const pillType = escapeHtml(row.pillName || row.pillType || '');  // Pill name for Pill Type
        const qty = escapeHtml(row.quantity ?? row.qty ?? 1);
        const ts = escapeHtml(formatTimestamp(row.timestamp ?? row.time ?? 0));
        const error = escapeHtml(row.status === 'failed' ? row.pillType : 'N/A');  // Reason for Error on failed
        const status = escapeHtml(row.status || row.result || 'N/A');
        const statusClass = status.toLowerCase().includes('fail') ? 'fail' : (status.toLowerCase().includes('ok') || status.toLowerCase().includes('success') ? 'ok' : 'pending');
        const pin = escapeHtml(row.pin || '');

  return `
    <tr data-id="${escapeHtml(row.id)}">
      <td data-label="User">${user}</td>
      <td data-label="Pill Type">${pillType}</td>
      <td data-label="Quantity">${qty}</td>
      <td data-label="Timestamp">${ts}</td>
      <td data-label="Error">${error}</td>
      <td data-label="Status"><span class="log-status ${statusClass}">${status}</span></td>
      <td data-label="PIN">${pin}</td>
    </tr>
  `;
}).join('');


  // --- RFID Tag Management ---
  if (addTagForm) {
    addTagForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const rfid = tagIdInput.value.trim();
      const name = tagNameInput.value.trim();
      const pin = tagPinInput.value.trim();

      if (!/^\d{4}$/.test(pin)) {
        alert('PIN must be exactly 4 digits.');
        return;
      }

      const tagData = { name, pin };
      await set(ref(db, `/tags/${rfid}`), tagData);

      tagIdInput.value = '';
      tagNameInput.value = '';
      tagPinInput.value = '';
    });
  }

  // --- Tags Listener ---
  onValue(tagsRef, (snap) => {
    const tags = snap.val() || {};
    tagListDiv.innerHTML = Object.keys(tags).length === 0 
      ? '<div class="muted">No tags assigned.</div>'
      : Object.entries(tags).map(([rfid, tag]) => `
          <div class="tag-row" data-rfid="${rfid}">
            <span class="tag-id">${rfid}</span>
            <span class="tag-name">${escapeHtml(tag.name || '')}</span>
            <button class="tag-remove-btn" data-rfid="${rfid}" style="margin-left:auto;">Remove</button>
          </div>
        `).join('');
  });

  // --- Tag Removal ---
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

  // --- Emergency Alert Modal Logic ---
  const alertModal = document.getElementById('alertModal');
  const alertMessage = document.getElementById('alertMessage');
  const alertTimestamp = document.getElementById('alertTimestamp');
  const resolveBtn = document.getElementById('resolveBtn');
  const closeBtn = document.getElementById('closeAlertModal');

  function showAlertModal(message, timestamp) {
    if (!alertModal) return;
    alertMessage.textContent = message;
    alertTimestamp.textContent = "Time: " + new Date(timestamp * 1000).toLocaleString();
    alertModal.style.display = "block";

    if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
      const notification = new Notification("🚨 Emergency Alert", {
        body: message,
        tag: "emergency-alert",
        requireInteraction: true
      });
      notification.onclick = function() {
        window.focus();
        alertModal.style.display = "block";
        this.close();
      };
    }
  }

  if (resolveBtn) resolveBtn.onclick = async () => {
    alertModal.style.display = "none";
    onValue(alertsRef, (snap) => {
      const alerts = snap.val() || {};
      let latestKey = null, latestTs = 0;
      for (const [key, val] of Object.entries(alerts)) {
        if (val.status === "active" && (val.timestamp ?? 0) > latestTs) {
          latestKey = key;
          latestTs = val.timestamp ?? 0;
        }
      }
      if (latestKey) {
        set(ref(db, `/alerts/${latestKey}/status`), "resolved");
      }
    }, { onlyOnce: true });
  };
  if (closeBtn) closeBtn.onclick = () => alertModal.style.display = "none";

  // --- Listen for New Alerts with HMAC Verification (Only Recent Ones) ---
  onChildAdded(alertsRef, async (snapshot) => {
  console.log('New alert received:', snapshot.val());  // Debug log
  const alert = snapshot.val();
  if (alert && alert.status === "active") {
    const now = Date.now() / 1000;
    if (alert.timestamp > (now - 60)) {  // Increased to 60 seconds for delay tolerance
      const payload = "Button Pressed." + alert.timestamp + "active";
      const expectedHash = await computeHMAC(payload, secretKey);
      if (alert.hash === expectedHash) {
        console.log('Hash verified, showing modal');  // Debug log
        showAlertModal(alert.message, alert.timestamp);
      } else {
        console.error("Alert hash verification failed! Received:", alert.hash, "Expected:", expectedHash);
      }
    } else {
      console.log('Alert too old, ignored:', alert.timestamp);
    }
  }
}, (error) => {
  console.error('Firebase alerts error:', error);
});

  // --- Request Notification Permission ---
  if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
  }

  document.addEventListener("visibilitychange", function() {
    if (document.visibilityState === "visible" && alertModal && alertModal.style.display === "block") {
      alert("Emergency Alert! Please check the page.");
    }
  });

  // --- Periodic Cleanup of Old Alerts ---
  setInterval(() => {
    const now = Date.now() / 1000;
    onValue(alertsRef, (snap) => {
      snap.forEach((child) => {
        const alert = child.val();
        if (alert.status === "active" && (now - alert.timestamp) > 300) {  // Older than 5 minutes
          set(ref(db, `/alerts/${child.key}/status`), "resolved");
        }
      });
    }, { onlyOnce: true });
  }, 300000);  // Every 5 minutes
});

// --- Window Load Event ---
window.addEventListener('load', () => {
  console.log('Script loaded — listening for device updates including slot statuses.');
});