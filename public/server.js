const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
const serviceAccount = require('./serviceAccountKey.json');  // Download from Firebase Console
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://final-pill-default-rtdb.asia-southeast1.firebasedatabase.app'
});
const db = admin.database();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let deviceData = {
    deviceId: '',
    rfid: '',
    lcdMessage: ''
};

// POST endpoint for ESP32 to send data
app.post('/api/device-data', async (req, res) => {
    const { deviceId, rfid, lcdMessage } = req.body;
    if (!deviceId || !rfid || !lcdMessage) {
        return res.status(400).json({ error: 'Missing required fields: deviceId, rfid, lcdMessage' });
    }
    deviceData = { deviceId, rfid, lcdMessage };
    console.log('Data received from ESP32:', deviceData);
    res.status(200).json({ message: 'Data saved successfully' });


    // Write to Firebase Realtime Database
    try {
        await db.ref('/deviceData').set(deviceData);
        console.log('Data written to Firebase.');
        res.status(200).json({ message: 'Data saved successfully' });
    } catch (error) {
        console.error('Firebase write error:', error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

// GET endpoint for website to fetch data (optional, since website uses Firebase directly)
app.get('/api/device-data', (req, res) => {
    res.json(deviceData);
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
