const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;  // Use env port for hosting

app.use(cors());  // Allow cross-origin requests
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));  // Serve static files from 'public/'

let deviceData = {
    deviceId: '',
    rfid: '',
    lcdMessage: ''
};

// POST endpoint for ESP32 to send data
app.post('/api/device-data', (req, res) => {
    const { deviceId, rfid, lcdMessage } = req.body;
    if (!deviceId || !rfid || !lcdMessage) {
        return res.status(400).json({ error: 'Missing required fields: deviceId, rfid, lcdMessage' });
    }
    deviceData = { deviceId, rfid, lcdMessage };
    console.log('Data received from ESP32:', deviceData);
    res.status(200).json({ message: 'Data saved successfully' });
});

// GET endpoint for website to fetch data
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