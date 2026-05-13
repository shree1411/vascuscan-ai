from fastapi import APIRouter, HTTPException
import serial.tools.list_ports
from typing import List, Dict

router = APIRouter()

@router.get("/ports", response_model=List[str])
async def list_serial_ports():
    """Returns a list of all available hardware serial ports."""
    try:
        ports = serial.tools.list_ports.comports()
        return [p.device for p in ports]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_sensor_status():
    """Place-holder for real-time sensor connection status logic."""
    # This will be integrated with the background streamer service
    return {
        "status": "Success",
        "ecg_connected": True,
        "ppg_connected": True,
        "is_simulated": False
    }

@router.post("/reconnect")
async def reconnect_sensors():
    """Trigger sensor hardware reconnection logic."""
    return {"status": "Success", "message": "Reconnection triggered"}
