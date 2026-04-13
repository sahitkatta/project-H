import type {
  User,
  CloverMenuItem,
  CloverDailySummary,
  CateringOrder,
  Customer,
  OrderStatus,
  Expense,
  Cheque,
  ChequesByVendor,
  Vendor,
  Employee,
  EmployeeHour,
  CashEntry,
  ReportsData,
} from '../types';

const BASE_URL = '/api';

async function request<T>(
  path: string,
  options: RequestInit = {},
  userId?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (userId) {
    headers['X-User-Id'] = userId;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (body.detail) {
        message = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      } else if (body.message) {
        message = body.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

// Auth
export function getUsers(): Promise<User[]> {
  return request<User[]>('/auth/users');
}

export function login(username: string, password: string): Promise<User> {
  return request<User>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

// Clover
export function getMenuItems(userId: string): Promise<CloverMenuItem[]> {
  return request<CloverMenuItem[]>('/clover/menu-items', {}, userId);
}

export function getDailySummary(userId: string): Promise<CloverDailySummary> {
  return request<CloverDailySummary>('/clover/daily-summary', {}, userId);
}

// Catering
export function getOrders(userId: string, status?: OrderStatus, search?: string): Promise<CateringOrder[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return request<CateringOrder[]>(`/catering/orders${qs}`, {}, userId);
}

export function getOrderById(userId: string, id: string): Promise<CateringOrder> {
  return request<CateringOrder>(`/catering/orders/${id}`, {}, userId);
}

export interface CreateOrderData extends Partial<CateringOrder> {
  payment?: CateringPaymentData;
}

export function createOrder(
  userId: string,
  data: CreateOrderData,
): Promise<CateringOrder> {
  return request<CateringOrder>('/catering/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  }, userId);
}

export function updateOrderStatus(
  userId: string,
  id: string,
  status: OrderStatus,
  rejectionReason?: string,
  payment?: CateringPaymentData,
): Promise<CateringOrder> {
  return request<CateringOrder>(`/catering/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, rejection_reason: rejectionReason, payment }),
  }, userId);
}

export interface CateringOrderUpdateData {
  negotiated_price?: number;
  estimated_price?: number;
  notes?: string;
  price_approval_status?: string;
  tray_sizes?: { small: number; medium: number; large: number; xlarge: number };
}

export function updateOrder(userId: string, id: string, data: CateringOrderUpdateData): Promise<CateringOrder> {
  return request<CateringOrder>(`/catering/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, userId);
}

export interface CateringPaymentData {
  payment_type: string;
  payment_status: string;
  payment_cash_amount?: number;
  payment_card_amount?: number;
  payment_cheque_amount?: number;
  payment_zelle_amount?: number;
  payment_other_amount?: number;
  payment_cheque_number?: string;
  payment_cheque_issue_date?: string;
  payment_cheque_withdrawal_date?: string;
  payment_cheque_image_uri?: string;
  payment_zelle_reference?: string;
  payment_zelle_date?: string;
  payment_zelle_status?: string;
  payment_other_details?: string;
  payment_notes?: string;
  payment_collected_by_id?: string;
  payment_collected_by_label?: string;
}

export function updateOrderPayment(userId: string, id: string, data: CateringPaymentData): Promise<CateringOrder> {
  return request<CateringOrder>(`/catering/orders/${id}/payment`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, userId);
}

export interface CustomerInfo {
  id?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  customer_company?: string;
  customer_point_of_contact?: string;
  last_event_type?: string;
  order_count: number;
}

export function searchCustomers(userId: string, q: string): Promise<CustomerInfo[]> {
  return request<CustomerInfo[]>(`/catering/customers?q=${encodeURIComponent(q)}`, {}, userId);
}

export function upsertCustomer(userId: string, data: { name: string; phone: string; email?: string; last_event_type?: string }): Promise<Customer> {
  return request<Customer>('/catering/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  }, userId);
}

// Expenses
export function getExpenses(userId: string, isPaid?: boolean): Promise<Expense[]> {
  const qs = isPaid !== undefined ? `?is_paid=${isPaid}` : '';
  return request<Expense[]>(`/expenses${qs}`, {}, userId);
}

export function createExpense(userId: string, data: Partial<Expense>): Promise<Expense> {
  return request<Expense>('/expenses', {
    method: 'POST',
    body: JSON.stringify(data),
  }, userId);
}

export function updateExpense(userId: string, id: string, data: Partial<Expense>): Promise<Expense> {
  return request<Expense>(`/expenses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, userId);
}

export interface BulkSettleData {
  expense_ids: string[];
  cheque_number: string;
  issue_date: string;
  withdrawal_date?: string;
  image_uri?: string;
}

export function bulkSettleExpenses(userId: string, data: BulkSettleData): Promise<Expense[]> {
  return request<Expense[]>('/expenses/bulk-settle', {
    method: 'POST',
    body: JSON.stringify(data),
  }, userId);
}

export function getCheques(userId: string): Promise<Cheque[]> {
  return request<Cheque[]>('/expenses/cheques', {}, userId);
}

export function getChequesByVendor(userId: string): Promise<ChequesByVendor[]> {
  return request<ChequesByVendor[]>('/expenses/cheques/by-vendor', {}, userId);
}

export interface SettleChequeData {
  cheque_number: string;
  issue_date: string;
  withdrawal_date?: string;
  amount: number;
  image_uri?: string;
}

export function settleCheque(
  userId: string,
  id: string,
  data: SettleChequeData,
): Promise<Cheque> {
  return request<Cheque>(`/expenses/cheques/${id}/settle`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, userId);
}

// Vendors
export function getVendors(userId: string): Promise<Vendor[]> {
  return request<Vendor[]>('/vendors', {}, userId);
}

export function createVendor(userId: string, name: string): Promise<Vendor> {
  return request<Vendor>('/vendors', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }, userId);
}

// Reports
export function getReports(userId: string, period: 'weekly' | 'monthly'): Promise<ReportsData> {
  return request<ReportsData>(`/reports?period=${period}`, {}, userId);
}

// Employees
export function getEmployees(userId: string): Promise<Employee[]> {
  return request<Employee[]>('/employees', {}, userId);
}

export function createEmployee(userId: string, data: { name: string; contact_number?: string }): Promise<Employee> {
  return request<Employee>('/employees', { method: 'POST', body: JSON.stringify(data) }, userId);
}

export function updateEmployee(userId: string, id: string, data: Partial<Employee>): Promise<Employee> {
  return request<Employee>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, userId);
}

export function deleteEmployee(userId: string, id: string): Promise<void> {
  return request<void>(`/employees/${id}`, { method: 'DELETE' }, userId);
}

// Employee Hours
export function getEmployeeHours(userId: string): Promise<EmployeeHour[]> {
  return request<EmployeeHour[]>('/employees/hours', {}, userId);
}

export function createEmployeeHour(userId: string, data: Omit<EmployeeHour, 'id' | 'created_at'>): Promise<EmployeeHour> {
  return request<EmployeeHour>('/employees/hours', { method: 'POST', body: JSON.stringify(data) }, userId);
}

export function updateEmployeeHour(userId: string, id: string, data: Partial<EmployeeHour>): Promise<EmployeeHour> {
  return request<EmployeeHour>(`/employees/hours/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, userId);
}

export function deleteEmployeeHour(userId: string, id: string): Promise<void> {
  return request<void>(`/employees/hours/${id}`, { method: 'DELETE' }, userId);
}

// Cash Entries
export function getCashEntries(userId: string): Promise<CashEntry[]> {
  return request<CashEntry[]>('/cash', {}, userId);
}

export function createCashEntry(userId: string, data: Omit<CashEntry, 'id' | 'created_at'>): Promise<CashEntry> {
  return request<CashEntry>('/cash', { method: 'POST', body: JSON.stringify(data) }, userId);
}

export function updateCashEntry(userId: string, id: string, data: Partial<CashEntry>): Promise<CashEntry> {
  return request<CashEntry>(`/cash/${id}`, { method: 'PATCH', body: JSON.stringify(data) }, userId);
}

export function deleteCashEntry(userId: string, id: string): Promise<void> {
  return request<void>(`/cash/${id}`, { method: 'DELETE' }, userId);
}
