from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import CashReceived
from app.schemas.schemas import CashReceivedCreate, CashReceivedUpdate, CashReceivedResponse

router = APIRouter(prefix="/cash", tags=["cash"])


@router.get("", response_model=list[CashReceivedResponse])
def list_cash(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(CashReceived).order_by(CashReceived.date.desc()).all()


@router.post("", response_model=CashReceivedResponse, status_code=201)
def create_cash(body: CashReceivedCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = CashReceived(**body.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.patch("/{entry_id}", response_model=CashReceivedResponse)
def update_cash(entry_id: str, body: CashReceivedUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(CashReceived).filter(CashReceived.id == entry_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Entry not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{entry_id}", status_code=204)
def delete_cash(entry_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(CashReceived).filter(CashReceived.id == entry_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(c)
    db.commit()
