import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import type { CateringOrder, OrderStatus } from '../../types';
import { LoadingSpinner } from '../../components/ui';

const STATUS_TABS: { label: string; value: OrderStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Completed', value: 'completed' },
  { label: 'Rejected', value: 'rejected' },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 10)}`;
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    pending:   'bg-yellow-100 text-yellow-800',
    accepted:  'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    rejected:  'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function PaymentBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-gray-400">—</span>;
  const styles: Record<string, string> = {
    paid:    'bg-green-100 text-green-800',
    unpaid:  'bg-red-100 text-red-800',
    partial: 'bg-orange-100 text-orange-800',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Week helpers ─────────────────────────────────────────────────────────────

/** Returns the Monday of the week containing `date`. */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const startStr = weekStart.toLocaleDateString('en-US', opts);
  const endStr   = weekEnd.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${startStr} – ${endStr}`;
}

// ── Print helper ─────────────────────────────────────────────────────────────

function buildOrderPage(o: CateringOrder): string {
  const tray = o.tray_sizes;
  const trayKeys = ['small', 'medium', 'large', 'xlarge'] as const;
  const trayEntries = tray ? trayKeys.filter(k => tray[k] > 0) : [];
  const hasTray = trayEntries.length > 0;
  const trayLabel = (k: string) => k === 'xlarge' ? 'X-Large' : k.charAt(0).toUpperCase() + k.slice(1);
  const items = o.items ?? [];
  const eventDate = new Date(o.event_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const placedDate = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const trayHtml = hasTray ? `
    <div style="border:2px solid #111;border-radius:4px;padding:12px;margin-bottom:20px;background:#f9fafb">
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:0 0 10px">Tray Sizes</p>
      <div style="display:grid;grid-template-columns:repeat(${trayEntries.length},1fr);gap:10px;text-align:center">
        ${trayEntries.map(k => `
          <div style="border:1px solid #d1d5db;border-radius:4px;padding:8px">
            <p style="font-size:10px;color:#6b7280;text-transform:uppercase;margin:0 0 4px">${trayLabel(k)}</p>
            <p style="font-size:28px;font-weight:700;margin:0">${tray![k]}</p>
          </div>`).join('')}
      </div>
    </div>` : '';

  const itemsHtml = items.length > 0 ? `
    <div style="margin-bottom:20px">
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #d1d5db;padding-bottom:4px;margin:0 0 8px">Menu Items</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid #e5e7eb">
            <th style="text-align:left;padding:4px 0;font-weight:600">Item</th>
            <th style="text-align:center;padding:4px 0;font-weight:600;width:48px">Qty</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(i => `
            <tr style="border-bottom:1px solid #f3f4f6">
              <td style="padding:6px 0">
                <p style="font-weight:500;margin:0">${i.name}</p>
                ${i.special_instructions ? `<p style="font-size:11px;color:#b45309;margin:3px 0 0">&#9888; ${i.special_instructions}</p>` : ''}
              </td>
              <td style="text-align:center;padding:6px 0;font-weight:700;font-size:18px">${i.quantity}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>` : '';

  const notesHtml = o.notes ? `
    <div style="border:2px dashed #f59e0b;border-radius:4px;padding:10px;margin-bottom:20px;background:#fffbeb">
      <p style="font-size:10px;color:#92400e;text-transform:uppercase;font-weight:700;margin:0 0 4px">Special Instructions / Notes</p>
      <p style="font-size:13px;margin:0;color:#111">${o.notes}</p>
    </div>` : '';

  return `
    <div style="padding:0;max-width:600px;margin:0 auto;font-family:Arial,sans-serif;color:#111">
      <!-- Header -->
      <div style="text-align:center;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:20px">
        <h1 style="font-size:26px;font-weight:700;letter-spacing:.05em;margin:0">BASERA</h1>
        <p style="font-size:12px;color:#6b7280;margin:4px 0 0">Kitchen Order</p>
      </div>

      <!-- Order meta -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
        <div>
          <p style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:0 0 2px">Order #</p>
          <p style="font-family:monospace;font-size:18px;font-weight:700;margin:0">${o.order_number ?? o.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <div style="text-align:right">
          <p style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:0 0 2px">Date Placed</p>
          <p style="font-size:13px;font-weight:600;margin:0">${placedDate}</p>
        </div>
      </div>

      <!-- Customer & Event -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div style="border:1px solid #d1d5db;border-radius:4px;padding:10px">
          <p style="font-size:10px;color:#6b7280;text-transform:uppercase;font-weight:700;margin:0 0 6px">Customer</p>
          <p style="font-weight:600;margin:0 0 2px">${o.customer_name}</p>
          <p style="font-size:12px;color:#4b5563;margin:0 0 2px">${formatPhone(o.customer_phone)}</p>
          ${o.customer_email ? `<p style="font-size:12px;color:#4b5563;margin:0 0 2px">${o.customer_email}</p>` : ''}
          ${o.customer_company ? `<p style="font-size:12px;color:#4b5563;margin:0 0 2px">${o.customer_company}</p>` : ''}
          ${o.customer_point_of_contact ? `<p style="font-size:11px;color:#6b7280;margin:0">Contact: ${o.customer_point_of_contact}</p>` : ''}
        </div>
        <div style="border:1px solid #d1d5db;border-radius:4px;padding:10px">
          <p style="font-size:10px;color:#6b7280;text-transform:uppercase;font-weight:700;margin:0 0 6px">Event</p>
          <p style="font-weight:600;margin:0 0 2px">${o.event_type}</p>
          <p style="font-size:12px;color:#4b5563;margin:0 0 2px">${eventDate}</p>
          <p style="font-size:12px;color:#4b5563;margin:0">${o.head_count} guests</p>
        </div>
      </div>

      ${notesHtml}
      ${trayHtml}
      ${itemsHtml}

      <!-- Signature -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px">
        <div>
          <div style="border-bottom:1px solid #9ca3af;padding-bottom:24px;margin-bottom:4px"></div>
          <p style="font-size:10px;color:#6b7280;margin:0">Kitchen Staff Signature</p>
        </div>
        <div>
          <div style="border-bottom:1px solid #9ca3af;padding-bottom:24px;margin-bottom:4px"></div>
          <p style="font-size:10px;color:#6b7280;margin:0">Date Fulfilled</p>
        </div>
      </div>
    </div>`;
}

function buildPrintHtml(orders: CateringOrder[]): string {
  const pages = orders.map((o, i) => `
    <div style="page-break-after:${i < orders.length - 1 ? 'always' : 'auto'}">
      ${buildOrderPage(o)}
    </div>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Kitchen Orders (${orders.length})</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #fff; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      @page { margin: 0.75in; }
    }
  </style>
</head>
<body>
  ${pages}
</body>
</html>`;
}

function printOrders(orders: CateringOrder[]) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;visibility:hidden';
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(buildPrintHtml(orders));
  doc.close();
  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  }, 400);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OrderHistoryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<OrderStatus | 'all'>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Weekly view
  const [weeklyMode, setWeeklyMode] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));

  // Multi-select
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function loadOrders(q: string, status: OrderStatus | 'all') {
    if (!user) return;
    setLoading(true);
    api.getOrders(user.id, status === 'all' ? undefined : status, q || undefined)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadOrders(search, statusTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, statusTab]);

  function handleSearch(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadOrders(value, statusTab), 350);
  }

  function changeWeek(delta: number) {
    setWeekStart(prev => {
      const next = addDays(prev, delta * 7);
      setSelected(new Set());
      return next;
    });
  }

  function toggleWeeklyMode() {
    setWeeklyMode(v => !v);
    setWeekStart(getWeekStart(new Date()));
    setSelected(new Set());
  }

  // Apply weekly filter client-side
  const weekEnd = addDays(weekStart, 6);
  const weekStartYMD = toYMD(weekStart);
  const weekEndYMD   = toYMD(weekEnd);

  const filteredOrders = weeklyMode
    ? orders.filter(o => o.event_date >= weekStartYMD && o.event_date <= weekEndYMD)
    : orders;

  const price = (o: CateringOrder) => o.negotiated_price || o.estimated_price;

  // Select helpers
  const allIds = filteredOrders.map(o => o.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handlePrintSelected() {
    const toPrint = filteredOrders.filter(o => selected.has(o.id));
    printOrders(toPrint);
  }

  const isCurrentWeek = toYMD(weekStart) === toYMD(getWeekStart(new Date()));

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order History</h1>
          <p className="text-sm text-gray-500 mt-0.5">Search and track all catering orders</p>
        </div>
        <div className="flex items-center gap-2">
          {someSelected && (
            <button
              onClick={handlePrintSelected}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print {selected.size}
            </button>
          )}
          <button
            onClick={() => navigate('/catering/create')}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          >
            + New Order
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by order # (BAS-00001), customer name, phone, company, event type…"
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {search && (
          <button onClick={() => handleSearch('')} className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600">×</button>
        )}
      </div>

      {/* Status tabs + weekly toggle */}
      <div className="flex items-center justify-between mb-5 border-b border-gray-200">
        <div className="flex gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusTab(tab.value); loadOrders(search, tab.value); setSelected(new Set()); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                statusTab === tab.value
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Weekly toggle */}
        <button
          onClick={toggleWeeklyMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 mb-1 rounded-lg text-xs font-medium border transition-colors ${
            weeklyMode
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Weekly
        </button>
      </div>

      {/* Week navigator (shown only in weekly mode) */}
      {weeklyMode && (
        <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2.5 mb-4">
          <button
            onClick={() => changeWeek(-1)}
            className="p-1.5 rounded-md hover:bg-indigo-100 text-indigo-600"
            aria-label="Previous week"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="text-center">
            <p className="text-sm font-semibold text-indigo-900">{formatWeekRange(weekStart)}</p>
            {isCurrentWeek && (
              <p className="text-xs text-indigo-500 mt-0.5">Current Week</p>
            )}
          </div>

          <button
            onClick={() => changeWeek(1)}
            className="p-1.5 rounded-md hover:bg-indigo-100 text-indigo-600"
            aria-label="Next week"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingSpinner message="Loading orders…" />
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-sm">
            {weeklyMode
              ? `No orders with events in ${formatWeekRange(weekStart)}`
              : `No orders found${search ? ` for "${search}"` : ''}`}
          </p>
          {weeklyMode && !isCurrentWeek && (
            <button
              onClick={() => setWeekStart(getWeekStart(new Date()))}
              className="mt-3 text-xs text-indigo-600 hover:underline"
            >
              Jump to current week
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-400">
              {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
              {weeklyMode && ` in ${formatWeekRange(weekStart)}`}
            </p>
            {someSelected && (
              <p className="text-xs text-indigo-600 font-medium">{selected.size} selected</p>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Order #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Event</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((o) => {
                  const isChecked = selected.has(o.id);
                  return (
                    <tr
                      key={o.id}
                      className={`transition-colors cursor-pointer ${isChecked ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
                    >
                      <td
                        className="px-4 py-3 w-10"
                        onClick={(e) => { e.stopPropagation(); toggleOne(o.id); }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleOne(o.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-indigo-700" onClick={() => navigate(`/catering/${o.id}`)}>
                        {o.order_number ?? '—'}
                      </td>
                      <td className="px-4 py-3" onClick={() => navigate(`/catering/${o.id}`)}>
                        <p className="font-medium text-gray-900">{o.customer_name}</p>
                        <p className="text-xs text-gray-500">{formatPhone(o.customer_phone)}</p>
                        {o.customer_company && <p className="text-xs text-gray-400">{o.customer_company}</p>}
                      </td>
                      <td className="px-4 py-3" onClick={() => navigate(`/catering/${o.id}`)}>
                        <p className="text-gray-800">{o.event_type}</p>
                        <p className="text-xs text-gray-400">{o.head_count} guests</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap" onClick={() => navigate(`/catering/${o.id}`)}>
                        {new Date(o.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900" onClick={() => navigate(`/catering/${o.id}`)}>
                        {fmt(price(o))}
                      </td>
                      <td className="px-4 py-3" onClick={() => navigate(`/catering/${o.id}`)}>
                        <StatusBadge status={o.status} />
                        {o.price_approval_status === 'pending_approval' && (
                          <span className="ml-1 inline-flex px-1.5 py-0.5 rounded text-xs bg-orange-100 text-orange-700">Approval</span>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={() => navigate(`/catering/${o.id}`)}>
                        <PaymentBadge status={o.payment_status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredOrders.map((o) => {
              const isChecked = selected.has(o.id);
              return (
                <div
                  key={o.id}
                  className={`border rounded-xl p-4 cursor-pointer transition-colors ${isChecked ? 'border-indigo-400 bg-indigo-50' : 'bg-white border-gray-200 hover:border-indigo-300'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(o.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="font-mono font-bold text-indigo-700 text-sm">{o.order_number ?? '—'}</span>
                    </div>
                    <div className="flex gap-1">
                      <StatusBadge status={o.status} />
                      {o.payment_status && <PaymentBadge status={o.payment_status} />}
                    </div>
                  </div>
                  <div onClick={() => navigate(`/catering/${o.id}`)}>
                    <p className="font-medium text-gray-900">{o.customer_name}</p>
                    {o.customer_company && <p className="text-xs text-gray-500">{o.customer_company}</p>}
                    <p className="text-xs text-gray-500">{formatPhone(o.customer_phone)}</p>
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <span className="text-gray-600">{o.event_type} · {o.head_count} guests</span>
                      <span className="font-semibold text-gray-900">{fmt(price(o))}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(o.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
