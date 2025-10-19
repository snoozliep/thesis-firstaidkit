// Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getDatabase, ref, onValue, get } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js";

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

// Real-time listeners for readings (if needed)
const databaseFloatRef = ref(database, 'test/float');
const databaseIntRef = ref(database, 'test/int');
const databaseStringRef = ref(database, 'test/string');

onValue(databaseFloatRef, (snapshot) => {
    const val = snapshot.val();
    console.log("Float: " + val);
    // Update UI if needed
});

onValue(databaseIntRef, (snapshot) => {
    const val = snapshot.val();
    console.log("Int: " + val);
});

onValue(databaseStringRef, (snapshot) => {
    const val = snapshot.val();
    console.log("String: " + val);
});

// Function to fetch device data
async function fetchDeviceData() {
    try {
        const dbRef = ref(database, '/deviceData');
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
            const data = snapshot.val();
            let parsedData;
            try {
                parsedData = JSON.parse(data);
            } catch {
                parsedData = { rfid: data, lcdMessage: '' };
            }
            document.getElementById('last-rfid').innerText = parsedData.rfid || 'No data';
            document.getElementById('lcd-message').innerText = parsedData.lcdMessage || 'No data';
            document.getElementById('user-id').textContent = parsedData.rfid || '— unknown —';
            document.getElementById('device-status-display').textContent = 'connected';
            console.log("Data updated:", parsedData);
        } else {
            document.getElementById('device-status-display').textContent = 'disconnected';
        }
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('device-status-display').textContent = 'error';
    }
}

// Fetch on load and poll every 5 seconds
fetchDeviceData();
setInterval(fetchDeviceData, 5000);