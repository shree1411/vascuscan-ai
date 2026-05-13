from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from app.services.risk_engine_service import risk_engine
from app.services.feature_extraction_service import feature_extractor
from app.services.signal_buffer_service import signal_buffer

router = APIRouter()

@router.post("/module1")
async def predict_module1(data: Dict[str, Any]):
    """
    Module 1: Cardivascular risk prediction using Patient History and Registration form data.
    """
    try:
        result = risk_engine.predict_module1(data)
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/module2")
async def predict_module2(data: Dict[str, Any]):
    """
    Module 2: Live monitoring risk prediction combining real-time ECG/PPG features and patient history.
    """
    try:
        # 1. Grab current signal features
        ecg_sig = signal_buffer.get_ecg_window(300) # 3-second window
        ppg_sig = signal_buffer.get_ppg_window(300)
        
        extracted = feature_extractor.extract_all(ecg_sig, ppg_sig)
        
        # 2. Fuse with incoming patient context
        combined_data = {**data, **extracted}
        
        # 3. Predict
        result = risk_engine.predict_module2(combined_data)
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return {
            **result,
            "vitals": extracted # Include extracted features for frontend update
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
