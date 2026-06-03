# 🧪 TESTING & DEBUGGING GUIDE

## Console Commands untuk Testing

Buka browser Developer Tools: **F12** → tab **Console**

Kemudian copy-paste command di bawah:

---

## 📊 Check Dashboard State

```javascript
// Lihat semua data sensor terbaru
console.log('Current Data:', state.currentData);

// Lihat seluruh history
console.log('Data History:', state.dataHistory);

// Jumlah data points
console.log('Total Data Points:', state.dataHistory.length);

// Status koneksi
console.log('Connected:', state.isConnected);
console.log('Simulating:', state.isSimulating);

// Update count
console.log('Updates Count:', state.updateCount);
```

---

## 💾 LocalStorage Management

```javascript
// Lihat data di localStorage
console.log('Saved History:', JSON.parse(localStorage.getItem('sensorHistory')));

// Hitung ukuran data (bytes)
const size = JSON.stringify(localStorage).length;
console.log('Storage Size:', (size / 1024).toFixed(2) + ' KB');

// Clear semua data
localStorage.clear();
console.log('✓ LocalStorage cleared');

// Backup data ke clipboard
copy(JSON.stringify(state.dataHistory, null, 2));
console.log('✓ Data copied to clipboard');
```

---

## 🎮 Manual Control

```javascript
// Start simulasi
state.isSimulating = true;
simulateData();

// Stop simulasi
state.isSimulating = false;

// Generate 1 data point
const newData = dummyGenerator.generate();
processNewData(newData);

// Update UI manual
updateSensorCard('temp', 30.5, 'temperature');
updateSensorCard('humidity', 70, 'humidity');
updateSensorCard('ph', 7.2, 'pH');
updateSensorCard('turbidity', 5.5, 'turbidity');

// Reset dashboard
state.dataHistory = [];
state.currentData = null;
updateDataTable();
updateSystemStatus();
```

---

## 📈 Data Analysis

```javascript
// Get min/max temperature
const temps = state.dataHistory.map(d => d.temperature);
console.log('Temp Range:', Math.min(...temps), '-', Math.max(...temps));

// Average humidity
const avgHumidity = state.dataHistory.reduce((a, b) => a + b.humidity, 0) / state.dataHistory.length;
console.log('Average Humidity:', avgHumidity.toFixed(2) + '%');

// Count abnormal readings
const abnormal = state.dataHistory.filter(d => 
    d.temperature < 25 || d.temperature > 35 ||
    d.humidity < 60 || d.humidity > 80 ||
    d.pH < 6.5 || d.pH > 7.5 ||
    d.turbidity > 10
).length;
console.log('Abnormal Readings:', abnormal);

// Calculate data rate (readings per second)
if (state.dataHistory.length > 1) {
    const timespan = state.dataHistory[state.dataHistory.length - 1].timestamp - state.dataHistory[0].timestamp;
    const rate = (state.dataHistory.length / (timespan / 1000)).toFixed(2);
    console.log('Data Rate:', rate + ' readings/second');
}

// Last 5 readings as table
console.table(state.dataHistory.slice(-5));
```

---

## 🔧 Configuration Testing

```javascript
// Check current config
console.log('Config:', CONFIG);

// Test status evaluation
console.log('Temp (28°C) status:', evaluateStatus(28, 'temperature'));
console.log('pH (6.0) status:', evaluateStatus(6.0, 'pH'));
console.log('Humidity (50%) status:', evaluateStatus(50, 'humidity'));

// Test timestamp formatting
console.log('Current time:', getTimestamp());
console.log('Formatted:', formatTime(new Date()));
```

---

## 🔥 Firebase Testing (jika sudah setup)

```javascript
// Check Firebase connection
firebase.database().ref('.info/connected').on('value', (snapshot) => {
    console.log('Firebase Connected:', snapshot.val());
});

// Read data from Firebase
firebase.database().ref('bioreactor/current').once('value', (snapshot) => {
    console.log('Firebase Current Data:', snapshot.val());
});

// Write test data
firebase.database().ref('bioreactor/current').set({
    temperature: 25.5,
    humidity: 65,
    pH: 7.0,
    turbidity: 3,
    timestamp: Date.now()
}).then(() => {
    console.log('✓ Test data written');
}).catch((error) => {
    console.error('✗ Write failed:', error);
});

// Listen to real-time updates
firebase.database().ref('bioreactor/current').on('value', (snapshot) => {
    console.log('Real-time update:', snapshot.val());
});

// Stop listening
firebase.database().ref('bioreactor/current').off();
```

---

## 🚨 Error Checking

```javascript
// Check for JavaScript errors
window.addEventListener('error', (event) => {
    console.error('JS Error:', event.error);
});

// Monitor console errors
const originalError = console.error;
console.error = function(...args) {
    console.log('ERROR DETECTED:', ...args);
    originalError.apply(console, args);
};

// Check for network errors
fetch('/').catch(err => console.error('Network error:', err));

// Performance monitoring
console.time('Dashboard Load');
console.timeEnd('Dashboard Load');
```

---

## 📱 Responsive Design Testing

```javascript
// Check viewport size
console.log('Viewport:', window.innerWidth + 'x' + window.innerHeight);

// Simulate different screen sizes
// Use F12 → Responsive Design Mode (Ctrl+Shift+M)

// Test touch events
document.addEventListener('touchstart', (e) => {
    console.log('Touch detected at:', e.touches[0].clientX, e.touches[0].clientY);
});
```

---

## ⚡ Performance Analysis

```javascript
// Memory usage (Chrome only)
if (performance.memory) {
    console.log('Memory Used:', (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB');
    console.log('Memory Limit:', (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB');
}

// Check rendering performance
console.time('Render Update');
updateSensorCard('temp', 30, 'temperature');
console.timeEnd('Render Update');

// Monitor DOM size
console.log('DOM Nodes:', document.querySelectorAll('*').length);
```

---

## 🧪 Full Testing Workflow

### 1. Clear & Fresh Start
```javascript
localStorage.clear();
location.reload();
```

### 2. Check Initial State
```javascript
console.log('Initial State:', state);
```

### 3. Start Simulation
```javascript
document.getElementById('startSimulationBtn').click();
```

### 4. Wait & Monitor
```javascript
// Monitor untuk 10 update
let count = 0;
const checkInterval = setInterval(() => {
    console.log(`Update ${++count}:`, state.currentData);
    if (count >= 10) clearInterval(checkInterval);
}, 2500);
```

### 5. Verify Data
```javascript
console.log('Final Data:', state.dataHistory);
console.log('Data Count:', state.dataHistory.length);
console.log('LocalStorage:', localStorage.getItem('sensorHistory'));
```

---

## 🔍 Debugging Checklist

- [ ] Console tidak ada error merah
- [ ] Data berhasil generate dan update
- [ ] UI update sesuai dengan data
- [ ] LocalStorage menyimpan data
- [ ] Keyboard shortcuts bekerja
- [ ] Button klik response normal
- [ ] Chart sparkline tampil dengan benar
- [ ] Status indicator update
- [ ] Mobile view responsive
- [ ] Performance smooth (60 FPS)

---

## 🚀 Test Scenarios

### Scenario 1: Data Validation
```javascript
// Generate 100 data points
for (let i = 0; i < 100; i++) {
    const data = dummyGenerator.generate();
    processNewData(data);
}
console.log('✓ 100 data points generated');

// Verify range
state.dataHistory.forEach(d => {
    if (d.temperature < 20 || d.temperature > 40) console.warn('Temp out of range:', d.temperature);
    if (d.humidity < 30 || d.humidity > 90) console.warn('Humidity out of range:', d.humidity);
});
```

### Scenario 2: Performance Under Load
```javascript
console.time('1000 Updates');
const originalInterval = CONFIG.UPDATE_INTERVAL;
CONFIG.UPDATE_INTERVAL = 10; // Update every 10ms

let count = 0;
const speedTest = setInterval(() => {
    const data = dummyGenerator.generate();
    processNewData(data);
    if (++count >= 1000) {
        clearInterval(speedTest);
        CONFIG.UPDATE_INTERVAL = originalInterval;
        console.timeEnd('1000 Updates');
        console.log('Memory:', performance.memory?.usedJSHeapSize);
    }
}, CONFIG.UPDATE_INTERVAL);
```

### Scenario 3: Data Persistence
```javascript
// Save data
localStorage.setItem('sensorHistory', JSON.stringify(state.dataHistory));

// Close & reopen (simulate: refresh)
location.reload();

// In console after refresh:
console.log('Restored:', state.dataHistory.length, 'data points');
```

---

## 📋 Browser Compatibility Check

```javascript
// Check browser features
console.log('Browser:', navigator.userAgent);
console.log('LocalStorage support:', typeof(Storage) !== 'undefined');
console.log('SVG support:', document.implementation.hasFeature("http://www.w3.org/2000/svg", "1.1"));
console.log('Canvas support:', !!document.querySelector('canvas'));

// Check API support
console.log('Fetch API:', typeof fetch === 'function');
console.log('Promise:', typeof Promise === 'function');
console.log('Arrow Functions:', (() => true)() ? 'Yes' : 'No');
```

---

## 💾 Export Test Data

```javascript
// Download data sebagai JSON file
const dataStr = JSON.stringify(state.dataHistory, null, 2);
const dataBlob = new Blob([dataStr], {type: 'application/json'});
const url = URL.createObjectURL(dataBlob);
const link = document.createElement('a');
link.href = url;
link.download = 'sensor-data-' + new Date().toISOString() + '.json';
link.click();

console.log('✓ Data exported');
```

---

## 🐛 Common Issues & Debug

### Issue: Data tidak update
```javascript
// Check simulasi status
console.log('Is simulating:', state.isSimulating);

// Manual trigger update
state.isSimulating = true;
simulateData();
```

### Issue: UI tidak update
```javascript
// Manual update
updateSensorCard('temp', 28.5, 'temperature');
updateDataTable();
updateSystemStatus();
```

### Issue: Memory leak
```javascript
// Check for growing memory
console.log('Data points:', state.dataHistory.length);
console.log('Memory:', (performance.memory?.usedJSHeapSize / 1048576).toFixed(2) + ' MB');

// Clear old data
state.dataHistory = state.dataHistory.slice(-100);
localStorage.setItem('sensorHistory', JSON.stringify(state.dataHistory));
```

---

## 📞 Help Commands

```javascript
// Lihat semua state
console.log('%cCURRENT STATE:', 'color: blue; font-size: 14px', state);

// Lihat config
console.log('%cCONFIG:', 'color: green; font-size: 14px', CONFIG);

// Full diagnostics
console.group('DIAGNOSTICS');
console.log('Data points:', state.dataHistory.length);
console.log('Latest:', state.currentData);
console.log('Connected:', state.isConnected);
console.log('Storage:', localStorage.length, 'items');
console.log('Memory:', (performance.memory?.usedJSHeapSize / 1048576).toFixed(2) + ' MB');
console.groupEnd();
```

---

## 🎯 Quick Test Commands

```javascript
// ✅ All OK
state.isSimulating = true; simulateData(); console.log('✓ Dashboard OK');

// 🔄 Reload
location.reload();

// 🗑️ Clear
localStorage.clear(); state.dataHistory = []; state.currentData = null;

// 📊 Status
console.log(state);

// 🔧 Debug mode ON
window.DEBUG = true; console.log('%cDEBUG MODE ON', 'color: red; font-weight: bold');
```

---

**Test wisely, debug systematically! 🧪✨**

