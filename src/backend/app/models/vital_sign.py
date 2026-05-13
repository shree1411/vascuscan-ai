from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .patient import Patient

class VitalSignBase(SQLModel):
    heart_rate: float
    spo2: float
    systolic_bp: Optional[float] = None
    diastolic_bp: Optional[float] = None
    ptt: Optional[float] = None
    perfusion_index: Optional[float] = None
    source: str = "sensor"

class VitalSign(VitalSignBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    patient_id: int = Field(foreign_key="patient.id")
    recorded_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    patient: "Patient" = Relationship(back_populates="vital_signs")

class VitalSignCreate(VitalSignBase):
    patient_id: int

class VitalSignRead(VitalSignBase):
    id: int
    recorded_at: datetime
