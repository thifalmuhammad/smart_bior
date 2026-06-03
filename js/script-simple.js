// ==================== CONFIG ====================
const CONFIG = {
    UPDATE_INTERVAL: 2000,
    DATA_HISTORY_LENGTH: 100,
    SENSOR_RANGES: {
        temperature: { min: 20, max: 40, ideal: [25, 35] },
        humidity: { min: 30, max: 90, ideal: [60, 80] },
        pH: { min: 4, max: 10, ideal: [6.5, 7.5] },
        turbidity: { min: 0, max: 100, ideal: [0, 10] }
    }
};

// ==================== STATE ====================
const state = {
    isSimulating: false,
    dataHistory: [],
    currentData: null
};

// ==================== DUMMY DATA GENERATOR ====================
class DummyDataGenerator {
    constructor() {
        this.lastValues = {
            temperature: 28,
            humidity: 65,
            pH: 7.0,
            turbidity: 5
        };
    }

    generateRandomWalk(currentValue, min, max, maxChange = 0.5) {
        const change = (Math.random() - 0.5) * maxChange * 2;
        let newValue = currentValue + change;
        newValue = Math.max(min, Math.min(max, newValue));
        return Math.round(newValue * 100) / 100;
    }

    generate() {
        this.lastValues.temperature = this.generateRandomWalk(
            this.lastValues.temperature,
            CONFIG.SENSOR_RANGES.temperature.min,
            CONFIG.SENSOR_RANGES.temperature.max,
            1
        );

        this.lastValues.humidity = this.generateRandomWalk(
            this.lastValues.humidity,
            CONFIG.SENSOR_RANGES.humidity.min,
            CONFIG.SENSOR_RANGES.humidity.max,
            2
        );

        this.lastValues.pH = this.generateRandomWalk(
            this.lastValues.pH,
            CONFIG.SENSOR_RANGES.pH.min,
            CONFIG.SENSOR_RANGES.pH.max,
            0.1
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
            humidity: this.lastValues.humidity,
            pH: this.lastValues.pH,
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
        second: '2-digit' 
    });
}

function formatTime(date) {
    if (typeof date === 'string') date = new Date(date);
    return date.toLocaleTimeString('id-ID', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
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

// ==================== UI UPDATE ====================
function updateSensorCard(sensorName, value, sensorType) {
    const valueElement = document.getElementById(`${sensorName}Value`);
    const statusElement = document.getElementById(`${sensorName}Status`);
    const rangeElement = document.getElementById(`${sensorName}Range`);

    if (!valueElement) return;

    valueElement.textContent = value;

    const statusEval = evaluateStatus(value, sensorType);
    statusElement.textContent = statusEval.badge;
    statusElement.className = `status-badge ${statusEval.status}`;

    const history = state.dataHistory.map(d => d[sensorType]);
    if (history.length > 0) {
        const min = Math.min(...history);
        const max = Math.max(...history);
        rangeElement.textContent = `Min: ${min.toFixed(2)}, Max: ${max.toFixed(2)}`;
    }
}

function updateDataTable() {
    const tableBody = document.getElementById('dataTableBody');
    
    if (state.dataHistory.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #999;">Tunggu data masuk...</td></tr>';
        return;
    }

    const recentData = state.dataHistory.slice(-10).reverse();
    
    tableBody.innerHTML = recentData.map(data => `
        <tr>
            <td>${formatTime(data.timestamp)}</td>
            <td>${data.temperature.toFixed(2)}</td>
            <td>${data.humidity.toFixed(2)}</td>
            <td>${data.pH.toFixed(2)}</td>
            <td>${data.turbidity.toFixed(2)}</td>
        </tr>
    `).join('');
}

function updateSystemStatus() {
    const modeStatus = document.getElementById('modeStatus');
    if (modeStatus) {
        modeStatus.textContent = state.isSimulating ? 'Simulasi Aktif' : 'Standby';
    }

    const dataPointsCount = document.getElementById('dataPointsCount');
    if (dataPointsCount) {
        dataPointsCount.textContent = state.dataHistory.length;
    }

    const lastUpdate = document.getElementById('lastUpdate');
    if (lastUpdate && state.currentData) {
        lastUpdate.textContent = formatTime(state.currentData.timestamp);
    }
}

// ==================== DATA PROCESSING ====================
function processNewData(data) {
    state.currentData = data;
    state.dataHistory.push(data);

    if (state.dataHistory.length > CONFIG.DATA_HISTORY_LENGTH) {
        state.dataHistory.shift();
    }

    localStorage.setItem('sensorHistory', JSON.stringify(state.dataHistory));

    updateSensorCard('temp', data.temperature.toFixed(2), 'temperature');
    updateSensorCard('humidity', data.humidity.toFixed(2), 'humidity');
    updateSensorCard('ph', data.pH.toFixed(2), 'pH');
    updateSensorCard('turbidity', data.turbidity.toFixed(2), 'turbidity');
    
    updateDataTable();
    updateSystemStatus();
}

function simulateData() {
    if (!state.isSimulating) return;

    const newData = dummyGenerator.generate();
    processNewData(newData);

    setTimeout(simulateData, CONFIG.UPDATE_INTERVAL);
}

// ==================== EVENT LISTENERS ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('✓ Dashboard Loaded');

    // Start Simulation
    const startBtn = document.getElementById('startSimulationBtn');
    if (startBtn) {
        startBtn.addEventListener('click', function() {
            if (!state.isSimulating) {
                state.isSimulating = true;
                startBtn.textContent = '⏸️ Berjalan...';
                startBtn.style.opacity = '0.5';
                simulateData();
                console.log('✓ Simulasi dimulai');
            }
        });
    }

    // Stop Simulation
    const stopBtn = document.getElementById('stopSimulationBtn');
    if (stopBtn) {
        stopBtn.addEventListener('click', function() {
            state.isSimulating = false;
            if (startBtn) {
                startBtn.textContent = '▶️ Mulai Simulasi';
                startBtn.style.opacity = '1';
            }
            updateSystemStatus();
            console.log('⏹️ Simulasi dihentikan');
        });
    }

    // Clear Data
    const clearBtn = document.getElementById('clearDataBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            if (confirm('Hapus semua data?')) {
                state.dataHistory = [];
                state.currentData = null;
                localStorage.removeItem('sensorHistory');
                
                document.getElementById('tempValue').textContent = '--';
                document.getElementById('humidityValue').textContent = '--';
                document.getElementById('phValue').textContent = '--';
                document.getElementById('turbidityValue').textContent = '--';
                
                updateDataTable();
                updateSystemStatus();
                console.log('✓ Data dihapus');
            }
        });
    }

    // Load saved data
    loadDataFromStorage();
    updateSystemStatus();
});

// ==================== LOCAL STORAGE ====================
function loadDataFromStorage() {
    const savedHistory = localStorage.getItem('sensorHistory');
    if (savedHistory) {
        try {
            state.dataHistory = JSON.parse(savedHistory);
            console.log(`✓ Loaded ${state.dataHistory.length} data points`);
            
            if (state.dataHistory.length > 0) {
                const lastData = state.dataHistory[state.dataHistory.length - 1];
                state.currentData = lastData;
                
                updateSensorCard('temp', lastData.temperature.toFixed(2), 'temperature');
                updateSensorCard('humidity', lastData.humidity.toFixed(2), 'humidity');
                updateSensorCard('ph', lastData.pH.toFixed(2), 'pH');
                updateSensorCard('turbidity', lastData.turbidity.toFixed(2), 'turbidity');
                
                updateDataTable();
            }
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }
}

console.log('📊 Dashboard Ready!');
