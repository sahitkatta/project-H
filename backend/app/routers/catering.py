from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import CateringOrder, CateringOrderItem, OrderStatus, User
from app.schemas.schemas import (
    CateringOrderCreate,
    CateringOrderPayment,
    CateringOrderResponse,
    CateringOrderStatusUpdate,
    CateringOrderUpdate,
    CustomerInfo,
)

router = APIRouter(prefix="/catering", tags=["catering"])

# Valid status transitions
VALID_TRANSITIONS = {
    OrderStatus.pending: {OrderStatus.accepted, OrderStatus.rejected},
    OrderStatus.accepted: {OrderStatus.completed},
    OrderStatus.rejected: set(),
    OrderStatus.completed: set(),
}


def _apply_payment(order: CateringOrder, payment: CateringOrderPayment) -> None:
    order.payment_type = payment.payment_type
    order.payment_status = payment.payment_status
    order.payment_cash_amount = payment.payment_cash_amount
    order.payment_card_amount = payment.payment_card_amount
    order.payment_cheque_amount = payment.payment_cheque_amount
    order.payment_zelle_amount = payment.payment_zelle_amount
    order.payment_other_amount = payment.payment_other_amount
    order.payment_cheque_number = payment.payment_cheque_number
    order.payment_cheque_issue_date = payment.payment_cheque_issue_date
    order.payment_cheque_withdrawal_date = payment.payment_cheque_withdrawal_date
    order.payment_cheque_image_uri = payment.payment_cheque_image_uri
    order.payment_zelle_reference = payment.payment_zelle_reference
    order.payment_zelle_date = payment.payment_zelle_date
    order.payment_zelle_status = payment.payment_zelle_status
    order.payment_other_details = payment.payment_other_details
    order.payment_notes = payment.payment_notes


# ---------------------------------------------------------------------------
# Customer search — must come before /{order_id} to avoid path conflict
# ---------------------------------------------------------------------------

@router.get("/customers", response_model=list[CustomerInfo])
def search_customers(
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return distinct past customers matching a name, phone, or email query."""
    query = db.query(CateringOrder)
    if q:
        term = f"%{q}%"
        query = query.filter(
            or_(
                CateringOrder.customer_name.ilike(term),
                CateringOrder.customer_phone.ilike(term),
                CateringOrder.customer_email.ilike(term),
            )
        )

    orders = query.order_by(CateringOrder.created_at.desc()).all()

    # Deduplicate by phone number, pick most recent per customer
    seen: dict = {}
    for o in orders:
        key = o.customer_phone
        if key not in seen:
            seen[key] = {
                "customer_name": o.customer_name,
                "customer_phone": o.customer_phone,
                "customer_email": o.customer_email,
                "last_event_type": o.event_type,
                "order_count": 1,
            }
        else:
            seen[key]["order_count"] += 1

    return list(seen.values())[:20]


# ---------------------------------------------------------------------------
# Orders
# ---------------------------------------------------------------------------

@router.get("/orders", response_model=list[CateringOrderResponse])
def list_orders(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    query = db.query(CateringOrder)

    if status:
        try:
            status_enum = OrderStatus(status)
            query = query.filter(CateringOrder.status == status_enum)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            CateringOrder.customer_name.ilike(search_term)
            | CateringOrder.customer_phone.ilike(search_term)
            | CateringOrder.event_type.ilike(search_term)
        )

    return query.order_by(CateringOrder.created_at.desc()).all()


@router.post("/orders", response_model=CateringOrderResponse, status_code=201)
def create_order(
    body: CateringOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Cashier-created orders require price approval
    price_approval_status = None
    if current_user.role.value == "cashier":
        price_approval_status = "pending_approval"

    order = CateringOrder(
        id=str(uuid4()),
        customer_name=body.customer_name,
        customer_phone=body.customer_phone,
        customer_email=body.customer_email,
        event_date=body.event_date,
        event_type=body.event_type,
        head_count=body.head_count,
        estimated_price=body.estimated_price,
        negotiated_price=body.negotiated_price,
        status=OrderStatus.pending,
        notes=body.notes,
        tray_sizes=body.tray_sizes,
        price_approval_status=price_approval_status,
        created_by_id=current_user.id,
    )
    db.add(order)
    db.flush()

    for item_data in body.items:
        item = CateringOrderItem(
            id=str(uuid4()),
            menu_item_id=item_data.menu_item_id,
            name=item_data.name,
            quantity=item_data.quantity,
            unit_price=item_data.unit_price,
            special_instructions=item_data.special_instructions,
            add_ons=item_data.add_ons or [],
            order_id=order.id,
        )
        db.add(item)

    db.commit()
    db.refresh(order)
    return order


@router.get("/orders/{order_id}", response_model=CateringOrderResponse)
def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    order = db.query(CateringOrder).filter(CateringOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.patch("/orders/{order_id}", response_model=CateringOrderResponse)
def update_order(
    order_id: str,
    body: CateringOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update order details (negotiate price, edit tray sizes, approve price)."""
    order = db.query(CateringOrder).filter(CateringOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if body.negotiated_price is not None:
        order.negotiated_price = body.negotiated_price
    if body.estimated_price is not None:
        order.estimated_price = body.estimated_price
    if body.notes is not None:
        order.notes = body.notes
    if body.tray_sizes is not None:
        order.tray_sizes = body.tray_sizes
    if body.price_approval_status is not None:
        order.price_approval_status = body.price_approval_status
        if body.price_approval_status == "approved":
            order.price_approved_by_id = current_user.id

    db.commit()
    db.refresh(order)
    return order


@router.patch("/orders/{order_id}/status", response_model=CateringOrderResponse)
def update_order_status(
    order_id: str,
    body: CateringOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    order = db.query(CateringOrder).filter(CateringOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    allowed = VALID_TRANSITIONS.get(order.status, set())
    if body.status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Cannot transition from '{order.status.value}' to '{body.status.value}'. "
                f"Allowed transitions: {[s.value for s in allowed]}"
            ),
        )

    order.status = body.status

    if body.status == OrderStatus.rejected:
        order.rejection_reason = body.rejection_reason

    if body.status == OrderStatus.accepted:
        order.accepted_by_id = current_user.id

    if body.status == OrderStatus.completed:
        # Apply inline payment if provided, else mark unpaid
        if body.payment:
            _apply_payment(order, body.payment)
        elif order.payment_status is None:
            order.payment_status = "unpaid"

    db.commit()
    db.refresh(order)
    return order


@router.patch("/orders/{order_id}/payment", response_model=CateringOrderResponse)
def update_order_payment(
    order_id: str,
    body: CateringOrderPayment,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Add or update payment details on any order (typically completed + unpaid)."""
    order = db.query(CateringOrder).filter(CateringOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    _apply_payment(order, body)
    db.commit()
    db.refresh(order)
    return order


@router.delete("/orders/{order_id}", status_code=204)
def delete_order(
    order_id: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    order = db.query(CateringOrder).filter(CateringOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    db.delete(order)
    db.commit()
