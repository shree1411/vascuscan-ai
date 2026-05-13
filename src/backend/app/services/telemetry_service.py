import asyncio
import threading
from typing import Dict, Any
from sensor_stream import SensorStreamer
from app.services.websocket_service import WebsocketService
from app.services.signal_buffer_service import signal_buffer
from app.services.risk_engine_service import risk_engine
from app.core.database import get_session
from app.models.vital_sign import VitalSign
from app.models.risk_assessment import RiskAssessment

class TelemetryService:
    """
    Orchestrates the real-time data flow from hardware/simulation to the dashboard.
    Bridges the legacy SensorStreamer into the FastAPI/Socket.IO service layer.
    """
    def __init__(self, ws_service: WebsocketService):
        self.ws_service = ws_service
        self.loop = asyncio.get_event_loop()
        self._counter = 0
        self.streamer = SensorStreamer(
            on_waveform=self._on_waveform_received,
            on_features=self._on_features_received,
            force_simulate=False
        )

    def start(self):
        """Starts the background telemetry loop."""
        print("[Telemetry] Starting background streamer...")
        self.streamer.start()

    def stop(self):
        """Stops the background telemetry loop."""
        self.streamer.stop()

    def _on_waveform_received(self, ecg_chunk, ppg_chunk, is_simulated, status):
        """Callback from streamer: update buffer and broadcast via Websockets."""
        # 1. Update the centralized thread-safe signal buffer
        signal_buffer.append_ecg(ecg_chunk)
        signal_buffer.append_ppg(ppg_chunk)

        # 2. Asynchronously broadcast via the main loop
        if self.loop and self.loop.is_running():
            asyncio.run_coroutine_threadsafe(
                self.ws_service.broadcast_waveform(ecg_chunk, ppg_chunk, status),
                self.loop
            )

    def _on_features_received(self, features):
        """Callback from streamer: broadcast extracted clinical features and run risk prediction."""
        if self.loop and self.loop.is_running():
            # Broadcast Vitals
            asyncio.run_coroutine_threadsafe(
                self.ws_service.broadcast_vitals(features),
                self.loop
            )
            
            # Map features to the expected schema for the Risk Engine
            model_data = {
                "ecg_heart_rate": features.get("ecg_hr", 0),
                "ecg_hrv": features.get("hrv", 0),
                "ecg_qrs_duration": features.get("qrs_duration", 90),
                "ppg_peak_amplitude": features.get("amp", 0),
                "ppg_perfusion_index": features.get("perfusion_index", 2.0),
                "ptt": features.get("ptt", 0)
            }
            
            # Run the AI model module 2 prediction
            prediction = risk_engine.predict_module2(model_data)
            
            # Merge vitals into prediction for the frontend state update
            prediction_payload = {
                **prediction,
                **features
            }
            
            # Broadcast Prediction
            asyncio.run_coroutine_threadsafe(
                self.ws_service.broadcast_prediction(prediction_payload),
                self.loop
            )
            
            # Save snapshot to database periodically (every 10 seconds)
            self._counter += 1
            if self._counter >= 10:
                self._counter = 0
                self._save_snapshot_to_db(features, prediction)
                
    def _save_snapshot_to_db(self, features, prediction):
        try:
            # We use a default patient_id = 1 for the real-time demo
            # A full system would track the active session ID.
            session = next(get_session())
            
            # Save Vitals
            vital = VitalSign(
                patient_id=1,
                heart_rate=features.get("ecg_hr", 0),
                spo2=features.get("spo2", 98.0),
                systolic_bp=max(90, 130 - (features.get("ptt", 0) - 0.25) * 50),
                diastolic_bp=max(60, 80 - (features.get("ptt", 0) - 0.25) * 30),
                ptt=features.get("ptt", 0),
                perfusion_index=features.get("perfusion_index", 2.0),
                status="monitoring"
            )
            session.add(vital)
            
            # Save Risk
            risk = RiskAssessment(
                patient_id=1,
                risk_level=prediction.get("risk_level", "Low"),
                risk_score=prediction.get("risk_score", 0.0) / 100.0,
                blockage_probability=prediction.get("risk_score", 0.0) * 0.8,
                ai_confidence=prediction.get("probabilities", {}).get(prediction.get("risk_level", "Low"), 85),
                model_used="model2_sensor",
                features_json=str(features)
            )
            session.add(risk)
            session.commit()
        except Exception as e:
            print(f"Failed to save DB snapshot: {e}")

# Global Instance (Initialized in main.py)
telemetry_service: TelemetryService = None
