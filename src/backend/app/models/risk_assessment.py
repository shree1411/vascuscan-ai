from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlmodel import SQLModel, Field, Relationship

if TYPE_CHECKING:
    from .patient import Patient

class RiskAssessmentBase(SQLModel):
    risk_level: str  # low/moderate/high
    risk_score: float # 0.0 - 1.0
    blockage_probability: float
    ai_confidence: float
    model_used: str = "rule_based"
    features_json: Optional[str] = None
    assessment_notes: Optional[str] = None

class RiskAssessment(RiskAssessmentBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    patient_id: int = Field(foreign_key="patient.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    patient: "Patient" = Relationship(back_populates="risk_assessments")

class RiskAssessmentCreate(RiskAssessmentBase):
    patient_id: int

class RiskAssessmentRead(RiskAssessmentBase):
    id: int
    created_at: datetime
