# VASCUSCAN AI — Flask Backend

Python/Flask backend for the VASCUSCAN AI medical monitoring platform.
Provides REST API, WebSocket events, signal processing, and AI risk prediction.

---

## Overview

| Component        | Technology                        |
|-----------------|-----------------------------------|
| Web framework   | Flask 3.x                        |
| Database        | PostgreSQL (prod) / SQLite (dev) |
| ORM             | Flask-SQLAlchemy                  |
| Auth            | JWT (Flask-JWT-Extended)         |
| Real-time       | Flask-SocketIO                    |
| ML              | scikit-learn (Random Forest)     |
| Signal DSP      | NumPy + SciPy                    |
| Serial I/O      | pyserial (ESP32)                 |

---

## Quick Start

```bash
# 1. Navigate to backend
cd src/backend/python

# 2. Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate      # Linux/macOS
venv\Scripts\activate.bat     # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Generate synthetic dataset
python generate_dataset.py

# 5. Train the AI model
python train_model.py

# 6. Start the server
python main.py
```

The API will be available at `http://localhost:5000`.

---

## Environment Variables

| Variable        | Default                              | Description                            |
|----------------|--------------------------------------|----------------------------------------|
| `DATABASE_URL`  | `sqlite:///vascuscan.db`             | Database connection string             |
| `JWT_SECRET_KEY`| `vascuscan-jwt-secret-change-in-prod`| JWT signing key — **change in prod**   |
| `SECRET_KEY`    | `vascuscan-dev-secret-change-in-prod`| Flask session secret                   |
| `DEBUG`         | `false`                              | Enable Flask debug mode                |
| `PORT`          | `5000`                               | Server port                            |
| `FLASK_ENV`     | `development`                        | `development` / `production`           |
| `CORS_ORIGINS`  | `*`                                  | Allowed CORS origins                   |

Create a `.env` file in `src/backend/python/` to set these locally:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/vascuscan
JWT_SECRET_KEY=your-super-secret-key
SECRET_KEY=another-secret-key
DEBUG=true
```

---

## Generate Dataset

```bash
python generate_dataset.py
# Options:
python generate_dataset.py --samples 3200 --seed 99 --output data/custom.csv
```

Generates `data/cardio_dataset_1600.csv` with 1600 synthetic patient samples.
Risk labels are derived from weighted clinical scoring (hypertension, diabetes, lipids, ECG HRV, etc.).

---

## Train AI Model

```bash
python train_model.py
# Use custom dataset:
python train_model.py --dataset data/custom.csv
```

Saves the trained Random Forest model to `models/model.pkl` and metadata to `models/model_metadata.json`.
The API automatically uses this model once it exists; falls back to rule-based scoring otherwise.

---

## API Endpoints

### Authentication

| Method | Path                  | Auth | Description              |
|--------|-----------------------|------|--------------------------|
| POST   | `/api/auth/register`  | —    | Register new user        |
| POST   | `/api/auth/login`     | —    | Login, get JWT token     |
| GET    | `/api/auth/me`        | JWT  | Get current user info    |

### Patients

| Method | Path                                      | Auth | Description                      |
|--------|-------------------------------------------|------|----------------------------------|
| GET    | `/api/patients`                           | JWT  | List all patients                |
| POST   | `/api/patients`                           | JWT  | Create patient + medical history |
| GET    | `/api/patients/<patient_id>`              | JWT  | Get patient details              |
| PUT    | `/api/patients/<patient_id>`              | JWT  | Update patient                   |
| DELETE | `/api/patients/<patient_id>`              | JWT  | Delete patient (admin only)      |

### Vitals

| Method | Path                                        | Auth | Description           |
|--------|---------------------------------------------|------|-----------------------|
| POST   | `/api/patients/<patient_id>/vitals`         | JWT  | Save vital signs      |
| GET    | `/api/patients/<patient_id>/vitals`         | JWT  | Get latest vitals     |

### Sensor

| Method | Path                      | Auth | Description                        |
|--------|---------------------------|------|------------------------------------|
| POST   | `/api/sensor/data`        | JWT  | Ingest raw ECG/PPG, extract features|
| POST   | `/api/sensors/configure`  | JWT  | Configure sensor connection        |
| GET    | `/api/sensor/status`      | —    | Get sensor connection status       |

### Risk Assessment

| Method | Path                                          | Auth | Description                   |
|--------|-----------------------------------------------|------|-------------------------------|
| POST   | `/api/patients/<patient_id>/predict`          | JWT  | Run AI risk prediction        |
| GET    | `/api/patients/<patient_id>/risk-history`     | JWT  | Get past risk assessments     |

### Scan Sessions

| Method | Path                                      | Auth | Description             |
|--------|-------------------------------------------|------|-------------------------|
| POST   | `/api/scans/start`                        | JWT  | Start a scan session    |
| POST   | `/api/scans/<session_id>/stop`            | JWT  | Stop a scan session     |
| GET    | `/api/patients/<patient_id>/scans`        | JWT  | List patient scans      |

### History

| Method | Path                                       | Auth | Description                       |
|--------|--------------------------------------------|------|-----------------------------------|
| GET    | `/api/history`                             | JWT  | All scan sessions + risk data     |
| GET    | `/api/patients/<patient_id>/history`       | JWT  | Full patient history              |

### Reports

| Method | Path                                       | Auth | Description                              |
|--------|--------------------------------------------|------|------------------------------------------|
| GET    | `/api/patients/<patient_id>/report`        | JWT  | Full report (JSON or CSV via ?export_format=csv)|

### Dataset

| Method | Path                  | Auth | Description                  |
|--------|-----------------------|------|------------------------------|
| POST   | `/api/dataset/upload` | JWT  | Upload CSV dataset           |
| GET    | `/api/dataset/info`   | JWT  | Get current dataset info     |
| POST   | `/api/dataset/train`  | JWT  | Trigger background training  |

---

## WebSocket Events

Connect to `ws://localhost:5000` using Socket.IO.

### Client → Server

| Event          | Payload                                 | Description                       |
|----------------|-----------------------------------------|-----------------------------------|
| `sensor_data`  | `{ecg, ppg, noise_intensity, filter_strength}` | Stream raw sensor data     |
| `start_scan`   | `{patient_id}`                          | Begin scan session                |
| `stop_scan`    | `{session_id}`                          | End scan session                  |

### Server → Client

| Event               | Payload                                 | Description                        |
|---------------------|-----------------------------------------|------------------------------------|
| `status`            | `{message}`                             | Connection status                  |
| `processed_data`    | `{features, filtered}`                  | Filtered signal + extracted features|
| `vitals_update`     | `{heart_rate, spo2, timestamp}`         | Live vitals broadcast              |
| `risk_update`       | `{patient_id, assessment}`              | Risk prediction result             |
| `sensor_status`     | `{connected}`                           | Sensor connection change           |
| `sensor_data_demo`  | `{ecg, ppg, heart_rate, spo2, timestamp}` | Demo mode fake sensor data       |
| `training_complete` | `{accuracy, f1, ...}`                   | Model training finished            |
| `training_error`    | `{error}`                               | Model training failed              |

---

## Hardware Setup (ESP32)

```
Finger → Photodiode → PPG amplifier → ESP32 ADC/I2C
Chest electrodes → AD8232 ECG amplifier → ESP32 ADC
ESP32 USB → Laptop serial port
```

Configure the serial port:
```bash
# Check connected ports
ls /dev/tty*         # Linux
ls /dev/cu.*         # macOS

# Set via API
curl -X POST http://localhost:5000/api/sensors/configure \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"sensor_type":"esp32","endpoint":"/dev/ttyUSB0","baud_rate":115200,"sample_rate":250}'
```

Without hardware the backend runs in **demo mode** — synthetic ECG/PPG data is streamed via SocketIO automatically.

---

## Deployment (Render)

1. Create a new **Web Service** on [render.com](https://render.com), connected to your GitHub repo.
2. Set **Build Command**: `pip install -r src/backend/python/requirements.txt`
3. Set **Start Command**: `gunicorn --worker-class eventlet -w 1 -b 0.0.0.0:$PORT src.backend.python.main:app`
4. Add a **PostgreSQL** database addon and copy the **Internal Database URL**.
5. Set environment variables in the Render dashboard:
   - `DATABASE_URL` — from the PostgreSQL addon
   - `JWT_SECRET_KEY` — a long random string
   - `SECRET_KEY` — another long random string
   - `FLASK_ENV=production`

---

## Project Structure

```
src/backend/python/
├── config.py            # Flask config, env vars
├── models.py            # SQLAlchemy ORM models
├── main.py              # Flask app, all API routes, SocketIO events
├── read_serial.py       # ESP32 serial reader + mock simulator
├── filter_signal.py     # Butterworth / notch / baseline filters
├── feature_extraction.py# ECG/PPG biomarker extraction
├── predict.py           # Risk prediction (ML model or rule-based)
├── train_model.py       # Model training pipeline
├── generate_dataset.py  # Synthetic dataset generator
├── requirements.txt     # Python dependencies
├── data/                # CSV datasets (gitignored after generation)
│   └── cardio_dataset_1600.csv
└── models/              # Trained model artifacts (gitignored)
    ├── model.pkl
    └── model_metadata.json
```
