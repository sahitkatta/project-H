from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Employee, EmployeeHours
from app.schemas.schemas import (
    EmployeeCreate,
    EmployeeUpdate,
    EmployeeResponse,
    EmployeeHoursCreate,
    EmployeeHoursUpdate,
    EmployeeHoursResponse,
)

router = APIRouter(prefix="/employees", tags=["employees"])


# ── Employee Contacts ─────────────────────────────────────────────────────────

@router.get("", response_model=list[EmployeeResponse])
def list_employees(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Employee).order_by(Employee.name).all()


@router.post("", response_model=EmployeeResponse, status_code=201)
def create_employee(body: EmployeeCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    e = Employee(**body.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return e


@router.patch("/{employee_id}", response_model=EmployeeResponse)
def update_employee(employee_id: str, body: EmployeeUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    e = db.query(Employee).filter(Employee.id == employee_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Employee not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(e, k, v)
    db.commit()
    db.refresh(e)
    return e


@router.delete("/{employee_id}", status_code=204)
def delete_employee(employee_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    e = db.query(Employee).filter(Employee.id == employee_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.delete(e)
    db.commit()


# ── Employee Hours ────────────────────────────────────────────────────────────

@router.get("/hours", response_model=list[EmployeeHoursResponse])
def list_hours(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(EmployeeHours).order_by(EmployeeHours.date.desc()).all()


@router.post("/hours", response_model=EmployeeHoursResponse, status_code=201)
def create_hours(body: EmployeeHoursCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    h = EmployeeHours(**body.model_dump())
    db.add(h)
    db.commit()
    db.refresh(h)
    return h


@router.patch("/hours/{entry_id}", response_model=EmployeeHoursResponse)
def update_hours(entry_id: str, body: EmployeeHoursUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    h = db.query(EmployeeHours).filter(EmployeeHours.id == entry_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Entry not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(h, k, v)
    db.commit()
    db.refresh(h)
    return h


@router.delete("/hours/{entry_id}", status_code=204)
def delete_hours(entry_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    h = db.query(EmployeeHours).filter(EmployeeHours.id == entry_id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(h)
    db.commit()
