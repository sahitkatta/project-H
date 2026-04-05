from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import CateringOrder, CateringOrderItem, OrderStatus, User
from app.schemas.schemas import (
    CateringOrderCreate,
    CateringOrderResponse,
    CateringOrderStatusUpdate,
)

router = APIRouter(prefix="/catering", tags=["catering"])

# Valid status transitions
VALID_TRANSITIONS = {
    OrderStatus.pending: {OrderStatus.accepted, OrderStatus.rejected},
    OrderStatus.accepted: {OrderStatus.completed},
    OrderStatus.rejected: set(),
    OrderStatus.completed: set(),
}


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


@router.post("/orders", response_model=CateringOrderResponse, status_code=201)
def create_order(
    body: CateringOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
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
        created_by_id=current_user.id,
    )
    db.add(order)
    db.flush()  # get order.id without committing

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
