from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select
from typing import List
from app.core.database import get_session
from app.models.patient import Patient, PatientCreate, PatientRead

router = APIRouter()

@router.post("/", response_model=PatientRead)
def create_patient(patient: PatientCreate, session: Session = Depends(get_session)):
    db_patient = Patient.from_orm(patient)
    session.add(db_patient)
    session.commit()
    session.refresh(db_patient)
    return db_patient

@router.get("/", response_model=List[PatientRead])
def read_patients(
    offset: int = 0,
    limit: int = Query(default=100, lte=100),
    session: Session = Depends(get_session)
):
    patients = session.exec(select(Patient).offset(offset).limit(limit)).all()
    return patients

@router.get("/{patient_id}", response_model=PatientRead)
def read_patient(patient_id: str, session: Session = Depends(get_session)):
    patient = session.exec(select(Patient).where(Patient.patient_id == patient_id)).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@router.delete("/{patient_id}")
def delete_patient(patient_id: str, session: Session = Depends(get_session)):
    patient = session.exec(select(Patient).where(Patient.patient_id == patient_id)).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    session.delete(patient)
    session.commit()
    return {"ok": True}
