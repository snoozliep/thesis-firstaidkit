// Cleaned express + Firebase Admin server

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://final-pill-default-rtdb.asia-southeast1.firebasedatabase.app';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Initialize Firebase Admin (try service account file, fallback to application default)
try {
  const keyPath = path.join(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    const serviceAccount = require(keyPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: DATABASE_URL
    });
  } else {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      databaseURL: DATABASE_URL
    });
  }
} catch (err) {
  console.error('Firebase Admin init error:', err);
  process.exit(1);
}

const db = admin.database();

let deviceDataCache = {
  deviceId: '',
  rfid: '',
  lcdMessage: '',
  timestamp: 0
};

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', ts: Date.now() }));

// POST endpoint: receive data from ESP32 and write to RTDB
app.post('/api/device-data', async (req, res) => {
  try {
    const { deviceId = '', rfid = '', lcdMessage = '' } = req.body || {};
    if (!deviceId && !rfid && !lcdMessage) {
      return res.status(400).json({ error: 'Provide at least one of deviceId, rfid, lcdMessage' });
    }

    const payload = {
      deviceId,
      rfid,
      lcdMessage,
      timestamp: Date.now()
    };

    // update cache and DB
    deviceDataCache = payload;
    await db.ref('/deviceData').set(payload);

    // optional: append log entry
    await db.ref('/logs').push({
      deviceId,
      rfid,
      lcdMessage,
      timestamp: payload.timestamp
    });

    console.info('Received device-data:', payload.deviceId || rfid || 'unknown');
    return res.json({ success: true });
  } catch (err) {
    console.error('Error saving device-data:', err);
    return res.status(500).json({ error: 'failed to save' });
  }
});

// GET endpoint: simple read from cache (fast) or DB fallback
app.get('/api/device-data', async (req, res) => {
  try {
    // return cache if present
    if (deviceDataCache && deviceDataCache.timestamp) return res.json(deviceDataCache);

    const snap = await db.ref('/deviceData').get();
    if (!snap.exists()) return res.json({});
    return res.json(snap.val());
  } catch (err) {
    console.error('Error reading device-data:', err);
    return res.status(500).json({ error: 'failed to read' });
  }
});

// Serve SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
