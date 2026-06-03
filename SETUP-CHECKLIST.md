# 📋 SETUP CHECKLIST - Smart BioReactor Dashboard

Ikuti checklist ini untuk setup website dengan sempurna!

---

## ✅ FASE 1: SETUP WEBSITE (SUDAH SELESAI)

- [x] Buat folder struktur (css/, js/)
- [x] Buat file index.html (dashboard UI)
- [x] Buat file css/styles.css (styling & responsif)
- [x] Buat file js/script.js (logic & dummy data)
- [x] Buat file README.md (dokumentasi)
- [x] Buat file js/firebase-setup.js (Firebase integration guide)

---

## ✅ FASE 2: TEST WEBSITE LOKAL

- [ ] Buka index.html di browser
- [ ] Klik tombol "▶️ Mulai Simulasi"
- [ ] Verifikasi data muncul di dashboard:
  - [ ] Nilai sensor tampil (temp, humidity, pH, turbidity)
  - [ ] Chart sparkline muncul
  - [ ] Data table terupdate
  - [ ] Status indicator berubah ke "Connected"
- [ ] Test semua tombol:
  - [ ] "🔌 Sambungkan Firebase" - Alert tampil
  - [ ] "⏹️ Hentikan Simulasi" - Data berhenti update
  - [ ] "🗑️ Hapus Data" - Semua data hilang
- [ ] Test keyboard shortcut:
  - [ ] Ctrl+Shift+S - Mulai simulasi
  - [ ] Ctrl+Shift+E - Hentikan simulasi
- [ ] Test responsif di mobile (F12 → Toggle Device Toolbar)

---

## 📋 FASE 3: SETUP FIREBASE (SIAP DIKERJAKAN)

### 3.1 Buat Firebase Project
- [ ] Kunjungi https://console.firebase.google.com/
- [ ] Login dengan Google account
- [ ] Klik "Create a new project"
- [ ] Isi nama project: `smart-bioreactor`
- [ ] Pilih region terdekat (misal: asia-southeast1)
- [ ] Klik "Create project"

### 3.2 Setup Realtime Database
- [ ] Di Firebase Console, pilih "Realtime Database"
- [ ] Klik "Create database"
- [ ] Pilih location (asia-southeast1)
- [ ] Pilih "Start in test mode" (untuk development)
- [ ] Klik "Enable"
- [ ] Copy URL database (contoh: `https://your-project.firebaseio.com`)

### 3.3 Ambil Firebase Credentials
- [ ] Di Firebase Console, klik ⚙️ Settings
- [ ] Pilih tab "Service Accounts"
- [ ] Klik "Generate new private key" (untuk backend) atau...
- [ ] Pilih tab "Project Settings" → pilih platform "Web"
- [ ] Copy `firebaseConfig` object

### 3.4 Update Website dengan Firebase
- [ ] Buka file `js/script.js`
- [ ] Cari bagian `const firebaseConfig = {...}`
- [ ] Ganti dengan credentials dari Firebase
- [ ] Uncomment section Firebase integration
- [ ] Di `index.html`, tambahkan Firebase libraries di atas `<script src="js/script.js">`

```html
<!-- Firebase -->
<script src="https://www.gstatic.com/firebaseapp/10.0.0/firebase-app-compat.min.js"></script>
<script src="https://www.gstatic.com/firebaseapp/10.0.0/firebase-database-compat.min.js"></script>
```

### 3.5 Setup Firebase Security Rules
- [ ] Di Firebase Console, pilih "Realtime Database"
- [ ] Klik tab "Rules"
- [ ] Ganti isi dengan:

```json
{
  "rules": {
    "bioreactor": {
      ".read": true,
      ".write": true
    }
  }
}
```

- [ ] Klik "Publish"

---

## 📝 FASE 4: SETUP ESP32 (UNTUK NANTI)

### 4.1 Install Arduino IDE & Library
- [ ] Download Arduino IDE dari arduino.cc
- [ ] Buka Arduino IDE → Preferences
- [ ] Additional Boards Manager URLs, tambahkan:
  ```
  https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
  ```
- [ ] Tools → Board Manager → Cari "esp32" → Install
- [ ] Tools → Manage Libraries → Cari "Firebase Arduino Client Library" → Install

### 4.2 Configure ESP32
- [ ] Hubungkan ESP32 ke komputer via USB
- [ ] Tools → Board → Pilih "ESP32 Dev Module"
- [ ] Tools → Port → Pilih COM port ESP32
- [ ] Upload sketch dengan Firebase integration (lihat contoh di README.md)

### 4.3 Test Koneksi
- [ ] Buka Serial Monitor (Tools → Serial Monitor)
- [ ] Set baud rate 115200
- [ ] Verifikasi ESP32 terhubung ke WiFi & Firebase
- [ ] Lihat data muncul di Firebase Console & Dashboard website

---

## 🧪 FASE 5: TESTING & DEBUGGING

### Test Website dengan Data Dummy
- [ ] Simulasi berjalan lancar
- [ ] Update interval 2 detik
- [ ] Data history simpan di localStorage
- [ ] Close & reopen browser → Data masih ada

### Test Website dengan Firebase
- [ ] Klik "🔌 Sambungkan Firebase"
- [ ] Lihat status berubah jadi "Connected"
- [ ] Tunggu data dari ESP32 (atau test data)
- [ ] Verifikasi update real-time

### Debugging Console (F12)
- [ ] Buka DevTools (F12)
- [ ] Check tab Console untuk error
- [ ] Jalankan command test:

```javascript
// Cek data di localStorage
console.log(JSON.parse(localStorage.getItem('sensorHistory')));

// Cek apakah Firebase connected
console.log(firebase.database().ref('.info/connected'));

// Cek data saat ini
console.log(state);
```

---

## 🚀 FASE 6: DEPLOYMENT (OPTIONAL)

Pilih salah satu opsi:

### Option A: Deploy ke GitHub Pages
- [ ] Push code ke GitHub
- [ ] Enable GitHub Pages di repository settings
- [ ] Website live di: `https://username.github.io/repo-name`

### Option B: Deploy ke Firebase Hosting
- [ ] Install Firebase CLI: `npm install -g firebase-tools`
- [ ] Login: `firebase login`
- [ ] Initialize: `firebase init hosting`
- [ ] Deploy: `firebase deploy`

### Option C: Deploy ke Netlify
- [ ] Push code ke GitHub
- [ ] Connect repository ke Netlify
- [ ] Auto-deploy setiap kali push

---

## 📞 TROUBLESHOOTING

### Problem: Data tidak muncul
**Solution:**
1. Pastikan simulasi sudah dimulai (tombol "▶️")
2. Check Console (F12) untuk error
3. Clear localStorage: `localStorage.clear()`
4. Reload halaman

### Problem: Firebase tidak connect
**Solution:**
1. Cek apakah credentials sudah diisi
2. Verifikasi Security Rules di Firebase
3. Check network tab (F12) untuk CORS error
4. Console: `firebase.database().ref('.info/connected').on('value', ...)`

### Problem: ESP32 tidak mengirim data
**Solution:**
1. Check ESP32 sudah punya WiFi credentials
2. Verify Firebase credentials di sketch
3. Lihat Serial Monitor untuk error message
4. Test manual send data dari Firebase Console

### Problem: Website loading lambat
**Solution:**
1. Check browser cache (Ctrl+Shift+Delete)
2. Disable animations di CSS (optional)
3. Kurangi DATA_HISTORY_LENGTH di script.js
4. Clear localStorage jika data terlalu banyak

---

## ✨ NEXT STEPS

Setelah setup selesai:

1. **Personalisasi Dashboard**
   - Ubah warna theme di css/styles.css
   - Tambah sensor baru sesuai kebutuhan
   - Custom landing page

2. **Implementasi Advanced Features**
   - Alert & notification system
   - Export data ke CSV/Excel
   - Historical data chart
   - Email alerts

3. **Security Hardening**
   - Implement Firebase authentication
   - Add API rate limiting
   - Setup data encryption

4. **Performance Optimization**
   - Implement data pagination
   - Add compression
   - Optimize chart rendering

---

## 📚 RESOURCES

- [Firebase Documentation](https://firebase.google.com/docs)
- [Arduino ESP32 Guide](https://docs.espressif.com/projects/arduino-esp32/en/latest/)
- [MDN Web Docs](https://developer.mozilla.org/)
- [Firebase Arduino Library](https://github.com/mobizt/Firebase-ESP-Client)

---

## 💬 SUPPORT

Jika ada pertanyaan atau masalah:
1. Check README.md untuk quick reference
2. Check console error (F12)
3. Test dengan dummy data dulu
4. Verify Firebase config & rules
5. Check internet connection

---

**Status**: ✅ Website Ready | ⏳ Firebase Setup Pending | ⏳ ESP32 Integration Pending

**Last Updated**: 2026-05-07

**Version**: 1.0 - Development
