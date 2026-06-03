# 🚀 QUICK START - Smart BioReactor Dashboard

## Mulai dalam 30 Detik!

### 1️⃣ Buka Website
```
Double-click file: index.html
atau
Buka di VS Code: right-click → Open with Live Server
```

### 2️⃣ Jalankan Simulasi
Klik tombol: **▶️ Mulai Simulasi**

### 3️⃣ Lihat Data Real-time
Selesai! Dashboard menampilkan sensor data dengan update setiap 2 detik.

---

## 📂 File Structure

```
Website/
├── 📄 index.html                  ← Buka ini di browser
├── 📁 css/
│   └── styles.css                 ← Styling dashboard
├── 📁 js/
│   ├── script.js                  ← Logic utama (edit di sini)
│   └── firebase-setup.js          ← Firebase integration guide
├── 📄 README.md                   ← Dokumentasi lengkap
├── 📄 SETUP-CHECKLIST.md          ← Step-by-step setup
├── 📄 DATA-STRUCTURE.md           ← Firebase data format
└── 📄 QUICK-START.md              ← File ini
```

---

## ⚙️ Kontrol Website

| Tombol | Fungsi |
|--------|--------|
| 🔌 Sambungkan Firebase | Persiapan koneksi ke Firebase |
| ▶️ Mulai Simulasi | Mulai generate dummy data |
| ⏹️ Hentikan Simulasi | Hentikan update data |
| 🗑️ Hapus Data | Clear semua history data |

---

## ⌨️ Keyboard Shortcuts

```
Ctrl + Shift + S  →  Start Simulation
Ctrl + Shift + E  →  Stop Simulation
```

---

## 🧪 Test Features

✅ **Sensor Cards**
- Tampilkan nilai real-time
- Status indicator (Optimal/Warning/Abnormal)
- Min/Max values
- Sparkline chart

✅ **Data Logger**
- Tabel dengan 10 data terbaru
- Timestamp otomatis
- Sortable & scrollable

✅ **System Status**
- Connection status
- Update count
- Last update time

✅ **Local Storage**
- Auto-save data
- Persist after browser close
- View: `F12 → Console → JSON.parse(localStorage.getItem('sensorHistory'))`

---

## 🔗 3 Langkah Setup Firebase

### Step 1: Firebase Console
```
https://console.firebase.google.com/
→ Buat project baru
→ Buat Realtime Database
→ Copy credentials
```

### Step 2: Update Website
Buka file: `js/script.js`

Cari bagian:
```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    // ... isi dengan credentials Firebase Anda
};
```

### Step 3: Add Firebase Library
Di `index.html`, tambahkan sebelum `<script src="js/script.js">`:

```html
<script src="https://www.gstatic.com/firebaseapp/10.0.0/firebase-app-compat.min.js"></script>
<script src="https://www.gstatic.com/firebaseapp/10.0.0/firebase-database-compat.min.js"></script>
```

---

## 📊 Sensor Data Format

Website mengharapkan data dalam format JSON:

```javascript
{
  "temperature": 28.5,      // °C
  "humidity": 65.2,         // %
  "pH": 7.1,               // 0-14
  "turbidity": 4.2,        // NTU
  "timestamp": 1683000000  // Unix timestamp
}
```

---

## 🛠️ Customize Website

### 1. Ubah Warna Theme
File: `css/styles.css`
```css
:root {
    --primary-color: #667eea;      /* Ubah warna utama */
    --secondary-color: #764ba2;    /* Ubah warna secondary */
    --success-color: #48bb78;      /* Ubah warna sukses */
    --danger-color: #f56565;       /* Ubah warna error */
}
```

### 2. Ubah Update Interval
File: `js/script.js`
```javascript
const CONFIG = {
    UPDATE_INTERVAL: 2000, // Ubah ke 1000 untuk lebih cepat
};
```

### 3. Ubah Sensor Range
File: `js/script.js`
```javascript
const CONFIG = {
    SENSOR_RANGES: {
        temperature: { min: 20, max: 40, ideal: [25, 35] },
        humidity: { min: 30, max: 90, ideal: [60, 80] },
        pH: { min: 4, max: 10, ideal: [6.5, 7.5] },
        turbidity: { min: 0, max: 100, ideal: [0, 10] }
    }
};
```

---

## 🐛 Common Issues & Solutions

### ❌ Data tidak muncul
1. Klik "▶️ Mulai Simulasi"
2. F12 → Console, cek error
3. Refresh page (Ctrl+F5)

### ❌ Firebase tidak connect
1. Cek credentials sudah diisi
2. Cek Firebase Security Rules
3. Check network tab (F12)

### ❌ Performance lambat
1. Clear localStorage: `localStorage.clear()`
2. Reduce UPDATE_INTERVAL
3. Close other browser tabs

---

## 📋 Next Steps

1. **Test dengan simulasi** ✓ (Sekarang)
2. **Setup Firebase** (Lihat SETUP-CHECKLIST.md)
3. **Setup ESP32** (Lihat DATA-STRUCTURE.md)
4. **Deploy website** (GitHub Pages / Netlify / Firebase)

---

## 📚 Resources

| Resource | Link |
|----------|------|
| Firebase Docs | https://firebase.google.com/docs |
| JavaScript | https://developer.mozilla.org/en-US/docs/Web/JavaScript |
| CSS | https://developer.mozilla.org/en-US/docs/Web/CSS |
| ESP32 Docs | https://docs.espressif.com/projects/esp-idf |

---

## 💡 Tips & Tricks

**💾 Auto-save Data**
- Dashboard otomatis save ke localStorage
- Data tetap ada meskipun browser tutup

**📊 View All Data**
```javascript
// Di Console (F12)
console.log(JSON.parse(localStorage.getItem('sensorHistory')));
```

**🔄 Reset Everything**
```javascript
// Di Console (F12)
localStorage.clear(); location.reload();
```

**⏱️ Check Uptime**
```javascript
// Di Console (F12)
console.log('Uptime:', new Date(Date.now() - state.dataHistory[0].timestamp));
```

---

## 🎯 Checklist Sebelum Deploy

- [ ] Website berjalan dengan simulasi ✓
- [ ] Semua tombol berfungsi ✓
- [ ] Responsive di mobile ✓
- [ ] Keyboard shortcuts bekerja ✓
- [ ] Data tersimpan di localStorage ✓
- [ ] Firebase credentials sudah diisi (optional)
- [ ] Security rules sudah setup (optional)
- [ ] ESP32 code siap (optional)

---

## 📞 Bantuan

**Error di Console?**
- F12 → Console → Lihat error message
- Google error message
- Copy-paste di StackOverflow

**Website rusak?**
- Refresh: Ctrl+F5
- Clear cache: Ctrl+Shift+Delete
- Reopen: Close & open browser lagi

**Performance issues?**
- Close other tabs
- Reduce update interval
- Clear localStorage
- Check network (F12 → Network)

---

## 🎉 Selesai!

Website Anda sudah ready untuk:
- ✅ Display real-time sensor data
- ✅ Store data locally
- ✅ Connect to Firebase
- ✅ Visualize trends
- ✅ Export history

**Sekarang tinggal connect ke Firebase & ESP32!**

---

**Version**: 1.0 | **Status**: Production Ready (Simulasi) | **Last Update**: 2026-05-07

**Happy Monitoring! 🚀📊**
