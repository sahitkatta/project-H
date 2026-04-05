from uuid import uuid4
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import CashReceived, Cheque, EmployeeHours, Expense, Vendor, User
from app.schemas.schemas import (
    BulkSettleRequest,
    CashReceivedCreate,
    CashReceivedResponse,
    ChequeCreate,
    ChequeResponse,
    ChequesByVendorItem,
    EmployeeHoursCreate,
    EmployeeHoursResponse,
    ExpenseCreate,
    ExpenseResponse,
    ExpenseUpdate,
    SettleChequeRequest,
)

router = APIRouter(prefix="/expenses", tags=["expenses"])

PAID_ON_CREATION_TYPES = {"cash", "card", "zelle", "mix"}


def _reload_expense(db: Session, expense_id: str) -> Expense:
    return (
        db.query(Expense)
        .options(joinedload(Expense.vendor), joinedload(Expense.paid_by))
        .filter(Expense.id == expense_id)
        .first()
    )


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------

@router.get("", response_model=list[ExpenseResponse])
def list_expenses(
    is_paid: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    q = db.query(Expense).options(joinedload(Expense.vendor), joinedload(Expense.paid_by))
    if is_paid is not None:
        q = q.filter(Expense.is_paid == is_paid)
    return q.order_by(Expense.created_at.desc()).all()


@router.post("", response_model=ExpenseResponse, status_code=201)
def create_expense(
    body: ExpenseCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # Cheque type without cheque_number → unpaid (needs cheque later)
    type_str = body.type.value if hasattr(body.type, "value") else str(body.type)
    if type_str in PAID_ON_CREATION_TYPES:
        is_paid = True
    else:
        # cheque type: paid only if cheque number was provided
        is_paid = bool(body.cheque_number)

    expense = Expense(
        id=str(uuid4()),
        description=body.description,
        amount=body.amount,
        type=body.type,
        category=body.category,
        date=body.date,
        vendor_id=body.vendor_id,
        paid_by_user_id=body.paid_by_user_id,
        cash_amount=body.cash_amount,
        card_amount=body.card_amount,
        zelle_amount=body.zelle_amount,
        zelle_reference=body.zelle_reference,
        cheque_amount=body.cheque_amount,
        cheque_number=body.cheque_number,
        cheque_issue_date=body.cheque_issue_date,
        cheque_withdrawal_date=body.cheque_withdrawal_date,
        is_paid=is_paid,
    )
    db.add(expense)
    db.flush()

    # Auto-create a Cheque record when cheque number is provided
    if type_str == "cheque" and body.cheque_number:
        vendor = db.query(Vendor).filter(Vendor.id == body.vendor_id).first() if body.vendor_id else None
        payee = vendor.name if vendor else body.description
        cheque = Cheque(
            id=str(uuid4()),
            payee=payee,
            amount=body.amount,
            cheque_number=body.cheque_number,
            issue_date=body.cheque_issue_date or body.date,
            withdrawal_date=body.cheque_withdrawal_date,
            is_cleared=False,
            vendor_id=body.vendor_id,
            expense_id=expense.id,
        )
        db.add(cheque)

    db.commit()
    return _reload_expense(db, expense.id)


@router.patch("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: str,
    body: ExpenseUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)

    # Recalculate is_paid when type or cheque_number changes
    type_str = expense.type.value if hasattr(expense.type, "value") else str(expense.type)
    if type_str in PAID_ON_CREATION_TYPES:
        expense.is_paid = True
    else:
        expense.is_paid = bool(expense.cheque_number)

    # If cheque_number was just added, create a Cheque record (if not already linked)
    if type_str == "cheque" and expense.cheque_number:
        existing_cheque = db.query(Cheque).filter(Cheque.expense_id == expense.id).first()
        if not existing_cheque:
            vendor = db.query(Vendor).filter(Vendor.id == expense.vendor_id).first() if expense.vendor_id else None
            payee = vendor.name if vendor else expense.description
            cheque = Cheque(
                id=str(uuid4()),
                payee=payee,
                amount=expense.amount,
                cheque_number=expense.cheque_number,
                issue_date=expense.cheque_issue_date or expense.date,
                withdrawal_date=expense.cheque_withdrawal_date,
                is_cleared=False,
                vendor_id=expense.vendor_id,
                expense_id=expense.id,
            )
            db.add(cheque)
        else:
            # Update existing cheque details
            if body.cheque_number:
                existing_cheque.cheque_number = expense.cheque_number
            if body.cheque_issue_date:
                existing_cheque.issue_date = expense.cheque_issue_date
            if body.cheque_withdrawal_date:
                existing_cheque.withdrawal_date = expense.cheque_withdrawal_date

    db.commit()
    return _reload_expense(db, expense.id)


@router.post("/bulk-settle", response_model=list[ExpenseResponse])
def bulk_settle_expenses(
    body: BulkSettleRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Mark multiple unpaid expenses as settled with cheque details."""
    expenses = db.query(Expense).filter(Expense.id.in_(body.expense_ids)).all()
    if not expenses:
        raise HTTPException(status_code=404, detail="No expenses found")

    updated_ids = []
    for expense in expenses:
        expense.cheque_number = body.cheque_number
        expense.cheque_issue_date = body.issue_date
        expense.cheque_withdrawal_date = body.withdrawal_date
        if body.image_uri:
            expense.cheque_image_uri = body.image_uri
        expense.is_paid = True

        # Create or update linked Cheque record
        existing = db.query(Cheque).filter(Cheque.expense_id == expense.id).first()
        if not existing:
            vendor = db.query(Vendor).filter(Vendor.id == expense.vendor_id).first() if expense.vendor_id else None
            payee = vendor.name if vendor else expense.description
            cheque = Cheque(
                id=str(uuid4()),
                payee=payee,
                amount=expense.amount,
                cheque_number=body.cheque_number,
                issue_date=body.issue_date,
                withdrawal_date=body.withdrawal_date,
                image_uri=body.image_uri,
                is_cleared=False,
                vendor_id=expense.vendor_id,
                expense_id=expense.id,
            )
            db.add(cheque)
        else:
            existing.cheque_number = body.cheque_number
            existing.issue_date = body.issue_date
            if body.withdrawal_date:
                existing.withdrawal_date = body.withdrawal_date
            if body.image_uri:
                existing.image_uri = body.image_uri

        updated_ids.append(expense.id)

    db.commit()
    return [_reload_expense(db, eid) for eid in updated_ids]


# ---------------------------------------------------------------------------
# Cheques — by-vendor MUST come before /{cheque_id} to avoid path conflicts
# ---------------------------------------------------------------------------

@router.get("/cheques/by-vendor", response_model=list[ChequesByVendorItem])
def cheques_by_vendor(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cheques = (
        db.query(Cheque)
        .options(joinedload(Cheque.vendor))
        .filter(Cheque.is_cleared == False)  # noqa: E712
        .order_by(Cheque.created_at.desc())
        .all()
    )

    grouped: dict = {}
    for c in cheques:
        key = c.vendor_id or "no-vendor"
        vname = c.vendor.name if c.vendor else c.payee
        if key not in grouped:
            grouped[key] = {
                "vendor_id": c.vendor_id,
                "vendor_name": vname,
                "total_outstanding": 0.0,
                "cheque_count": 0,
                "cheques": [],
            }
        outstanding = c.amount - (c.settled_amount or 0.0)
        grouped[key]["total_outstanding"] += outstanding
        grouped[key]["cheque_count"] += 1
        grouped[key]["cheques"].append(c)

    return list(grouped.values())


@router.get("/cheques", response_model=list[ChequeResponse])
def list_cheques(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    return (
        db.query(Cheque)
        .options(joinedload(Cheque.vendor))
        .order_by(Cheque.created_at.desc())
        .all()
    )


@router.post("/cheques", response_model=ChequeResponse, status_code=201)
def create_cheque(
    body: ChequeCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cheque = Cheque(
        id=str(uuid4()),
        payee=body.payee,
        amount=body.amount,
        cheque_number=body.cheque_number,
        issue_date=body.issue_date,
        withdrawal_date=body.withdrawal_date,
    )
    db.add(cheque)
    db.commit()
    db.refresh(cheque)
    return cheque


@router.patch("/cheques/{cheque_id}/settle", response_model=ChequeResponse)
def settle_cheque(
    cheque_id: str,
    body: SettleChequeRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    cheque = db.query(Cheque).filter(Cheque.id == cheque_id).first()
    if not cheque:
        raise HTTPException(status_code=404, detail="Cheque not found")
    cheque.is_cleared = True
    cheque.settled_amount = body.amount
    if body.cheque_number:
        cheque.cheque_number = body.cheque_number
    if body.issue_date:
        cheque.issue_date = body.issue_date
    if body.withdrawal_date:
        cheque.withdrawal_date = body.withdrawal_date
    if body.image_uri:
        cheque.image_uri = body.image_uri
    db.commit()
    db.refresh(cheque)
    return cheque


# ---------------------------------------------------------------------------
# Employee Hours
# ---------------------------------------------------------------------------

@router.get("/employee-hours", response_model=list[EmployeeHoursResponse])
def list_employee_hours(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(EmployeeHours).order_by(EmployeeHours.date.desc()).all()


@router.post("/employee-hours", response_model=EmployeeHoursResponse, status_code=201)
def create_employee_hours(body: EmployeeHoursCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    hours = EmployeeHours(id=str(uuid4()), employee_name=body.employee_name, date=body.date, hours_worked=body.hours_worked, hourly_rate=body.hourly_rate)
    db.add(hours)
    db.commit()
    db.refresh(hours)
    return hours


# ---------------------------------------------------------------------------
# Cash Received
# ---------------------------------------------------------------------------

@router.get("/cash-received", response_model=list[CashReceivedResponse])
def list_cash_received(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(CashReceived).order_by(CashReceived.created_at.desc()).all()


@router.post("/cash-received", response_model=CashReceivedResponse, status_code=201)
def create_cash_received(body: CashReceivedCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    cash = CashReceived(id=str(uuid4()), amount=body.amount, description=body.description, date=body.date)
    db.add(cash)
    db.commit()
    db.refresh(cash)
    return cash
