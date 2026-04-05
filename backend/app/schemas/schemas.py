from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict

from app.models.models import (
    ExpenseCategory,
    ExpenseType,
    OrderStatus,
    PaymentType,
    UserRole,
)


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    role: UserRole
    created_at: Optional[datetime] = None


class LoginRequest(BaseModel):
    username: str
    password: str


# ---------------------------------------------------------------------------
# Clover
# ---------------------------------------------------------------------------

class CloverMenuItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    price: float
    category: str
    description: Optional[str] = None
    available: bool


class CloverTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    amount: float
    timestamp: datetime
    payment_type: PaymentType
    employee_name: str
    items: Optional[List[Any]] = []


class DailySummaryResponse(BaseModel):
    total_revenue: float
    cash_revenue: float
    card_revenue: float
    transaction_count: int
    top_items: List[Dict[str, Any]]
    date: str


# ---------------------------------------------------------------------------
# Catering Order Items
# ---------------------------------------------------------------------------

class CateringOrderItemCreate(BaseModel):
    menu_item_id: str
    name: str
    quantity: int
    unit_price: float
    special_instructions: Optional[str] = None
    add_ons: Optional[List[Any]] = []


class CateringOrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    menu_item_id: str
    name: str
    quantity: int
    unit_price: float
    special_instructions: Optional[str] = None
    add_ons: Optional[List[Any]] = []
    order_id: str


# ---------------------------------------------------------------------------
# Catering Orders
# ---------------------------------------------------------------------------

class TraySize(BaseModel):
    small: int = 0
    medium: int = 0
    large: int = 0
    xlarge: int = 0


class CateringOrderCreate(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    event_date: str
    event_type: str
    head_count: int
    estimated_price: float
    negotiated_price: float
    notes: Optional[str] = None
    tray_sizes: Optional[Dict[str, int]] = None
    items: List[CateringOrderItemCreate] = []


class CateringOrderUpdate(BaseModel):
    negotiated_price: Optional[float] = None
    estimated_price: Optional[float] = None
    notes: Optional[str] = None
    price_approval_status: Optional[str] = None
    tray_sizes: Optional[Dict[str, int]] = None


class CateringOrderPayment(BaseModel):
    payment_type: str
    payment_status: str = 'paid'
    payment_cash_amount: Optional[float] = None
    payment_card_amount: Optional[float] = None
    payment_cheque_amount: Optional[float] = None
    payment_zelle_amount: Optional[float] = None
    payment_other_amount: Optional[float] = None
    payment_cheque_number: Optional[str] = None
    payment_cheque_issue_date: Optional[str] = None
    payment_cheque_withdrawal_date: Optional[str] = None
    payment_cheque_image_uri: Optional[str] = None
    payment_zelle_reference: Optional[str] = None
    payment_zelle_date: Optional[str] = None
    payment_zelle_status: Optional[str] = None
    payment_other_details: Optional[str] = None
    payment_notes: Optional[str] = None


class CateringOrderStatusUpdate(BaseModel):
    status: OrderStatus
    rejection_reason: Optional[str] = None
    # Optional payment when marking completed
    payment: Optional[CateringOrderPayment] = None


class CustomerInfo(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    last_event_type: Optional[str] = None
    order_count: int = 1


class CateringOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    event_date: str
    event_type: str
    head_count: int
    estimated_price: float
    negotiated_price: float
    status: OrderStatus
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None
    tray_sizes: Optional[Dict[str, Any]] = None
    price_approval_status: Optional[str] = None
    price_approved_by_id: Optional[str] = None
    price_approved_by_name: Optional[str] = None
    payment_type: Optional[str] = None
    payment_status: Optional[str] = None
    payment_cash_amount: Optional[float] = None
    payment_card_amount: Optional[float] = None
    payment_cheque_amount: Optional[float] = None
    payment_zelle_amount: Optional[float] = None
    payment_other_amount: Optional[float] = None
    payment_cheque_number: Optional[str] = None
    payment_cheque_issue_date: Optional[str] = None
    payment_cheque_withdrawal_date: Optional[str] = None
    payment_cheque_image_uri: Optional[str] = None
    payment_zelle_reference: Optional[str] = None
    payment_zelle_date: Optional[str] = None
    payment_zelle_status: Optional[str] = None
    payment_other_details: Optional[str] = None
    payment_notes: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_id: str
    created_by_name: Optional[str] = None
    accepted_by_id: Optional[str] = None
    items: List[CateringOrderItemResponse] = []


# ---------------------------------------------------------------------------
# Vendors
# ---------------------------------------------------------------------------

class VendorCreate(BaseModel):
    name: str


class VendorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Expenses
# ---------------------------------------------------------------------------

class ExpenseCreate(BaseModel):
    description: str
    amount: float
    type: ExpenseType
    category: ExpenseCategory
    date: str
    vendor_id: Optional[str] = None
    paid_by_user_id: Optional[str] = None
    cash_amount: Optional[float] = None
    card_amount: Optional[float] = None
    zelle_amount: Optional[float] = None
    zelle_reference: Optional[str] = None
    cheque_amount: Optional[float] = None
    cheque_number: Optional[str] = None
    cheque_issue_date: Optional[str] = None
    cheque_withdrawal_date: Optional[str] = None


class ExpenseUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[ExpenseType] = None
    category: Optional[ExpenseCategory] = None
    date: Optional[str] = None
    vendor_id: Optional[str] = None
    paid_by_user_id: Optional[str] = None
    cash_amount: Optional[float] = None
    card_amount: Optional[float] = None
    zelle_amount: Optional[float] = None
    zelle_reference: Optional[str] = None
    cheque_amount: Optional[float] = None
    cheque_number: Optional[str] = None
    cheque_issue_date: Optional[str] = None
    cheque_withdrawal_date: Optional[str] = None


class BulkSettleRequest(BaseModel):
    expense_ids: List[str]
    cheque_number: str
    issue_date: str
    withdrawal_date: Optional[str] = None
    image_uri: Optional[str] = None


class ExpenseResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    description: str
    amount: float
    type: ExpenseType
    category: ExpenseCategory
    date: str
    is_paid: bool = True
    vendor_id: Optional[str] = None
    vendor_name: Optional[str] = None
    paid_by_user_id: Optional[str] = None
    paid_by_name: Optional[str] = None
    cash_amount: Optional[float] = None
    card_amount: Optional[float] = None
    zelle_amount: Optional[float] = None
    zelle_reference: Optional[str] = None
    cheque_amount: Optional[float] = None
    cheque_number: Optional[str] = None
    cheque_issue_date: Optional[str] = None
    cheque_withdrawal_date: Optional[str] = None
    cheque_image_uri: Optional[str] = None
    receipt_image_uri: Optional[str] = None
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Cheques
# ---------------------------------------------------------------------------

class ChequeCreate(BaseModel):
    payee: str
    amount: float
    cheque_number: str
    issue_date: str
    withdrawal_date: Optional[str] = None


class ChequeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    payee: str
    amount: float
    cheque_number: str
    issue_date: str
    withdrawal_date: Optional[str] = None
    is_cleared: bool
    settled_amount: float = 0.0
    vendor_id: Optional[str] = None
    vendor_name: Optional[str] = None
    expense_id: Optional[str] = None
    image_uri: Optional[str] = None
    created_at: Optional[datetime] = None


class ChequesByVendorItem(BaseModel):
    vendor_id: Optional[str]
    vendor_name: str
    total_outstanding: float
    cheque_count: int
    cheques: List[ChequeResponse]


class SettleChequeRequest(BaseModel):
    cheque_number: str
    issue_date: str
    withdrawal_date: Optional[str] = None
    amount: float
    image_uri: Optional[str] = None


# ---------------------------------------------------------------------------
# Employee Hours
# ---------------------------------------------------------------------------

class EmployeeHoursCreate(BaseModel):
    employee_name: str
    date: str
    hours_worked: float
    hourly_rate: float


class EmployeeHoursResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    employee_name: str
    date: str
    hours_worked: float
    hourly_rate: float
    is_paid: bool


# ---------------------------------------------------------------------------
# Cash Received
# ---------------------------------------------------------------------------

class CashReceivedCreate(BaseModel):
    amount: float
    description: str
    date: str


class CashReceivedResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    amount: float
    description: str
    date: str
    created_at: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------

class RevenueReport(BaseModel):
    restaurant_revenue: float
    catering_revenue: float
    total_revenue: float


class ExpensesByType(BaseModel):
    cash: float
    card: float
    cheque: float
    zelle: float


class ExpensesByCategory(BaseModel):
    supplies: float
    salary: float
    rent: float
    utilities: float
    other: float


class ExpensesReport(BaseModel):
    total: float
    by_type: ExpensesByType
    by_category: ExpensesByCategory


class UpcomingSalaryPayment(BaseModel):
    employee_name: str
    amount: float
    date: str


class CashFlowReport(BaseModel):
    current_balance: float
    outstanding_cheques_count: int
    outstanding_cheques_total: float
    upcoming_salary_payments: List[UpcomingSalaryPayment]


class ReportsResponse(BaseModel):
    revenue: RevenueReport
    expenses: ExpensesReport
    cash_flow: CashFlowReport
