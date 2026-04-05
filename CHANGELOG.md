# Basera — Build Changelog

All features built for the Basera restaurant management app. Ordered by session/feature set.

---

## Session 1 — Initial Build

**Goal:** Full-stack app from scratch based on documentation in `/ProjectH/docs/`.

### Stack
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + React Router v6
- **Backend**: Python FastAPI + SQLAlchemy (sync) + PostgreSQL
- **Infrastructure**: Docker Compose (3 services: db, backend, frontend)

### What was built
- Docker Compose setup with `db` (postgres:16-alpine, port 5433), `backend` (port 8000), `frontend` (nginx port 3000)
- Multi-stage Dockerfile for frontend: Node builder → nginx serving static dist
- nginx reverse proxy: `/api/*` → `http://backend:8000`, SPA fallback for React Router
- Full SQLAlchemy ORM models: User, Vendor, Expense, Cheque, CateringOrder, CateringOrderItem, CloverMenuItem, CloverTransaction, EmployeeHours, CashReceived
- FastAPI routers: auth, catering, expenses, vendors, reports, clover
- React pages: Dashboard, Login (role-picker), Catering list/create/detail, Expenses list/create, Reports, Settings
- Idempotent `seed.py` that creates users and sample data on first boot

---

## Session 2 — Login Fix

**Problem:** Login was a card-picker (click a role), not a real login form.

### Changes
- Added `username` and `password_hash` columns to `User` model
- `seed.py` creates users with bcrypt-hashed passwords:
  - `senthil` / `password` — Owner
  - `hari` / `password` — Manager
  - `cashier1` / `password` — Cashier
- Auth router updated: `POST /auth/login` verifies bcrypt hash, returns user
- `LoginPage.tsx` replaced with username + password form
- `api.ts` `login()` fixed to call `POST /auth/login`

---

## Session 3 — Portability

**Goal:** `docker compose up --build` works on any machine with Docker installed.

### Changes
- `.dockerignore` for backend (excludes `__pycache__`, `venv`, `.env`)
- `.dockerignore` for frontend (excludes `node_modules`, `dist`) — reduced build context from 77 MB to 88 bytes
- `.gitignore` protecting credentials and build artifacts
- README with one-command setup instructions

---

## Session 4 — Expense Enhancements

**Source:** `Improvements.md` first block.

### Backend
- New `Vendor` model + `GET /vendors`, `POST /vendors` router
- `Expense` model additions:
  - `vendor_id` (FK), `paid_by_user_id` (FK)
  - `cash_amount`, `card_amount` (for Mix type)
  - `cheque_number`, `cheque_issue_date`, `cheque_withdrawal_date`, `cheque_image_uri`
- `ExpenseType` enum: `cash | card | cheque | zelle | mix`
- `ExpenseCategory` enum updated: `groceries | catering | supplies | salary | rent | utilities | other`
- `@property` on Expense: `vendor_name`, `paid_by_name` (readable by Pydantic)
- `Cheque` model: tracks standalone cheque records linked to expenses
- `POST /expenses/cheques/bulk-settle`: settle multiple cheques at once
- `GET /expenses/cheques/by-vendor`: grouped outstanding cheques with totals

### Frontend
- `CreateExpensePage.tsx`:
  - Vendor dropdown with inline "Add new vendor" flow (saves to DB)
  - Paid By dropdown (all users)
  - Payment type segmented control: Cash | Card | Cheque | Zelle | Mix
  - Mix: shows cash_amount + card_amount, auto-calculates total
  - Cheque: shows cheque number, issue date, withdrawal date, image upload with preview
  - 7 categories
- `ChequesPage.tsx`:
  - "By Vendor" tab: expandable vendor cards, inline settle form per cheque
  - "All Cheques" tab: outstanding / cleared sections

---

## Session 5 — Edit Expense + Unpaid / Bulk Settle

**Source:** `Improvements.md` second block.

### Backend
- `is_paid` column added to `Expense` (Boolean, default True)
- `is_paid` logic:
  - `cash | card | zelle | mix` → always paid on creation
  - `cheque` → paid only when `cheque_number` is set; unpaid if no cheque number
- `PATCH /expenses/:id` — edit any expense field, recalculates `is_paid`, auto-creates Cheque record if cheque number added
- `GET /expenses?is_paid=false` — filter unpaid expenses
- `POST /expenses/bulk-settle` — mark multiple unpaid expenses as settled with one set of cheque details (creates Cheque records for each)
- Route ordering fixed: `/cheques/by-vendor` before `/cheques/:id`, `bulk-settle` before `/:id`

### Frontend
- `types/index.ts`: added `is_paid: boolean` to Expense
- `api.ts`: added `updateExpense()`, `bulkSettleExpenses()`, `BulkSettleData` interface; `getExpenses()` accepts `isPaid` filter
- `ExpensesPage.tsx` (full rewrite):
  - Tabs: "All (N)" | "Unpaid (N)"
  - Inline `EditForm` component: edit all fields including cheque number
  - `BulkSettlePanel`: sticky bottom bar when expenses selected, enter one set of cheque details to settle multiple at once
  - `ExpenseRow`: checkbox (unpaid tab), edit pencil icon, "Unpaid" badge
  - Select-all checkbox on unpaid tab

---

## Session 6 — Mix Payment + Zelle Reference

**Source:** `Improvements.md` third block — "Mix amount support all payment types, Zelle transaction, cheque details etc."

### Backend
- New columns on `Expense`:
  - `zelle_reference` — transaction ID for Zelle payments
  - `zelle_amount` — Zelle component in Mix
  - `cheque_amount` — Cheque component in Mix
- `ExpenseCreate`, `ExpenseUpdate`, `ExpenseResponse` schemas updated
- `seed.py` migration: `ALTER TABLE IF NOT EXISTS` for all new columns (safe on existing DBs)

### Frontend
- `types/index.ts`: `zelle_reference?`, `zelle_amount?`, `cheque_amount?` added to Expense
- `CreateExpensePage.tsx`:
  - **Standalone Zelle**: shows Zelle Reference / Transaction ID field
  - **Mix**: toggle buttons for Cash / Card / Zelle / Cheque sub-components
    - Each toggled component shows its own amount + metadata fields
    - Zelle component: amount + transaction reference
    - Cheque component: amount + number + issue date + withdrawal date + image
    - Total auto-calculated from all active components
- `ExpensesPage.tsx` (EditForm):
  - Mix section shows all 4 sub-components (cash, card, zelle with ref, cheque with details)
  - Standalone Zelle shows reference field
- Expense row: Zelle reference shown inline; Mix breakdown shows all component amounts

---

## Session 7 — Catering Order Enhancements

**Source:** `Improvements.md` catering block + follow-up message.

### 1. Any user can create orders
- Removed `allowedRoles={['manager', 'owner']}` from `/catering/create` route in `App.tsx`
- "New Order" button shown for all roles in `CateringListPage`

### 2. Customer Prefill from Past Orders
- `GET /catering/customers?q=...` endpoint: searches past orders by name, phone, email, deduplicates by phone, returns up to 20 results
- `CreateOrderPage`: phone field debounce-searches customers (400ms), shows dropdown with past customer cards
- Clicking a result prefills name, phone, email, and last event type

### 3. Tray Sizes (Optional)
- `tray_sizes` JSON column on `CateringOrder`: `{small, medium, large, xlarge}`
- `CreateOrderPage` Step 1: "Tray Sizes" section with +/- quantity controls for each size
- Tray sizes displayed on order detail page
- Tray sizes prominently shown on kitchen print sheet

### 4. Cashier Price Approval Flow
- When cashier creates order: `price_approval_status = 'pending_approval'`
- `price_approved_by_id` FK + `price_approved_by_name` property added to model
- Orange "Price Needs Approval" badge in order list and detail page
- Owner/Manager sees "Approve Price" button; clicking sets `price_approval_status = 'approved'`
- Cashier sees notice on pricing step of create form

### 5. Negotiate Price (replaces Reject as primary action)
- `PATCH /catering/orders/:id` endpoint for non-status updates (price, notes, tray sizes, approval)
- Order detail pending actions:
  - **Accept Order** (prominent, green)
  - **Negotiate Price** (opens inline form with new price + note fields)
  - **Reject** (de-emphasized, small red text link)

### 6. Kitchen Print PDF
- New route: `/catering/:id/print` → `KitchenPrintPage.tsx`
- Printer icon in order detail header opens print page in new tab
- Print page auto-triggers `window.print()` on load
- Layout: Basera header, order ID, customer/event grid, tray size boxes (large numbers), items table with quantities, pricing, signature lines
- `@media print` CSS for clean output

### 7 & 8. Payment Details — with Pre-Complete Gate

#### Backend
- 19 new payment columns on `CateringOrder`:
  - `payment_type`, `payment_status`
  - `payment_cash_amount`, `payment_card_amount`, `payment_cheque_amount`, `payment_zelle_amount`, `payment_other_amount`
  - `payment_cheque_number`, `payment_cheque_issue_date`, `payment_cheque_withdrawal_date`, `payment_cheque_image_uri`
  - `payment_zelle_reference`, `payment_zelle_date`, `payment_zelle_status`
  - `payment_other_details`, `payment_notes`
- `CateringOrderPayment` Pydantic schema
- `CateringOrderStatusUpdate` extended with optional `payment` field
- `POST /catering/orders/:id/status` with `status=completed` now accepts inline payment; if none provided, sets `payment_status = 'unpaid'`
- `PATCH /catering/orders/:id/payment` — add/update payment on any order

#### Frontend
- `OrderDetailPage.tsx` — "Mark as Completed" opens `PaymentForm` inline (payment required before completing)
- `PaymentForm` supports: Cash, Card, Cheque (number/dates/image), Zelle (ref/date/status), Other, Mix of any combination
- **"Mark as Unpaid / Collect Later"** checkbox: completes the order with `payment_status = 'unpaid'`
- Completed + unpaid orders show red "Payment Outstanding" banner with "Collect Payment" button
- `PaymentSummary` component: shows all payment details on order detail
- Payment status badge (Paid / Unpaid / Partial) shown in order list

---

## Data Model Summary

### Expense
| Column | Type | Notes |
|---|---|---|
| `is_paid` | Boolean | False when cheque type with no cheque number |
| `vendor_id` | FK | Optional |
| `paid_by_user_id` | FK | Optional |
| `cash_amount` | Float | Mix component |
| `card_amount` | Float | Mix component |
| `zelle_amount` | Float | Mix component |
| `zelle_reference` | String | Standalone Zelle or Mix |
| `cheque_amount` | Float | Mix component |
| `cheque_number` | String | Standalone cheque or Mix |
| `cheque_issue_date` | String | |
| `cheque_withdrawal_date` | String | |
| `cheque_image_uri` | String | Base64 or URI |

### CateringOrder (additions)
| Column | Type | Notes |
|---|---|---|
| `tray_sizes` | JSON | `{small, medium, large, xlarge}` |
| `price_approval_status` | String | `pending_approval` / `approved` |
| `price_approved_by_id` | FK | |
| `payment_type` | String | `cash/card/cheque/zelle/other/mix/unpaid` |
| `payment_status` | String | `paid/unpaid/partial` |
| `payment_*_amount` | Float | Per method component |
| `payment_cheque_*` | String | Cheque metadata |
| `payment_zelle_*` | String | Zelle metadata |
| `payment_other_*` | String | Other method |
| `payment_notes` | String | Free text |

---

## API Endpoints Added

### Expenses
| Method | Path | Description |
|---|---|---|
| `GET` | `/expenses?is_paid=false` | Filter unpaid expenses |
| `PATCH` | `/expenses/:id` | Edit expense, recalculates is_paid |
| `POST` | `/expenses/bulk-settle` | Bulk settle unpaid with cheque |
| `GET` | `/expenses/cheques` | All cheques |
| `GET` | `/expenses/cheques/by-vendor` | Outstanding cheques grouped by vendor |
| `PATCH` | `/expenses/cheques/:id/settle` | Settle individual cheque |

### Vendors
| Method | Path | Description |
|---|---|---|
| `GET` | `/vendors` | List all vendors |
| `POST` | `/vendors` | Create vendor (idempotent by name) |

### Catering
| Method | Path | Description |
|---|---|---|
| `GET` | `/catering/customers?q=` | Search past customers |
| `PATCH` | `/catering/orders/:id` | Update price / notes / tray sizes / approval |
| `PATCH` | `/catering/orders/:id/status` | Status transition (now accepts payment inline) |
| `PATCH` | `/catering/orders/:id/payment` | Add/update payment details |

---

## Pending / Noted for Future

From `Improvements.md`:
- **OCR functionality** — prefill expense fields from receipt image
- **Token amount / partial payment** on catering orders
- **Pay on delivery** flag
- **Who took the payment** field on catering orders
- **Feedback loop** feature
- **Hosting decision** (CAPEX vs cloud)
