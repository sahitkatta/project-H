import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import type { Expense, ExpenseType, Vendor, User } from '../../types';
import { Card, Badge, Button, LoadingSpinner } from '../../components/ui';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

type Tab = 'all' | 'unpaid';

const CATEGORIES = ['groceries','catering','supplies','salary','rent','utilities','other'] as const;
const PAYMENT_TYPES: ExpenseType[] = ['cash','card','cheque','zelle','mix'];

// ── Inline Edit Form ──────────────────────────────────────────────────────────

interface EditFormProps {
  expense: Expense;
  vendors: Vendor[];
  users: User[];
  userId: string;
  onSaved: (updated: Expense) => void;
  onCancel: () => void;
}

function EditForm({ expense, vendors, users, userId, onSaved, onCancel }: EditFormProps) {
  const [form, setForm] = useState({
    description: expense.description,
    amount: String(expense.amount),
    type: expense.type,
    category: expense.category,
    date: expense.date,
    vendor_id: expense.vendor_id ?? '',
    paid_by_user_id: expense.paid_by_user_id ?? '',
    cash_amount: String(expense.cash_amount ?? ''),
    card_amount: String(expense.card_amount ?? ''),
    zelle_amount: String(expense.zelle_amount ?? ''),
    zelle_reference: expense.zelle_reference ?? '',
    cheque_amount: String(expense.cheque_amount ?? ''),
    cheque_number: expense.cheque_number ?? '',
    cheque_issue_date: expense.cheque_issue_date ?? '',
    cheque_withdrawal_date: expense.cheque_withdrawal_date ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function handleSave() {
    if (!form.description || !form.amount) { setError('Description and amount are required'); return; }
    setSaving(true); setError('');
    try {
      const payload: Record<string, unknown> = {
        description: form.description,
        amount: parseFloat(form.amount),
        type: form.type,
        category: form.category,
        date: form.date,
        vendor_id: form.vendor_id || null,
        paid_by_user_id: form.paid_by_user_id || null,
      };
      if (form.type === 'zelle') {
        payload.zelle_reference = form.zelle_reference || null;
      }
      if (form.type === 'mix') {
        payload.cash_amount = parseFloat(form.cash_amount) || null;
        payload.card_amount = parseFloat(form.card_amount) || null;
        payload.zelle_amount = parseFloat(form.zelle_amount) || null;
        payload.zelle_reference = form.zelle_reference || null;
        payload.cheque_amount = parseFloat(form.cheque_amount) || null;
        if (form.cheque_number) payload.cheque_number = form.cheque_number;
        if (form.cheque_issue_date) payload.cheque_issue_date = form.cheque_issue_date;
        payload.cheque_withdrawal_date = form.cheque_withdrawal_date || null;
      }
      if (form.type === 'cheque') {
        payload.cheque_number = form.cheque_number || null;
        payload.cheque_issue_date = form.cheque_issue_date || null;
        payload.cheque_withdrawal_date = form.cheque_withdrawal_date || null;
      }
      const updated = await api.updateExpense(userId, expense.id, payload as Partial<Expense>);
      onSaved(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
      {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <input value={form.description} onChange={e => set('description', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Amount{form.type === 'mix' ? ' (auto-calculated)' : ''}
          </label>
          <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
            readOnly={form.type === 'mix'}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-gray-50" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Payment Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            {PAYMENT_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Vendor</label>
          <select value={form.vendor_id} onChange={e => set('vendor_id', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option value="">-- No Vendor --</option>
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Paid By</label>
          <select value={form.paid_by_user_id} onChange={e => set('paid_by_user_id', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            <option value="">-- Select --</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
      </div>

      {/* Zelle reference */}
      {form.type === 'zelle' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Zelle Reference / Transaction ID</label>
          <input value={form.zelle_reference} onChange={e => set('zelle_reference', e.target.value)}
            placeholder="e.g., ZLL-20240325-4892"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
        </div>
      )}

      {/* Mix breakdown */}
      {form.type === 'mix' && (
        <div className="space-y-3 bg-indigo-50 rounded-lg p-3">
          <p className="text-xs font-semibold text-indigo-700">Mix Breakdown (fill in amounts used)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cash Amount</label>
              <input type="number" value={form.cash_amount} onChange={e => set('cash_amount', e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Card Amount</label>
              <input type="number" value={form.card_amount} onChange={e => set('card_amount', e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Zelle Amount</label>
              <input type="number" value={form.zelle_amount} onChange={e => set('zelle_amount', e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Zelle Reference</label>
              <input value={form.zelle_reference} onChange={e => set('zelle_reference', e.target.value)}
                placeholder="Transaction ID"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cheque Amount</label>
              <input type="number" value={form.cheque_amount} onChange={e => set('cheque_amount', e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cheque Number</label>
              <input value={form.cheque_number} onChange={e => set('cheque_number', e.target.value)}
                placeholder="e.g. 1042"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cheque Issue Date</label>
              <input type="date" value={form.cheque_issue_date} onChange={e => set('cheque_issue_date', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cheque Withdrawal Date</label>
              <input type="date" value={form.cheque_withdrawal_date} onChange={e => set('cheque_withdrawal_date', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white" />
            </div>
          </div>
        </div>
      )}

      {/* Cheque fields (standalone) */}
      {form.type === 'cheque' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cheque Number</label>
            <input value={form.cheque_number} onChange={e => set('cheque_number', e.target.value)}
              placeholder="e.g. 1042"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Issue Date</label>
            <input type="date" value={form.cheque_issue_date} onChange={e => set('cheque_issue_date', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Withdrawal Date</label>
            <input type="date" value={form.cheque_withdrawal_date} onChange={e => set('cheque_withdrawal_date', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

// ── Bulk Settle Panel ─────────────────────────────────────────────────────────

interface BulkSettlePanelProps {
  selected: Expense[];
  userId: string;
  onSettled: (updated: Expense[]) => void;
  onCancel: () => void;
}

function BulkSettlePanel({ selected, userId, onSettled, onCancel }: BulkSettlePanelProps) {
  const [chequeNumber, setChequeNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [withdrawalDate, setWithdrawalDate] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const totalAmount = selected.reduce((s, e) => s + e.amount, 0);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSettle() {
    if (!chequeNumber) { setError('Cheque number is required'); return; }
    if (!issueDate) { setError('Issue date is required'); return; }
    setSaving(true); setError('');
    try {
      const updated = await api.bulkSettleExpenses(userId, {
        expense_ids: selected.map(e => e.id),
        cheque_number: chequeNumber,
        issue_date: issueDate,
        withdrawal_date: withdrawalDate || undefined,
        image_uri: image ?? undefined,
      });
      onSettled(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Settlement failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-indigo-200 shadow-2xl">
      <div className="max-w-5xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="font-semibold text-gray-900">{selected.length} expense{selected.length !== 1 ? 's' : ''} selected</span>
            <span className="ml-3 text-sm text-gray-500">Total: <span className="font-semibold text-indigo-700">{fmt(totalAmount)}</span></span>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2 mb-3">{error}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cheque Number <span className="text-red-500">*</span></label>
            <input value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} placeholder="e.g. 1042"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Issue Date <span className="text-red-500">*</span></label>
            <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Withdrawal Date</label>
            <input type="date" value={withdrawalDate} onChange={e => setWithdrawalDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cheque Image</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            <button onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition">
              {image ? '✓ Image attached' : 'Upload image'}
            </button>
          </div>
        </div>

        <div className="mt-3 flex gap-2 justify-end">
          <Button variant="secondary" size="sm" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button variant="success" size="sm" onClick={handleSettle} disabled={saving}>
            {saving ? 'Settling…' : `Settle ${selected.length} Expense${selected.length !== 1 ? 's' : ''} with Cheque`}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Expense Row ───────────────────────────────────────────────────────────────

interface ExpenseRowProps {
  expense: Expense;
  vendors: Vendor[];
  users: User[];
  userId: string;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  onUpdated: (e: Expense) => void;
}

function ExpenseRow({ expense, vendors, users, userId, selectable, selected, onToggleSelect, onUpdated }: ExpenseRowProps) {
  const [editing, setEditing] = useState(false);

  return (
    <Card className={`p-4 transition-all ${selected ? 'ring-2 ring-indigo-400' : ''}`}>
      <div className="flex items-start gap-3">
        {selectable && (
          <input type="checkbox" checked={selected} onChange={onToggleSelect}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-gray-900 truncate">{expense.description}</p>
            <Badge variant={expense.type} />
            {!expense.is_paid && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                Unpaid
              </span>
            )}
            {expense.type === 'cheque' && expense.cheque_number && (
              <span className="text-xs text-gray-400">#{expense.cheque_number}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {expense.vendor_name && <span className="text-xs text-gray-500">{expense.vendor_name}</span>}
            {expense.paid_by_name && <span className="text-xs text-gray-400">by {expense.paid_by_name}</span>}
            <span className="text-xs text-gray-400 capitalize">{expense.category}</span>
            <span className="text-xs text-gray-400">{new Date(expense.date).toLocaleDateString()}</span>
          </div>
          {expense.type === 'zelle' && expense.zelle_reference && (
            <p className="text-xs text-gray-400 mt-0.5">Ref: {expense.zelle_reference}</p>
          )}
          {expense.type === 'mix' && (
            <p className="text-xs text-gray-400 mt-0.5">
              {[
                expense.cash_amount ? `Cash: ${fmt(expense.cash_amount)}` : null,
                expense.card_amount ? `Card: ${fmt(expense.card_amount)}` : null,
                expense.zelle_amount ? `Zelle: ${fmt(expense.zelle_amount)}` : null,
                expense.cheque_amount ? `Cheque: ${fmt(expense.cheque_amount)}` : null,
              ].filter(Boolean).join(' / ')}
            </p>
          )}

          {editing && (
            <EditForm
              expense={expense}
              vendors={vendors}
              users={users}
              userId={userId}
              onSaved={updated => { setEditing(false); onUpdated(updated); }}
              onCancel={() => setEditing(false)}
            />
          )}
        </div>
        <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
          <p className="font-semibold text-gray-900">{fmt(expense.amount)}</p>
          <button onClick={() => setEditing(v => !v)}
            title="Edit expense"
            className="text-gray-300 hover:text-indigo-500 transition text-sm">
            {editing ? '✕' : '✏️'}
          </button>
        </div>
      </div>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSettle, setShowSettle] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.getExpenses(user.id),
      api.getVendors(user.id),
      api.getUsers(),
    ])
      .then(([expenses, v, u]) => { setAllExpenses(expenses); setVendors(v); setUsers(u); })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <LoadingSpinner message="Loading expenses…" />;

  const unpaidExpenses = allExpenses.filter(e => !e.is_paid);
  const displayed = tab === 'unpaid' ? unpaidExpenses : allExpenses;

  const typeTotals: Record<ExpenseType, number> = { cash: 0, card: 0, cheque: 0, zelle: 0, mix: 0 };
  for (const e of allExpenses) typeTotals[e.type] += e.amount;
  const totalAll = allExpenses.reduce((s, e) => s + e.amount, 0);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setShowSettle(true);
  }

  function toggleSelectAll() {
    if (selectedIds.size === unpaidExpenses.length) {
      setSelectedIds(new Set());
      setShowSettle(false);
    } else {
      setSelectedIds(new Set(unpaidExpenses.map(e => e.id)));
      setShowSettle(true);
    }
  }

  function onUpdated(updated: Expense) {
    setAllExpenses(prev => prev.map(e => e.id === updated.id ? updated : e));
  }

  function onSettled(updated: Expense[]) {
    const map = new Map(updated.map(e => [e.id, e]));
    setAllExpenses(prev => prev.map(e => map.get(e.id) ?? e));
    setSelectedIds(new Set());
    setShowSettle(false);
  }

  const selectedExpenses = unpaidExpenses.filter(e => selectedIds.has(e.id));

  return (
    <div className={`p-6 max-w-5xl mx-auto ${showSettle && selectedIds.size > 0 ? 'pb-48' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/expenses/cheques')}>
            Cheques
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/expenses/create')}>
            + Add Expense
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        <Card className="p-4 col-span-3 sm:col-span-1">
          <p className="text-xs text-gray-500 mb-1">Total</p>
          <p className="text-xl font-bold text-gray-900">{fmt(totalAll)}</p>
          {unpaidExpenses.length > 0 && (
            <p className="text-xs text-red-500 mt-1">{unpaidExpenses.length} unpaid</p>
          )}
        </Card>
        {PAYMENT_TYPES.map(type => (
          <Card key={type} className="p-3">
            <p className="text-xs text-gray-500 mb-1 capitalize">{type}</p>
            <p className="text-sm font-semibold text-gray-900">{fmt(typeTotals[type])}</p>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {(['all', 'unpaid'] as Tab[]).map(t => (
          <button key={t} onClick={() => { setTab(t); setSelectedIds(new Set()); setShowSettle(false); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition capitalize ${
              tab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t === 'unpaid' ? `Unpaid (${unpaidExpenses.length})` : `All (${allExpenses.length})`}
          </button>
        ))}
      </div>

      {/* Select All (unpaid tab only) */}
      {tab === 'unpaid' && unpaidExpenses.length > 0 && (
        <div className="flex items-center gap-2 mb-3 px-1">
          <input type="checkbox"
            checked={selectedIds.size === unpaidExpenses.length && unpaidExpenses.length > 0}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
          <span className="text-sm text-gray-600">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
          </span>
          {selectedIds.size > 0 && (
            <button onClick={() => setShowSettle(true)}
              className="ml-2 text-sm font-medium text-indigo-600 hover:text-indigo-800">
              → Settle with cheque
            </button>
          )}
        </div>
      )}

      {/* Expense list */}
      {displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">{tab === 'unpaid' ? 'No unpaid expenses' : 'No expenses recorded'}</p>
          {tab === 'all' && (
            <Button variant="primary" className="mt-4" onClick={() => navigate('/expenses/create')}>
              Add First Expense
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(expense => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              vendors={vendors}
              users={users}
              userId={user!.id}
              selectable={tab === 'unpaid'}
              selected={selectedIds.has(expense.id)}
              onToggleSelect={() => toggleSelect(expense.id)}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      )}

      {/* Bulk Settle Panel */}
      {showSettle && selectedIds.size > 0 && (
        <BulkSettlePanel
          selected={selectedExpenses}
          userId={user!.id}
          onSettled={onSettled}
          onCancel={() => { setSelectedIds(new Set()); setShowSettle(false); }}
        />
      )}
    </div>
  );
}
