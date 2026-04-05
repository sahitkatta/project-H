from collections import defaultdict
from datetime import date, timezone
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import CloverMenuItem, CloverTransaction, PaymentType, User
from app.schemas.schemas import (
    CloverMenuItemResponse,
    CloverTransactionResponse,
    DailySummaryResponse,
)

router = APIRouter(prefix="/clover", tags=["clover"])


@router.get("/menu-items", response_model=list[CloverMenuItemResponse])
def list_menu_items(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return db.query(CloverMenuItem).all()


@router.get("/transactions", response_model=list[CloverTransactionResponse])
def list_transactions(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return (
        db.query(CloverTransaction)
        .order_by(CloverTransaction.timestamp.desc())
        .all()
    )


@router.get("/daily-summary", response_model=DailySummaryResponse)
def daily_summary(
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    today = date.today()

    # Try today's transactions first; fall back to all for demo purposes
    transactions: List[CloverTransaction] = (
        db.query(CloverTransaction)
        .filter(
            CloverTransaction.timestamp >= f"{today}T00:00:00",
            CloverTransaction.timestamp < f"{today}T23:59:59",
        )
        .all()
    )

    if not transactions:
        transactions = db.query(CloverTransaction).all()

    total_revenue = sum(t.amount for t in transactions)
    cash_revenue = sum(
        t.amount for t in transactions if t.payment_type == PaymentType.cash
    )
    card_revenue = sum(
        t.amount for t in transactions if t.payment_type == PaymentType.card
    )
    transaction_count = len(transactions)

    # Aggregate items across all transactions
    item_counts: Dict[str, Any] = defaultdict(lambda: {"name": "", "count": 0, "revenue": 0.0})
    for txn in transactions:
        items = txn.items or []
        for item in items:
            name = item.get("name", "Unknown")
            qty = item.get("quantity", 1)
            price = item.get("unit_price", 0.0)
            item_counts[name]["name"] = name
            item_counts[name]["count"] += qty
            item_counts[name]["revenue"] += qty * price

    top_items = sorted(
        item_counts.values(), key=lambda x: x["count"], reverse=True
    )[:5]

    summary_date = today.isoformat() if transactions else today.isoformat()

    return DailySummaryResponse(
        total_revenue=round(total_revenue, 2),
        cash_revenue=round(cash_revenue, 2),
        card_revenue=round(card_revenue, 2),
        transaction_count=transaction_count,
        top_items=list(top_items),
        date=summary_date,
    )
