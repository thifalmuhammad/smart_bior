// ==================== CONFIG & CONSTANTS ====================
const CONFIG = {
    UPDATE_INTERVAL: 2000, // milliseconds
    CHART_HISTORY_LENGTH: 100,
    TABLE_ROWS_PER_PAGE: 10,
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
    fullHistory: [],
    currentData: null,
    firebaseData: null,
    firebaseRef: null,
    calibrationRef: null,
    calibrationClearTimer: null,
    calibrationActivated: false,
    calibrationLastPhase: null,
    firebaseDb: null,
    updateCount: 0,
    tablePage: 1,
    chartView: {
        temp: { start: 0, end: 1 },
        turbidity: { start: 0, end: 1 }
    },
    chartDrag: {
        temp: null,
        turbidity: null
    }
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

function formatChartTimestampWithDate(date) {
    date = normalizeDate(date);
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        return '--';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function normalizeTimestamp(timestamp) {
    const numericTimestamp = Number(timestamp);

    if (!Number.isFinite(numericTimestamp)) {
        return new Date();
    }

    return new Date(numericTimestamp < 10000000000 ? numericTimestamp * 1000 : numericTimestamp);
}

function isValidHistoryTimestamp(timestamp) {
    const raw = String(timestamp ?? '').trim();
    if (!raw) return false;

    const numeric = Number(raw);
    if (!Number.isFinite(numeric)) return false;

    // Reject short / malformed timestamps, for example 2-digit values.
    return raw.length >= 10 || numeric >= 1000000000;
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
        .filter(([timestampKey]) => isValidHistoryTimestamp(timestampKey))
        .map(([timestampKey, reading]) => normalizeSensorReading(reading, timestampKey))
        .filter(Boolean)
        .sort((a, b) => a.timestamp - b.timestamp)
        ;
}

function getFilteredHistory() {
    return state.fullHistory.length > 0 ? state.fullHistory : state.dataHistory;
}

function collectInvalidHistoryPaths(firebasePayload) {
    if (!firebasePayload) return [];

    const candidates = [
        { basePath: '/history', payload: firebasePayload.history },
        { basePath: '/bioreactor/history', payload: firebasePayload.bioreactor?.history },
        { basePath: '/smart-bior/history', payload: firebasePayload['smart-bior']?.history }
    ];

    const invalidPaths = [];

    candidates.forEach(({ basePath, payload }) => {
        if (!payload || typeof payload !== 'object') return;

        Object.keys(payload).forEach((timestampKey) => {
            if (!isValidHistoryTimestamp(timestampKey)) {
                invalidPaths.push(`${basePath}/${timestampKey}`);
            }
        });
    });

    return invalidPaths;
}

async function cleanupInvalidFirebaseHistory(firebasePayload) {
    if (!state.firebaseDb) return;

    const invalidPaths = collectInvalidHistoryPaths(firebasePayload);
    if (invalidPaths.length === 0) return;

    await Promise.allSettled(
        invalidPaths.map((path) => state.firebaseDb.ref(path).remove())
    );
}

function evaluateStatus(value, sensorType) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return { status: 'warning', badge: '⚠ Menunggu data' };
    }

    if (sensorType === 'turbidity') {
        if (numericValue < 0.8) {
            return { status: 'warning', badge: '⚠ Belum siap panen' };
        }

        if (numericValue <= 1.2) {
            return { status: 'good', badge: '✓ Siap panen' };
        }

        return { status: 'danger', badge: '✗ Kultur overpopulasi' };
    }

    const range = CONFIG.SENSOR_RANGES[sensorType];
    const ideal = range.ideal;

    if (numericValue >= ideal[0] && numericValue <= ideal[1]) {
        return { status: 'good', badge: '✓ Optimal' };
    } else if (numericValue >= range.min && numericValue <= range.max) {
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
    const chartHistorySource = getFilteredHistory();
    const chartSeries = chartHistorySource
        .map((entry) => ({
            value: Number(entry?.[sensorType]),
            timestamp: entry?.timestamp
        }))
        .filter((point) => Number.isFinite(point.value) && point.timestamp);
    createSparkline(`${sensorName}Chart`, chartSeries, sensorName);
}

function createSparkline(elementId, series, chartKey = null) {
    const container = document.getElementById(elementId);
    if (!container || series.length === 0) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    const padding = { top: 18, right: 12, bottom: 30, left: 38 };
    const chartColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#256f4a';
    const isZoomed = chartKey ? getChartLabelMode(chartKey) === 'zoomed' : false;

    if (series.length < 2) return;

    container.innerHTML = '';

    const baseWidth = Math.max(width, 320);
    const baseHeight = Math.max(height, 180);

    // Create SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${baseWidth} ${baseHeight}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    const viewState = chartKey ? (state.chartView[chartKey] || { start: 0, end: 1 }) : { start: 0, end: 1 };
    const totalPoints = series.length;
    const visibleStart = Math.max(0, Math.min(totalPoints - 2, Math.floor(viewState.start * (totalPoints - 1))));
    const visibleEnd = Math.max(visibleStart + 2, Math.min(totalPoints, Math.ceil(viewState.end * totalPoints)));
    const visibleSeries = series.slice(visibleStart, visibleEnd);
    if (visibleSeries.length < 2) return;
    container._chartSeries = visibleSeries;

    // Find min/max
    const values = visibleSeries.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    // Create path
    let pathData = '';
    visibleSeries.forEach((point, index) => {
        const x = (index / (visibleSeries.length - 1)) * (baseWidth - padding.left - padding.right) + padding.left;
        const y = baseHeight - padding.bottom - ((point.value - min) / range) * (baseHeight - padding.top - padding.bottom);
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

    const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    hitArea.setAttribute('x', 0);
    hitArea.setAttribute('y', 0);
    hitArea.setAttribute('width', baseWidth);
    hitArea.setAttribute('height', baseHeight);
    hitArea.setAttribute('fill', 'transparent');
    svg.appendChild(hitArea);

    if (isZoomed) {
        const tickCount = Math.min(4, visibleSeries.length);
        const tickIndexes = Array.from({ length: tickCount }, (_, index) => {
            if (tickCount === 1) return 0;
            return Math.round((index / (tickCount - 1)) * (visibleSeries.length - 1));
        });

        tickIndexes.forEach((tickIndex) => {
            const point = visibleSeries[tickIndex];
            const x = (tickIndex / (visibleSeries.length - 1)) * (baseWidth - padding.left - padding.right) + padding.left;
            const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tick.setAttribute('x1', x);
            tick.setAttribute('x2', x);
            tick.setAttribute('y1', baseHeight - padding.bottom - 2);
            tick.setAttribute('y2', baseHeight - padding.bottom + 5);
            tick.setAttribute('stroke', chartColor);
            tick.setAttribute('stroke-width', '1.5');
            svg.appendChild(tick);

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', x);
            label.setAttribute('y', baseHeight - 12);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('fill', getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#637568');
            label.setAttribute('font-size', '10');
            label.textContent = formatChartTime(point.timestamp, 500);
            svg.appendChild(label);
        });
    } else {
        const tickCount = Math.min(4, visibleSeries.length);
        const tickIndexes = Array.from({ length: tickCount }, (_, index) => {
            if (tickCount === 1) return 0;
            return Math.round((index / (tickCount - 1)) * (visibleSeries.length - 1));
        });

        tickIndexes.forEach((tickIndex) => {
            const point = visibleSeries[tickIndex];
            const x = (tickIndex / (visibleSeries.length - 1)) * (baseWidth - padding.left - padding.right) + padding.left;
            const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tick.setAttribute('x1', x);
            tick.setAttribute('x2', x);
            tick.setAttribute('y1', baseHeight - padding.bottom - 2);
            tick.setAttribute('y2', baseHeight - padding.bottom + 5);
            tick.setAttribute('stroke', chartColor);
            tick.setAttribute('stroke-width', '1.5');
            svg.appendChild(tick);

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', x);
            label.setAttribute('y', baseHeight - 12);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('fill', getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#637568');
            label.setAttribute('font-size', '10');
            label.textContent = formatChartTimestampWithDate(point.timestamp);
            svg.appendChild(label);
        });
    }

    container.appendChild(svg);
    if (!container.dataset.tooltipBound) {
        container.dataset.tooltipBound = 'true';
        const tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip';
        tooltip.hidden = true;
        document.body.appendChild(tooltip);

        const updateTooltip = (clientX, clientY) => {
            const seriesData = container._chartSeries || [];
            if (!seriesData.length) return;
            const rect = container.getBoundingClientRect();
            const x = clientX - rect.left;
            const y = clientY - rect.top;
            const plotWidth = baseWidth - padding.left - padding.right;
            const ratio = Math.max(0, Math.min(1, (x - padding.left) / plotWidth));
            const index = Math.round(ratio * (seriesData.length - 1));
            const point = seriesData[Math.max(0, Math.min(seriesData.length - 1, index))];
            if (!point) return;

            tooltip.hidden = false;
            tooltip.style.left = `${Math.max(12, Math.min(window.innerWidth - 12, clientX + 16))}px`;
            tooltip.style.top = `${Math.max(12, Math.min(window.innerHeight - 12, clientY - 12))}px`;
            tooltip.innerHTML = `
                <strong>${chartKey === 'temp' ? 'Suhu' : 'OD'}</strong>
                Nilai: ${point.value.toFixed(chartKey === 'temp' ? 2 : 4)}<br>
                Waktu: ${formatTime(point.timestamp)}
            `;
        };

        const hideTooltip = () => {
            tooltip.hidden = true;
        };

        container.addEventListener('pointermove', (event) => {
            updateTooltip(event.clientX, event.clientY);
        });
        container.addEventListener('pointerleave', hideTooltip);
    }

    if (chartKey && state.chartDrag[chartKey]) {
        const dragState = state.chartDrag[chartKey];
        const selection = document.createElement('div');
        selection.className = 'chart-selection';
        const left = Math.min(dragState.startX, dragState.currentX);
        const right = Math.max(dragState.startX, dragState.currentX);
        selection.style.left = `${left}px`;
        selection.style.width = `${Math.max(0, right - left)}px`;
        container.appendChild(selection);
        container.classList.add('is-dragging');
    } else {
        container.classList.remove('is-dragging');
    }

    const shouldShowShortTime = chartKey && getChartLabelMode(chartKey) === 'zoomed';
    addChartLabel(container, 'chart-label-y-max', max.toFixed(2));
    addChartLabel(container, 'chart-label-y-min', min.toFixed(2));
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

    state.chartView.temp = { start: 0, end: 1 };
    state.chartView.turbidity = { start: 0, end: 1 };
    state.chartDrag.temp = null;
    state.chartDrag.turbidity = null;
}

function getChartLabelMode(chartKey) {
    const viewState = state.chartView[chartKey];
    return viewState && (viewState.start > 0 || viewState.end < 1) ? 'zoomed' : 'full';
}

function attachChartInteractions() {
    ['tempChart', 'turbidityChart'].forEach((chartId) => {
        const container = document.getElementById(chartId);
        if (!container || container.dataset.zoomBound === 'true') return;

        container.dataset.zoomBound = 'true';

        const chartKey = chartId === 'tempChart' ? 'temp' : 'turbidity';

        container.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            const rect = container.getBoundingClientRect();
            const startX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
            state.chartDrag[chartKey] = {
                startX,
                currentX: startX,
                rectWidth: rect.width
            };
            container.setPointerCapture(event.pointerId);
        });

        container.addEventListener('pointermove', (event) => {
            const dragState = state.chartDrag[chartKey];
            if (!dragState) return;
            const rect = container.getBoundingClientRect();
            dragState.currentX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
            updateChartsOnly();
        });

        container.addEventListener('pointerup', (event) => {
            const dragState = state.chartDrag[chartKey];
            if (!dragState) return;

            const rect = container.getBoundingClientRect();
            const endX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
            const minX = Math.min(dragState.startX, endX);
            const maxX = Math.max(dragState.startX, endX);

            state.chartDrag[chartKey] = null;
            if (container.hasPointerCapture(event.pointerId)) {
                container.releasePointerCapture(event.pointerId);
            }

            if (Math.abs(maxX - minX) < 12) {
                return;
            }

            const stateRange = state.chartView[chartKey];
            const startRatio = minX / rect.width;
            const endRatio = maxX / rect.width;
            stateRange.start = Math.max(0, Math.min(1, startRatio));
            stateRange.end = Math.max(stateRange.start + 0.1, Math.min(1, endRatio));
            updateChartsOnly();
        });

        container.addEventListener('pointerleave', () => {
            state.chartDrag[chartKey] = null;
            updateChartsOnly();
        });

        container.addEventListener('pointercancel', () => {
            state.chartDrag[chartKey] = null;
            updateChartsOnly();
        });

        container.title = 'Klik-drag untuk zoom, tombol reset untuk kembali';
    });
}

function resetChartZoom(chartKey) {
    state.chartView[chartKey] = { start: 0, end: 1 };
    state.chartDrag[chartKey] = null;
    updateChartsOnly();
}

function updateChartsOnly() {
    const sourceHistory = getFilteredHistory();
    if (!sourceHistory.length) {
        resetCharts();
        return;
    }

    ['temp', 'turbidity'].forEach((sensorType) => {
        const chartId = `${sensorType}Chart`;
        const chartSeries = sourceHistory
            .map((entry) => ({
                value: Number(entry?.[sensorType === 'temp' ? 'temperature' : sensorType]),
                timestamp: entry?.timestamp
            }))
            .filter((point) => Number.isFinite(point.value) && point.timestamp);
        createSparkline(chartId, chartSeries, sensorType);
    });
}

function updateDataTable() {
    const tableBody = document.getElementById('dataTableBody');
    const tableInfo = document.getElementById('tablePageInfo');
    const tablePrevBtn = document.getElementById('tablePrevBtn');
    const tableNextBtn = document.getElementById('tableNextBtn');
    const sourceHistory = getFilteredHistory();
    
    if (sourceHistory.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="no-data">Tunggu data masuk...</td></tr>';
        if (tableInfo) tableInfo.textContent = '0 data';
        if (tablePrevBtn) tablePrevBtn.disabled = true;
        if (tableNextBtn) tableNextBtn.disabled = true;
        return;
    }

    const totalPages = Math.max(1, Math.ceil(sourceHistory.length / CONFIG.TABLE_ROWS_PER_PAGE));
    state.tablePage = Math.min(state.tablePage, totalPages);
    const startIndex = sourceHistory.length - (state.tablePage * CONFIG.TABLE_ROWS_PER_PAGE);
    const endIndex = sourceHistory.length - ((state.tablePage - 1) * CONFIG.TABLE_ROWS_PER_PAGE);
    const pageData = sourceHistory.slice(Math.max(0, startIndex), Math.max(0, endIndex)).reverse();
    
    tableBody.innerHTML = pageData.map(data => `
        <tr>
            <td>${formatTime(data.timestamp)}</td>
            <td>${formatSensorValue(data.temperature, 'temperature')}</td>
            <td>${formatSensorValue(data.turbidity, 'turbidity')}</td>
        </tr>
    `).join('');

    if (tableInfo) {
        const from = sourceHistory.length - endIndex + 1;
        const to = sourceHistory.length - startIndex;
        tableInfo.textContent = `Halaman ${state.tablePage} dari ${totalPages} · sample ${from}-${to} dari ${sourceHistory.length}`;
    }

    if (tablePrevBtn) tablePrevBtn.disabled = state.tablePage <= 1;
    if (tableNextBtn) tableNextBtn.disabled = state.tablePage >= totalPages;
}

function goToTablePage(direction) {
    const sourceHistory = getFilteredHistory();
    const totalPages = Math.max(1, Math.ceil(sourceHistory.length / CONFIG.TABLE_ROWS_PER_PAGE));

    if (direction === 'older') {
        state.tablePage = Math.min(totalPages, state.tablePage + 1);
    } else if (direction === 'newer') {
        state.tablePage = Math.max(1, state.tablePage - 1);
    }

    updateDataTable();
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function exportDataToXls() {
    const sourceHistory = state.fullHistory.length > 0 ? state.fullHistory : state.dataHistory;

    if (!sourceHistory.length) {
        alert('Tidak ada data untuk diekspor.');
        return;
    }

    const rows = sourceHistory.map((row, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(formatTime(row.timestamp))}</td>
            <td>${escapeHtml(formatSensorValue(row.temperature, 'temperature'))}</td>
            <td>${escapeHtml(formatSensorValue(row.turbidity, 'turbidity'))}</td>
        </tr>
    `).join('');

    const html = `
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
                th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                th { background: #e8f4ec; }
            </style>
        </head>
        <body>
            <table>
                <thead>
                    <tr>
                        <th>No</th>
                        <th>Timestamp</th>
                        <th>Suhu (°C)</th>
                        <th>Optical Density (OD)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-bioreactor-${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
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
    const totalSamples = getFilteredHistory().length || state.fullHistory.length || state.dataHistory.length;
    dataPointsCount.textContent = totalSamples;

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
    state.fullHistory.push(data);
    state.updateCount++;

    // Keep only last N data points
    if (state.dataHistory.length > CONFIG.CHART_HISTORY_LENGTH) {
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
    state.fullHistory = normalizedHistory;
    state.dataHistory = normalizedHistory.slice(-CONFIG.CHART_HISTORY_LENGTH);
    state.currentData = normalizedHistory[normalizedHistory.length - 1];
    state.updateCount = normalizedHistory.length;
    state.tablePage = 1;

    saveDataToStorage();
    cleanupInvalidFirebaseHistory(firebasePayload).catch((error) => {
        console.error('Gagal membersihkan history Firebase yang invalid:', error);
    });

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
            state.fullHistory = [];
            state.currentData = null;
            state.updateCount = 0;
            state.tablePage = 1;
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

    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) {
        exportDataBtn.addEventListener('click', exportDataToXls);
    }

    attachChartInteractions();

    const resetTempZoomBtn = document.getElementById('resetTempZoomBtn');
    if (resetTempZoomBtn) {
        resetTempZoomBtn.addEventListener('click', () => resetChartZoom('temp'));
    }

    const resetTurbidityZoomBtn = document.getElementById('resetTurbidityZoomBtn');
    if (resetTurbidityZoomBtn) {
        resetTurbidityZoomBtn.addEventListener('click', () => resetChartZoom('turbidity'));
    }

    const tablePrevBtn = document.getElementById('tablePrevBtn');
    const tableNextBtn = document.getElementById('tableNextBtn');
    if (tablePrevBtn) {
        tablePrevBtn.addEventListener('click', function() {
            goToTablePage('newer');
        });
    }
    if (tableNextBtn) {
        tableNextBtn.addEventListener('click', function() {
            goToTablePage('older');
        });
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
    localStorage.setItem('sensorHistory', JSON.stringify(state.fullHistory.length ? state.fullHistory : state.dataHistory));
    localStorage.setItem('lastUpdate', new Date().toISOString());
}

function loadDataFromStorage() {
    const savedHistory = localStorage.getItem('sensorHistory');
    if (savedHistory) {
        try {
            state.fullHistory = JSON.parse(savedHistory);
            state.dataHistory = state.fullHistory.slice(-CONFIG.CHART_HISTORY_LENGTH);
            state.tablePage = 1;
            console.log(`📦 Loaded ${state.fullHistory.length} data points dari localStorage`);
            
            // Update UI with loaded data
            if (state.fullHistory.length > 0) {
                const lastData = state.fullHistory[state.fullHistory.length - 1];
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
