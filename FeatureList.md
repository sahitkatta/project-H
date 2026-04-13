# Feature List — Basera Restaurant Management System

## Overview

A full-stack restaurant management system covering catering orders, expenses, employee tracking, cash management, and financial reporting. Integrates with Clover POS for restaurant sales data.

---

## 1. Authentication

- Username/password login
- Role-based access control: **Owner**, **Manager**, **Cashier**
- Session-based authentication with redirect on login/logout
- Role-specific navigation and visible actions throughout the app

---

## 2. Dashboard

- **Today's Revenue** (visible to all roles): total, cash, card, transaction count from Clover POS
- **Catering Summaries**: pending order count, active (accepted) order count
- **Quick Actions** (role-gated): create order, add expense, view reports
- **Pending Orders Preview**: top 5 pending catering orders with customer name, event type, guest count, and price — clickable to full detail

---

## 3. Catering Orders

### 3.1 Order List

- Filter orders by status: All / Pending / Accepted / Completed / Rejected
- Each order card shows: customer name, event type, guest count, event date, order date, created-by staff, status badge, payment status, price approval status, estimated vs. negotiated price, and rejection reason (if rejected)

### 3.2 Create Order (4-step wizard)

**Step 1 — Customer Info**
- Auto-complete search by name, phone, or email
- Fields: name, phone (auto-formatted), email, company, point of contact
- Shows previous order count, last event type, and order history for returning customers

**Step 2 — Items & Trays**
- Load available menu items from Clover
- Add/remove items, adjust quantities, add per-item special instructions
- Tray size selection per item: small, medium, large, X-large

**Step 3 — Pricing**
- Calculated item subtotal
- Estimated price and negotiated price fields
- Order notes

**Step 4 — Review & Submit**
- Full order summary
- Optional payment collection at creation time (same payment form as order completion)

### 3.3 Order Detail

- Full display of customer info, event details, items list, tray sizes, notes, status, and audit trail (created by/at, accepted by)
- **Actions**:
  - Accept (pending → accepted)
  - Reject with reason (pending → rejected)
  - Complete with payment collection (accepted → completed)
  - Edit order: price, notes, items, tray sizes
  - Price approval workflow (pending approval → approved)

### 3.4 Payment Collection (at creation or completion)

- **Payment methods**: cash, card, cheque, Zelle, other, or mix (split across methods)
- **Payment status**: unpaid, partial, paid
- Per-method amount inputs for mix payments
- **Cheque details**: cheque number, issue date, withdrawal date, image upload
- **Zelle details**: reference/transaction ID, date, status
- Collected-by staff name and payment notes

### 3.5 Order History

- Week-by-week navigation to browse past orders
- Status filter tabs within each week view
- Print-to-kitchen action per order

### 3.6 Kitchen Print

- Print-optimized page with: order number, full customer info, event type/date/guest count, special instructions (highlighted), tray sizes grid, menu items with quantities and per-item instructions, signature lines
- Auto-triggers browser print on page load

---

## 4. Expenses

### 4.1 Expense List

- Filter by: All / Unpaid only
- Each expense shows: description, amount, payment type, category, date, vendor, paid-by user, paid/unpaid status badge
- Inline edit for any expense field
- **Bulk Settle**: multi-select unpaid expenses → settle all to a single cheque (cheque number, issue date, withdrawal date, image upload)

### 4.2 Create Expense

- Fields: description, amount, category (groceries, catering, supplies, salary, rent, utilities, other), payment type, date
- **Vendor selector**: pick existing or create new inline
- **Paid by**: user selector
- **Pay Later**: mark expense as unpaid for deferred settlement
- **Cheque support**: cheque number, issue date, withdrawal date, image upload
- **Zelle support**: reference/transaction ID
- **Mix payment**: select which methods are included (cash, card, cheque, Zelle), enter amounts per method — total auto-calculated

### 4.3 Cheques

- Cheques grouped by vendor with total outstanding per vendor
- Each cheque shows: cheque number, amount, issue/withdrawal dates, outstanding/cleared status
- **Settle cheque inline**: enter cheque number, settlement amount, dates, and upload settlement image → marks cheque as cleared

---

## 5. Employees

### 5.1 Employee Contacts

- List all employees with name, contact number, and created date
- Add, edit, and delete employees
- Fields: name, contact number (optional)

### 5.2 Hourly Tracker

- Log hours worked per employee: date, hours (0.5 increments), hourly rate, notes
- Live total amount preview (hours × rate)
- Mark entries as paid / unpaid with a toggle
- Edit and delete entries
- **Summary banner**: total unpaid balance and count of unpaid entries

---

## 6. Cash Management

- Log cash received entries: amount, date, description, from (payer), paid to (recipient)
- **Invoice Number (Catering Order) link**: fuzzy search dropdown to link a cash entry to a catering order — searches by order number, customer name, or event type; shows order number badge, customer name, event type, date, guest count, and price in results
- Linked order number displays on the entry card as a clickable link that navigates directly to the catering order detail page
- **Total Cash Received banner** showing the running sum of all entries
- Edit and delete any entry (linked order persists through edits)

---

## 7. Reports (Owner only)

- **Period**: Weekly or Monthly view
- **Revenue**: restaurant revenue (Clover), catering revenue (completed orders), total
- **Expenses breakdown**:
  - By payment type: cash, card, cheque, Zelle, mix
  - By category: groceries, catering, supplies, salary, rent, utilities, other
- **Cash Flow**:
  - Current balance (all-time cash in minus cash out)
  - Outstanding cheques count and total
  - Net flow (total revenue minus total expenses)
  - **Upcoming Salary Payments**: per employee, amount owed and due date, sorted oldest first

---

## 8. Settings

- Profile card: name, role badge, user ID, initials avatar
- Access level summary based on role
- Sign out

---

## Backend API Summary

| Area | Endpoints |
|---|---|
| Auth | Login, list users |
| Clover | Menu items, transactions, daily summary |
| Catering | CRUD orders, status/payment updates, customer search/upsert |
| Expenses | CRUD expenses, bulk settle, cheque list/settle |
| Vendors | List, create (deduped by name) |
| Employees | CRUD employees, CRUD hour entries |
| Cash | CRUD cash entries |
| Reports | Weekly/monthly report generation |

---

## Role Permissions Matrix

| Feature | Owner | Manager | Cashier |
|---|---|---|---|
| Dashboard | Full | Full | Full |
| Catering — view | Yes | Yes | Yes |
| Catering — create/edit | Yes | Yes | No |
| Catering — accept/reject/complete | Yes | Yes | No |
| Expenses — view/create | Yes | Limited | Yes |
| Cheques | Yes | No | Yes |
| Employees | Yes | No | No |
| Cash Management | Yes | No | No |
| Reports | Yes | No | No |

---

## Integrations

- **Clover POS**: menu items for order creation, daily revenue summary for dashboard and reports
