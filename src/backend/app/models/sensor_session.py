from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .patient import Patient

class SensorSessionBase(SQLModel):
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    status: str = "active" # active/completed/cancelled
    data_quality: float = 0.0

class SensorSession(SensorSessionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    patient_id: int = Field(foreign_key="patient.id")
    
    # Relationships
    patient: "Patient" = Relationship(back_populates="sessions")

class SensorSessionCreate(SensorSessionBase):
    patient_id: int

class SensorSessionRead(SensorSessionBase):
    id: int
