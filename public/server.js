const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

let deviceData = {
    rfid: '',
    lcdMessage: ''
};

app.post('/api/device-data', (req, res) => {
    deviceData.rfid = req.body.rfid;
    deviceData.lcdMessage = req.body.lcdMessage;
    res.sendStatus(200);
});

app.get('/api/device-data', (req, res) => {
    res.json(deviceData);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
