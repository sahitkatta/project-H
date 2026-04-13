/**
 * Dev-only form prefills for manual QA. Not for production data.
 *
 * Toggle: `VITE_FORM_TEST_PREFILL=true` in `.env.local` (see `frontend/.env.example`).
 * Default is off (unset or any value other than `true`).
 *
 * Cleanup: delete this file, remove `VITE_FORM_TEST_PREFILL` from env, then run:
 *   rg "formTestPrefill|FORM_TEST_PREFILL" frontend/src
 *
 * Files that import this module (update list when adding/removing):
 * - LoginPage.tsx
 * - CreateOrderPage.tsx
 * - CreateExpensePage.tsx
 * - OrderDetailPage.tsx (PaymentForm + negotiate / reject fields)
 * - ExpensesPage.tsx (BulkSettlePanel)
 *
 * Search: FORM_TEST_PREFILL | formTestPrefill | FORM_TEST_TINY_PNG
 */

export const FORM_TEST_PREFILL_ENABLED =
  import.meta.env.VITE_FORM_TEST_PREFILL === 'true';

/** 1×1 transparent PNG — use for cheque image fields without a real file upload */
export const FORM_TEST_TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export function testPrefill<T>(empty: T, filled: T): T {
  return FORM_TEST_PREFILL_ENABLED ? filled : empty;
}

export function todayISODate(): string {
  return new Date().toISOString().split('T')[0];
}

/** Exported for date inputs in expense / order test data */
export const FORM_TEST_SAMPLE_ISO_DATE = '2026-06-15';

const SAMPLE_DATE = FORM_TEST_SAMPLE_ISO_DATE;

export const loginTestDefaults = () =>
  testPrefill(
    { username: '', password: '' },
    { username: 'testuser', password: 'testpass' },
  );

export type CreateOrderFormShape = {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_company: string;
  customer_point_of_contact: string;
  event_date: string;
  event_type: string;
  head_count: string;
  notes: string;
  estimated_price: string;
  negotiated_price: string;
};

export const createOrderFormDefaults = (): CreateOrderFormShape =>
  testPrefill(
    {
      customer_name: '',
      customer_phone: '',
      customer_email: '',
      customer_company: '',
      customer_point_of_contact: '',
      event_date: '',
      event_type: '',
      head_count: '',
      notes: '',
      estimated_price: '',
      negotiated_price: '',
    },
    {
      customer_name: 'Test Customer',
      customer_phone: '5551234567',
      customer_email: 'test@example.com',
      customer_company: '',
      customer_point_of_contact: '',
      event_date: SAMPLE_DATE,
      event_type: 'Wedding reception',
      head_count: '48',
      notes: 'Dev prefill — allergies: none',
      estimated_price: '1200',
      negotiated_price: '1100',
    },
  );

export type PaymentFormTestFields = {
  markUnpaid: boolean;
  paymentType: 'cash' | 'card' | 'cheque' | 'zelle' | 'other' | 'mix';
  cashAmt: string;
  cardAmt: string;
  chequeAmt: string;
  zelleAmt: string;
  otherAmt: string;
  chequeNumber: string;
  chequeIssueDate: string;
  chequeWithdrawalDate: string;
  chequeImage: string;
  chequeImagePreview: string;
  zelleRef: string;
  zelleDate: string;
  zelleStatus: string;
  otherDetails: string;
  notes: string;
};

export function paymentFormTestDefaults(agreedPrice: number): PaymentFormTestFields {
  const base: PaymentFormTestFields = {
    markUnpaid: false,
    paymentType: 'cash',
    cashAmt: '',
    cardAmt: '',
    chequeAmt: '',
    zelleAmt: '',
    otherAmt: '',
    chequeNumber: '',
    chequeIssueDate: '',
    chequeWithdrawalDate: '',
    chequeImage: '',
    chequeImagePreview: '',
    zelleRef: '',
    zelleDate: '',
    zelleStatus: '',
    otherDetails: '',
    notes: '',
  };
  if (!FORM_TEST_PREFILL_ENABLED) return base;

  const ap = Math.max(agreedPrice, 1);
  const cash = (ap * 0.3).toFixed(2);
  const card = (ap * 0.25).toFixed(2);
  const chq = (ap * 0.15).toFixed(2);
  const zel = (ap * 0.15).toFixed(2);
  const oth = (ap * 0.15).toFixed(2);
  const d = todayISODate();

  return {
    markUnpaid: false,
    paymentType: 'mix',
    cashAmt: cash,
    cardAmt: card,
    chequeAmt: chq,
    zelleAmt: zel,
    otherAmt: oth,
    chequeNumber: '10042',
    chequeIssueDate: SAMPLE_DATE,
    chequeWithdrawalDate: d,
    chequeImage: FORM_TEST_TINY_PNG,
    chequeImagePreview: FORM_TEST_TINY_PNG,
    zelleRef: 'ZLL-20260408-TEST',
    zelleDate: d,
    zelleStatus: 'Completed',
    otherDetails: 'Dev prefill — gift card balance',
    notes: 'Dev prefill payment notes',
  };
}

export const bulkSettleTestDefaults = () =>
  testPrefill(
    { chequeNumber: '', issueDate: todayISODate(), withdrawalDate: '' },
    {
      chequeNumber: '10042',
      issueDate: SAMPLE_DATE,
      withdrawalDate: todayISODate(),
    },
  );

export const orderNegotiateTestDefaults = (estimatedPrice: number) =>
  testPrefill(
    { newPrice: '', negotiateNote: '' },
    {
      newPrice: String(Math.max(estimatedPrice * 0.95, 1)),
      negotiateNote: 'Dev prefill — agreed verbally',
    },
  );

export const orderRejectTestDefaults = () =>
  testPrefill(
    { rejectionReason: '' },
    { rejectionReason: 'Dev prefill — schedule conflict' },
  );
