from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Vendor, User
from app.schemas.schemas import VendorCreate, VendorResponse

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("", response_model=list[VendorResponse])
def list_vendors(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(Vendor).order_by(Vendor.name).all()


@router.post("", response_model=VendorResponse, status_code=201)
def create_vendor(
    body: VendorCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    existing = db.query(Vendor).filter(Vendor.name == body.name).first()
    if existing:
        return existing  # return existing if same name
    v = Vendor(id=str(uuid4()), name=body.name)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v
