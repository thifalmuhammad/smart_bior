// ==================== FIREBASE DATA STRUCTURE ====================
// 
// File ini menunjukkan struktur data yang diharapkan di Firebase
// Gunakan sebagai reference untuk setup database dan ESP32
//

// ==================== STRUKTUR DATABASE ====================
/*

Firebase Realtime Database Structure:

{
  "bioreactor": {
    "current": {
      "temperature": 28.5,
      "humidity": 65.2,
      "pH": 7.1,
      "turbidity": 4.2,
      "timestamp": 1683000000000
    },
    "history": [
      {
        "temperature": 28.3,
        "humidity": 65.0,
        "pH": 7.05,
        "turbidity": 4.1,
        "timestamp": 1682999998000
      },
      {
        "temperature": 28.7,
        "humidity": 65.4,
        "pH": 7.15,
        "turbidity": 4.3,
        "timestamp": 1682999996000
      }
      // ... more history data
    ],
    "metadata": {
      "device_id": "ESP32-001",
      "version": "1.0",
      "last_connection": 1683000000000,
      "status": "online"
    }
  }
}

*/

// ==================== EXPECTED DATA FORMAT ====================
/*

CURRENT DATA (Real-time)
========================

Path: /bioreactor/current

{
  "temperature": 28.5,          // Float: suhu dalam °C
  "humidity": 65.2,             // Float: kelembaban dalam %
  "pH": 7.1,                    // Float: nilai pH (0-14)
  "turbidity": 4.2,             // Float: kekeruhan dalam NTU
  "timestamp": 1683000000000    // Integer: Unix timestamp dalam ms
}

Range & Validasi:
- temperature: 0 - 50 °C (ideal: 25-35)
- humidity: 0 - 100 % (ideal: 60-80)
- pH: 0 - 14 (ideal: 6.5-7.5)
- turbidity: 0 - 1000 NTU (ideal: 0-10)
- timestamp: Current Unix timestamp


HISTORY DATA (Optional, untuk data logger)
===========================================

Path: /bioreactor/history/{date}/{hour}

[
  {
    "temperature": 28.5,
    "humidity": 65.2,
    "pH": 7.1,
    "turbidity": 4.2,
    "timestamp": 1683000000000
  },
  {
    "temperature": 28.6,
    "humidity": 65.3,
    "pH": 7.12,
    "turbidity": 4.25,
    "timestamp": 1683000002000
  }
]

Rekomendasi:
- Save history setiap jam (directory by date/hour)
- Keep last 30 days of history
- Archive older data ke separate storage


METADATA (Informasi Perangkat)
=============================

Path: /bioreactor/metadata

{
  "device_id": "ESP32-001",
  "device_name": "BioReactor Unit 1",
  "version": "1.0",
  "firmware_date": "2024-01-15",
  "last_connection": 1683000000000,
  "status": "online",
  "uptime_seconds": 864000,
  "ip_address": "192.168.1.100",
  "signal_strength": -45
}

*/

// ==================== CARA KIRIM DATA DARI ESP32 ====================
/*

OPSI 1: Update Current Data Only
==================================

Paling simple, kirim data latest aja:

void sendDataToFirebase() {
  Firebase.RTDB.setJSON(&fbdo, "bioreactor/current", {
    "temperature": readTemperature(),
    "humidity": readHumidity(),
    "pH": readPH(),
    "turbidity": readTurbidity(),
    "timestamp": millis()
  });
}

Kelebihan: Simple, realtime update
Kekurangan: Tidak ada history data


OPSI 2: Update Current + Add to History
========================================

Kirim current dan append ke history:

void sendDataToFirebase() {
  time_t now = time(nullptr);
  struct tm* timeinfo = localtime(&now);
  
  char datePath[50];
  strftime(datePath, sizeof(datePath), "bioreactor/history/%Y%m%d/%H", timeinfo);
  
  FirebaseJson json;
  json.set("temperature", readTemperature());
  json.set("humidity", readHumidity());
  json.set("pH", readPH());
  json.set("turbidity", readTurbidity());
  json.set("timestamp", now);
  
  // Update current
  Firebase.RTDB.setJSON(&fbdo, "bioreactor/current", &json);
  
  // Add to history
  Firebase.RTDB.push(&fbdo, datePath, &json);
}

Kelebihan: Ada history data, bisa analyze trends
Kekurangan: Lebih kompleks


OPSI 3: Batch Update dengan Metadata
=====================================

Update all data sekaligus dengan metadata:

void sendDataToFirebase() {
  time_t now = time(nullptr);
  
  FirebaseJson updateData;
  
  // Current readings
  updateData.set("bioreactor/current/temperature", readTemperature());
  updateData.set("bioreactor/current/humidity", readHumidity());
  updateData.set("bioreactor/current/pH", readPH());
  updateData.set("bioreactor/current/turbidity", readTurbidity());
  updateData.set("bioreactor/current/timestamp", now);
  
  // Metadata
  updateData.set("bioreactor/metadata/last_connection", now);
  updateData.set("bioreactor/metadata/status", "online");
  updateData.set("bioreactor/metadata/uptime_seconds", millis()/1000);
  
  Firebase.RTDB.updateNode(&fbdo, "/", &updateData);
}

Kelebihan: Atomic update, efficient
Kekurangan: Kompleks setup


REKOMENDASI:
============
Mulai dengan OPSI 1 (simple), nanti bisa upgrade ke OPSI 2/3

*/

// ==================== CONTOH FULL ESP32 CODE ====================
/*

#include <WiFi.h>
#include <Firebase_ESP_Client.h>

// WiFi credentials
#define WIFI_SSID "YOUR_SSID"
#define WIFI_PASSWORD "YOUR_PASSWORD"

// Firebase API Key
#define API_KEY "YOUR_API_KEY"
#define DATABASE_URL "https://your-project.firebaseio.com"
#define USER_EMAIL "your@email.com"
#define USER_PASSWORD "password"

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Sensor pins
#define TEMP_PIN 34
#define HUMIDITY_PIN 35
#define PH_PIN 32
#define TURBIDITY_PIN 33

// Function to read sensors (placeholder)
float readTemperature() {
  int raw = analogRead(TEMP_PIN);
  return 20.0 + (raw / 4095.0) * 20.0; // 20-40 °C
}

float readHumidity() {
  int raw = analogRead(HUMIDITY_PIN);
  return (raw / 4095.0) * 100.0; // 0-100%
}

float readPH() {
  int raw = analogRead(PH_PIN);
  return 4.0 + (raw / 4095.0) * 10.0; // 4-14
}

float readTurbidity() {
  int raw = analogRead(TURBIDITY_PIN);
  return (raw / 4095.0) * 100.0; // 0-100 NTU
}

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi: ");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println("\nWiFi connected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
  
  // Firebase config
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;
  
  auth.user.email = USER_EMAIL;
  auth.user.password = USER_PASSWORD;
  
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  Firebase.RTDB.setMaxRetry(&fbdo, 3);
}

void loop() {
  if (Firebase.ready()) {
    // Read sensors
    float temp = readTemperature();
    float humidity = readHumidity();
    float pH = readPH();
    float turbidity = readTurbidity();
    
    // Create JSON
    FirebaseJson json;
    json.set("temperature", temp);
    json.set("humidity", humidity);
    json.set("pH", pH);
    json.set("turbidity", turbidity);
    json.set("timestamp", millis());
    
    // Send to Firebase
    if (Firebase.RTDB.setJSON(&fbdo, "bioreactor/current", &json)) {
      Serial.println("✓ Data sent to Firebase");
      Serial.print("Temp: "); Serial.print(temp);
      Serial.print(" | Humidity: "); Serial.print(humidity);
      Serial.print(" | pH: "); Serial.print(pH);
      Serial.print(" | Turbidity: "); Serial.println(turbidity);
    } else {
      Serial.print("✗ Failed to send data: ");
      Serial.println(fbdo.errorReason());
    }
    
    // Update metadata
    Firebase.RTDB.setInt(&fbdo, "bioreactor/metadata/last_connection", millis());
  }
  
  delay(2000); // Update setiap 2 detik
}

void tokenStatusCallback(token_info_t info) {
  Serial.print("Token Status: ");
  Serial.println(info.status == token_status_ready ? "ready" : "not ready");
}

*/

// ==================== TESTING DATA ====================
/*

Jika ingin test manual di Firebase Console:

1. Buka Firebase Console
2. Pilih Realtime Database
3. Klik "+" untuk add data
4. Location: bioreactor/current
5. Paste JSON:

{
  "temperature": 28.5,
  "humidity": 65.2,
  "pH": 7.1,
  "turbidity": 4.2,
  "timestamp": 1683000000000
}

6. Klik Add
7. Lihat update di website dashboard

*/

// ==================== SECURITY BEST PRACTICES ====================
/*

1. JANGAN expose API keys di client-side code
   ✗ Buruk: const apiKey = "AIzaSyD_xxxx" di frontend
   ✓ Baik: Gunakan signed URLs atau backend proxy

2. Setup Security Rules yang ketat
   ✗ Buruk: ".read": true, ".write": true
   ✓ Baik: Auth-based atau IP-based restrictions

3. Use environment variables
   Simpan credentials di file .env (jangan commit ke git)

4. Implement rate limiting
   Jangan spam data update > 1000 requests/second

5. Validate data di backend
   Check range, type, format sebelum save

6. Monitor database usage
   Check Firebase Console untuk unusual patterns

*/

console.log('📊 Firebase Data Structure Reference Loaded');
console.log('Use this as guide for database setup and ESP32 integration');
