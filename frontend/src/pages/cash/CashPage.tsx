import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import type { CashEntry, CateringOrder } from '../../types';
import { Button, Card, LoadingSpinner } from '../../components/ui';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function CashPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = { amount: '', description: '', date: '', from_source: '', paid_to: '', catering_order_id: '' };
  const [form, setForm] = useState(emptyForm);

  // Invoice / catering order search
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [invoiceResults, setInvoiceResults] = useState<CateringOrder[]>([]);
  const [invoiceSearching, setInvoiceSearching] = useState(false);
  const [showInvoiceDropdown, setShowInvoiceDropdown] = useState(false);
  const invoiceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invoiceWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (invoiceWrapperRef.current && !invoiceWrapperRef.current.contains(e.target as Node)) {
        setShowInvoiceDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleInvoiceQueryChange(q: string) {
    setInvoiceQuery(q);
    setForm(prev => ({ ...prev, catering_order_id: '' }));
    if (!q.trim()) {
      setInvoiceResults([]);
      setShowInvoiceDropdown(false);
      return;
    }
    if (invoiceDebounceRef.current) clearTimeout(invoiceDebounceRef.current);
    invoiceDebounceRef.current = setTimeout(async () => {
      setInvoiceSearching(true);
      try {
        const results = await api.getOrders(user!.id, undefined, q.trim());
        setInvoiceResults(results.slice(0, 10));
        setShowInvoiceDropdown(true);
      } catch {
        // ignore
      } finally {
        setInvoiceSearching(false);
      }
    }, 250);
  }

  function selectOrder(order: CateringOrder) {
    const label = `${order.order_number ?? order.id} — ${order.customer_name} (${order.event_type})`;
    setInvoiceQuery(label);
    setForm(prev => ({ ...prev, catering_order_id: order.id }));
    setShowInvoiceDropdown(false);
  }

  function clearOrderSelection() {
    setInvoiceQuery('');
    setForm(prev => ({ ...prev, catering_order_id: '' }));
    setInvoiceResults([]);
  }

  async function load() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      setEntries(await api.getCashEntries(user.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [user]);

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.amount || !form.description.trim() || !form.date) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        amount: parseFloat(form.amount),
        description: form.description.trim(),
        date: form.date,
        from_source: form.from_source.trim() || undefined,
        paid_to: form.paid_to.trim() || undefined,
        catering_order_id: form.catering_order_id || undefined,
      };
      if (editingId) {
        await api.updateCashEntry(user!.id, editingId, payload);
      } else {
        await api.createCashEntry(user!.id, payload);
      }
      setForm(emptyForm);
      setInvoiceQuery('');
      setInvoiceResults([]);
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(entry: CashEntry) {
    setForm({
      amount: String(entry.amount),
      description: entry.description,
      date: entry.date,
      from_source: entry.from_source ?? '',
      paid_to: entry.paid_to ?? '',
      catering_order_id: entry.catering_order_id ?? '',
    });
    if (entry.catering_order_number) {
      setInvoiceQuery(`${entry.catering_order_number} — (linked order)`);
    } else {
      setInvoiceQuery('');
    }
    setEditingId(entry.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteCashEntry(user!.id, id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  const isValid = form.amount && form.description.trim() && form.date;
  const totalReceived = entries.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cash</h1>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Summary */}
      {entries.length > 0 && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Total Received</p>
            <p className="text-3xl font-bold text-green-800">{fmt(totalReceived)}</p>
          </div>
          <p className="text-sm text-green-600">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</p>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm ? (
        <Card className="p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Entry' : 'New Cash Entry'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => update('date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount Received ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={e => update('amount', e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => update('description', e.target.value)}
                placeholder="What was this cash for?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="text"
                value={form.from_source}
                onChange={e => update('from_source', e.target.value)}
                placeholder="Who paid this?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Paid To</label>
              <input
                type="text"
                value={form.paid_to}
                onChange={e => update('paid_to', e.target.value)}
                placeholder="Who received this?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div className="sm:col-span-2" ref={invoiceWrapperRef}>
              <label className="block text-xs font-medium text-gray-600 mb-1">Invoice Number (Catering Order)</label>
              <div className="relative">
                <input
                  type="text"
                  value={invoiceQuery}
                  onChange={e => handleInvoiceQueryChange(e.target.value)}
                  onFocus={() => invoiceResults.length > 0 && setShowInvoiceDropdown(true)}
                  placeholder="Search by order #, customer name, or event type…"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 pr-8"
                />
                {invoiceQuery && (
                  <button
                    type="button"
                    onClick={clearOrderSelection}
                    className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {showInvoiceDropdown && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {invoiceSearching ? (
                      <div className="px-4 py-3 text-xs text-gray-400">Searching…</div>
                    ) : invoiceResults.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-gray-400">No orders found</div>
                    ) : (
                      invoiceResults.map(order => (
                        <button
                          key={order.id}
                          type="button"
                          onMouseDown={() => selectOrder(order)}
                          className="w-full text-left px-4 py-2.5 hover:bg-green-50 border-b border-gray-100 last:border-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                              {order.order_number ?? order.id.slice(0, 8)}
                            </span>
                            <span className="text-sm text-gray-800">{order.customer_name}</span>
                            <span className="text-xs text-gray-400">{order.event_type}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5 pl-0.5">
                            {order.event_date} · {order.head_count} guests · ${order.negotiated_price.toLocaleString()}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {form.catering_order_id && (
                <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Order linked
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); setInvoiceQuery(''); setInvoiceResults([]); }}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={submitting} onClick={handleSubmit} disabled={!isValid}>
              {editingId ? 'Save Changes' : 'Add Entry'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="mb-6">
          <Button variant="primary" onClick={() => setShowForm(true)}>
            + Add Cash Entry
          </Button>
        </div>
      )}

      {/* Entries list */}
      {loading ? (
        <LoadingSpinner message="Loading entries..." />
      ) : entries.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-sm">No cash entries yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <Card key={entry.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{entry.description}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                    <span>{fmtDate(entry.date)}</span>
                    {entry.from_source && (
                      <span>From: <span className="font-medium text-gray-700">{entry.from_source}</span></span>
                    )}
                    {entry.paid_to && (
                      <span>Paid to: <span className="font-medium text-gray-700">{entry.paid_to}</span></span>
                    )}
                    {entry.catering_order_id && (
                      <button
                        onClick={() => navigate(`/catering/${entry.catering_order_id}`)}
                        className="flex items-center gap-1 font-mono font-semibold text-green-700 hover:text-green-900 hover:underline"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {entry.catering_order_number ?? entry.catering_order_id.slice(0, 8)}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-lg font-bold text-green-700">{fmt(entry.amount)}</span>
                  <button
                    onClick={() => startEdit(entry)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-gray-400 hover:text-red-600 p-1"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
