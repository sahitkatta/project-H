export type UserRole = 'owner' | 'manager' | 'cashier';

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export type OrderStatus = 'pending' | 'accepted' | 'rejected' | 'completed';

export interface TraySize {
  small: number;
  medium: number;
  large: number;
  xlarge: number;
}

export interface CateringOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  event_date: string;
  event_type: string;
  head_count: number;
  estimated_price: number;
  negotiated_price: number;
  status: OrderStatus;
  notes?: string;
  rejection_reason?: string;
  tray_sizes?: TraySize;
  price_approval_status?: string; // 'pending_approval' | 'approved'
  price_approved_by_id?: string;
  price_approved_by_name?: string;
  payment_type?: string;
  payment_status?: string; // 'unpaid' | 'partial' | 'paid'
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
  created_at: string;
  updated_at: string;
  created_by_id: string;
  created_by_name?: string;
  accepted_by_id?: string;
  items: CateringOrderItem[];
}

export interface CateringOrderItem {
  id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  special_instructions?: string;
  add_ons: unknown[];
}

export interface CloverMenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  available: boolean;
}

export interface CloverDailySummary {
  total_revenue: number;
  cash_revenue: number;
  card_revenue: number;
  transaction_count: number;
  date: string;
}

export type ExpenseType = 'cash' | 'card' | 'cheque' | 'zelle' | 'mix';
export type ExpenseCategory =
  | 'groceries'
  | 'catering'
  | 'supplies'
  | 'salary'
  | 'rent'
  | 'utilities'
  | 'other';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  type: ExpenseType;
  category: ExpenseCategory;
  date: string;
  is_paid: boolean;
  vendor_id?: string;
  vendor_name?: string;
  paid_by_user_id?: string;
  paid_by_name?: string;
  cash_amount?: number;
  card_amount?: number;
  zelle_amount?: number;
  zelle_reference?: string;
  cheque_amount?: number;
  cheque_number?: string;
  cheque_issue_date?: string;
  cheque_withdrawal_date?: string;
  cheque_image_uri?: string;
  created_at: string;
}

export interface Cheque {
  id: string;
  payee: string;
  amount: number;
  cheque_number: string;
  issue_date: string;
  withdrawal_date?: string;
  is_cleared: boolean;
  settled_amount: number;
  vendor_id?: string;
  vendor_name?: string;
  expense_id?: string;
  image_uri?: string;
  created_at: string;
}

export interface ChequesByVendor {
  vendor_id?: string;
  vendor_name: string;
  total_outstanding: number;
  cheque_count: number;
  cheques: Cheque[];
}

export interface Vendor {
  id: string;
  name: string;
}

export interface ReportsData {
  revenue: {
    restaurant_revenue: number;
    catering_revenue: number;
    total_revenue: number;
  };
  expenses: {
    total: number;
    by_type: {
      cash: number;
      card: number;
      cheque: number;
      zelle: number;
      mix: number;
    };
    by_category: {
      groceries: number;
      catering: number;
      supplies: number;
      salary: number;
      rent: number;
      utilities: number;
      other: number;
    };
  };
  cash_flow: {
    current_balance: number;
    outstanding_cheques_count: number;
    outstanding_cheques_total: number;
    upcoming_salary_payments: Array<{
      employee_name: string;
      amount: number;
      date: string;
    }>;
  };
}
