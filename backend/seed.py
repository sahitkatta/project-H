"""
Standalone seed script for Basera.
Run directly: python seed.py
In Docker: runs before uvicorn starts (see Dockerfile CMD).
"""

import os
import sys
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Database setup (local fallback to localhost, Docker uses 'db' host)
# ---------------------------------------------------------------------------

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://basera:basera_dev_123@localhost:5432/basera",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ---------------------------------------------------------------------------
# Import models (after engine is configured so Base.metadata is populated)
# ---------------------------------------------------------------------------

# Ensure the app package can be found when running as `python seed.py`
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from passlib.context import CryptContext  # noqa: E402

from app.database import Base  # noqa: E402
from app.models.models import (  # noqa: E402
    CashReceived,
    CateringOrder,
    CateringOrderItem,
    Cheque,
    CloverMenuItem,
    CloverTransaction,
    EmployeeHours,
    Expense,
    ExpenseCategory,
    ExpenseType,
    OrderStatus,
    PaymentType,
    User,
    UserRole,
    Vendor,
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_tables():
    Base.metadata.create_all(bind=engine)
    # Apply incremental column additions for existing databases
    with engine.connect() as conn:
        migrations = [
            "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT TRUE",
            "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS zelle_amount FLOAT",
            "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS zelle_reference VARCHAR",
            "ALTER TABLE expenses ADD COLUMN IF NOT EXISTS cheque_amount FLOAT",
            # Catering order enhancements
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS tray_sizes JSONB",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS price_approval_status VARCHAR",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS price_approved_by_id VARCHAR REFERENCES users(id)",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_type VARCHAR",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_cash_amount FLOAT",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_card_amount FLOAT",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_cheque_amount FLOAT",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_zelle_amount FLOAT",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_other_amount FLOAT",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_cheque_number VARCHAR",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_cheque_issue_date VARCHAR",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_cheque_withdrawal_date VARCHAR",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_cheque_image_uri VARCHAR",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_zelle_reference VARCHAR",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_zelle_date VARCHAR",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_zelle_status VARCHAR",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_other_details VARCHAR",
            "ALTER TABLE catering_orders ADD COLUMN IF NOT EXISTS payment_notes VARCHAR",
        ]
        for sql in migrations:
            try:
                conn.execute(__import__('sqlalchemy').text(sql))
                conn.commit()
            except Exception:
                conn.rollback()


def parse_dt(s: str) -> datetime:
    """Parse an ISO 8601 UTC datetime string."""
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def seed():
    db = SessionLocal()
    try:
        # Guard: skip if already seeded
        if db.query(User).count() > 0:
            print("Database already seeded. Skipping.")
            return

        print("Seeding database...")

        # -------------------------------------------------------------------
        # Users
        # -------------------------------------------------------------------
        hashed = pwd_context.hash("password")
        users = [
            User(id="senthil", name="Senthil", username="senthil", password_hash=hashed, role=UserRole.owner),
            User(id="hari", name="Hari", username="hari", password_hash=hashed, role=UserRole.manager),
            User(id="cashier1", name="Cashier", username="cashier1", password_hash=hashed, role=UserRole.cashier),
        ]
        db.add_all(users)
        db.flush()
        print(f"  Created {len(users)} users")

        # -------------------------------------------------------------------
        # Vendors
        # -------------------------------------------------------------------
        vendors = [
            Vendor(id="v-001", name="Patel Wholesale Grocers"),
            Vendor(id="v-002", name="Sunrise Property Management"),
            Vendor(id="v-003", name="Kumar Linen Services"),
            Vendor(id="v-004", name="India Bazaar"),
            Vendor(id="v-005", name="Local Utility Co"),
        ]
        db.add_all(vendors)
        db.flush()
        print(f"  Created {len(vendors)} vendors")

        # -------------------------------------------------------------------
        # Clover Menu Items
        # -------------------------------------------------------------------
        menu_items = [
            CloverMenuItem(id="mi-001", name="Butter Chicken", price=18.99, category="Entrees"),
            CloverMenuItem(id="mi-002", name="Chicken Biryani", price=17.99, category="Entrees"),
            CloverMenuItem(id="mi-003", name="Naan", price=3.49, category="Breads"),
            CloverMenuItem(id="mi-004", name="Samosa (2 pcs)", price=6.99, category="Appetizers"),
            CloverMenuItem(id="mi-005", name="Dal Makhani", price=14.99, category="Entrees"),
            CloverMenuItem(id="mi-006", name="Tandoori Chicken", price=16.99, category="Entrees"),
            CloverMenuItem(id="mi-007", name="Paneer Tikka", price=14.99, category="Appetizers"),
            CloverMenuItem(id="mi-008", name="Mango Lassi", price=4.99, category="Beverages"),
            CloverMenuItem(id="mi-009", name="Gulab Jamun (3 pcs)", price=5.99, category="Desserts"),
            CloverMenuItem(id="mi-010", name="Chicken Tikka Masala", price=18.99, category="Entrees"),
            CloverMenuItem(id="mi-011", name="Palak Paneer", price=15.99, category="Entrees"),
            CloverMenuItem(id="mi-012", name="Chole Bhature", price=13.99, category="Entrees"),
            CloverMenuItem(id="mi-013", name="Garlic Naan", price=4.49, category="Breads"),
            CloverMenuItem(id="mi-014", name="Raita", price=3.99, category="Sides"),
            CloverMenuItem(id="mi-015", name="Masala Chai", price=3.49, category="Beverages"),
        ]
        db.add_all(menu_items)
        db.flush()
        print(f"  Created {len(menu_items)} menu items")

        # -------------------------------------------------------------------
        # Clover Transactions
        # -------------------------------------------------------------------
        transactions = [
            CloverTransaction(
                id="txn-001", amount=48.46,
                timestamp=parse_dt("2026-03-27T12:15:00Z"),
                payment_type=PaymentType.card, employee_name="Ravi K.", items=[],
            ),
            CloverTransaction(
                id="txn-002", amount=36.97,
                timestamp=parse_dt("2026-03-27T12:42:00Z"),
                payment_type=PaymentType.card, employee_name="Priya M.", items=[],
            ),
            CloverTransaction(
                id="txn-003", amount=22.48,
                timestamp=parse_dt("2026-03-27T13:05:00Z"),
                payment_type=PaymentType.cash, employee_name="Ravi K.", items=[],
            ),
            CloverTransaction(
                id="txn-004", amount=55.96,
                timestamp=parse_dt("2026-03-27T13:30:00Z"),
                payment_type=PaymentType.card, employee_name="Priya M.", items=[],
            ),
            CloverTransaction(
                id="txn-005", amount=34.97,
                timestamp=parse_dt("2026-03-27T14:10:00Z"),
                payment_type=PaymentType.cash, employee_name="Ravi K.", items=[],
            ),
            CloverTransaction(
                id="txn-006", amount=27.47,
                timestamp=parse_dt("2026-03-27T17:45:00Z"),
                payment_type=PaymentType.card, employee_name="Anita S.", items=[],
            ),
            CloverTransaction(
                id="txn-007", amount=42.97,
                timestamp=parse_dt("2026-03-27T18:20:00Z"),
                payment_type=PaymentType.card, employee_name="Anita S.", items=[],
            ),
            CloverTransaction(
                id="txn-008", amount=19.48,
                timestamp=parse_dt("2026-03-27T18:55:00Z"),
                payment_type=PaymentType.cash, employee_name="Ravi K.", items=[],
            ),
            CloverTransaction(
                id="txn-009", amount=63.95,
                timestamp=parse_dt("2026-03-27T19:30:00Z"),
                payment_type=PaymentType.card, employee_name="Priya M.", items=[],
            ),
            CloverTransaction(
                id="txn-010", amount=29.97,
                timestamp=parse_dt("2026-03-27T20:10:00Z"),
                payment_type=PaymentType.cash, employee_name="Anita S.", items=[],
            ),
        ]
        db.add_all(transactions)
        db.flush()
        print(f"  Created {len(transactions)} transactions")

        # -------------------------------------------------------------------
        # Catering Orders (with items)
        # -------------------------------------------------------------------

        # cat-001: Sharma Family — accepted
        order1 = CateringOrder(
            id="cat-001",
            customer_name="Sharma Family",
            customer_phone="(512) 555-1234",
            customer_email="sharma.family@email.com",
            event_date="2026-04-05",
            event_type="Wedding Reception",
            head_count=150,
            estimated_price=2285.00,
            negotiated_price=2100.00,
            status=OrderStatus.accepted,
            created_by_id="senthil",
            accepted_by_id="senthil",
        )
        db.add(order1)
        db.flush()
        db.add_all([
            CateringOrderItem(id="coi-001-1", order_id="cat-001", menu_item_id="mi-001", name="Butter Chicken", quantity=40, unit_price=12.0, add_ons=[]),
            CateringOrderItem(id="coi-001-2", order_id="cat-001", menu_item_id="mi-002", name="Chicken Biryani", quantity=50, unit_price=11.0, add_ons=[]),
            CateringOrderItem(id="coi-001-3", order_id="cat-001", menu_item_id="mi-011", name="Palak Paneer", quantity=30, unit_price=10.0, add_ons=[]),
            CateringOrderItem(id="coi-001-4", order_id="cat-001", menu_item_id="mi-003", name="Naan", quantity=200, unit_price=1.5, add_ons=[]),
            CateringOrderItem(id="coi-001-5", order_id="cat-001", menu_item_id="mi-009", name="Gulab Jamun (3 pcs)", quantity=60, unit_price=3.5, add_ons=[]),
        ])

        # cat-002: Patel Corp — pending
        order2 = CateringOrder(
            id="cat-002",
            customer_name="Patel Corp",
            customer_phone="(512) 555-5678",
            customer_email="events@patelcorp.com",
            event_date="2026-04-12",
            event_type="Corporate Lunch",
            head_count=50,
            estimated_price=675.00,
            negotiated_price=625.00,
            status=OrderStatus.pending,
            created_by_id="senthil",
        )
        db.add(order2)
        db.flush()
        db.add_all([
            CateringOrderItem(id="coi-002-1", order_id="cat-002", menu_item_id="mi-010", name="Chicken Tikka Masala", quantity=20, unit_price=12.0, add_ons=[]),
            CateringOrderItem(id="coi-002-2", order_id="cat-002", menu_item_id="mi-005", name="Dal Makhani", quantity=15, unit_price=9.0, add_ons=[]),
            CateringOrderItem(id="coi-002-3", order_id="cat-002", menu_item_id="mi-013", name="Garlic Naan", quantity=60, unit_price=2.0, add_ons=[]),
            CateringOrderItem(id="coi-002-4", order_id="cat-002", menu_item_id="mi-008", name="Mango Lassi", quantity=50, unit_price=3.0, add_ons=[]),
        ])

        # cat-003: Gupta Residence — completed
        order3 = CateringOrder(
            id="cat-003",
            customer_name="Gupta Residence",
            customer_phone="(512) 555-9012",
            event_date="2026-03-20",
            event_type="Birthday Party",
            head_count=30,
            estimated_price=365.00,
            negotiated_price=340.00,
            status=OrderStatus.completed,
            created_by_id="senthil",
            accepted_by_id="senthil",
        )
        db.add(order3)
        db.flush()
        db.add_all([
            CateringOrderItem(id="coi-003-1", order_id="cat-003", menu_item_id="mi-006", name="Tandoori Chicken", quantity=10, unit_price=11.0, add_ons=[]),
            CateringOrderItem(id="coi-003-2", order_id="cat-003", menu_item_id="mi-004", name="Samosa (2 pcs)", quantity=30, unit_price=4.0, add_ons=[]),
            CateringOrderItem(id="coi-003-3", order_id="cat-003", menu_item_id="mi-012", name="Chole Bhature", quantity=15, unit_price=9.0, add_ons=[]),
        ])

        # cat-004: Reddy Engagement — pending
        order4 = CateringOrder(
            id="cat-004",
            customer_name="Reddy Engagement",
            customer_phone="(512) 555-3456",
            customer_email="reddy.events@email.com",
            event_date="2026-04-20",
            event_type="Engagement Ceremony",
            head_count=80,
            estimated_price=1015.00,
            negotiated_price=950.00,
            status=OrderStatus.pending,
            created_by_id="senthil",
        )
        db.add(order4)
        db.flush()
        db.add_all([
            CateringOrderItem(id="coi-004-1", order_id="cat-004", menu_item_id="mi-001", name="Butter Chicken", quantity=25, unit_price=12.0, add_ons=[]),
            CateringOrderItem(id="coi-004-2", order_id="cat-004", menu_item_id="mi-007", name="Paneer Tikka", quantity=20, unit_price=10.0, add_ons=[]),
            CateringOrderItem(id="coi-004-3", order_id="cat-004", menu_item_id="mi-003", name="Naan", quantity=100, unit_price=1.5, add_ons=[]),
            CateringOrderItem(id="coi-004-4", order_id="cat-004", menu_item_id="mi-015", name="Masala Chai", quantity=80, unit_price=2.0, add_ons=[]),
        ])

        db.flush()
        print("  Created 4 catering orders with items")

        # -------------------------------------------------------------------
        # Expenses
        # -------------------------------------------------------------------
        expenses = [
            Expense(
                id="exp-001",
                description="Weekly produce from Patel Wholesale",
                amount=850.0,
                type=ExpenseType.cheque,
                category=ExpenseCategory.groceries,
                date="2026-03-25",
                vendor_id="v-001",
            ),
            Expense(
                id="exp-002",
                description="Monthly rent - Basera restaurant space",
                amount=4500.0,
                type=ExpenseType.cheque,
                category=ExpenseCategory.rent,
                date="2026-03-01",
                vendor_id="v-002",
            ),
            Expense(
                id="exp-003",
                description="Electricity bill - March",
                amount=620.0,
                type=ExpenseType.card,
                category=ExpenseCategory.utilities,
                date="2026-03-15",
            ),
            Expense(
                id="exp-004",
                description="Emergency spice restock from India Bazaar",
                amount=185.50,
                type=ExpenseType.cash,
                category=ExpenseCategory.groceries,
                date="2026-03-22",
                vendor_id="v-004",
            ),
            Expense(
                id="exp-005",
                description="Gas bill - March",
                amount=340.0,
                type=ExpenseType.zelle,
                category=ExpenseCategory.utilities,
                date="2026-03-18",
                vendor_id="v-005",
            ),
            Expense(
                id="exp-006",
                description="Kitchen equipment repair - tandoor maintenance",
                amount=275.0,
                type=ExpenseType.cash,
                category=ExpenseCategory.other,
                date="2026-03-24",
            ),
        ]
        db.add_all(expenses)
        db.flush()
        print(f"  Created {len(expenses)} expenses")

        # -------------------------------------------------------------------
        # Cheques
        # -------------------------------------------------------------------
        cheques = [
            Cheque(
                id="chq-001",
                payee="Patel Wholesale Grocers",
                amount=850.0,
                cheque_number="4521",
                issue_date="2026-03-25",
                withdrawal_date="2026-03-27",
                is_cleared=True,
                vendor_id="v-001",
            ),
            Cheque(
                id="chq-002",
                payee="Sunrise Property Management",
                amount=4500.0,
                cheque_number="4522",
                issue_date="2026-03-01",
                is_cleared=False,
                vendor_id="v-002",
            ),
            Cheque(
                id="chq-003",
                payee="Kumar Linen Services",
                amount=320.0,
                cheque_number="4523",
                issue_date="2026-03-26",
                is_cleared=False,
                vendor_id="v-003",
            ),
        ]
        db.add_all(cheques)
        db.flush()
        print(f"  Created {len(cheques)} cheques")

        # -------------------------------------------------------------------
        # Employee Hours
        # -------------------------------------------------------------------
        employee_hours = [
            EmployeeHours(
                id="eh-001",
                employee_name="Ravi Kumar",
                date="2026-03-27",
                hours_worked=8.0,
                hourly_rate=16.0,
                is_paid=False,
            ),
            EmployeeHours(
                id="eh-002",
                employee_name="Priya Menon",
                date="2026-03-27",
                hours_worked=7.5,
                hourly_rate=16.0,
                is_paid=False,
            ),
            EmployeeHours(
                id="eh-003",
                employee_name="Anita Singh",
                date="2026-03-27",
                hours_worked=6.0,
                hourly_rate=15.0,
                is_paid=False,
            ),
            EmployeeHours(
                id="eh-004",
                employee_name="Deepak Joshi",
                date="2026-03-26",
                hours_worked=8.0,
                hourly_rate=18.0,
                is_paid=True,
            ),
        ]
        db.add_all(employee_hours)
        db.flush()
        print(f"  Created {len(employee_hours)} employee hour records")

        # -------------------------------------------------------------------
        # Cash Received
        # -------------------------------------------------------------------
        cash_received = [
            CashReceived(
                id="cr-001",
                amount=500.0,
                description="Cash deposit from weekend sales",
                date="2026-03-24",
            ),
            CashReceived(
                id="cr-002",
                amount=340.0,
                description="Catering deposit - Gupta Birthday Party",
                date="2026-03-18",
            ),
            CashReceived(
                id="cr-003",
                amount=1050.0,
                description="Catering advance - Sharma Wedding Reception",
                date="2026-03-16",
            ),
        ]
        db.add_all(cash_received)
        db.flush()
        print(f"  Created {len(cash_received)} cash received records")

        db.commit()
        print("Seeding complete!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print(f"Using DATABASE_URL: {DATABASE_URL}")
    create_tables()
    seed()
