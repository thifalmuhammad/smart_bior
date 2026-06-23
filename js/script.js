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
    firebaseRef: null,
    calibrationRef: null,
    calibrationClearTimer: null,
    calibrationActivated: false,
    calibrationLastPhase: null,
    firebaseDb: null,
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

function normalizeDate(date) {
    if (typeof date === 'string' || typeof date === 'number') date = new Date(date);
    return date;
}

function formatTime(date) {
    date = normalizeDate(date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatChartTime(date, chartWidth) {
    date = normalizeDate(date);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    if (chartWidth < 360) {
        return `${hours}:${minutes}`;
    }

    if (chartWidth < 520) {
        return `${hours}:${minutes}:${seconds}`;
    }

    return `${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function normalizeTimestamp(timestamp) {
    const numericTimestamp = Number(timestamp);

    if (!Number.isFinite(numericTimestamp)) {
        return new Date();
    }

    return new Date(numericTimestamp < 10000000000 ? numericTimestamp * 1000 : numericTimestamp);
}

function normalizeSensorReading(reading, fallbackTimestamp) {
    if (!reading || typeof reading !== 'object') return null;

    const temperature = Number(reading.temperature);
    const od = Number(reading.od ?? reading.turbidity);
    const timestamp = reading.timestamp ?? fallbackTimestamp;

    if (!Number.isFinite(temperature) || !Number.isFinite(od)) {
        return null;
    }

    return {
        timestamp: normalizeTimestamp(timestamp),
        temperature,
        turbidity: od
    };
}

function normalizeFirebaseHistory(firebasePayload) {
    if (!firebasePayload) return [];

    const historyPayload =
        firebasePayload.history ??
        firebasePayload['smart-bior']?.history ??
        firebasePayload.bioreactor?.history ??
        firebasePayload;
    const historyEntries = Array.isArray(historyPayload)
        ? historyPayload.map((reading, index) => [reading?.timestamp ?? index, reading])
        : Object.entries(historyPayload);

    return historyEntries
        .map(([timestampKey, reading]) => normalizeSensorReading(reading, timestampKey))
        .filter(Boolean)
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-CONFIG.DATA_HISTORY_LENGTH);
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

function formatSensorValue(value, sensorType) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return '--';

    return numericValue.toFixed(sensorType === 'turbidity' ? 4 : 2);
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
        rangeElement.textContent = `Min: ${formatSensorValue(min, sensorType)}, Max: ${formatSensorValue(max, sensorType)}`;
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
    const chartColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#256f4a';

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
    path.setAttribute('stroke', chartColor);
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    svg.appendChild(path);
    container.appendChild(svg);

    const timestamps = state.dataHistory.slice(-data.length).map(item => item.timestamp);
    addChartLabel(container, 'chart-label-y-max', max.toFixed(2));
    addChartLabel(container, 'chart-label-y-min', min.toFixed(2));
    addChartLabel(container, 'chart-label-x-start', formatChartTime(timestamps[0], width));
    addChartLabel(container, 'chart-label-x-end', formatChartTime(timestamps[timestamps.length - 1], width));
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
            <td>${formatSensorValue(data.temperature, 'temperature')}</td>
            <td>${formatSensorValue(data.turbidity, 'turbidity')}</td>
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
    modeStatus.textContent = state.isConnected ? 'Firebase Live' : (state.isSimulating ? 'Simulasi Aktif' : 'Standby');

    // Data Points Count
    const dataPointsCount = document.getElementById('dataPointsCount');
    dataPointsCount.textContent = state.dataHistory.length;

    // Update Interval
    const updateInterval = document.getElementById('updateInterval');
    updateInterval.textContent = state.isConnected ? 'Realtime' : '2s';

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
    updateSensorCard('temp', formatSensorValue(data.temperature, 'temperature'), 'temperature');
    updateSensorCard('turbidity', formatSensorValue(data.turbidity, 'turbidity'), 'turbidity');
    
    updateDataTable();
    updateSystemStatus();
}

function processFirebaseHistory(firebasePayload) {
    const normalizedHistory = normalizeFirebaseHistory(firebasePayload);

    if (normalizedHistory.length === 0) {
        console.warn('Firebase data kosong atau format tidak valid:', firebasePayload);
        return false;
    }

    state.firebaseData = firebasePayload;
    state.dataHistory = normalizedHistory;
    state.currentData = normalizedHistory[normalizedHistory.length - 1];
    state.updateCount = normalizedHistory.length;

    saveDataToStorage();

    updateSensorCard('temp', formatSensorValue(state.currentData.temperature, 'temperature'), 'temperature');
    updateSensorCard('turbidity', formatSensorValue(state.currentData.turbidity, 'turbidity'), 'turbidity');
    updateDataTable();
    updateSystemStatus();
    return true;
}

function simulateData() {
    if (!state.isSimulating) return;

    const newData = dummyGenerator.generate();
    processNewData(newData);

    // Schedule next update
    setTimeout(simulateData, CONFIG.UPDATE_INTERVAL);
}

// ==================== FIREBASE INTEGRATION ====================
const firebaseConfig = {
    apiKey: "AIzaSyDzUepyqix_E8mKzNSc8ijMxF3yXDYLBF4",
    authDomain: "smart-bior-6dac6.firebaseapp.com",
    databaseURL: "https://smart-bior-6dac6-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "smart-bior-6dac6",
    storageBucket: "smart-bior-6dac6.firebasestorage.app",
    messagingSenderId: "996524440588",
    appId: "1:996524440588:web:7d5842c0d4869201398229",
    measurementId: "G-HV429BVJX2"
};

function initializeFirebase() {
    if (!window.firebase) {
        alert('Firebase SDK belum termuat. Pastikan koneksi internet aktif saat membuka dashboard.');
        return null;
    }

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    state.firebaseDb = firebase.database();
    return state.firebaseDb;
}

function disconnectFirebase() {
    if (state.firebaseRef) {
        state.firebaseRef.off();
        state.firebaseRef = null;
    }

    if (state.calibrationRef) {
        state.calibrationRef.off();
        state.calibrationRef = null;
    }
}

function setCalibrationStatus(text, tone = 'neutral') {
    const statusEl = document.getElementById('calibrationStatus');
    if (!statusEl) return;

    if (state.calibrationClearTimer) {
        clearTimeout(state.calibrationClearTimer);
        state.calibrationClearTimer = null;
    }

    if (!text) {
        statusEl.textContent = '';
        statusEl.classList.remove('is-visible');
        statusEl.setAttribute('aria-hidden', 'true');
        statusEl.dataset.tone = tone;
        statusEl.classList.remove('is-loading');
        return;
    }

    statusEl.classList.add('is-visible');
    statusEl.setAttribute('aria-hidden', 'false');
    statusEl.textContent = text;
    statusEl.dataset.tone = tone;
    statusEl.classList.toggle('is-loading', tone === 'warning');
}

function clearCalibrationStatusLater(delay = 1800) {
    const statusEl = document.getElementById('calibrationStatus');
    if (!statusEl) return;

    if (state.calibrationClearTimer) {
        clearTimeout(state.calibrationClearTimer);
    }

    state.calibrationClearTimer = setTimeout(() => {
        setCalibrationStatus('', 'neutral');
    }, delay);
}

function openConfirmModal(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        const messageEl = document.getElementById('confirmModalMessage');
        const cancelBtn = document.getElementById('confirmModalCancel');
        const confirmBtn = document.getElementById('confirmModalConfirm');

        if (!modal || !messageEl || !cancelBtn || !confirmBtn) {
            resolve(window.confirm(message));
            return;
        }

        messageEl.textContent = message;
        modal.hidden = false;

        const cleanup = () => {
            modal.hidden = true;
            confirmBtn.removeEventListener('click', onConfirm);
            cancelBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKeydown);
        };

        const onConfirm = () => {
            cleanup();
            resolve(true);
        };

        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        const onBackdrop = (event) => {
            if (event.target === modal) {
                onCancel();
            }
        };

        const onKeydown = (event) => {
            if (event.key === 'Escape') {
                onCancel();
            }
        };

        confirmBtn.addEventListener('click', onConfirm);
        cancelBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKeydown);
        confirmBtn.focus();
    });
}

function getCalibrationStatusCopy(statusValue) {
    switch (statusValue) {
        case 'pending':
            return { text: 'Kalibrasi menunggu diproses', tone: 'neutral' };
        case 'processing':
            return { text: 'Kalibrasi sedang diproses', tone: 'warning' };
        case 'done':
        case 'success':
            return { text: 'Kalibrasi selesai', tone: 'success' };
        case 'failed':
        case 'error':
            return { text: 'Kalibrasi gagal', tone: 'danger' };
        case 'idle':
            return { text: 'Siap kalibrasi', tone: 'neutral' };
        default:
            return { text: `Status kalibrasi: ${String(statusValue).replace(/_/g, ' ')}`, tone: 'neutral' };
    }
}

function normalizeCalibrationStatusPayload(value) {
    if (!value) return null;
    if (typeof value === 'string') {
        return { status: value };
    }

    if (typeof value === 'object') {
        return {
            status: value.status || value.state || value.action || '',
            message: value.message || value.note || ''
        };
    }

    return null;
}

function listenToCalibrationStatus() {
    if (!state.firebaseDb) return;

    if (state.calibrationRef) {
        state.calibrationRef.off();
    }

    state.calibrationRef = state.firebaseDb.ref('/bioreactor/commands/calibration/status');
    state.calibrationRef.on('value', (snapshot) => {
        const payload = normalizeCalibrationStatusPayload(snapshot.val());

        if (!state.calibrationActivated) {
            setCalibrationStatus('', 'neutral');
            return;
        }

        if (!payload) {
            if (state.calibrationLastPhase === 'processing') {
                setCalibrationStatus('Kalibrasi sedang diproses', 'warning');
            }
            return;
        }

        const copy = getCalibrationStatusCopy(payload.status);
        state.calibrationLastPhase = payload.status || null;

        if (payload.status === 'processing') {
            setCalibrationStatus(payload.message || copy.text, copy.tone);
            return;
        }

        if (payload.status === 'done' || payload.status === 'success') {
            setCalibrationStatus(payload.message || copy.text, copy.tone);
            clearCalibrationStatusLater(4000);
            return;
        }

        if (payload.status === 'failed' || payload.status === 'error') {
            setCalibrationStatus(payload.message || copy.text, copy.tone);
            clearCalibrationStatusLater(4000);
            return;
        }

        setCalibrationStatus(payload.message || copy.text, copy.tone);
    }, (error) => {
        console.error('[Calibration] Listener gagal:', error);
        setCalibrationStatus('Gagal memantau status kalibrasi', 'danger');
    });
}

async function sendCalibrationCommand() {
    if (!state.firebaseDb) {
        setCalibrationStatus('Firebase belum siap', 'danger');
        return;
    }

    const shouldSend = await openConfirmModal('Kirim perintah kalibrasi ke alat sekarang?');
    if (!shouldSend) {
        setCalibrationStatus('', 'neutral');
        return;
    }

    state.calibrationActivated = true;
    state.calibrationLastPhase = 'pending';
    setCalibrationStatus('Mengirim perintah...', 'neutral');

    const requestId = `cal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const payload = {
        action: 'calibration',
        value: null,
        note: null,
        requestedAt: Date.now(),
        requestId,
        requestedBy: 'dashboard',
        status: 'pending'
    };

    state.firebaseDb.ref('/bioreactor/commands/calibration').set(payload)
        .then(() => {
            setCalibrationStatus('Menunggu alat memulai kalibrasi...', 'neutral');
        })
        .catch((error) => {
            console.error('[Calibration] Gagal kirim:', error);
            setCalibrationStatus('Gagal mengirim kalibrasi', 'danger');
            clearCalibrationStatusLater(4000);
        });
}

function refreshCalibrationStatus() {
    if (!state.firebaseDb) {
        if (state.calibrationActivated) {
            setCalibrationStatus('Firebase belum siap', 'danger');
        }
        return;
    }

    state.firebaseDb.ref('/bioreactor/commands/calibration/status').once('value')
        .then((snapshot) => {
            const value = snapshot.val();
            if (!value) {
                if (state.calibrationActivated) {
                    setCalibrationStatus('', 'neutral');
                }
                return;
            }

            const tone = value === 'done' ? 'success' : value === 'failed' ? 'danger' : 'neutral';
            if (state.calibrationActivated) {
                setCalibrationStatus(`Status: ${String(value).replace(/_/g, ' ')}`, tone);
            }
        })
        .catch((error) => {
            console.error('[Calibration] Refresh gagal:', error);
            setCalibrationStatus('Gagal ambil status', 'danger');
        });
}

function connectToFirebase() {
    console.log('Connecting to Firebase realtime listener...');
    const database = initializeFirebase();

    if (!database) return false;

    state.isSimulating = false;
    disconnectFirebase();

    state.firebaseRef = database.ref('/');
    state.firebaseRef.on('value', (snapshot) => {
        const isProcessed = processFirebaseHistory(snapshot.val());

        state.isConnected = isProcessed;
        updateConnectionIndicator(isProcessed);
        updateSystemStatus();
    }, (error) => {
        console.error('Firebase realtime read error:', error);
        alert(`Gagal membaca Firebase: ${error.message}`);
        state.isConnected = false;
        updateConnectionIndicator(false);
        updateSystemStatus();
    });

    listenToCalibrationStatus();

    state.isConnected = true;
    updateConnectionIndicator(true);
    updateSystemStatus();
    return true;
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Smart BioReactor Dashboard Loaded');

    // Connect Firebase Button
    const connectBtn = document.getElementById('connectBtn');
    connectBtn.addEventListener('click', function() {
        connectBtn.disabled = true;
        connectBtn.style.opacity = '0.5';

        if (connectToFirebase()) {
            alert('✓ Terhubung ke Firebase!');
        }

        connectBtn.disabled = false;
        connectBtn.style.opacity = '1';
    });

    // Start Simulation Button
    const startSimulationBtn = document.getElementById('startSimulationBtn');
    startSimulationBtn.addEventListener('click', function() {
        if (!state.isSimulating) {
            disconnectFirebase();
            state.isConnected = false;
            updateConnectionIndicator(false);

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

    const calibrationBtn = document.getElementById('calibrationBtn');
    if (calibrationBtn) {
        calibrationBtn.addEventListener('click', sendCalibrationCommand);
    }

    // Load data from localStorage
    loadDataFromStorage();

    // Initial UI update
    updateSystemStatus();

    // Auto-connect ke Firebase saat halaman dibuka
    const connectAutomatically = connectToFirebase();
    if (!connectAutomatically) {
        console.warn('Auto-connect Firebase gagal, tombol sambungkan masih bisa dipakai manual.');
    }
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
                
                updateSensorCard('temp', formatSensorValue(lastData.temperature, 'temperature'), 'temperature');
                updateSensorCard('turbidity', formatSensorValue(lastData.turbidity, 'turbidity'), 'turbidity');
                
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
