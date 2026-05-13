from datetime import datetime, date
from typing import Optional, List, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .vital_sign import VitalSign
    from .risk_assessment import RiskAssessment
    from .sensor_session import SensorSession

class PatientBase(SQLModel):
    patient_id: str = Field(index=True, unique=True)
    first_name: str
    last_name: str
    date_of_birth: Optional[date] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    bmi: Optional[float] = None

class Patient(PatientBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    vital_signs: List["VitalSign"] = Relationship(back_populates="patient")
    risk_assessments: List["RiskAssessment"] = Relationship(back_populates="patient")
    sessions: List["SensorSession"] = Relationship(back_populates="patient")

class PatientCreate(PatientBase):
    pass

class PatientRead(PatientBase):
    id: int
    created_at: datetime
