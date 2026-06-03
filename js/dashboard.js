/**
 * ═══════════════════════════════════════════════════════════════════════
 * SMART-BIOR DASHBOARD - Main Script
 * Sistem Monitoring Spirulina Berbasis IoT
 * ═══════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════
// ⚙️ FIREBASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD0ZF1X7hw2plcHHduXRpVlji4F4STVu9s",
  authDomain: "smart-bior.firebaseapp.com",
  databaseURL: "https://smart-bior-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-bior",
  storageBucket: "smart-bior.firebasestorage.app",
  messagingSenderId: "656488250692",
  appId: "1:656488250692:web:8620bb7ca4ea321643ab11"
};

// ═══════════════════════════════════════════════════════════════════════
// SYSTEM CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const OD_DANGER = 1.5;
const OD_HARVEST_LO = 1.0;
const MAX_HISTORY = 48;
const MAX_CHART_PTS = 48;

// ═══════════════════════════════════════════════════════════════════════
// FALLBACK DATA (untuk simulasi ketika Firebase belum terhubung)
// ═══════════════════════════════════════════════════════════════════════

const FALLBACK = {
  od: 1.42,
  bio: 1.06,
  count: 48,
  status: 'panen',
  timestamp: new Date().toISOString(),
  spectral: {
    nm450: 2841,
    nm500: 3120,
    nm550: 3880,
    nm570: 4210,
    nm600: 3650,
    nm650: 2190
  },
  history: [
    { time: '14:30', od: 1.42, bio: 1.06, status: 'panen' },
    { time: '14:00', od: 1.38, bio: 1.03, status: 'panen' },
    { time: '13:30', od: 1.31, bio: 0.98, status: 'panen' },
    { time: '13:00', od: 1.22, bio: 0.91, status: 'tumbuh' },
    { time: '12:30', od: 1.14, bio: 0.85, status: 'tumbuh' },
    { time: '12:00', od: 1.05, bio: 0.79, status: 'tumbuh' }
  ],
  chartLabels: [
    '00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00', '07:00',
    '08:00', '09:00', '10:00', '11:00', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30'
  ],
  chartOD: [
    0.41, 0.42, 0.43, 0.44, 0.47, 0.51, 0.55, 0.61,
    0.67, 0.76, 0.87, 0.99, 1.05, 1.14, 1.22, 1.31,
    1.38, 1.42
  ],
  notifications: [
    {
      color: '#d29922',
      text: 'Spirulina memasuki <strong>zona siap panen</strong>. OD mencapai 1.30.',
      time: 'Hari ini, 13:30 WIB'
    },
    {
      color: '#58a6ff',
      text: 'OD mendekati zona panen (OD = 1.05). Persiapkan pemanenan.',
      time: 'Hari ini, 12:00 WIB'
    },
    {
      color: '#3fb950',
      text: 'Sistem Smart-Bior menyala. Koneksi Firebase berhasil.',
      time: 'Kemarin, 06:00 WIB'
    },
    {
      color: '#3fb950',
      text: 'Kalibrasi blanko (I₀) berhasil. Sistem siap mengukur.',
      time: 'Kemarin, 05:58 WIB'
    }
  ]
};

// ═══════════════════════════════════════════════════════════════════════
// SPECTRAL SENSOR METADATA
// ═══════════════════════════════════════════════════════════════════════

const SPECTRAL_META = [
  { key: 'nm450', label: '450 nm (Biru)', color: '#4f97f5' },
  { key: 'nm500', label: '500 nm (Sian)', color: '#39d0c4' },
  { key: 'nm550', label: '550 nm (Hijau)', color: '#3fb950' },
  { key: 'nm570', label: '570 nm (Kuning)', color: '#d29922' },
  { key: 'nm600', label: '600 nm (Jingga)', color: '#e07a3b' },
  { key: 'nm650', label: '650 nm ★ Utama', color: '#f85149', primary: true }
];

// ═══════════════════════════════════════════════════════════════════════
// GLOBAL STATE
// ═══════════════════════════════════════════════════════════════════════

let growthChart = null;
let chartLabels = [...FALLBACK.chartLabels];
let chartOD = [...FALLBACK.chartOD];
let usingFirebase = false;
let prevOD = null;
let currentMode = 'real'; // 'real' or 'simulasi'
let notificationHistory = []; // Track untuk notifikasi dinamis

// ═══ Simulasi Dynamic Variables ═══
let simulationMode = null; // 'belum_panen', 'siap_panen', 'bahaya'
let simulationStartTime = null; // Waktu mulai simulasi
let simulationIntervalId = null; // Timer untuk update simulasi
let simulationCounter = 0; // Counter untuk perubahan OD

// ═══════════════════════════════════════════════════════════════════════
// INITIALIZE FIREBASE & LISTENERS
// ═══════════════════════════════════════════════════════════════════════

function initFirebase() {
  // Cek jika Firebase config belum dikonfigurasi
  if (FIREBASE_CONFIG.apiKey === 'GANTI_API_KEY_KAMU') {
    console.warn('[Smart-Bior] Firebase belum dikonfigurasi → mode simulasi aktif');
    setConnectionStatus(false);
    loadFallback();
    return;
  }

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.database();

    // Listener 1: Data terbaru (real-time update)
    db.ref('/smart-bior/latest').on(
      'value',
      (snap) => {
        const d = snap.val();
        if (!d) return;
        usingFirebase = true;
        setConnectionStatus(true);

        const od = parseFloat(d.od) || 0;
        const bio = parseFloat(d.biomass) || 0;
        const status = d.status || getStatus(od);
        const spectral = d.spectral || {};

        updateStats(od, bio, status);
        updateGauge(od);
        updateAlert(od, status);
        updateSpectral(spectral);
        updateLastSeen(d.timestamp);

        prevOD = od;
      },
      (err) => {
        console.error('[Firebase] /latest error:', err);
        setConnectionStatus(false);
      }
    );

    // Listener 2: Riwayat pengukuran (48 data terakhir)
    db.ref('/smart-bior/history')
      .orderByKey()
      .limitToLast(MAX_HISTORY)
      .on('value', (snap) => {
        const raw = snap.val();
        if (!raw) return;

        const arr = Object.values(raw).reverse();
        renderHistory(arr);

        const forChart = [...arr].reverse().slice(-MAX_CHART_PTS);
        chartLabels = forChart.map((r) => r.time || '');
        chartOD = forChart.map((r) => parseFloat(r.od) || null);
        updateChart();
      });

    // Listener 3: System info (cycle count)
    db.ref('/smart-bior/system').on('value', (snap) => {
      const sys = snap.val();
      if (!sys) return;
      if (sys.cycle_count !== undefined) {
        document.getElementById('countValue').textContent = sys.cycle_count;
      }
    });

    // Listener 4: Notifikasi dari history events
    db.ref('/smart-bior/history')
      .orderByKey()
      .limitToLast(4)
      .on('value', (snap) => {
        const raw = snap.val();
        if (!raw) return;
        const arr = Object.entries(raw)
          .reverse()
          .map(([key, val]) => buildNotif(val));
        renderNotifications(arr);
      });
  } catch (e) {
    console.error('[Firebase] Init gagal:', e);
    setConnectionStatus(false);
    loadFallback();
  }
}

// ═══════════════════════════════════════════════════════════════════════
// DOM UPDATE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

function updateStats(od, bio, status) {
  document.getElementById('odValue').textContent = od.toFixed(2);
  document.getElementById('biomassValue').innerHTML = bio.toFixed(2) + ' <span>g/L</span>';

  // Update trend OD
  const trendEl = document.querySelector('.stat-card:nth-child(1) .stat-trend span');
  if (prevOD !== null && trendEl) {
    const diff = od - prevOD;
    const trendIconEl = document.querySelector('.stat-card:nth-child(1) .stat-trend i');

    if (diff > 0.001) {
      trendIconEl.className = 'fas fa-arrow-trend-up';
      trendEl.textContent = `Naik ${diff.toFixed(2)} sejak pengukuran lalu`;
    } else if (diff < -0.001) {
      trendIconEl.className = 'fas fa-arrow-trend-down';
      trendEl.textContent = `Turun ${Math.abs(diff).toFixed(2)} sejak pengukuran lalu`;
    } else {
      trendIconEl.className = 'fas fa-minus';
      trendEl.textContent = 'Stabil';
    }
  }
}

function updateGauge(od) {
  const pct = Math.min((od / 2.0) * 100, 100);
  document.getElementById('gaugeFill').style.width = pct + '%';
  document.getElementById('gaugeNeedle').style.left = pct + '%';
  document.getElementById('gaugeOD').textContent = od.toFixed(2);

  // Update rekomendasi
  const recEl = document.querySelector('.gauge-rec');
  if (recEl) {
    if (od >= OD_DANGER) {
      recEl.style.borderLeftColor = 'var(--red)';
      recEl.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <div>
          <strong style="color:var(--red);">Bahaya!</strong> OD sudah melewati 1.5. Lakukan panen <strong>segera</strong> untuk mencegah <em>culture crash</em>.
        </div>
      `;
    } else if (od >= OD_HARVEST_LO) {
      recEl.style.borderLeftColor = 'var(--yellow)';
      recEl.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <div>
          <strong>Rekomendasi:</strong> Panen segera dalam <strong>24 jam ke depan</strong>. Jika melewati OD 1.5, risiko <em>culture crash</em> meningkat signifikan.
        </div>
      `;
    } else {
      recEl.style.borderLeftColor = 'var(--green)';
      recEl.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <div>
          <strong style="color:var(--green);">Pertumbuhan normal.</strong> Kultur masih dalam fase tumbuh. Pantau terus hingga OD mencapai zona panen (1.0–1.5).
        </div>
      `;
    }
  }
}

function updateAlert(od, status) {
  const banner = document.getElementById('alertBanner');
  const titleEl = document.getElementById('alertTitle');
  const msgEl = document.getElementById('alertMsg');
  const iconEl = banner.querySelector('.alert-icon');

  if (od >= OD_DANGER) {
    banner.className = 'alert-banner danger';
    iconEl.innerHTML = '<i class="fas fa-triangle-exclamation"></i>';
    titleEl.style.color = 'var(--red)';
    titleEl.textContent = 'Peringatan! OD Melewati Batas Bahaya';
    msgEl.innerHTML = `OD saat ini <strong>${od.toFixed(
      2
    )}</strong> sudah melewati batas bahaya 1.5. Risiko <em>culture crash</em> sangat tinggi. Lakukan panen <strong>segera</strong>!`;
  } else if (od >= OD_HARVEST_LO) {
    banner.className = 'alert-banner harvest';
    iconEl.innerHTML = '<i class="fas fa-sheaf-wheat"></i>';
    titleEl.style.color = 'var(--green)';
    titleEl.textContent = 'Spirulina Siap Dipanen!';
    msgEl.innerHTML = `Kepadatan kultur berada di puncak fase stasioner (OD = ${od.toFixed(
      2
    )}). Segera lakukan pemanenan untuk mendapatkan hasil biomassa terbaik dan mencegah risiko <em>culture crash</em>.`;
  } else {
    banner.className = 'alert-banner';
    banner.style.background = 'var(--surface2)';
    banner.style.border = '1px solid var(--border)';
    iconEl.innerHTML = '<i class="fas fa-leaf"></i>';
    titleEl.style.color = 'var(--blue)';
    titleEl.textContent = 'Kultur Sedang Tumbuh';
    msgEl.innerHTML = `OD saat ini <strong>${od.toFixed(
      2
    )}</strong>. Kultur masih dalam fase pertumbuhan aktif. Lanjutkan pemantauan rutin.`;
  }
}

function updateSpectral(spectral) {
  const maxVal = Math.max(...SPECTRAL_META.map((m) => spectral[m.key] || 0), 1000);
  const grid = document.getElementById('spectralGrid');

  grid.innerHTML = SPECTRAL_META.map((m) => {
    const val = spectral[m.key] || 0;
    const pct = ((val / maxVal) * 100).toFixed(1);
    return `
    <div class="spectral-row">
      <div class="spectral-label">
        <div class="wavelength-dot" style="background:${m.color};${
      m.primary ? ' box-shadow:0 0 6px ' + m.color + ';' : ''
    }"></div>
        <span style="${m.primary ? 'color:var(--text);font-weight:600;' : ''}">${m.label}</span>
      </div>
      <div class="spectral-bar-bg">
        <div class="spectral-bar" style="width:${pct}%; background:${m.color}; opacity:${
      m.primary ? '1' : '0.7'
    };"></div>
      </div>
      <div class="spectral-value" style="${m.primary ? 'color:var(--text);' : ''}">
        ${val.toLocaleString()}<br>
        <span style="font-size:9px; color:var(--text-dim);">counts ×10¹</span>
      </div>
    </div>`;
  }).join('');
}

function renderHistory(rows) {
  const tbody = document.getElementById('historyTable');
  tbody.innerHTML = rows
    .slice(0, MAX_HISTORY)
    .map((r) => {
      const st = r.status || getStatus(parseFloat(r.od));
      const badgeClass = st === 'bahaya' ? 'danger' : st === 'panen' ? 'panen' : 'tumbuh';
      const badgeIcon = st === 'bahaya' ? 'fa-triangle-exclamation' : 
                       st === 'panen' ? 'fa-check-circle' : 'fa-leaf';
      const badgeText = st === 'bahaya' ? 'Bahaya' : st === 'panen' ? 'Siap Panen' : 'Tumbuh';
      return `
    <tr>
      <td class="td-time">${r.time || '--:--'}</td>
      <td class="td-od">${parseFloat(r.od).toFixed(2)}</td>
      <td class="td-biomass">${parseFloat(r.bio || r.biomass || 0).toFixed(2)} g/L</td>
      <td><span class="status-badge ${badgeClass}"><i class="fas ${badgeIcon}"></i> ${badgeText}</span></td>
    </tr>`;
    })
    .join('');
}

function buildNotif(data) {
  const od = parseFloat(data.od) || 0;
  const status = data.status || getStatus(od);
  let color = '#3fb950',
    text = '';

  if (status === 'bahaya') {
    color = '#f85149';
    text = `OD mencapai <strong>${od.toFixed(2)}</strong> — melewati batas bahaya! Panen segera diperlukan.`;
  } else if (status === 'panen') {
    color = '#d29922';
    text = `Spirulina memasuki <strong>zona siap panen</strong>. OD = ${od.toFixed(2)}.`;
  } else {
    color = '#58a6ff';
    text = `Pengukuran OD = ${od.toFixed(2)}. Kultur dalam fase tumbuh normal.`;
  }

  const ts = data.timestamp ? new Date(data.timestamp) : new Date();
  const timeStr = ts.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit'
  }) + ' WIB';

  return { color, text, time: timeStr };
}

function renderNotifications(notifs) {
  const list = document.getElementById('notifList');
  
  if (!notifs || notifs.length === 0) {
    list.innerHTML = `
      <div style="padding: 20px; text-align: center; color: var(--text-dim);">
        <i class="fas fa-info-circle" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
        <p>Belum ada notifikasi sistem</p>
      </div>
    `;
    return;
  }
  
  list.innerHTML = notifs
    .map(
      (n) => `
    <div class="notif-item">
      <div class="notif-dot-wrap">
        <div class="notif-dot-small" style="background:${n.color};"></div>
      </div>
      <div class="notif-content">
        <p style="margin-bottom: 6px;">${n.text}</p>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>
  `
    )
    .join('');
}

// ═══════════════════════════════════════════════════════════════════════
// CHART INITIALIZATION & UPDATE
// ═══════════════════════════════════════════════════════════════════════

function initChart() {
  const ctx = document.getElementById('growthChart').getContext('2d');
  growthChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: chartLabels,
      datasets: [
        {
          label: 'Optical Density',
          data: chartOD,
          borderColor: '#3fb950',
          backgroundColor: 'rgba(63,185,80,0.08)',
          borderWidth: 2.5,
          tension: 0.4,
          fill: true,
          pointRadius: 2,
          pointHoverRadius: 6,
          pointBackgroundColor: '#3fb950',
          pointBorderColor: '#fff',
          pointBorderWidth: 1,
          spanGaps: false
        },
        {
          label: 'Batas Bahaya',
          data: chartLabels.map(() => OD_DANGER),
          borderColor: '#f85149',
          borderWidth: 1.5,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1c2128',
          borderColor: '#30363d',
          borderWidth: 1,
          titleColor: '#8b949e',
          bodyColor: '#e6edf3',
          titleFont: { family: 'Space Mono', size: 11, weight: 600 },
          bodyFont: { family: 'Space Mono', size: 12 },
          padding: 12,
          displayColors: false,
          callbacks: {
            title: (items) => items[0].label + ' WIB',
            label: (item) => {
              if (item.datasetIndex === 0 && item.parsed.y !== null)
                return ' OD: ' + item.parsed.y.toFixed(2);
              return null;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#21262d', lineWidth: 0.5 },
          ticks: {
            color: '#484f58',
            font: { family: 'Space Mono', size: 10 },
            maxTicksLimit: 8,
            maxRotation: 0
          },
          border: { color: '#30363d' }
        },
        y: {
          min: 0.3,
          max: 1.8,
          grid: { color: '#21262d', lineWidth: 0.5 },
          ticks: {
            color: '#484f58',
            font: { family: 'Space Mono', size: 10 },
            stepSize: 0.3
          },
          border: { color: '#30363d' }
        }
      }
    }
  });
}

function updateChart() {
  if (!growthChart) return;
  growthChart.data.labels = chartLabels;
  growthChart.data.datasets[0].data = chartOD;
  growthChart.data.datasets[1].data = chartLabels.map(() => OD_DANGER);
  growthChart.update('active');
}

// ═══════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

function getStatus(od) {
  if (od >= OD_DANGER) return 'bahaya';
  if (od >= OD_HARVEST_LO) return 'panen';
  return 'tumbuh';
}

function setConnectionStatus(connected) {
  const badge = document.querySelector('.live-badge');
  const dot = document.querySelector('.live-dot');
  const statusText = badge.querySelector('span');

  if (connected) {
    badge.style.background = 'var(--green-dim)';
    badge.style.borderColor = 'rgba(63,185,80,0.3)';
    badge.style.color = 'var(--green)';
    dot.style.background = 'var(--green)';
    statusText.textContent = 'Live · Update tiap 30 menit';
  } else {
    badge.style.background = 'var(--yellow-dim)';
    badge.style.borderColor = 'rgba(210,153,34,0.3)';
    badge.style.color = 'var(--yellow)';
    dot.style.background = 'var(--yellow)';
    statusText.textContent = 'Mode Simulasi';
  }
}

function updateLastSeen(timestamp) {
  if (!timestamp) return;
  const ts = new Date(timestamp);
  const hh = String(ts.getHours()).padStart(2, '0');
  const mm = String(ts.getMinutes()).padStart(2, '0');
  const ss = String(ts.getSeconds()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  document.getElementById('dateDisplay').textContent =
    `Data terakhir: ${hh}:${mm}:${ss} WIB · ${ts.getDate()} ${months[ts.getMonth()]} ${ts.getFullYear()}`;
}

function renderClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const d = now.getDate();
  const month = months[now.getMonth()];
  const y = now.getFullYear();
  
  document.getElementById('clock').textContent = `${h}:${m}:${s}`;
  document.getElementById('dateDisplay').textContent = `${d} ${month} ${y}`;
}

// ═══════════════════════════════════════════════════════════════════════
// LOAD FALLBACK DATA (simulasi mode)
// ═══════════════════════════════════════════════════════════════════════

function loadFallback() {
  const d = FALLBACK;
  notificationHistory = [
    { color: '#16a34a', text: 'OD mencapai <strong>1.42</strong> — memasuki zona siap panen. Persiapkan pemanenan.', time: '14:30 WIB' },
    { color: '#16a34a', text: 'Pengukuran OD = <strong>1.31</strong>. Kultur mendekati fase panen.', time: '13:30 WIB' },
    { color: '#16a34a', text: 'Pengukuran OD = <strong>1.14</strong>. Kultur dalam pertumbuhan lanjut.', time: '12:30 WIB' },
    { color: '#16a34a', text: 'Sistem Smart-Bior menyala dan siap beroperasi.', time: 'Hari ini, 06:00 WIB' }
  ];
  updateStats(d.od, d.bio, d.status);
  updateGauge(d.od);
  updateAlert(d.od, d.status);
  updateSpectral(d.spectral);
  renderHistory(d.history);
  renderNotifications(notificationHistory);
  chartLabels = d.chartLabels;
  chartOD = d.chartOD;
  updateChart();
  document.getElementById('countValue').textContent = d.count;
}

// ═══════════════════════════════════════════════════════════════════════
// DYNAMIC SIMULATION (simulasi dengan perubahan seiring waktu)
// ═══════════════════════════════════════════════════════════════════════

function startDynamicSimulation(mode) {
  // Hapus interval sebelumnya jika ada
  if (simulationIntervalId) {
    clearInterval(simulationIntervalId);
  }
  
  simulationMode = mode;
  simulationStartTime = Date.now();
  simulationCounter = 0;
  
  // Update data awal
  updateSimulationData();
  
  // Update setiap 2 detik (simulasi 30 menit real)
  simulationIntervalId = setInterval(() => {
    simulationCounter++;
    updateSimulationData();
  }, 2000);
}

function updateSimulationData() {
  if (!simulationMode) return;
  
  let baseOD, bioMultiplier, status, odIncrement, timeStep;
  const counter = simulationCounter;
  
  // Definisi masing-masing scenario
  if (simulationMode === 'belum_panen') {
    // Growing phase: OD dari 0.20 → 0.68 (13 step × 0.04 = 0.52)
    baseOD = 0.20;
    odIncrement = 0.04;
    bioMultiplier = 0.75; // Rasio bio/od
    timeStep = counter;
  } else if (simulationMode === 'siap_panen') {
    // Harvest ready: OD dari 0.41 → 1.28 (12 step × 0.08 = 0.87)
    baseOD = 0.41;
    odIncrement = 0.08;
    bioMultiplier = 0.75;
    timeStep = counter;
  } else if (simulationMode === 'bahaya') {
    // Danger: OD dari 0.41 → 1.68 (14 step × 0.09 = 1.27)
    baseOD = 0.41;
    odIncrement = 0.09;
    bioMultiplier = 0.75;
    timeStep = counter;
  }
  
  // Hitung OD saat ini
  let od = Math.min(baseOD + (odIncrement * timeStep), 2.0);
  let bio = od * bioMultiplier;
  status = getStatus(od);
  
  // Generate waktu simulasi (mulai dari 06:00)
  const startHour = 6;
  const minutesPerStep = 30; // Setiap step = 30 menit
  const totalMinutes = timeStep * minutesPerStep;
  const currentDate = new Date();
  currentDate.setHours(startHour + Math.floor(totalMinutes / 60), (totalMinutes % 60), 0);
  
  const timeStr = String(currentDate.getHours()).padStart(2, '0') + ':' + 
                  String(currentDate.getMinutes()).padStart(2, '0');
  const timeFullStr = timeStr + ' WIB';
  
  // Update stats
  updateStats(od, bio, status);
  updateGauge(od);
  updateAlert(od, status);
  updateSpectral(FALLBACK.spectral);
  
  // Generate history dengan 6 data terakhir
  let history = [];
  for (let i = Math.max(0, timeStep - 5); i <= timeStep; i++) {
    const stepOD = Math.min(baseOD + (odIncrement * i), 2.0);
    const stepBio = stepOD * bioMultiplier;
    const stepStatus = getStatus(stepOD);
    const stepMinutes = i * minutesPerStep;
    const stepDate = new Date();
    stepDate.setHours(startHour + Math.floor(stepMinutes / 60), (stepMinutes % 60), 0);
    const stepTime = String(stepDate.getHours()).padStart(2, '0') + ':' + 
                     String(stepDate.getMinutes()).padStart(2, '0');
    history.push({
      time: stepTime,
      od: stepOD.toFixed(2),
      bio: stepBio.toFixed(2),
      status: stepStatus
    });
  }
  renderHistory(history);
  
  // Generate dynamic notifications
  generateDynamicNotifications(simulationMode, od, timeStr, timeStep);
  renderNotifications(notificationHistory);
  
  // Update chart - tambahkan data baru
  chartLabels.push(timeStr);
  chartOD.push(od);
  
  // Batasi chart ke 13 data terakhir
  if (chartLabels.length > 13) {
    chartLabels.shift();
    chartOD.shift();
  }
  updateChart();
}

function generateDynamicNotifications(mode, od, timeStr, step) {
  notificationHistory = [];
  
  if (mode === 'belum_panen') {
    // Growing phase - notifikasi pertumbuhan
    if (step >= 6) notificationHistory.push({
      color: '#16a34a',
      text: `Pengukuran OD = <strong>${od.toFixed(2)}</strong>. Kultur dalam fase tumbuh normal.`,
      time: timeStr + ' WIB'
    });
    if (step >= 3) notificationHistory.push({
      color: '#16a34a',
      text: `Pengukuran OD = <strong>${(od - 0.08).toFixed(2)}</strong>. Kultur dalam fase tumbuh normal.`,
      time: (parseInt(timeStr.split(':')[0]) - 1) + ':' + timeStr.split(':')[1] + ' WIB'
    });
    notificationHistory.push({
      color: '#16a34a',
      text: 'Sistem Smart-Bior menyala. Koneksi berhasil.',
      time: 'Hari ini, 06:00 WIB'
    });
    notificationHistory.push({
      color: '#16a34a',
      text: 'Kalibrasi blanko (I₀) berhasil. Sistem siap mengukur.',
      time: 'Kemarin, 05:58 WIB'
    });
  } else if (mode === 'siap_panen') {
    // Harvest phase
    if (step >= 10) notificationHistory.push({
      color: '#eab308',
      text: `Spirulina memasuki <strong>zona siap panen</strong>. OD = <strong>${od.toFixed(2)}</strong>.`,
      time: timeStr + ' WIB'
    });
    if (step >= 6) notificationHistory.push({
      color: '#eab308',
      text: `OD mendekati zona panen (OD = <strong>${(od - 0.16).toFixed(2)}</strong>). Persiapkan pemanenan.`,
      time: (parseInt(timeStr.split(':')[0]) - 2) + ':' + timeStr.split(':')[1] + ' WIB'
    });
    if (step >= 2) notificationHistory.push({
      color: '#16a34a',
      text: `OD mencapai <strong>${(od - 0.32).toFixed(2)}</strong> - memasuki zona panen mulai.`,
      time: (parseInt(timeStr.split(':')[0]) - 4) + ':' + timeStr.split(':')[1] + ' WIB'
    });
    notificationHistory.push({
      color: '#16a34a',
      text: 'Pengukuran OD = <strong>0.41</strong>. Kultur dalam fase tumbuh lanjut.',
      time: '11:00 WIB'
    });
  } else if (mode === 'bahaya') {
    // Danger phase
    if (step >= 12) notificationHistory.push({
      color: '#ef4444',
      text: `<strong style="color:#ef4444;">🚨 ALERT!</strong> OD mencapai <strong>${od.toFixed(2)}</strong> — melewati batas bahaya 1.5! Panen segera diperlukan untuk mencegah culture crash!`,
      time: timeStr + ' WIB'
    });
    if (step >= 8) notificationHistory.push({
      color: '#ef4444',
      text: `<strong style="color:#ef4444;">⚠️ WARNING!</strong> OD sudah di <strong>${(od - 0.18).toFixed(2)}</strong>. Segera lakukan pemanenan!`,
      time: (parseInt(timeStr.split(':')[0]) - 2) + ':' + timeStr.split(':')[1] + ' WIB'
    });
    if (step >= 4) notificationHistory.push({
      color: '#eab308',
      text: `Spirulina memasuki <strong>zona siap panen</strong>. OD = <strong>${(od - 0.36).toFixed(2)}</strong>.`,
      time: (parseInt(timeStr.split(':')[0]) - 4) + ':' + timeStr.split(':')[1] + ' WIB'
    });
    notificationHistory.push({
      color: '#16a34a',
      text: 'Sistem Smart-Bior menyala. Koneksi berhasil.',
      time: 'Hari ini, 06:00 WIB'
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// SIMULATION MODE & MODE SWITCHING
// ═══════════════════════════════════════════════════════════════════════

function switchMode(mode) {
  currentMode = mode;
  const btnReal = document.getElementById('btnRealMode');
  const btnSim = document.getElementById('btnSimMode');
  const scenarioButtons = document.getElementById('scenarioButtons');
  
  if (mode === 'real') {
    // Hentikan simulasi jika ada
    if (simulationIntervalId) {
      clearInterval(simulationIntervalId);
      simulationIntervalId = null;
    }
    
    btnReal.style.background = '#d1fae5';
    btnReal.style.borderColor = '#16a34a';
    btnReal.style.color = '#065f46';
    btnSim.style.background = '#f3f4f6';
    btnSim.style.borderColor = '#d1d5db';
    btnSim.style.color = '#6b7280';
    scenarioButtons.style.display = 'none';
    document.getElementById('connectionStatus').textContent = '🔴 Live · Connected to Firebase';
    loadFallback(); // Tampilkan fallback dulu sambil menunggu firebase
    console.log('[Mode] Switched to REAL (Firebase)');
  } else {
    btnSim.style.background = '#fee2e2';
    btnSim.style.borderColor = '#fca5a5';
    btnSim.style.color = '#991b1b';
    btnReal.style.background = '#f3f4f6';
    btnReal.style.borderColor = '#d1d5db';
    btnReal.style.color = '#6b7280';
    scenarioButtons.style.display = 'flex';
    document.getElementById('connectionStatus').textContent = '⚙️ Simulation Mode Active';
    // Mulai simulasi dinamis dengan scenario awal
    startDynamicSimulation('belum_panen');
    console.log('[Mode] Switched to SIMULASI (Dynamic)');
  }
}

function simulateMode(mode) {
  let od, bio, status, history;
  
  if (mode === 'belum_panen') {
    // OD < 1.0 - Kultur masih tumbuh
    od = 0.68;
    bio = 0.51;
    status = 'tumbuh';
    history = [
      { time: '14:30', od: 0.68, bio: 0.51, status: 'tumbuh' },
      { time: '14:00', od: 0.64, bio: 0.48, status: 'tumbuh' },
      { time: '13:30', od: 0.59, bio: 0.44, status: 'tumbuh' },
      { time: '13:00', od: 0.54, bio: 0.40, status: 'tumbuh' },
      { time: '12:30', od: 0.49, bio: 0.36, status: 'tumbuh' },
      { time: '12:00', od: 0.44, bio: 0.33, status: 'tumbuh' }
    ];
    notificationHistory = [
      { color: '#16a34a', text: 'Pengukuran OD = <strong>0.68</strong>. Kultur dalam fase tumbuh normal.', time: '14:30 WIB' },
      { color: '#16a34a', text: 'Pengukuran OD = <strong>0.59</strong>. Kultur dalam fase tumbuh normal.', time: '13:30 WIB' },
      { color: '#16a34a', text: 'Sistem Smart-Bior menyala. Koneksi berhasil.', time: 'Hari ini, 06:00 WIB' },
      { color: '#16a34a', text: 'Kalibrasi blanko (I₀) berhasil. Sistem siap mengukur.', time: 'Kemarin, 05:58 WIB' }
    ];
  } else if (mode === 'siap_panen') {
    // OD 1.0-1.5 - Siap panen
    od = 1.28;
    bio = 0.96;
    status = 'panen';
    history = [
      { time: '14:30', od: 1.28, bio: 0.96, status: 'panen' },
      { time: '14:00', od: 1.24, bio: 0.93, status: 'panen' },
      { time: '13:30', od: 1.18, bio: 0.89, status: 'panen' },
      { time: '13:00', od: 1.10, bio: 0.82, status: 'tumbuh' },
      { time: '12:30', od: 1.01, bio: 0.76, status: 'tumbuh' },
      { time: '12:00', od: 0.91, bio: 0.68, status: 'tumbuh' }
    ];
    notificationHistory = [
      { color: '#eab308', text: 'Spirulina memasuki <strong>zona siap panen</strong>. OD = <strong>1.28</strong>.', time: '14:30 WIB' },
      { color: '#eab308', text: 'OD mendekati zona panen (OD = <strong>1.18</strong>). Persiapkan pemanenan.', time: '13:30 WIB' },
      { color: '#16a34a', text: 'OD mencapai <strong>1.01</strong> - memasuki zona panen mulai.', time: '12:00 WIB' },
      { color: '#16a34a', text: 'Pengukuran OD = <strong>0.91</strong>. Kultur dalam fase tumbuh lanjut.', time: '11:00 WIB' }
    ];
  } else if (mode === 'bahaya') {
    // OD >= 1.5 - Bahaya
    od = 1.68;
    bio = 1.26;
    status = 'bahaya';
    history = [
      { time: '14:30', od: 1.68, bio: 1.26, status: 'bahaya' },
      { time: '14:00', od: 1.62, bio: 1.22, status: 'bahaya' },
      { time: '13:30', od: 1.54, bio: 1.16, status: 'bahaya' },
      { time: '13:00', od: 1.42, bio: 1.07, status: 'panen' },
      { time: '12:30', od: 1.28, bio: 0.96, status: 'panen' },
      { time: '12:00', od: 1.10, bio: 0.83, status: 'tumbuh' }
    ];
    notificationHistory = [
      { color: '#ef4444', text: '<strong style="color:#ef4444;">🚨 ALERT!</strong> OD mencapai <strong>1.68</strong> — melewati batas bahaya 1.5! Panen segera diperlukan untuk mencegah culture crash!', time: '14:30 WIB' },
      { color: '#ef4444', text: '<strong style="color:#ef4444;">⚠️ WARNING!</strong> OD sudah di <strong>1.54</strong>. Segera lakukan pemanenan!', time: '13:30 WIB' },
      { color: '#eab308', text: 'Spirulina memasuki <strong>zona siap panen</strong>. OD = <strong>1.42</strong>.', time: '13:00 WIB' },
      { color: '#16a34a', text: 'Sistem Smart-Bior menyala. Koneksi berhasil.', time: 'Hari ini, 06:00 WIB' }
    ];
  }
  
  // Update chart dengan progression
  const chartProgression = {
    belum_panen: [0.20, 0.22, 0.25, 0.28, 0.31, 0.35, 0.40, 0.44, 0.49, 0.54, 0.59, 0.64, 0.68],
    siap_panen: [0.41, 0.47, 0.55, 0.67, 0.76, 0.87, 0.99, 1.05, 1.10, 1.18, 1.24, 1.28],
    bahaya: [0.41, 0.47, 0.55, 0.67, 0.76, 0.87, 0.99, 1.05, 1.10, 1.22, 1.35, 1.48, 1.62, 1.68]
  };
  
  chartLabels = chartLabels.slice(-chartProgression[mode].length);
  chartOD = chartProgression[mode];
  
  prevOD = od;
  updateStats(od, bio, status);
  updateGauge(od);
  updateAlert(od, status);
  updateSpectral(FALLBACK.spectral);
  renderHistory(history);
  renderNotifications(notificationHistory);
  updateChart();
  
  console.log(`[Simulasi] Mode: ${mode}, OD: ${od.toFixed(2)}`);
}

// ═══════════════════════════════════════════════════════════════════════
// INITIALIZATION ON DOM READY
// ═══════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // Initialize clock
  renderClock();
  setInterval(renderClock, 1000);

  // Initialize chart
  initChart();

  // Set default mode to REAL
  switchMode('real');

  // Connect to Firebase (fallback jika config belum ada)
  initFirebase();
});
