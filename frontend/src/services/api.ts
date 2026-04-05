import type {
  User,
  CloverMenuItem,
  CloverDailySummary,
  CateringOrder,
  OrderStatus,
  Expense,
  Cheque,
  ChequesByVendor,
  Vendor,
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
export function getOrders(userId: string, status?: OrderStatus): Promise<CateringOrder[]> {
  const qs = status ? `?status=${status}` : '';
  return request<CateringOrder[]>(`/catering/orders${qs}`, {}, userId);
}

export function getOrderById(userId: string, id: string): Promise<CateringOrder> {
  return request<CateringOrder>(`/catering/orders/${id}`, {}, userId);
}

export function createOrder(
  userId: string,
  data: Partial<CateringOrder>,
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
}

export function updateOrderPayment(userId: string, id: string, data: CateringPaymentData): Promise<CateringOrder> {
  return request<CateringOrder>(`/catering/orders/${id}/payment`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, userId);
}

export interface CustomerInfo {
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  last_event_type?: string;
  order_count: number;
}

export function searchCustomers(userId: string, q: string): Promise<CustomerInfo[]> {
  return request<CustomerInfo[]>(`/catering/customers?q=${encodeURIComponent(q)}`, {}, userId);
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
