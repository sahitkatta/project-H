import re
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import CateringOrder, CateringOrderItem, Customer, OrderStatus, User
from app.schemas.schemas import (
    CateringOrderCreate,
    CateringOrderPayment,
    CateringOrderResponse,
    CateringOrderStatusUpdate,
    CateringOrderUpdate,
    CustomerCreate,
    CustomerInfo,
    CustomerResponse,
)

router = APIRouter(prefix="/catering", tags=["catering"])


def normalize_phone(phone: str) -> str:
    """Strip all non-digit characters from a phone number."""
    return re.sub(r'[^0-9]', '', phone)


def generate_order_number(db: Session) -> str:
    """Generate next sequential customer-facing order number like BAS-00001."""
    last = (
        db.query(CateringOrder)
        .filter(CateringOrder.order_number.isnot(None))
        .order_by(CateringOrder.created_at.desc())
        .first()
    )
    if last and last.order_number:
        try:
            num = int(last.order_number.split('-')[1]) + 1
        except (ValueError, IndexError):
            num = db.query(CateringOrder).count() + 1
    else:
        num = db.query(CateringOrder).count() + 1
    return f"BAS-{num:05d}"


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
    if payment.payment_collected_by_label is not None:
        stripped = (payment.payment_collected_by_label or "").strip()
        order.payment_collected_by_label = stripped or None
    if payment.payment_collected_by_id is not None:
        order.payment_collected_by_id = payment.payment_collected_by_id


# ---------------------------------------------------------------------------
# Customer search — must come before /{order_id} to avoid path conflict
# ---------------------------------------------------------------------------

@router.get("/customers", response_model=list[CustomerInfo])
def search_customers(
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Return customers matching name, phone (digits only), or email."""
    query = db.query(Customer)
    if q:
        name_email_term = f"%{q}%"
        # Phones are stored as digits-only — strip query too for direct match
        phone_term = f"%{normalize_phone(q)}%"
        query = query.filter(
            or_(
                Customer.name.ilike(name_email_term),
                Customer.phone.ilike(phone_term),
                Customer.email.ilike(name_email_term),
            )
        )

    customers = query.order_by(Customer.order_count.desc(), Customer.name).limit(20).all()

    return [
        {
            "id": c.id,
            "customer_name": c.name,
            "customer_phone": c.phone,
            "customer_email": c.email,
            "customer_company": c.company,
            "customer_point_of_contact": c.point_of_contact,
            "last_event_type": c.last_event_type,
            "order_count": c.order_count,
        }
        for c in customers
    ]


@router.post("/customers", response_model=CustomerResponse, status_code=201)
def upsert_customer(
    body: CustomerCreate,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    """Create a new customer or update an existing one (matched by phone)."""
    clean_phone = normalize_phone(body.phone)
    existing = db.query(Customer).filter(Customer.phone == clean_phone).first()
    if existing:
        existing.name = body.name
        if body.email is not None:
            existing.email = body.email
        if body.company is not None:
            existing.company = body.company
        if body.point_of_contact is not None:
            existing.point_of_contact = body.point_of_contact
        if body.last_event_type is not None:
            existing.last_event_type = body.last_event_type
        db.commit()
        db.refresh(existing)
        return existing

    customer = Customer(
        id=str(uuid4()),
        name=body.name,
        phone=clean_phone,
        email=body.email,
        company=body.company,
        point_of_contact=body.point_of_contact,
        last_event_type=body.last_event_type,
        order_count=0,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


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
        phone_digits = f"%{normalize_phone(search)}%"
        query = query.filter(
            or_(
                CateringOrder.order_number.ilike(search_term),
                CateringOrder.customer_name.ilike(search_term),
                CateringOrder.customer_phone.ilike(phone_digits),
                CateringOrder.customer_company.ilike(search_term),
                CateringOrder.event_type.ilike(search_term),
            )
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

    # Upsert customer record (phone stored as digits only)
    clean_phone = normalize_phone(body.customer_phone)
    customer = db.query(Customer).filter(Customer.phone == clean_phone).first()
    if customer:
        customer.name = body.customer_name
        if body.customer_email:
            customer.email = body.customer_email
        if body.customer_company is not None:
            customer.company = body.customer_company
        if body.customer_point_of_contact is not None:
            customer.point_of_contact = body.customer_point_of_contact
        customer.last_event_type = body.event_type
        customer.order_count = (customer.order_count or 0) + 1
        db.flush()
    else:
        customer = Customer(
            id=str(uuid4()),
            name=body.customer_name,
            phone=clean_phone,
            email=body.customer_email,
            company=body.customer_company,
            point_of_contact=body.customer_point_of_contact,
            last_event_type=body.event_type,
            order_count=1,
        )
        db.add(customer)
        db.flush()

    order = CateringOrder(
        id=str(uuid4()),
        order_number=generate_order_number(db),
        customer_id=customer.id,
        customer_name=body.customer_name,
        customer_phone=clean_phone,
        customer_email=body.customer_email,
        customer_company=body.customer_company,
        customer_point_of_contact=body.customer_point_of_contact,
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

    if body.payment:
        _apply_payment(order, body.payment)

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
