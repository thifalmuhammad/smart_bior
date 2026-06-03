# 🔬 Smart BioReactor Dashboard - Real-time Monitoring

Website untuk menampilkan data sensor bioreaktor secara real-time. Dilengkapi dengan simulasi data dummy dan siap diintegrasikan dengan Firebase Realtime Database dari ESP32.

## 📋 Fitur Utama

✅ **Dashboard Modern** - Interface yang menarik dan responsif  
✅ **Data Sensor Real-time** - Tampilkan suhu, kelembaban, pH, kekeruhan  
✅ **Simulasi Data** - Generate dummy data untuk testing  
✅ **Grafik Sparkline** - Visualisasi trend data  
✅ **Data Logger** - Catat history data sensor  
✅ **Local Storage** - Simpan data di browser  
✅ **Firebase Ready** - Siap integrasi dengan Firebase Database  
✅ **Responsive Design** - Bekerja di desktop & mobile  

## 📁 Struktur File

```
Website/
├── index.html              # Halaman utama
├── css/
│   └── styles.css         # Styling dashboard
├── js/
│   └── script.js          # Logic JavaScript & dummy data
├── README.md              # File ini
└── smart_bior_dashboard.jpg  # Background image (optional)
```

## 🚀 Cara Menggunakan

### 1. **Buka Website**
Buka file `index.html` di browser:
```
Double-click index.html
atau
Buka file melalui VS Code Live Server
```

### 2. **Jalankan Simulasi**
- Klik tombol **"▶️ Mulai Simulasi"** untuk mulai generate data dummy
- Data akan di-update setiap 2 detik
- Lihat real-time chart, status, dan data log

### 3. **Kontrol Website**
- **🔌 Sambungkan Firebase** - Persiapan untuk koneksi Firebase
- **▶️ Mulai Simulasi** - Generate data dummy
- **⏹️ Hentikan Simulasi** - Hentikan update data
- **🗑️ Hapus Data** - Clear semua data history

### 4. **Keyboard Shortcuts**
```
Ctrl + Shift + S  →  Start Simulation
Ctrl + Shift + E  →  Stop Simulation
```

## 📊 Sensor yang Ditampilkan

| Sensor | Unit | Range Ideal | Tipe |
|--------|------|-------------|------|
| Suhu | °C | 25-35 | Temperature |
| Kelembaban | % | 60-80 | Humidity |
| pH | pH | 6.5-7.5 | Acidity |
| Kekeruhan | NTU | 0-10 | Turbidity |

## 🔧 Cara Integrasi dengan Firebase

### Step 1: Setup Firebase Project
1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Buat project baru
3. Pilih "Realtime Database"
4. Copy `firebaseConfig` Anda

### Step 2: Update Credentials
Buka file `js/script.js` dan cari bagian:
```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

Ganti dengan credentials Anda dari Firebase Console.

### Step 3: Import Firebase Library
Tambahkan di atas `<script src="js/script.js"></script>` dalam `index.html`:
```html
<!-- Firebase -->
<script src="https://www.gstatic.com/firebaseapp/10.0.0/firebase-app-compat.min.js"></script>
<script src="https://www.gstatic.com/firebaseapp/10.0.0/firebase-database-compat.min.js"></script>
```

### Step 4: Update JavaScript untuk Firebase
Di `js/script.js`, ubah bagian `connectToFirebase()` menjadi:
```javascript
function connectToFirebase() {
    if (!firebaseConfig.apiKey) {
        alert('Firebase config tidak lengkap!');
        return false;
    }

    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    // Listen to data changes
    db.ref('bioreactor').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            const newData = {
                timestamp: new Date(data.timestamp),
                temperature: data.temperature,
                humidity: data.humidity,
                pH: data.pH,
                turbidity: data.turbidity
            };
            processNewData(newData);
        }
    });

    state.isConnected = true;
    updateConnectionIndicator(true);
    return true;
}
```

### Step 5: Konfigurasi ESP32
Di ESP32, kirim data dengan format JSON ke Firebase:
```cpp
// ESP32 Code Example (Arduino)
#include <Firebase_ESP_Client.h>

void sendToFirebase(float temp, float humidity, float pH, float turbidity) {
    FirebaseJson json;
    json.set("temperature", temp);
    json.set("humidity", humidity);
    json.set("pH", pH);
    json.set("turbidity", turbidity);
    json.set("timestamp", millis());
    
    Firebase.RTDB.setJSON(&config, "bioreactor/current", &json);
}
```

## 💾 Local Storage

Website menggunakan **LocalStorage** untuk menyimpan data:
- Data history disimpan otomatis setiap kali ada update
- Data akan tetap ada meskipun browser ditutup
- Kapasitas: ~5-10MB (tergantung browser)

Untuk lihat data di Console Browser:
```javascript
// Di Console Browser (F12 → Console)
JSON.parse(localStorage.getItem('sensorHistory'))
```

## 📈 Dummy Data Generator

Data dummy di-generate menggunakan **Random Walk Algorithm**:
- Setiap value bergerak smooth dari value sebelumnya
- Tetap dalam range ideal sensor
- Terkadang ada anomali untuk simulasi kondisi abnormal

Ubah parameter di `CONFIG.SENSOR_RANGES` untuk custom range.

## 🎨 Customization

### Mengubah Interval Update
Di `js/script.js`:
```javascript
const CONFIG = {
    UPDATE_INTERVAL: 2000, // milliseconds (ubah ke 1000 untuk lebih cepat)
    // ...
};
```

### Mengubah Warna Theme
Di `css/styles.css`:
```css
:root {
    --primary-color: #667eea;      /* Warna utama */
    --secondary-color: #764ba2;    /* Warna sekunder */
    --success-color: #48bb78;      /* Warna sukses */
    /* ... */
}
```

### Menambah Sensor Baru
1. Tambah card di `index.html`
2. Tambah config di `CONFIG.SENSOR_RANGES`
3. Tambah property di dummy data generator
4. Update `processNewData()` untuk update UI

## 🐛 Troubleshooting

### Data tidak muncul
- Klik "▶️ Mulai Simulasi"
- Check Console (F12) untuk error messages
- Clear localStorage: `localStorage.clear()`

### Firebase tidak terkoneksi
- Pastikan Firebase credentials sudah benar
- Check CORS settings di Firebase
- Buka Console (F12) untuk lihat error detail

### Website lambat
- Kurangi `UPDATE_INTERVAL` bisa buat CPU usage tinggi
- Clear data history: klik "🗑️ Hapus Data"
- Disable animations di CSS jika perlu

## 📞 Developer Notes

- **Browser Compatibility**: Chrome, Firefox, Safari, Edge (modern versions)
- **Dependencies**: Hanya HTML5, CSS3, JavaScript (vanilla)
- **Firebase**: Opsional (untuk mode real-time)
- **Database**: LocalStorage (built-in) + Firebase (optional)

## 🔐 Security Notes

- **Jangan expose Firebase credentials di client-side**
- Gunakan Firebase Security Rules untuk protect data
- Implementasikan authentication jika diperlukan
- Test di environment lokal dulu sebelum production

## 📝 TODO (Fitur Mendatang)

- [ ] Integrasi penuh Firebase
- [ ] Export data ke CSV
- [ ] Dark/Light mode toggle
- [ ] Alerts & Notifications
- [ ] Historical graph dengan Chart.js
- [ ] Mobile app dengan React Native
- [ ] Data backup otomatis

## 📄 License

Free to use for educational and research purposes.

---

**Dibuat untuk**: UTS Ransin IPB  
**Status**: v1.0 - Development (Siap Testing)  
**Last Updated**: 2026-05-07
