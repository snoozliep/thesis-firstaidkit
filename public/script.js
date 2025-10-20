// Safe Firebase client + guarded DOM updates

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
const deviceDataRef = ref(db, '/deviceData');
const logsRef = ref(db, '/logs');

function formatTimestamp(ts) {
  if (!ts) return 'N/A';
  if (ts < 1e12) ts = ts * 1000;
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

document.addEventListener('DOMContentLoaded', () => {
  const el = id => document.getElementById(id) || null;

  const lastRfidEl = el('last-rfid');
  const userIdEl = el('user-id');
  const lcdEl = el('lcd-message');
  const headerStatusEl = el('device-status');
  const badgeEl = el('device-status-display');
  const logTbody = el('log-table-body');

  // deviceData listener (guarded)
  onValue(deviceDataRef, (snap) => {
    const data = snap.val() ?? {};
    // pick name (ESP writes "name"), fallback to userName or rfid
    const name = data?.name ?? data?.userName ?? '';
    const rfid = data?.rfid ?? '— unknown —';

    const userIdEl = document.getElementById('user-id');
    const headerEl = document.getElementById('current-user-header');
    const userNameValue = document.getElementById('user-name-value');

    if (userIdEl) userIdEl.textContent = name || rfid || '— unknown —';
    if (headerEl) headerEl.textContent = name || 'Last User';
    if (userNameValue) userNameValue.textContent = name || '— none —';

    const lcdMessage = data && (data.lcdMessage || data.lcd || data.message) ? (data.lcdMessage || data.lcd || data.message) : '';
    const rawTs = data && data.timestamp ? data.timestamp : 0;
    const tsMs = rawTs && rawTs < 1e12 ? rawTs * 1000 : rawTs;
    const now = Date.now();
    const connected = !!data && tsMs && (now - tsMs) < 15000; // 15s freshness

    if (lastRfidEl) lastRfidEl.textContent = rfid;
    if (userIdEl) userIdEl.textContent = rfid;
    if (lcdEl) lcdEl.textContent = lcdMessage || (connected ? 'ready' : 'No data');
    if (headerStatusEl) headerStatusEl.textContent = connected ? 'Connected' : 'Disconnected';

    if (badgeEl) {
      badgeEl.textContent = connected ? 'connected' : 'disconnected';
      badgeEl.classList.toggle('connected', connected);
      badgeEl.classList.toggle('disconnected', !connected);
    }
  }, (err) => console.error('deviceData onValue error', err));

  // logs listener (guarded)
  onValue(logsRef, (snap) => {
    try {
      const logs = snap.val();
      if (!logTbody) return;
      logTbody.innerHTML = '';

      if (!logs) {
        logTbody.innerHTML = '<tr class="empty"><td colspan="5">No dispense logs yet.</td></tr>';
        return;
      }

      Object.values(logs).forEach(log => {
        const tr = document.createElement('tr');
        const user = log.user || log.rfid || 'N/A';
        const pillType = log.pillType || log.pill || 'N/A';
        const qty = (typeof log.quantity !== 'undefined') ? log.quantity : (log.qty ?? 1);
        const ts = log.timestamp ?? log.time ?? null;
        const status = log.status || log.result || 'N/A';

        tr.innerHTML = `
          <td>${user}</td>
          <td>${pillType}</td>
          <td>${qty}</td>
          <td>${formatTimestamp(ts)}</td>
          <td>${status}</td>
        `;
        logTbody.appendChild(tr);
      });
    } catch (e) {
      console.error('logs handler error', e);
    }
  }, (err) => console.error('logs onValue error', err));
});

/*
  Enhanced client-side rendering for /logs:
  - search filter
  - header sorting (click to sort)
  - page size + pagination
  - responsive row labels
*/

document.addEventListener('DOMContentLoaded', () => {
  // --- setup controls & state ---
  const logTbody = document.getElementById('log-table-body');
  const tableWrap = document.querySelector('.log-card .table-wrap') || document.querySelector('.log-card');
  if (!tableWrap) return;

  // inject controls container above table
  const controls = document.createElement('div');
  controls.className = 'log-controls';
  controls.innerHTML = `
    <div class="left">
      <input type="search" id="logSearch" placeholder="Search user / pill / status">
      <label for="pageSize">Rows</label>
      <select id="pageSize">
        <option value="5">5</option>
        <option value="10" selected>10</option>
        <option value="25">25</option>
      </select>
    </div>
    <div class="right">
      <div class="log-pagination" id="logPagination"></div>
    </div>
  `;
  tableWrap.parentNode.insertBefore(controls, tableWrap);

  // state
  let logsCache = [];
  let filterText = '';
  let sortBy = { key: 'timestamp', dir: -1 }; // -1 = desc, 1 = asc
  let page = 1;
  let pageSize = parseInt(document.getElementById('pageSize').value, 10);

  const searchInput = document.getElementById('logSearch');
  const pageSizeSelect = document.getElementById('pageSize');
  const paginationEl = document.getElementById('logPagination');

  // debounce helper
  const debounce = (fn, wait=200) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
  };

  // format timestamp (re-use existing helper if present)
  function fmt(ts){
    if (!ts) return '—';
    if (ts < 1e12) ts = ts * 1000;
    try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
  }

  // render table from logsCache with current filter/sort/page
  function renderLogs(){
    if (!logTbody) return;
    const ft = filterText.trim().toLowerCase();
    let list = Array.isArray(logsCache) ? logsCache.slice() : [];

    if (ft) {
      list = list.filter(l => {
        const user = (l.user || l.rfid || '').toString().toLowerCase();
        const pill = (l.pillType || l.pill || '').toString().toLowerCase();
        const status = (l.status || l.result || '').toString().toLowerCase();
        return user.includes(ft) || pill.includes(ft) || status.includes(ft) || (l.timestamp || '').toString().includes(ft);
      });
    }

    // sort
    list.sort((a,b) => {
      const A = a?.[sortBy.key] ?? '';
      const B = b?.[sortBy.key] ?? '';
      if (A === B) return 0;
      return (A > B ? 1 : -1) * sortBy.dir;
    });

    // pagination
    const total = list.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (page > pages) page = pages;
    const start = (page - 1) * pageSize;
    const pageItems = list.slice(start, start + pageSize);

    // build rows
    if (pageItems.length === 0) {
      logTbody.innerHTML = '<tr class="empty"><td colspan="5">No dispense logs found.</td></tr>';
    } else {
      logTbody.innerHTML = pageItems.map(log => {
        const user = log.user || log.rfid || 'N/A';
        const pillType = log.pillType || log.pill || 'N/A';
        const qty = (typeof log.quantity !== 'undefined') ? log.quantity : (log.qty ?? 1);
        const ts = fmt(log.timestamp ?? log.time ?? 0);
        const status = (log.status || log.result || 'N/A').toString();
        const statusClass = status.toLowerCase().includes('fail') ? 'fail' : (status.toLowerCase().includes('ok') || status.toLowerCase().includes('success') ? 'ok' : 'pending');

        // add data-label attributes for responsive layout
        return `
          <tr>
            <td data-label="User">${escapeHtml(user)}</td>
            <td data-label="Pill Type">${escapeHtml(pillType)}</td>
            <td data-label="Quantity">${escapeHtml(qty)}</td>
            <td data-label="Timestamp">${escapeHtml(ts)}</td>
            <td data-label="Status"><span class="log-status ${statusClass}">${escapeHtml(status)}</span></td>
          </tr>
        `;
      }).join('');
    }

    renderPagination(total, pages);
  }

  // render pagination controls
  function renderPagination(total, pages){
    if (!paginationEl) return;
    paginationEl.innerHTML = '';
    if (pages <= 1) return;

    const prev = document.createElement('button');
    prev.textContent = '‹ Prev';
    prev.disabled = page <= 1;
    prev.addEventListener('click', () => { page = Math.max(1, page-1); renderLogs(); });
    paginationEl.appendChild(prev);

    const info = document.createElement('div');
    info.textContent = `${page} / ${pages} · ${total} rows`;
    info.style.padding = '6px 10px';
    paginationEl.appendChild(info);

    const next = document.createElement('button');
    next.textContent = 'Next ›';
    next.disabled = page >= pages;
    next.addEventListener('click', () => { page = Math.min(pages, page+1); renderLogs(); });
    paginationEl.appendChild(next);
  }

  // set sort when header clicked
  function setupHeaderSorting(){
    const headers = document.querySelectorAll('.log-table thead th');
    headers.forEach(th => {
      const key = (th.datasetKey || th.textContent || '').toString().trim().toLowerCase();
      // map visible headers to data keys
      let mapKey = 'timestamp';
      if (/user/i.test(th.textContent)) mapKey = 'rfid';
      if (/pill/i.test(th.textContent)) mapKey = 'pillType';
      if (/quantity/i.test(th.textContent)) mapKey = 'quantity';
      if (/timestamp/i.test(th.textContent)) mapKey = 'timestamp';
      if (/status/i.test(th.textContent)) mapKey = 'status';

      th.addEventListener('click', () => {
        if (sortBy.key === mapKey) sortBy.dir = -sortBy.dir;
        else { sortBy.key = mapKey; sortBy.dir = -1; }
        // update sort indicators
        document.querySelectorAll('.log-table thead th .sort-ind').forEach(el => el.remove());
        const span = document.createElement('span');
        span.className = 'sort-ind';
        span.textContent = sortBy.dir === -1 ? '↓' : '↑';
        th.appendChild(span);
        renderLogs();
      });
    });
  }

  // escape helper to avoid HTML injection
  function escapeHtml(str){
    return String(str ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }

  // wire controls
  searchInput.addEventListener('input', debounce(e => {
    filterText = e.target.value || '';
    page = 1;
    renderLogs();
  }, 250));

  pageSizeSelect.addEventListener('change', e => {
    pageSize = parseInt(e.target.value, 10) || 10;
    page = 1;
    renderLogs();
  });

  // initialize header sorting behavior
  setupHeaderSorting();

  // Replace the logs onValue handler with safe upsert logic
  onValue(logsRef, (snap) => {
    const logs = snap.val() || {};
    const tbody = document.getElementById('log-table-body');
    if (!tbody) return;

    // Helper to create/update a row for a given key/log
    function upsertRow(key, log) {
      let tr = tbody.querySelector(`tr[data-id="${key}"]`);
      const user = log.user || log.rfid || 'N/A';
      const pillType = log.pillType || log.pill || 'N/A';
      const qty = (typeof log.quantity !== 'undefined') ? log.quantity : (log.qty ?? 1);
      const ts = (log.timestamp ?? log.time) || '';
      const status = log.status || log.result || 'N/A';

      const rowHtml = `
        <td data-label="User">${user}</td>
        <td data-label="Pill Type">${pillType}</td>
        <td data-label="Quantity">${qty}</td>
        <td data-label="Timestamp">${formatTimestamp(ts)}</td>
        <td data-label="Status"><span class="log-status ${String(status).toLowerCase()}">${status}</span></td>
      `;

      if (tr) {
        tr.innerHTML = rowHtml; // update existing row
      } else {
        tr = document.createElement('tr');
        tr.setAttribute('data-id', key);
        tr.innerHTML = rowHtml;
        tbody.appendChild(tr); // append new row
      }
    }

    // Upsert each entry returned from the DB
    if (typeof logs === 'object' && logs !== null) {
      Object.entries(logs).forEach(([key, log]) => {
        upsertRow(key, log);
      });
    }

    // NOTE: this intentionally does NOT remove rows that are not in the current snapshot.
    // If you later want to remove stale rows, do a cleanup pass comparing existing data-ids to snapshot keys.
  }, (err) => {
    console.error('logs onValue error', err);
  });

}); // end DOMContentLoaded

window.addEventListener('load', () => {
  console.log('Script loaded — listening for device updates.');
});
