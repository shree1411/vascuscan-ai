import socketio
from typing import Any, Dict

class WebsocketService:
    """
    Handles real-time event broadcasting to clinical dashboards.
    """
    def __init__(self, sio: socketio.AsyncServer):
        self.sio = sio

    async def broadcast_waveform(self, ecg: Any, ppg: Any, status: Dict[str, Any]):
        await self.sio.emit('waveform_update', {
            'ecg': ecg,
            'ppg': ppg,
            'sensor_status': status
        })

    async def broadcast_vitals(self, vitals: Dict[str, Any]):
        await self.sio.emit('vitals_update', vitals)

    async def broadcast_prediction(self, prediction: Dict[str, Any]):
        await self.sio.emit('prediction_update', prediction)

    async def notify_alert(self, message: str, level: str = "warning"):
        await self.sio.emit('alert_notification', {
            'message': message,
            'level': level
        })

# Global instance will be initialised in main.py
websocket_service: WebsocketService = None
