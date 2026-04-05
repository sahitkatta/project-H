from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import (
    CashReceived,
    CateringOrder,
    CloverTransaction,
    EmployeeHours,
    Expense,
    ExpenseCategory,
    ExpenseType,
    OrderStatus,
    PaymentType,
    Cheque,
    User,
)
from app.schemas.schemas import (
    CashFlowReport,
    ExpensesByCategory,
    ExpensesByType,
    ExpensesReport,
    ReportsResponse,
    RevenueReport,
    UpcomingSalaryPayment,
)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("", response_model=ReportsResponse)
def get_reports(
    period: str = Query("weekly", pattern="^(weekly|monthly)$"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    today = date.today()
    if period == "weekly":
        delta = timedelta(days=7)
    else:
        delta = timedelta(days=30)

    start_date = today - delta
    start_str = start_date.isoformat()
    end_str = today.isoformat()

    # -----------------------------------------------------------------------
    # Revenue
    # -----------------------------------------------------------------------

    # Restaurant revenue from Clover transactions in period
    clover_txns = (
        db.query(CloverTransaction)
        .filter(
            CloverTransaction.timestamp >= f"{start_str}T00:00:00",
            CloverTransaction.timestamp <= f"{end_str}T23:59:59",
        )
        .all()
    )
    restaurant_revenue = round(sum(t.amount for t in clover_txns), 2)

    # Catering revenue from completed orders with event_date or created_at in period
    # Use created_at datetime range for string-date comparison on event_date field
    completed_orders = (
        db.query(CateringOrder)
        .filter(
            CateringOrder.status == OrderStatus.completed,
            CateringOrder.event_date >= start_str,
            CateringOrder.event_date <= end_str,
        )
        .all()
    )
    catering_revenue = round(sum(o.negotiated_price for o in completed_orders), 2)

    total_revenue = round(restaurant_revenue + catering_revenue, 2)

    # -----------------------------------------------------------------------
    # Expenses
    # -----------------------------------------------------------------------

    expenses = (
        db.query(Expense)
        .filter(
            Expense.date >= start_str,
            Expense.date <= end_str,
        )
        .all()
    )

    total_expenses = round(sum(e.amount for e in expenses), 2)

    by_type = {t.value: 0.0 for t in ExpenseType}
    by_category = {c.value: 0.0 for c in ExpenseCategory}

    for e in expenses:
        by_type[e.type.value] = round(by_type[e.type.value] + e.amount, 2)
        by_category[e.category.value] = round(by_category[e.category.value] + e.amount, 2)

    # -----------------------------------------------------------------------
    # Cash Flow
    # -----------------------------------------------------------------------

    # Cash balance = total cash received - total cash expenses (all time)
    total_cash_in = db.query(CashReceived).all()
    cash_in_total = round(sum(c.amount for c in total_cash_in), 2)

    cash_expenses = (
        db.query(Expense).filter(Expense.type == ExpenseType.cash).all()
    )
    cash_out_total = round(sum(e.amount for e in cash_expenses), 2)
    current_balance = round(cash_in_total - cash_out_total, 2)

    # Outstanding cheques
    outstanding_cheques = (
        db.query(Cheque).filter(Cheque.is_cleared == False).all()  # noqa: E712
    )
    outstanding_cheques_count = len(outstanding_cheques)
    outstanding_cheques_total = round(sum(c.amount for c in outstanding_cheques), 2)

    # Upcoming salary payments (unpaid employee hours)
    unpaid_hours = (
        db.query(EmployeeHours)
        .filter(EmployeeHours.is_paid == False)  # noqa: E712
        .order_by(EmployeeHours.date.asc())
        .all()
    )

    upcoming_salary_payments = [
        UpcomingSalaryPayment(
            employee_name=eh.employee_name,
            amount=round(eh.hours_worked * eh.hourly_rate, 2),
            date=eh.date,
        )
        for eh in unpaid_hours
    ]

    return ReportsResponse(
        revenue=RevenueReport(
            restaurant_revenue=restaurant_revenue,
            catering_revenue=catering_revenue,
            total_revenue=total_revenue,
        ),
        expenses=ExpensesReport(
            total=total_expenses,
            by_type=ExpensesByType(
                cash=by_type["cash"],
                card=by_type["card"],
                cheque=by_type["cheque"],
                zelle=by_type["zelle"],
            ),
            by_category=ExpensesByCategory(
                supplies=by_category["supplies"],
                salary=by_category["salary"],
                rent=by_category["rent"],
                utilities=by_category["utilities"],
                other=by_category["other"],
            ),
        ),
        cash_flow=CashFlowReport(
            current_balance=current_balance,
            outstanding_cheques_count=outstanding_cheques_count,
            outstanding_cheques_total=outstanding_cheques_total,
            upcoming_salary_payments=upcoming_salary_payments,
        ),
    )
