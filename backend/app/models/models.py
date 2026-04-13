import enum
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


def generate_id() -> str:
    return str(uuid4())


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    owner = "owner"
    manager = "manager"
    cashier = "cashier"


class OrderStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    completed = "completed"


class ExpenseType(str, enum.Enum):
    cash = "cash"
    card = "card"
    cheque = "cheque"
    zelle = "zelle"
    mix = "mix"


class ExpenseCategory(str, enum.Enum):
    groceries = "groceries"
    catering = "catering"
    supplies = "supplies"
    salary = "salary"
    rent = "rent"
    utilities = "utilities"
    other = "other"


class PaymentType(str, enum.Enum):
    cash = "cash"
    card = "card"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, default=generate_id)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False, unique=True)
    email = Column(String, nullable=True)
    company = Column(String, nullable=True)
    point_of_contact = Column(String, nullable=True)
    last_event_type = Column(String, nullable=True)
    order_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(String, primary_key=True, default=generate_id)
    name = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    expenses = relationship("Expense", back_populates="vendor")
    cheques = relationship("Cheque", back_populates="vendor")


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_id)
    name = Column(String, nullable=False)
    username = Column(String, unique=True, nullable=True)
    password_hash = Column(String, nullable=True)
    role = Column(Enum(UserRole), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    orders_created = relationship(
        "CateringOrder",
        foreign_keys="CateringOrder.created_by_id",
        back_populates="created_by",
    )
    orders_accepted = relationship(
        "CateringOrder",
        foreign_keys="CateringOrder.accepted_by_id",
        back_populates="accepted_by",
    )
    expenses_paid = relationship(
        "Expense",
        foreign_keys="Expense.paid_by_user_id",
        back_populates="paid_by",
    )


class CloverMenuItem(Base):
    __tablename__ = "clover_menu_items"

    id = Column(String, primary_key=True, default=generate_id)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    category = Column(String, nullable=False)
    description = Column(String, nullable=True)
    available = Column(Boolean, default=True)


class CloverTransaction(Base):
    __tablename__ = "clover_transactions"

    id = Column(String, primary_key=True, default=generate_id)
    amount = Column(Float, nullable=False)
    timestamp = Column(DateTime(timezone=True), nullable=False)
    payment_type = Column(Enum(PaymentType), nullable=False)
    employee_name = Column(String, nullable=False)
    items = Column(JSON, default=list)


class CateringOrder(Base):
    __tablename__ = "catering_orders"

    id = Column(String, primary_key=True, default=generate_id)
    order_number = Column(String, nullable=True, unique=True)  # e.g. BAS-00001
    customer_name = Column(String, nullable=False)
    customer_phone = Column(String, nullable=False)
    customer_email = Column(String, nullable=True)
    customer_company = Column(String, nullable=True)
    customer_point_of_contact = Column(String, nullable=True)
    event_date = Column(String, nullable=False)
    event_type = Column(String, nullable=False)
    head_count = Column(Integer, nullable=False)
    estimated_price = Column(Float, nullable=False)
    negotiated_price = Column(Float, nullable=False)
    status = Column(Enum(OrderStatus), nullable=False, default=OrderStatus.pending)
    notes = Column(String, nullable=True)
    rejection_reason = Column(String, nullable=True)
    tray_sizes = Column(JSON, nullable=True)  # {small, medium, large, xlarge}
    price_approval_status = Column(String, nullable=True)  # None | 'pending_approval' | 'approved'
    price_approved_by_id = Column(String, ForeignKey("users.id"), nullable=True)

    # Payment fields
    payment_type = Column(String, nullable=True)   # cash/card/cheque/zelle/other/mix
    payment_status = Column(String, nullable=True)  # unpaid/partial/paid
    payment_cash_amount = Column(Float, nullable=True)
    payment_card_amount = Column(Float, nullable=True)
    payment_cheque_amount = Column(Float, nullable=True)
    payment_zelle_amount = Column(Float, nullable=True)
    payment_other_amount = Column(Float, nullable=True)
    payment_cheque_number = Column(String, nullable=True)
    payment_cheque_issue_date = Column(String, nullable=True)
    payment_cheque_withdrawal_date = Column(String, nullable=True)
    payment_cheque_image_uri = Column(String, nullable=True)
    payment_zelle_reference = Column(String, nullable=True)
    payment_zelle_date = Column(String, nullable=True)
    payment_zelle_status = Column(String, nullable=True)
    payment_other_details = Column(String, nullable=True)
    payment_notes = Column(String, nullable=True)
    payment_collected_by_id = Column(String, ForeignKey("users.id"), nullable=True)
    payment_collected_by_label = Column(String, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    customer_id = Column(String, ForeignKey("customers.id"), nullable=True)

    created_by_id = Column(String, ForeignKey("users.id"), nullable=False)
    accepted_by_id = Column(String, ForeignKey("users.id"), nullable=True)

    created_by = relationship(
        "User", foreign_keys=[created_by_id], back_populates="orders_created"
    )
    accepted_by = relationship(
        "User", foreign_keys=[accepted_by_id], back_populates="orders_accepted"
    )
    price_approved_by = relationship(
        "User", foreign_keys=[price_approved_by_id]
    )
    payment_collected_by = relationship(
        "User", foreign_keys=[payment_collected_by_id]
    )

    items = relationship(
        "CateringOrderItem", back_populates="order", cascade="all, delete-orphan"
    )

    @property
    def created_by_name(self):
        return self.created_by.name if self.created_by else None

    @property
    def price_approved_by_name(self):
        return self.price_approved_by.name if self.price_approved_by else None

    @property
    def payment_collected_by_name(self):
        if self.payment_collected_by_label:
            return self.payment_collected_by_label
        return self.payment_collected_by.name if self.payment_collected_by else None


class CateringOrderItem(Base):
    __tablename__ = "catering_order_items"

    id = Column(String, primary_key=True, default=generate_id)
    menu_item_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    special_instructions = Column(String, nullable=True)
    add_ons = Column(JSON, default=list)
    order_id = Column(
        String, ForeignKey("catering_orders.id", ondelete="CASCADE"), nullable=False
    )

    order = relationship("CateringOrder", back_populates="items")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(String, primary_key=True, default=generate_id)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(Enum(ExpenseType), nullable=False)
    category = Column(Enum(ExpenseCategory), nullable=False)
    date = Column(String, nullable=False)
    receipt_image_uri = Column(String, nullable=True)
    ocr_data = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=True)
    paid_by_user_id = Column(String, ForeignKey("users.id"), nullable=True)
    cash_amount = Column(Float, nullable=True)
    card_amount = Column(Float, nullable=True)
    zelle_amount = Column(Float, nullable=True)
    zelle_reference = Column(String, nullable=True)
    cheque_amount = Column(Float, nullable=True)
    cheque_number = Column(String, nullable=True)
    cheque_issue_date = Column(String, nullable=True)
    cheque_withdrawal_date = Column(String, nullable=True)
    cheque_image_uri = Column(String, nullable=True)
    is_paid = Column(Boolean, default=True, nullable=False)

    vendor = relationship("Vendor", back_populates="expenses")
    paid_by = relationship("User", foreign_keys=[paid_by_user_id])

    @property
    def vendor_name(self):
        return self.vendor.name if self.vendor else None

    @property
    def paid_by_name(self):
        return self.paid_by.name if self.paid_by else None


class Cheque(Base):
    __tablename__ = "cheques"

    id = Column(String, primary_key=True, default=generate_id)
    payee = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    cheque_number = Column(String, nullable=False)
    issue_date = Column(String, nullable=False)
    withdrawal_date = Column(String, nullable=True)
    is_cleared = Column(Boolean, default=False)
    image_uri = Column(String, nullable=True)
    ocr_data = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=True)
    expense_id = Column(String, ForeignKey("expenses.id"), nullable=True)
    settled_amount = Column(Float, default=0.0)

    vendor = relationship("Vendor", back_populates="cheques")
    expense = relationship("Expense", foreign_keys=[expense_id])

    @property
    def vendor_name(self):
        return self.vendor.name if self.vendor else None


class Employee(Base):
    __tablename__ = "employees"

    id = Column(String, primary_key=True, default=generate_id)
    name = Column(String, nullable=False)
    contact_number = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class EmployeeHours(Base):
    __tablename__ = "employee_hours"

    id = Column(String, primary_key=True, default=generate_id)
    employee_name = Column(String, nullable=False)
    date = Column(String, nullable=False)
    hours_worked = Column(Float, nullable=False)
    hourly_rate = Column(Float, nullable=False)
    is_paid = Column(Boolean, default=False)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CashReceived(Base):
    __tablename__ = "cash_received"

    id = Column(String, primary_key=True, default=generate_id)
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=False)
    date = Column(String, nullable=False)
    from_source = Column(String, nullable=True)
    paid_to = Column(String, nullable=True)
    catering_order_id = Column(String, ForeignKey("catering_orders.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    catering_order = relationship("CateringOrder", foreign_keys=[catering_order_id])

    @property
    def catering_order_number(self):
        return self.catering_order.order_number if self.catering_order else None
