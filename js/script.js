// ==================== CONFIG & CONSTANTS ====================
const CONFIG = {
    UPDATE_INTERVAL: 2000, // milliseconds
    DATA_HISTORY_LENGTH: 100,
    SENSOR_RANGES: {
        temperature: { min: 20, max: 40, ideal: [25, 35] },
        turbidity: { min: 0, max: 100, ideal: [0, 10] }
    }
};

// ==================== STATE MANAGEMENT ====================
const state = {
    isConnected: false,
    isSimulating: false,
    dataHistory: [],
    currentData: null,
    firebaseData: null,
    updateCount: 0
};

// ==================== DUMMY DATA GENERATOR ====================
class DummyDataGenerator {
    constructor() {
        this.lastValues = {
            temperature: 28,
            turbidity: 5
        };
    }

    generateRandomWalk(currentValue, min, max, maxChange = 0.5) {
        const change = (Math.random() - 0.5) * maxChange * 2;
        let newValue = currentValue + change;
        
        // Clamp between min and max
        newValue = Math.max(min, Math.min(max, newValue));
        
        return Math.round(newValue * 100) / 100;
    }

    generate() {
        // Generate realistic sensor data with random walk
        this.lastValues.temperature = this.generateRandomWalk(
            this.lastValues.temperature,
            CONFIG.SENSOR_RANGES.temperature.min,
            CONFIG.SENSOR_RANGES.temperature.max,
            1
        );

        this.lastValues.turbidity = this.generateRandomWalk(
            this.lastValues.turbidity,
            CONFIG.SENSOR_RANGES.turbidity.min,
            CONFIG.SENSOR_RANGES.turbidity.max,
            1
        );

        return {
            timestamp: new Date(),
            temperature: this.lastValues.temperature,
            turbidity: this.lastValues.turbidity
        };
    }
}

const dummyGenerator = new DummyDataGenerator();

// ==================== UTILITY FUNCTIONS ====================
function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
    });
}

function formatTime(date) {
    if (typeof date === 'string') date = new Date(date);
    return date.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
    });
}

function evaluateStatus(value, sensorType) {
    const range = CONFIG.SENSOR_RANGES[sensorType];
    const ideal = range.ideal;

    if (value >= ideal[0] && value <= ideal[1]) {
        return { status: 'good', badge: '✓ Optimal' };
    } else if (value >= range.min && value <= range.max) {
        return { status: 'warning', badge: '⚠ Hati-hati' };
    } else {
        return { status: 'danger', badge: '✗ Abnormal' };
    }
}

// ==================== UI UPDATE FUNCTIONS ====================
function updateSensorCard(sensorName, value, sensorType) {
    const valueElement = document.getElementById(`${sensorName}Value`);
    const statusElement = document.getElementById(`${sensorName}Status`);
    const rangeElement = document.getElementById(`${sensorName}Range`);

    if (!valueElement) return;

    // Update value with animation
    valueElement.style.animation = 'none';
    setTimeout(() => {
        valueElement.style.animation = 'slideIn 0.5s ease-out';
        valueElement.textContent = value;
    }, 10);

    // Update status
    const statusEval = evaluateStatus(value, sensorType);
    statusElement.textContent = statusEval.badge;
    statusElement.className = `status-badge ${statusEval.status}`;

    // Update range (min/max)
    const history = state.dataHistory.map(d => d[sensorType]);
    if (history.length > 0) {
        const min = Math.min(...history);
        const max = Math.max(...history);
        rangeElement.textContent = `Min: ${min.toFixed(2)}, Max: ${max.toFixed(2)}`;
    }

    // Create sparkline chart
    createSparkline(`${sensorName}Chart`, history);
}

function createSparkline(elementId, data) {
    const container = document.getElementById(elementId);
    if (!container || data.length === 0) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const padding = { top: 18, right: 12, bottom: 30, left: 38 };

    if (data.length < 2) return;

    container.innerHTML = '';

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    // Find min/max
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Create path
    let pathData = '';
    data.forEach((value, index) => {
        const x = (index / (data.length - 1)) * (width - padding.left - padding.right) + padding.left;
        const y = height - padding.bottom - ((value - min) / range) * (height - padding.top - padding.bottom);
        pathData += `${x},${y} `;
    });

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    path.setAttribute('points', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#16a34a');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    svg.appendChild(path);
    container.appendChild(svg);

    const timestamps = state.dataHistory.slice(-data.length).map(item => item.timestamp);
    addChartLabel(container, 'chart-label-y-max', max.toFixed(2));
    addChartLabel(container, 'chart-label-y-min', min.toFixed(2));
    addChartLabel(container, 'chart-label-x-start', formatTime(timestamps[0]));
    addChartLabel(container, 'chart-label-x-end', formatTime(timestamps[timestamps.length - 1]));
}

function addChartLabel(container, className, text) {
    const label = document.createElement('span');
    label.className = `chart-label ${className}`;
    label.textContent = text;
    container.appendChild(label);
}

function resetCharts() {
    ['tempChart', 'turbidityChart'].forEach(chartId => {
        const chart = document.getElementById(chartId);
        if (chart) {
            chart.innerHTML = '<span class="chart-empty">Menunggu data...</span>';
        }
    });
}

function updateDataTable() {
    const tableBody = document.getElementById('dataTableBody');
    
    if (state.dataHistory.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="no-data">Tunggu data masuk...</td></tr>';
        return;
    }

    // Show last 10 entries
    const recentData = state.dataHistory.slice(-10).reverse();
    
    tableBody.innerHTML = recentData.map(data => `
        <tr>
            <td>${formatTime(data.timestamp)}</td>
            <td>${data.temperature.toFixed(2)}</td>
            <td>${data.turbidity.toFixed(2)}</td>
        </tr>
    `).join('');
}

function updateSystemStatus() {
    // Connection Status
    const connectionStatus = document.getElementById('connectionStatus');
    connectionStatus.textContent = state.isConnected ? 'Online' : 'Offline';
    connectionStatus.style.color = state.isConnected ? '#48bb78' : '#f56565';

    // Mode Status
    const modeStatus = document.getElementById('modeStatus');
    modeStatus.textContent = state.isSimulating ? 'Simulasi Aktif' : 'Standby';

    // Data Points Count
    const dataPointsCount = document.getElementById('dataPointsCount');
    dataPointsCount.textContent = state.dataHistory.length;

    // Last Update Time
    const lastUpdate = document.getElementById('lastUpdate');
    if (state.currentData) {
        lastUpdate.textContent = `Update: ${formatTime(state.currentData.timestamp)}`;
    }
}

function updateConnectionIndicator(connected) {
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');

    if (connected) {
        indicator.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        indicator.classList.remove('connected');
        statusText.textContent = 'Disconnected';
    }
}

// ==================== DATA UPDATE LOGIC ====================
function processNewData(data) {
    state.currentData = data;
    state.dataHistory.push(data);
    state.updateCount++;

    // Keep only last N data points
    if (state.dataHistory.length > CONFIG.DATA_HISTORY_LENGTH) {
        state.dataHistory.shift();
    }

    // Save to localStorage
    localStorage.setItem('sensorHistory', JSON.stringify(state.dataHistory));

    // Update UI
    updateSensorCard('temp', data.temperature.toFixed(2), 'temperature');
    updateSensorCard('turbidity', data.turbidity.toFixed(2), 'turbidity');
    
    updateDataTable();
    updateSystemStatus();
}

function simulateData() {
    if (!state.isSimulating) return;

    const newData = dummyGenerator.generate();
    processNewData(newData);

    // Schedule next update
    setTimeout(simulateData, CONFIG.UPDATE_INTERVAL);
}

// ==================== FIREBASE INTEGRATION (READY) ====================
// This will be filled with actual Firebase config later
const firebaseConfig = {
    // apiKey: "YOUR_API_KEY",
    // authDomain: "YOUR_AUTH_DOMAIN",
    // databaseURL: "YOUR_DATABASE_URL",
    // projectId: "YOUR_PROJECT_ID",
    // storageBucket: "YOUR_STORAGE_BUCKET",
    // messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    // appId: "YOUR_APP_ID"
};

function initializeFirebase() {
    // TODO: Initialize Firebase when config is available
    console.log('Firebase initialization ready. Add your credentials to proceed.');
    return false;
}

function connectToFirebase() {
    // Check if Firebase config is available
    if (!firebaseConfig.apiKey) {
        alert('⚠️ Firebase config belum dikonfigurasi.\n\nLangkah selanjutnya:\n1. Buat project di Firebase Console\n2. Copy credentials Anda\n3. Ganti firebaseConfig di script.js\n4. Ganti simulasi dengan data real Firebase');
        return false;
    }

    // TODO: Implement real Firebase connection
    console.log('Connecting to Firebase...');
    state.isConnected = true;
    updateConnectionIndicator(true);
    return true;
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Smart BioReactor Dashboard Loaded');

    // Connect Firebase Button
    const connectBtn = document.getElementById('connectBtn');
    connectBtn.addEventListener('click', function() {
        if (connectToFirebase()) {
            alert('✓ Terhubung ke Firebase!');
        }
    });

    // Start Simulation Button
    const startSimulationBtn = document.getElementById('startSimulationBtn');
    startSimulationBtn.addEventListener('click', function() {
        if (!state.isSimulating) {
            state.isSimulating = true;
            startSimulationBtn.style.opacity = '0.5';
            startSimulationBtn.disabled = true;
            
            // Send first data immediately
            simulateData();
            
            console.log('✓ Simulasi dimulai');
        }
    });

    // Stop Simulation Button
    const stopSimulationBtn = document.getElementById('stopSimulationBtn');
    stopSimulationBtn.addEventListener('click', function() {
        state.isSimulating = false;
        startSimulationBtn.style.opacity = '1';
        startSimulationBtn.disabled = false;
        
        console.log('⏹️ Simulasi dihentikan');
        updateSystemStatus();
    });

    // Clear Data Button
    const clearDataBtn = document.getElementById('clearDataBtn');
    clearDataBtn.addEventListener('click', function() {
        if (confirm('Hapus semua data sensor? Tindakan ini tidak dapat diulang.')) {
            state.dataHistory = [];
            state.currentData = null;
            state.updateCount = 0;
            localStorage.removeItem('sensorHistory');
            
            // Reset UI
            ['temp', 'turbidity'].forEach(sensorName => {
                const valueElement = document.getElementById(`${sensorName}Value`);
                if (valueElement) valueElement.textContent = '--';
            });
            
            resetCharts();
            updateDataTable();
            updateSystemStatus();
            
            console.log('🗑️ Data dihapus');
        }
    });

    // Load data from localStorage
    loadDataFromStorage();

    // Initial UI update
    updateSystemStatus();
});

// ==================== LOCAL STORAGE ====================
function saveDataToStorage() {
    localStorage.setItem('sensorHistory', JSON.stringify(state.dataHistory));
    localStorage.setItem('lastUpdate', new Date().toISOString());
}

function loadDataFromStorage() {
    const savedHistory = localStorage.getItem('sensorHistory');
    if (savedHistory) {
        try {
            state.dataHistory = JSON.parse(savedHistory);
            console.log(`📦 Loaded ${state.dataHistory.length} data points dari localStorage`);
            
            // Update UI with loaded data
            if (state.dataHistory.length > 0) {
                const lastData = state.dataHistory[state.dataHistory.length - 1];
                state.currentData = lastData;
                
                updateSensorCard('temp', lastData.temperature.toFixed(2), 'temperature');
                updateSensorCard('turbidity', lastData.turbidity.toFixed(2), 'turbidity');
                
                updateDataTable();
                updateSystemStatus();
            }
        } catch (e) {
            console.error('Error loading data from storage:', e);
        }
    }
}

// ==================== KEYBOARD SHORTCUTS ====================
document.addEventListener('keydown', function(event) {
    // Ctrl+Shift+S to start simulation
    if (event.ctrlKey && event.shiftKey && event.key === 'S') {
        event.preventDefault();
        if (!state.isSimulating) {
            document.getElementById('startSimulationBtn').click();
        }
    }
    
    // Ctrl+Shift+E to stop simulation
    if (event.ctrlKey && event.shiftKey && event.key === 'E') {
        event.preventDefault();
        if (state.isSimulating) {
            document.getElementById('stopSimulationBtn').click();
        }
    }
});

console.log('📊 Dashboard Ready!');
console.log('Keyboard Shortcuts:');
console.log('  Ctrl+Shift+S - Start Simulation');
console.log('  Ctrl+Shift+E - Stop Simulation');
