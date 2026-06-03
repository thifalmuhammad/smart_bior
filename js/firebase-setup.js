/**
 * FIREBASE INTEGRATION GUIDE
 * ============================
 * File ini menunjukkan cara mengintegrasikan Firebase dengan dashboard
 * 
 * LANGKAH SETUP:
 * 1. Buka Firebase Console: https://console.firebase.google.com/
 * 2. Buat project baru atau gunakan yang sudah ada
 * 3. Buat Realtime Database
 * 4. Copy config dari Project Settings
 * 5. Paste credentials di bawah
 * 6. Uncomment code Firebase di file ini
 * 7. Include Firebase libraries di HTML
 */

// ==================== FIREBASE CONFIG ====================
// TODO: Ganti dengan credentials dari Firebase Console Anda
const firebaseConfig = {
    apiKey: "AIzaSyD_YOUR_API_KEY_HERE",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// ==================== FIREBASE INITIALIZATION ====================
/**
 * Uncomment code di bawah setelah memasukkan credentials
 * 
 * 1. Tambahkan di HTML sebelum <script src="js/script.js"></script>:
 * 
 *    <script src="https://www.gstatic.com/firebaseapp/10.0.0/firebase-app-compat.min.js"></script>
 *    <script src="https://www.gstatic.com/firebaseapp/10.0.0/firebase-database-compat.min.js"></script>
 * 
 * 2. Uncomment code di bawah:
 */

// // Initialize Firebase
// firebase.initializeApp(firebaseConfig);
// const database = firebase.database();

// ==================== RECEIVE DATA FROM ESP32 ====================
/**
 * Fungsi untuk mendengarkan data dari ESP32 yang dikirim ke Firebase
 * 
 * ESP32 harus mengirim data dengan struktur JSON seperti ini:
 * {
 *   "temperature": 28.5,
 *   "humidity": 65.2,
 *   "pH": 7.1,
 *   "turbidity": 4.2,
 *   "timestamp": 1683000000000
 * }
 */

// function listenToESP32Data() {
//     // Mendengarkan data real-time dari path 'bioreactor'
//     database.ref('bioreactor').on('value', (snapshot) => {
//         const data = snapshot.val();
        
//         if (data) {
//             // Format data dari Firebase
//             const newData = {
//                 timestamp: new Date(data.timestamp || Date.now()),
//                 temperature: data.temperature || 0,
//                 humidity: data.humidity || 0,
//                 pH: data.pH || 0,
//                 turbidity: data.turbidity || 0
//             };
            
//             // Process data (update UI, chart, dll)
//             processNewData(newData);
//         }
//     }, (error) => {
//         console.error('Error reading from Firebase:', error);
//         state.isConnected = false;
//         updateConnectionIndicator(false);
//     });
// }

// ==================== SEND TEST DATA TO FIREBASE ====================
/**
 * Fungsi untuk mengirim test data ke Firebase
 * Berguna untuk testing sebelum ESP32 siap
 */

// function sendTestDataToFirebase() {
//     const testData = {
//         temperature: 28.5 + Math.random() * 2,
//         humidity: 65 + Math.random() * 10,
//         pH: 7.0 + (Math.random() - 0.5) * 0.5,
//         turbidity: 5 + Math.random() * 3,
//         timestamp: Date.now()
//     };
    
//     database.ref('bioreactor').set(testData)
//         .then(() => {
//             console.log('✓ Test data sent to Firebase');
//         })
//         .catch((error) => {
//             console.error('Error sending data:', error);
//         });
// }

// ==================== REPLACE SIMULATION WITH FIREBASE ====================
/**
 * Untuk menghubungkan dengan Firebase, ganti function simulateData()
 * di script.js dengan:
 * 
 * function simulateData() {
 *     if (!state.isConnected) return;
 *     // Data sudah di-listen via Firebase
 *     // Tidak perlu di-generate, tinggal tunggu ESP32 kirim
 * }
 */

// ==================== FIREBASE SECURITY RULES ====================
/**
 * PENTING: Setup Security Rules di Firebase Console
 * 
 * Rules yang cocok untuk test/development:
 * 
 * {
 *   "rules": {
 *     "bioreactor": {
 *       ".read": true,
 *       ".write": true
 *     }
 *   }
 * }
 * 
 * JANGAN GUNAKAN INI DI PRODUCTION!
 * 
 * Untuk production, gunakan rules yang lebih aman:
 * {
 *   "rules": {
 *     "bioreactor": {
 *       ".read": "auth != null",
 *       ".write": "auth.uid === 'esp32-device-id'"
 *     }
 *   }
 * }
 */

// ==================== CONTOH ESP32 CODE ====================
/**
 * Contoh kode Arduino untuk mengirim data ke Firebase:
 * 
 * #include <Firebase_ESP_Client.h>
 * #include "addons/TokenHelper.h"
 * #include "addons/RTDBHelper.h"
 * 
 * // Firebase config
 * #define API_KEY "YOUR_API_KEY"
 * #define DATABASE_URL "YOUR_DATABASE_URL"
 * #define USER_EMAIL "your@email.com"
 * #define USER_PASSWORD "password"
 * 
 * FirebaseData fbdo;
 * FirebaseAuth auth;
 * FirebaseConfig config;
 * 
 * void setup() {
 *     Serial.begin(115200);
 *     WiFi.begin("SSID", "PASSWORD");
 *     
 *     // Config Firebase
 *     config.api_key = API_KEY;
 *     config.database_url = DATABASE_URL;
 *     config.token_status_callback = tokenStatusCallback;
 *     
 *     Firebase.begin(&config, &auth);
 * }
 * 
 * void loop() {
 *     // Baca sensor
 *     float temp = readTemperature();
 *     float humidity = readHumidity();
 *     float pH = readPH();
 *     float turbidity = readTurbidity();
 *     
 *     // Kirim ke Firebase
 *     if (Firebase.ready() && signupOK) {
 *         Firebase.RTDB.setFloat(&fbdo, "bioreactor/temperature", temp);
 *         Firebase.RTDB.setFloat(&fbdo, "bioreactor/humidity", humidity);
 *         Firebase.RTDB.setFloat(&fbdo, "bioreactor/pH", pH);
 *         Firebase.RTDB.setFloat(&fbdo, "bioreactor/turbidity", turbidity);
 *         Firebase.RTDB.setInt(&fbdo, "bioreactor/timestamp", millis());
 *     }
 *     
 *     delay(2000); // Update setiap 2 detik
 * }
 */

// ==================== DEBUGGING FIREBASE ====================
/**
 * Buka Console di Browser (F12) dan jalankan command ini:
 */

// // Cek apakah Firebase sudah loaded
// console.log(firebase);

// // Cek koneksi ke database
// firebase.database().ref('.info/connected').on('value', (snapshot) => {
//     if (snapshot.val() === true) {
//         console.log('✓ Connected to Firebase');
//     } else {
//         console.log('✗ Disconnected from Firebase');
//     }
// });

// // Lihat semua data di 'bioreactor' path
// firebase.database().ref('bioreactor').once('value', (snapshot) => {
//     console.log('Bioreactor data:', snapshot.val());
// });

// ==================== HELPFUL LINKS ====================
/**
 * Dokumentasi resmi:
 * - Firebase Console: https://console.firebase.google.com/
 * - Firebase Realtime Database Docs: https://firebase.google.com/docs/database
 * - Firebase Web Setup: https://firebase.google.com/docs/web/setup
 * 
 * Tutorials:
 * - Realtime Database Guide: https://firebase.google.com/docs/database/start
 * - Security Rules: https://firebase.google.com/docs/database/security
 * 
 * ESP32 Libraries:
 * - Firebase Arduino Library: https://github.com/mobizt/Firebase-ESP-Client
 * - Arduino Core for ESP32: https://github.com/espressif/arduino-esp32
 */

console.log('📚 Firebase Integration Guide Loaded');
console.log('Next: Add your Firebase credentials and uncomment the code above');
