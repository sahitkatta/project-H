import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import type { CateringOrder } from '../../types';
import type { CateringPaymentData } from '../../services/api';
import { Card, Badge, Button, LoadingSpinner } from '../../components/ui';
import {
  FORM_TEST_PREFILL_ENABLED,
  orderNegotiateTestDefaults,
  orderRejectTestDefaults,
  paymentFormTestDefaults,
} from '../../dev/formTestPrefill';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-4">
      <span className="text-sm text-gray-500 sm:w-36 flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

// ── Payment Form ─────────────────────────────────────────────────────────────

type PaymentType = 'cash' | 'card' | 'cheque' | 'zelle' | 'other' | 'mix';

interface PaymentFormProps {
  order: CateringOrder;
  userId: string;
  /** If true, submitting also marks order as completed */
  markComplete?: boolean;
  onSaved: (updated: CateringOrder) => void;
  onCancel: () => void;
}

function AmountInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
        <input type="number" step="0.01" min="0" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? '0.00'}
          className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
      </div>
    </div>
  );
}

function PaymentForm({ order, userId, markComplete, onSaved, onCancel }: PaymentFormProps) {
  const agreedPrice = order.negotiated_price || order.estimated_price;
  const t = paymentFormTestDefaults(agreedPrice);

  const [collectedByLabel, setCollectedByLabel] = useState('');
  const [markUnpaid, setMarkUnpaid] = useState(t.markUnpaid);
  const [isPartial, setIsPartial] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>(t.paymentType);
  const [cashAmt, setCashAmt] = useState(t.cashAmt);
  const [cardAmt, setCardAmt] = useState(t.cardAmt);
  const [chequeAmt, setChequeAmt] = useState(t.chequeAmt);
  const [zelleAmt, setZelleAmt] = useState(t.zelleAmt);
  const [otherAmt, setOtherAmt] = useState(t.otherAmt);
  const [chequeNumber, setChequeNumber] = useState(t.chequeNumber);
  const [chequeIssueDate, setChequeIssueDate] = useState(t.chequeIssueDate);
  const [chequeWithdrawalDate, setChequeWithdrawalDate] = useState(t.chequeWithdrawalDate);
  const [chequeImage, setChequeImage] = useState(t.chequeImage);
  const [chequeImagePreview, setChequeImagePreview] = useState(t.chequeImagePreview);
  const [zelleRef, setZelleRef] = useState(t.zelleRef);
  const [zelleDate, setZelleDate] = useState(t.zelleDate);
  const [zelleStatus, setZelleStatus] = useState(t.zelleStatus);
  const [otherDetails, setOtherDetails] = useState(t.otherDetails);
  const [notes, setNotes] = useState(t.notes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const chequeFileRef = useRef<HTMLInputElement>(null);


  const TYPES: { value: PaymentType; label: string }[] = [
    { value: 'cash', label: 'Cash' },
    { value: 'card', label: 'Card' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'zelle', label: 'Zelle' },
    { value: 'other', label: 'Other' },
    { value: 'mix', label: 'Mix' },
  ];

  // Compute total collected from entered amounts
  const collectedTotal = (() => {
    if (markUnpaid) return 0;
    if (paymentType === 'mix') {
      return (parseFloat(cashAmt) || 0) + (parseFloat(cardAmt) || 0) +
        (parseFloat(chequeAmt) || 0) + (parseFloat(zelleAmt) || 0) + (parseFloat(otherAmt) || 0);
    }
    if (paymentType === 'cash') return parseFloat(cashAmt) || 0;
    if (paymentType === 'card') return parseFloat(cardAmt) || 0;
    if (paymentType === 'cheque') return parseFloat(chequeAmt) || 0;
    if (paymentType === 'zelle') return parseFloat(zelleAmt) || 0;
    if (paymentType === 'other') return parseFloat(otherAmt) || 0;
    return 0;
  })();

  const outstanding = agreedPrice - collectedTotal;
  const autoPartial = collectedTotal > 0 && collectedTotal < agreedPrice;

  function handleChequeImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { const r = ev.target?.result as string; setChequeImage(r); setChequeImagePreview(r); };
    reader.readAsDataURL(file);
  }

  function buildPaymentData(): CateringPaymentData {
    if (markUnpaid) {
      return { payment_type: 'unpaid', payment_status: 'unpaid', payment_notes: notes || undefined, payment_collected_by_label: collectedByLabel || undefined };
    }
    const effectivePartial = isPartial || autoPartial;
    const base: CateringPaymentData = {
      payment_type: paymentType,
      payment_status: effectivePartial ? 'partial' : 'paid',
      payment_notes: notes || undefined,
      payment_collected_by_label: collectedByLabel || undefined,
    };
    if (paymentType === 'cash' || paymentType === 'mix') base.payment_cash_amount = parseFloat(cashAmt) || undefined;
    if (paymentType === 'card' || paymentType === 'mix') base.payment_card_amount = parseFloat(cardAmt) || undefined;
    if (paymentType === 'cheque' || paymentType === 'mix') {
      base.payment_cheque_amount = parseFloat(chequeAmt) || undefined;
      base.payment_cheque_number = chequeNumber || undefined;
      base.payment_cheque_issue_date = chequeIssueDate || undefined;
      base.payment_cheque_withdrawal_date = chequeWithdrawalDate || undefined;
      base.payment_cheque_image_uri = chequeImage || undefined;
    }
    if (paymentType === 'zelle' || paymentType === 'mix') {
      base.payment_zelle_amount = parseFloat(zelleAmt) || undefined;
      base.payment_zelle_reference = zelleRef || undefined;
      base.payment_zelle_date = zelleDate || undefined;
      base.payment_zelle_status = zelleStatus || undefined;
    }
    if (paymentType === 'other' || paymentType === 'mix') {
      base.payment_other_amount = parseFloat(otherAmt) || undefined;
      base.payment_other_details = otherDetails || undefined;
    }
    return base;
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const paymentData = buildPaymentData();
      let updated: CateringOrder;
      if (markComplete) {
        updated = await api.updateOrderStatus(userId, order.id, 'completed', undefined, paymentData);
      } else {
        updated = await api.updateOrderPayment(userId, order.id, paymentData);
      }
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}

      {/* Order total reminder */}
      <div className="flex items-center justify-between bg-indigo-50 rounded-lg px-4 py-2">
        <span className="text-sm text-indigo-700">Order Total</span>
        <span className="font-bold text-indigo-900">{fmt(agreedPrice)}</span>
      </div>

      {/* Who took payment */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Who Took the Payment</label>
        <input
          type="text"
          value={collectedByLabel}
          onChange={e => setCollectedByLabel(e.target.value)}
          placeholder="e.g. Sahit"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>

      {/* Unpaid / Partial toggles */}
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-3 cursor-pointer p-3 bg-gray-50 rounded-lg">
          <input type="checkbox" checked={markUnpaid} onChange={e => { setMarkUnpaid(e.target.checked); if (e.target.checked) setIsPartial(false); }}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          <div>
            <span className="text-sm font-medium text-gray-900">Mark as Unpaid / Collect Later</span>
            <p className="text-xs text-gray-500">No payment collected yet</p>
          </div>
        </label>
        {!markUnpaid && (
          <label className="flex items-center gap-3 cursor-pointer p-3 bg-amber-50 rounded-lg border border-amber-100">
            <input type="checkbox" checked={isPartial || autoPartial}
              onChange={e => setIsPartial(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500" />
            <div>
              <span className="text-sm font-medium text-gray-900">Partial / Token Payment</span>
              <p className="text-xs text-gray-500">Collecting a deposit now, remainder later</p>
            </div>
          </label>
        )}
      </div>

      {!markUnpaid && (
        <>
          {/* Payment method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map(tp => (
                <button key={tp.value} type="button" onClick={() => setPaymentType(tp.value)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    paymentType === tp.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                  }`}>
                  {tp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cash */}
          {(paymentType === 'cash' || paymentType === 'mix') && (
            <AmountInput label={paymentType === 'mix' ? 'Cash Amount' : 'Amount'} value={cashAmt} onChange={setCashAmt} placeholder={paymentType === 'cash' ? String(agreedPrice) : '0.00'} />
          )}

          {/* Card */}
          {(paymentType === 'card' || paymentType === 'mix') && (
            <AmountInput label={paymentType === 'mix' ? 'Card Amount' : 'Amount'} value={cardAmt} onChange={setCardAmt} placeholder={paymentType === 'card' ? String(agreedPrice) : '0.00'} />
          )}

          {/* Cheque */}
          {(paymentType === 'cheque' || paymentType === 'mix') && (
            <div className="bg-orange-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Cheque Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AmountInput label={paymentType === 'mix' ? 'Cheque Amount' : 'Amount'} value={chequeAmt} onChange={setChequeAmt} />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cheque Number</label>
                  <input type="text" value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} placeholder="e.g. 1042"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Issue Date</label>
                  <input type="date" value={chequeIssueDate} onChange={e => setChequeIssueDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Withdrawal Date</label>
                  <input type="date" value={chequeWithdrawalDate} onChange={e => setChequeWithdrawalDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cheque Image</label>
                <input ref={chequeFileRef} type="file" accept="image/*" onChange={handleChequeImage}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200" />
                {chequeImagePreview && (
                  <div className="mt-2 relative inline-block">
                    <img src={chequeImagePreview} alt="Cheque" className="h-20 rounded border border-orange-200 object-cover" />
                    <button type="button" onClick={() => { setChequeImage(''); setChequeImagePreview(''); if (chequeFileRef.current) chequeFileRef.current.value = ''; }}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">×</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Zelle */}
          {(paymentType === 'zelle' || paymentType === 'mix') && (
            <div className="bg-green-50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Zelle Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <AmountInput label={paymentType === 'mix' ? 'Zelle Amount' : 'Amount'} value={zelleAmt} onChange={setZelleAmt} />
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Transaction Reference</label>
                  <input type="text" value={zelleRef} onChange={e => setZelleRef(e.target.value)} placeholder="e.g. ZLL-2024-0001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Transaction Date</label>
                  <input type="date" value={zelleDate} onChange={e => setZelleDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Transaction Status</label>
                  <input type="text" value={zelleStatus} onChange={e => setZelleStatus(e.target.value)} placeholder="e.g. Completed, Pending"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
              </div>
            </div>
          )}

          {/* Other */}
          {(paymentType === 'other' || paymentType === 'mix') && (
            <div className="space-y-3">
              <AmountInput label={paymentType === 'mix' ? 'Other Amount' : 'Amount'} value={otherAmt} onChange={setOtherAmt} />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Details</label>
                <textarea value={otherDetails} onChange={e => setOtherDetails(e.target.value)} rows={2}
                  placeholder="Describe the payment method"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
              </div>
            </div>
          )}

          {/* Live partial/full summary */}
          {collectedTotal > 0 && (
            <div className={`rounded-lg px-4 py-3 text-sm flex items-center justify-between ${
              autoPartial || isPartial ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'
            }`}>
              <div>
                <p className="font-medium text-gray-800">
                  {autoPartial || isPartial ? 'Partial Payment' : 'Full Payment'}
                </p>
                {(autoPartial || isPartial) && outstanding > 0 && (
                  <p className="text-xs text-amber-700 mt-0.5">Outstanding: {fmt(outstanding)}</p>
                )}
              </div>
              <span className={`text-lg font-bold ${autoPartial || isPartial ? 'text-amber-800' : 'text-green-800'}`}>
                {fmt(collectedTotal)}
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Any additional notes"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
        </>
      )}

      {markUnpaid && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Customer will pay at pickup"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        </div>
      )}

      <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button variant={markComplete ? 'success' : 'primary'} size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : markComplete
            ? (markUnpaid ? 'Complete (Unpaid)' : 'Complete & Save Payment')
            : 'Save Payment'}
        </Button>
      </div>
    </div>
  );
}

// ── Payment Summary ───────────────────────────────────────────────────────────

function PaymentSummary({ order }: { order: CateringOrder }) {
  if (!order.payment_type) return null;

  const isUnpaid = order.payment_status === 'unpaid';
  const isPartial = order.payment_status === 'partial';

  const rows: { label: string; value: string }[] = [];
  if (order.payment_cash_amount) rows.push({ label: 'Cash', value: fmt(order.payment_cash_amount) });
  if (order.payment_card_amount) rows.push({ label: 'Card', value: fmt(order.payment_card_amount) });
  if (order.payment_cheque_amount) rows.push({ label: 'Cheque', value: fmt(order.payment_cheque_amount) });
  if (order.payment_zelle_amount) rows.push({ label: 'Zelle', value: fmt(order.payment_zelle_amount) });
  if (order.payment_other_amount) rows.push({ label: 'Other', value: fmt(order.payment_other_amount) });

  const collectedTotal = rows.reduce((sum, r) => sum + parseFloat(r.value.replace(/[^0-9.]/g, '')), 0);
  const agreedPrice = order.negotiated_price || order.estimated_price;
  const outstanding = agreedPrice - collectedTotal;

  return (
    <div className="space-y-2">
      {isUnpaid ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
            Unpaid
          </span>
          {order.payment_notes && <span className="text-sm text-gray-500">{order.payment_notes}</span>}
        </div>
      ) : (
        <>
          <InfoRow label="Method" value={<span className="capitalize">{order.payment_type}</span>} />
          <InfoRow label="Status" value={
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : isPartial ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'
            }`}>{order.payment_status}</span>
          } />
          {rows.map(r => <InfoRow key={r.label} label={r.label} value={r.value} />)}
          {isPartial && outstanding > 0 && (
            <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
              <span className="text-sm text-amber-800 font-medium">Outstanding Balance</span>
              <span className="text-sm font-bold text-amber-900">{fmt(outstanding)}</span>
            </div>
          )}
          {order.payment_collected_by_name && <InfoRow label="Collected By" value={order.payment_collected_by_name} />}
          {order.payment_cheque_number && <InfoRow label="Cheque #" value={order.payment_cheque_number} />}
          {order.payment_cheque_issue_date && <InfoRow label="Issue Date" value={order.payment_cheque_issue_date} />}
          {order.payment_cheque_withdrawal_date && <InfoRow label="Withdrawal" value={order.payment_cheque_withdrawal_date} />}
          {order.payment_zelle_reference && <InfoRow label="Zelle Ref" value={order.payment_zelle_reference} />}
          {order.payment_zelle_date && <InfoRow label="Zelle Date" value={order.payment_zelle_date} />}
          {order.payment_zelle_status && <InfoRow label="Zelle Status" value={order.payment_zelle_status} />}
          {order.payment_other_details && <InfoRow label="Other Details" value={order.payment_other_details} />}
          {order.payment_notes && <InfoRow label="Notes" value={order.payment_notes} />}
          {order.payment_cheque_image_uri && (
            <div>
              <p className="text-sm text-gray-500 mb-1">Cheque Image</p>
              <img src={order.payment_cheque_image_uri} alt="Cheque" className="h-20 rounded border border-gray-200 object-cover" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<CateringOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Panels
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showNegotiateForm, setShowNegotiateForm] = useState(false);
  const [newPrice, setNewPrice] = useState('');
  const [negotiateNote, setNegotiateNote] = useState('');
  const orderActionPrefill = useRef(false);
  const [showCompletePayment, setShowCompletePayment] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showPendingPayment, setShowPendingPayment] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    api.getOrderById(user.id, id)
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load order'))
      .finally(() => setLoading(false));
  }, [user, id]);

  useEffect(() => {
    if (!order || !FORM_TEST_PREFILL_ENABLED || orderActionPrefill.current) return;
    orderActionPrefill.current = true;
    const neg = orderNegotiateTestDefaults(order.estimated_price);
    setNewPrice(neg.newPrice);
    setNegotiateNote(neg.negotiateNote);
    const rej = orderRejectTestDefaults();
    setRejectionReason(rej.rejectionReason);
  }, [order]);

  async function handleStatusChange(status: 'accepted' | 'rejected' | 'completed', reason?: string) {
    if (!user || !id) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await api.updateOrderStatus(user.id, id, status, reason);
      setOrder(updated);
      setShowRejectForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleNegotiate() {
    if (!user || !id || !newPrice) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await api.updateOrder(user.id, id, {
        negotiated_price: parseFloat(newPrice),
        notes: negotiateNote || undefined,
      });
      setOrder(updated);
      setShowNegotiateForm(false);
      setNewPrice('');
      setNegotiateNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprovePrice() {
    if (!user || !id) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await api.updateOrder(user.id, id, { price_approval_status: 'approved' });
      setOrder(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) return <LoadingSpinner message="Loading order..." />;

  if (error && !order) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (!order) return null;

  const canManage = user?.role === 'owner' || user?.role === 'manager';
  const itemsTotal = order.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  const isPendingApproval = order.price_approval_status === 'pending_approval';
  const isCompleteUnpaid = order.status === 'completed' && order.payment_status === 'unpaid';
  const isPartialPayment = order.payment_status === 'partial';
  const agreedPrice = order.negotiated_price || order.estimated_price;
  const collectedSoFar = (order.payment_cash_amount || 0) + (order.payment_card_amount || 0) +
    (order.payment_cheque_amount || 0) + (order.payment_zelle_amount || 0) + (order.payment_other_amount || 0);
  const outstandingBalance = agreedPrice - collectedSoFar;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/catering')} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Details</h1>
          {order.order_number && (
            <p className="text-sm font-mono font-semibold text-indigo-600">{order.order_number}</p>
          )}
        </div>
        <Badge variant={order.status} className="ml-2" />
        {order.payment_status && (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            order.payment_status === 'paid' ? 'bg-green-100 text-green-700' : order.payment_status === 'unpaid' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {order.payment_status === 'partial' ? 'Partial' : order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
          </span>
        )}
        {/* Print button */}
        <button
          onClick={() => window.open(`/catering/${order.id}/print`, '_blank')}
          title="Print Kitchen Order"
          className="ml-auto text-gray-400 hover:text-indigo-600 transition"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Price approval notice */}
      {isPendingApproval && (
        <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-orange-800">Price Needs Approval</p>
            <p className="text-xs text-orange-600 mt-0.5">This order was created by a cashier and the negotiated price requires manager/owner approval.</p>
          </div>
          {canManage && (
            <Button variant="primary" size="sm" loading={actionLoading} onClick={handleApprovePrice}>
              Approve Price
            </Button>
          )}
        </div>
      )}

      {/* Completed + unpaid banner */}
      {isCompleteUnpaid && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-800">Payment Outstanding</p>
            <p className="text-xs text-red-600 mt-0.5">This order is completed but payment has not been collected.</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowAddPayment(true)}>
            Collect Payment
          </Button>
        </div>
      )}

      {/* Partial payment banner */}
      {isPartialPayment && order.status === 'completed' && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-800">Partial Payment — Balance Due</p>
            <p className="text-xs text-amber-700 mt-0.5">Outstanding: {fmt(outstandingBalance)}</p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setShowAddPayment(true)}>
            Collect Remaining
          </Button>
        </div>
      )}

      {/* Actions — Pending */}
      {order.status === 'pending' && canManage && (
        <Card className="p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Actions</h3>

          {showNegotiateForm ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Enter the new negotiated price and optionally add a note:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">New Negotiated Price *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                    <input type="number" step="0.01" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                      placeholder={String(order.estimated_price)}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Note (optional)</label>
                  <input type="text" value={negotiateNote} onChange={e => setNegotiateNote(e.target.value)}
                    placeholder="e.g. Agreed with customer via call"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" loading={actionLoading} onClick={handleNegotiate} disabled={!newPrice}>
                  Update Price
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setShowNegotiateForm(false)}>Cancel</Button>
              </div>
            </div>
          ) : showRejectForm ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason</label>
                <textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Why is this order being rejected?" />
              </div>
              <div className="flex gap-2">
                <Button variant="danger" loading={actionLoading} onClick={() => handleStatusChange('rejected', rejectionReason)}>Confirm Rejection</Button>
                <Button variant="secondary" onClick={() => setShowRejectForm(false)}>Cancel</Button>
              </div>
            </div>
          ) : showPendingPayment ? (
            <div>
              <p className="text-sm font-medium text-gray-800 mb-3">Add Deposit / Partial Payment</p>
              <PaymentForm
                order={order}
                userId={user!.id}
                onSaved={updated => { setOrder(updated); setShowPendingPayment(false); }}
                onCancel={() => setShowPendingPayment(false)}
              />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="success" loading={actionLoading} onClick={() => handleStatusChange('accepted')}>
                Accept Order
              </Button>
              <Button variant="secondary" onClick={() => setShowNegotiateForm(true)}>
                Negotiate Price
              </Button>
              <Button variant="secondary" onClick={() => setShowPendingPayment(true)}>
                Add Deposit
              </Button>
              <button onClick={() => setShowRejectForm(true)}
                className="text-sm text-red-500 hover:text-red-700 underline px-2">
                Reject
              </button>
            </div>
          )}
        </Card>
      )}

      {/* Actions — Accepted: Mark Complete */}
      {order.status === 'accepted' && (
        <Card className="p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Actions</h3>
          {showCompletePayment ? (
            <div>
              <p className="text-sm font-medium text-gray-800 mb-3">Add Payment Details to Complete Order</p>
              <PaymentForm
                order={order}
                userId={user!.id}
                markComplete
                onSaved={updated => { setOrder(updated); setShowCompletePayment(false); }}
                onCancel={() => setShowCompletePayment(false)}
              />
            </div>
          ) : (
            <Button variant="primary" loading={actionLoading} onClick={() => setShowCompletePayment(true)}>
              Mark as Completed
            </Button>
          )}
        </Card>
      )}

      {/* Actions — Completed + unpaid: add payment */}
      {showAddPayment && isCompleteUnpaid && (
        <Card className="p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Collect Payment</h3>
          <PaymentForm
            order={order}
            userId={user!.id}
            onSaved={updated => { setOrder(updated); setShowAddPayment(false); }}
            onCancel={() => setShowAddPayment(false)}
          />
        </Card>
      )}

      {order.rejection_reason && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <p className="text-sm font-medium text-red-800">Rejection Reason</p>
          <p className="text-sm text-red-700 mt-0.5">{order.rejection_reason}</p>
        </div>
      )}

      {/* Customer Info */}
      <Card className="p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Customer</h3>
        <div className="space-y-2">
          <InfoRow label="Name" value={order.customer_name} />
          <InfoRow label="Phone" value={order.customer_phone} />
          {order.customer_email && <InfoRow label="Email" value={order.customer_email} />}
          {order.customer_company && <InfoRow label="Company" value={order.customer_company} />}
          {order.customer_point_of_contact && <InfoRow label="Point of Contact" value={order.customer_point_of_contact} />}
        </div>
      </Card>

      {/* Event Info */}
      <Card className="p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Event</h3>
        <div className="space-y-2">
          <InfoRow label="Event Type" value={order.event_type} />
          <InfoRow label="Event Date" value={new Date(order.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
          <InfoRow label="Head Count" value={`${order.head_count} guests`} />
          {order.notes && <InfoRow label="Notes" value={order.notes} />}
        </div>
      </Card>

      {/* Tray Sizes */}
      {order.tray_sizes && Object.values(order.tray_sizes).some(v => v > 0) && (
        <Card className="p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Tray Sizes</h3>
          <div className="grid grid-cols-4 gap-3 text-center">
            {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
              order.tray_sizes![size] > 0 ? (
                <div key={size} className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500 capitalize">{size === 'xlarge' ? 'X-Large' : size}</p>
                  <p className="text-2xl font-bold text-amber-800">{order.tray_sizes![size]}</p>
                </div>
              ) : null
            ))}
          </div>
        </Card>
      )}

      {/* Items */}
      {order.items.length > 0 && (
        <Card className="p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Items</h3>
          <div className="divide-y divide-gray-100">
            {order.items.map((item) => (
              <div key={item.id} className="py-3 flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.quantity} x {fmt(item.unit_price)}</p>
                  {item.special_instructions && (
                    <p className="text-xs text-indigo-600 mt-0.5">{item.special_instructions}</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-gray-900">{fmt(item.unit_price * item.quantity)}</span>
              </div>
            ))}
            <div className="py-3 flex justify-between">
              <span className="text-sm font-semibold text-gray-700">Items Total</span>
              <span className="text-sm font-bold text-gray-900">{fmt(itemsTotal)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Pricing */}
      <Card className="p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Pricing</h3>
        <div className="space-y-2">
          <InfoRow label="Estimated" value={fmt(order.estimated_price)} />
          <InfoRow label="Negotiated" value={<span className="text-green-700">{fmt(order.negotiated_price)}</span>} />
          {isPendingApproval && (
            <p className="text-xs text-orange-600 mt-1">Negotiated price pending approval</p>
          )}
          {order.price_approved_by_name && (
            <InfoRow label="Approved by" value={order.price_approved_by_name} />
          )}
        </div>
      </Card>

      {/* Payment Details */}
      {order.payment_type && (
        <Card className="p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Payment</h3>
          <PaymentSummary order={order} />
          {!isCompleteUnpaid && !isPartialPayment && order.payment_status !== 'paid' && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {showAddPayment ? (
                <PaymentForm
                  order={order}
                  userId={user!.id}
                  onSaved={updated => { setOrder(updated); setShowAddPayment(false); }}
                  onCancel={() => setShowAddPayment(false)}
                />
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setShowAddPayment(true)}>
                  Update Payment
                </Button>
              )}
            </div>
          )}
          {isPartialPayment && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              {showAddPayment ? (
                <PaymentForm
                  order={order}
                  userId={user!.id}
                  onSaved={updated => { setOrder(updated); setShowAddPayment(false); }}
                  onCancel={() => setShowAddPayment(false)}
                />
              ) : (
                <Button variant="primary" size="sm" onClick={() => setShowAddPayment(true)}>
                  Collect Remaining {fmt(outstandingBalance)}
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Order Info */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Order Info</h3>
        <div className="space-y-2">
          {order.order_number && (
            <InfoRow label="Order #" value={<span className="font-mono font-bold text-indigo-700">{order.order_number}</span>} />
          )}
          <InfoRow label="Order ID" value={<span className="font-mono text-xs text-gray-400">{order.id}</span>} />
          {order.created_by_name && <InfoRow label="Created By" value={order.created_by_name} />}
          <InfoRow label="Created" value={new Date(order.created_at).toLocaleString()} />
          <InfoRow label="Updated" value={new Date(order.updated_at).toLocaleString()} />
        </div>
      </Card>
    </div>
  );
}
