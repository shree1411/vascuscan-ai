/*
 * ==============================================================================
 * VASCUSCAN AI - ESP32 BIOMEDICAL STREAMING FIRMWARE
 * ==============================================================================
 * 
 * DESCRIPTION:
 * High-performance, real-time biomedical sensor firmware for ESP32.
 * Connects to AD8232 (ECG) and MAX30102 (PPG) sensors to stream synchronous
 * physiological data over Serial (115200 baud) using standard JSON formats.
 * 
 * FEATURES:
 * - Real-time ECG Leads-Off Detection
 * - MAX30102 Auto-Reconnection & Initialization
 * - Live Finger Detection via IR threshold
 * - 10Hz (100ms) synchronous JSON telemetry stream
 * - Optimized non-blocking execution loop
 * 
 * DEPENDENCIES:
 * - SparkFun MAX3010x Pulse and Proximity Sensor Library
 * 
 * ==============================================================================
 */

#include <Wire.h>
#include "MAX30105.h" // Works for MAX30102 as well

// ------------------------------------------------------------------------------
// HARDWARE PIN DEFINITIONS
// ------------------------------------------------------------------------------
#define ECG_OUTPUT_PIN    34  // Analog pin for ECG signal
#define ECG_LO_PLUS_PIN   32  // Leads-Off Detection (+)
#define ECG_LO_MINUS_PIN  33  // Leads-Off Detection (-)

// ------------------------------------------------------------------------------
// SENSOR OBJECTS & STATE VARIABLES
// ------------------------------------------------------------------------------
MAX30105 particleSensor;

unsigned long lastStreamTime = 0;
const unsigned long STREAM_INTERVAL_MS = 100; // 100ms interval (10 Hz)

// State Tracking
bool ecg_connected = false;
bool ppg_connected = false;
bool finger_detected = false;

// Previous states for debug logging
bool prev_ecg_connected = false;
bool prev_ppg_connected = false;
bool prev_finger_detected = false;

// ------------------------------------------------------------------------------
// SETUP
// ------------------------------------------------------------------------------
void setup() {
  // Initialize Serial at specified stable baud rate
  Serial.begin(115200);
  while (!Serial); 
  
  Serial.println("[SYSTEM] Booting VascuScan AI Sensor Firmware...");

  // Configure ECG Pins
  pinMode(ECG_LO_PLUS_PIN, INPUT);
  pinMode(ECG_LO_MINUS_PIN, INPUT);
  pinMode(ECG_OUTPUT_PIN, INPUT);

  // Initialize I2C and MAX30102
  Wire.begin();
  
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("[ERROR] MAX30102 PPG sensor not found. Check I2C wiring.");
    ppg_connected = false;
  } else {
    Serial.println("[SYSTEM] MAX30102 PPG sensor initialized successfully.");
    
    // Configure sensor with default biomedical settings
    // ledBrightness=0x1F, sampleAverage=4, ledMode=2 (Red+IR), sampleRate=400, pulseWidth=411, adcRange=4096
    particleSensor.setup(60, 4, 2, 400, 411, 4096); 
    ppg_connected = true;
  }
  
  Serial.println("[SYSTEM] Initialization Complete. Starting real-time stream...");
}

// ------------------------------------------------------------------------------
// MAIN LOOP
// ------------------------------------------------------------------------------
void loop() {
  unsigned long currentTime = millis();
  
  // Non-blocking timer for 100ms intervals
  if (currentTime - lastStreamTime >= STREAM_INTERVAL_MS) {
    lastStreamTime = currentTime;
    
    // -----------------------------------------------------
    // 1. ECG CONNECTION & DATA ACQUISITION
    // -----------------------------------------------------
    // The AD8232 pulls LO+ or LO- HIGH when leads are disconnected
    if ((digitalRead(ECG_LO_PLUS_PIN) == 1) || (digitalRead(ECG_LO_MINUS_PIN) == 1)) {
      ecg_connected = false;
    } else {
      ecg_connected = true;
    }
    
    int ecg_value = 0;
    if (ecg_connected) {
      ecg_value = analogRead(ECG_OUTPUT_PIN);
    }

    // -----------------------------------------------------
    // 2. PPG CONNECTION, RECOVERY & DATA ACQUISITION
    // -----------------------------------------------------
    long ppg_red = 0;
    long ppg_ir = 0;
    
    if (ppg_connected) {
      ppg_ir = particleSensor.getIR();
      ppg_red = particleSensor.getRed();
      
      // If values drop exactly to 0 abruptly, I2C might have crashed/disconnected
      if (ppg_ir == 0 && ppg_red == 0) {
        ppg_connected = false; // Mark as offline to trigger reconnect
      } else {
        // Evaluate live finger detection based on IR threshold
        finger_detected = (ppg_ir > 50000);
      }
    } else {
      // Robust reconnection handler
      if (particleSensor.begin(Wire, I2C_SPEED_FAST)) {
        particleSensor.setup(60, 4, 2, 400, 411, 4096);
        ppg_connected = true;
        Serial.println("[RECOVERY] MAX30102 PPG sensor reconnected successfully.");
      }
      finger_detected = false;
    }

    // -----------------------------------------------------
    // 3. DEBUG STATE LOGGING
    // -----------------------------------------------------
    if (ecg_connected != prev_ecg_connected) {
      Serial.print("[STATE] ECG Sensor: ");
      Serial.println(ecg_connected ? "ONLINE" : "OFFLINE");
      prev_ecg_connected = ecg_connected;
    }
    
    if (ppg_connected != prev_ppg_connected) {
      Serial.print("[STATE] PPG Sensor: ");
      Serial.println(ppg_connected ? "ONLINE" : "OFFLINE");
      prev_ppg_connected = ppg_connected;
    }
    
    if (finger_detected != prev_finger_detected) {
      Serial.print("[STATE] Patient Finger: ");
      Serial.println(finger_detected ? "DETECTED" : "REMOVED");
      prev_finger_detected = finger_detected;
    }

    // -----------------------------------------------------
    // 4. JSON TELEMETRY SERIALIZATION
    // -----------------------------------------------------
    // Constructing manual JSON for high-performance, low-overhead streaming
    
    Serial.print("{");
    
    Serial.print("\"ecg_connected\":");
    Serial.print(ecg_connected ? "true" : "false");
    Serial.print(",");
    
    Serial.print("\"ppg_connected\":");
    Serial.print(ppg_connected ? "true" : "false");
    Serial.print(",");
    
    Serial.print("\"finger_detected\":");
    Serial.print(finger_detected ? "true" : "false");
    Serial.print(",");
    
    Serial.print("\"ecg\":");
    Serial.print(ecg_value);
    Serial.print(",");
    
    Serial.print("\"ppg\":");
    Serial.print(ppg_red);
    Serial.print(",");
    
    Serial.print("\"ir\":");
    Serial.print(ppg_ir);
    Serial.print(",");
    
    Serial.print("\"timestamp\":");
    Serial.print(currentTime);
    
    Serial.println("}");
  }
}
