import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import type { Cheque, ChequesByVendor } from '../../types';
import { Badge, Button, Card, LoadingSpinner } from '../../components/ui';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

interface SettleFormState {
  cheque_number: string;
  issue_date: string;
  withdrawal_date: string;
  amount: string;
  image_uri: string;
  imagePreview: string;
}

interface SettleRowProps {
  cheque: Cheque;
  userId: string;
  onSettled: () => void;
}

function SettleRow({ cheque, userId, onSettled }: SettleRowProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<SettleFormState>({
    cheque_number: cheque.cheque_number,
    issue_date: cheque.issue_date,
    withdrawal_date: cheque.withdrawal_date ?? '',
    amount: String(cheque.amount),
    image_uri: cheque.image_uri ?? '',
    imagePreview: cheque.image_uri ?? '',
  });

  function updateForm(field: keyof SettleFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setForm((prev) => ({ ...prev, image_uri: result, imagePreview: result }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSettle() {
    setSubmitting(true);
    setError('');
    try {
      await api.settleCheque(userId, cheque.id, {
        cheque_number: form.cheque_number,
        issue_date: form.issue_date,
        withdrawal_date: form.withdrawal_date || undefined,
        amount: parseFloat(form.amount),
        image_uri: form.image_uri || undefined,
      });
      setOpen(false);
      onSettled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to settle cheque');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-3 bg-white hover:bg-gray-50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">#{cheque.cheque_number}</span>
            <span className="text-sm font-semibold text-gray-900">{formatCurrency(cheque.amount)}</span>
            {cheque.is_cleared ? (
              <Badge variant="completed">Cleared</Badge>
            ) : (
              <Badge variant="pending">Outstanding</Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Issued: {formatDate(cheque.issue_date)}
            {cheque.withdrawal_date && ` · Withdrawn: ${formatDate(cheque.withdrawal_date)}`}
          </p>
        </div>
        {!cheque.is_cleared && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Cancel' : 'Settle'}
          </Button>
        )}
      </div>

      {/* Settle form — inline below the cheque row */}
      {open && (
        <div className="border-t border-orange-100 bg-orange-50 p-4 space-y-3">
          <h4 className="text-sm font-semibold text-orange-800">Settle Cheque</h4>
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Cheque Number
              </label>
              <input
                type="text"
                value={form.cheque_number}
                onChange={(e) => updateForm('cheque_number', e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Settlement Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1.5 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => updateForm('amount', e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Issue Date
              </label>
              <input
                type="date"
                value={form.issue_date}
                onChange={(e) => updateForm('issue_date', e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Withdrawal Date
              </label>
              <input
                type="date"
                value={form.withdrawal_date}
                onChange={(e) => updateForm('withdrawal_date', e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>
          </div>

          {/* Settlement image */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Settlement Cheque Image
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full text-sm text-gray-500 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200"
            />
            {form.imagePreview && (
              <div className="mt-2 relative inline-block">
                <img
                  src={form.imagePreview}
                  alt="Cheque preview"
                  className="h-20 rounded-lg border border-orange-200 object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({ ...prev, image_uri: '', imagePreview: '' }));
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              variant="success"
              size="sm"
              loading={submitting}
              onClick={handleSettle}
            >
              Confirm Settlement
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function VendorCard({
  group,
  userId,
  onSettled,
}: {
  group: ChequesByVendor;
  userId: string;
  onSettled: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-5 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{group.vendor_name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {group.cheque_count} {group.cheque_count === 1 ? 'cheque' : 'cheques'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-gray-400">Outstanding</p>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(group.total_outstanding)}
              </p>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-3 space-y-2">
          {group.cheques.map((cheque) => (
            <SettleRow
              key={cheque.id}
              cheque={cheque}
              userId={userId}
              onSettled={onSettled}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Upcoming Cheques tab ──────────────────────────────────────────────────────

type Urgency = 'overdue' | 'today' | 'week' | 'later' | 'no-date';

function getUrgency(withdrawalDate?: string): Urgency {
  if (!withdrawalDate) return 'no-date';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(withdrawalDate); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 7) return 'week';
  return 'later';
}

function daysLabel(withdrawalDate?: string): { label: string; className: string } {
  if (!withdrawalDate) return { label: 'No date', className: 'bg-gray-100 text-gray-500' };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(withdrawalDate); d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, className: 'bg-red-100 text-red-700' };
  if (diff === 0) return { label: 'Today', className: 'bg-red-100 text-red-700' };
  if (diff === 1) return { label: 'Tomorrow', className: 'bg-orange-100 text-orange-700' };
  if (diff <= 7) return { label: `in ${diff} days`, className: 'bg-amber-100 text-amber-700' };
  return { label: `in ${diff} days`, className: 'bg-green-100 text-green-700' };
}

const URGENCY_ORDER: Urgency[] = ['overdue', 'today', 'week', 'later', 'no-date'];
const URGENCY_LABELS: Record<Urgency, string> = {
  overdue: 'Overdue',
  today: 'Due Today',
  week: 'This Week',
  later: 'Later',
  'no-date': 'No Withdrawal Date',
};
const URGENCY_STYLES: Record<Urgency, string> = {
  overdue: 'text-red-700 border-red-200 bg-red-50',
  today: 'text-red-600 border-red-200 bg-red-50',
  week: 'text-amber-700 border-amber-200 bg-amber-50',
  later: 'text-green-700 border-green-200 bg-green-50',
  'no-date': 'text-gray-600 border-gray-200 bg-gray-50',
};

function UpcomingTab({ cheques, userId, onSettled }: { cheques: Cheque[]; userId: string; onSettled: () => void }) {
  const uncleared = cheques.filter(c => !c.is_cleared);

  // Group by urgency
  const groups = new Map<Urgency, Cheque[]>();
  for (const c of uncleared) {
    const u = getUrgency(c.withdrawal_date);
    if (!groups.has(u)) groups.set(u, []);
    groups.get(u)!.push(c);
  }
  // Sort each group by withdrawal_date ascending
  for (const [, list] of groups) {
    list.sort((a, b) => {
      if (!a.withdrawal_date) return 1;
      if (!b.withdrawal_date) return -1;
      return a.withdrawal_date.localeCompare(b.withdrawal_date);
    });
  }

  const total = uncleared.reduce((s, c) => s + c.amount, 0);
  const urgentTotal = uncleared
    .filter(c => ['overdue', 'today', 'week'].includes(getUrgency(c.withdrawal_date)))
    .reduce((s, c) => s + c.amount, 0);

  if (uncleared.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm">No outstanding cheques</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Balance alert banner */}
      <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1">Ensure Bank Balance</p>
            <p className="text-3xl font-bold text-red-700">{formatCurrency(total)}</p>
            <p className="text-sm text-red-500 mt-1">
              {uncleared.length} outstanding cheque{uncleared.length !== 1 ? 's' : ''}
            </p>
          </div>
          {urgentTotal > 0 && urgentTotal !== total && (
            <div className="text-right">
              <p className="text-xs text-red-500 font-medium">Due within 7 days</p>
              <p className="text-xl font-bold text-red-700">{formatCurrency(urgentTotal)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Urgency groups */}
      {URGENCY_ORDER.filter(u => groups.has(u)).map(urgency => {
        const list = groups.get(urgency)!;
        const groupTotal = list.reduce((s, c) => s + c.amount, 0);
        return (
          <div key={urgency}>
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-semibold uppercase tracking-wide mb-2 ${URGENCY_STYLES[urgency]}`}>
              <span>{URGENCY_LABELS[urgency]} ({list.length})</span>
              <span>{formatCurrency(groupTotal)}</span>
            </div>
            <div className="space-y-2">
              {list.map(cheque => {
                const days = daysLabel(cheque.withdrawal_date);
                return (
                  <Card key={cheque.id} className="overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900">{cheque.payee}</span>
                            {cheque.vendor_name && (
                              <span className="text-xs text-gray-400">({cheque.vendor_name})</span>
                            )}
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${days.className}`}>
                              {days.label}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                            <span>#{cheque.cheque_number}</span>
                            <span>Issued: {formatDate(cheque.issue_date)}</span>
                            {cheque.withdrawal_date && (
                              <span className="font-medium">Withdraws: {formatDate(cheque.withdrawal_date)}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-lg font-bold text-gray-900 flex-shrink-0">
                          {formatCurrency(cheque.amount)}
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-gray-100">
                      <SettleRow cheque={cheque} userId={userId} onSettled={onSettled} />
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ChequesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'by-vendor' | 'all'>('upcoming');

  const [groupedCheques, setGroupedCheques] = useState<ChequesByVendor[]>([]);
  const [allCheques, setAllCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [grouped, all] = await Promise.all([
        api.getChequesByVendor(user.id),
        api.getCheques(user.id),
      ]);
      setGroupedCheques(grouped);
      setAllCheques(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cheques');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const outstandingCheques = allCheques.filter((c) => !c.is_cleared);
  const clearedCheques = allCheques.filter((c) => c.is_cleared);

  const totalOutstanding = groupedCheques.reduce(
    (sum, g) => sum + g.total_outstanding,
    0,
  );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/expenses')}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Cheques</h1>
      </div>

      {/* Summary */}
      {totalOutstanding > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-red-700 font-medium">Total Outstanding</p>
            <p className="text-3xl font-bold text-red-600">{formatCurrency(totalOutstanding)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-red-600">{outstandingCheques.length} cheques</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        {([
          { key: 'upcoming', label: 'Upcoming' },
          { key: 'by-vendor', label: 'By Vendor' },
          { key: 'all', label: 'All Cheques' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner message="Loading cheques..." />
      ) : (
        <>
          {/* Upcoming tab */}
          {activeTab === 'upcoming' && (
            <UpcomingTab cheques={allCheques} userId={user!.id} onSettled={loadData} />
          )}

          {/* By Vendor tab */}
          {activeTab === 'by-vendor' && (
            <div className="space-y-4">
              {groupedCheques.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <p>No cheque data found</p>
                </div>
              ) : (
                groupedCheques.map((group) => (
                  <VendorCard
                    key={group.vendor_id ?? group.vendor_name}
                    group={group}
                    userId={user!.id}
                    onSettled={loadData}
                  />
                ))
              )}
            </div>
          )}

          {/* All Cheques tab */}
          {activeTab === 'all' && (
            <div className="space-y-6">
              {/* Outstanding */}
              <div>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Outstanding ({outstandingCheques.length})
                </h2>
                {outstandingCheques.length === 0 ? (
                  <p className="text-sm text-gray-400">No outstanding cheques</p>
                ) : (
                  <div className="space-y-2">
                    {outstandingCheques.map((cheque) => (
                      <AllChequeCard key={cheque.id} cheque={cheque} userId={user!.id} onSettled={loadData} />
                    ))}
                  </div>
                )}
              </div>

              {/* Cleared */}
              <div>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                  Cleared ({clearedCheques.length})
                </h2>
                {clearedCheques.length === 0 ? (
                  <p className="text-sm text-gray-400">No cleared cheques</p>
                ) : (
                  <div className="space-y-2">
                    {clearedCheques.map((cheque) => (
                      <AllChequeCard key={cheque.id} cheque={cheque} userId={user!.id} onSettled={loadData} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AllChequeCard({
  cheque,
  userId,
  onSettled,
}: {
  cheque: Cheque;
  userId: string;
  onSettled: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900">{cheque.payee}</span>
              {cheque.vendor_name && (
                <span className="text-xs text-gray-500">({cheque.vendor_name})</span>
              )}
              {cheque.is_cleared ? (
                <Badge variant="completed">Cleared</Badge>
              ) : (
                <Badge variant="pending">Outstanding</Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
              <span>#{cheque.cheque_number}</span>
              <span>Issued: {formatDate(cheque.issue_date)}</span>
              {cheque.withdrawal_date && (
                <span>Withdrawn: {formatDate(cheque.withdrawal_date)}</span>
              )}
            </div>
          </div>
          <span className="text-lg font-bold text-gray-900">
            {formatCurrency(cheque.amount)}
          </span>
        </div>
      </div>
      {!cheque.is_cleared && (
        <div className="border-t border-gray-100">
          <SettleRow cheque={cheque} userId={userId} onSettled={onSettled} />
        </div>
      )}
    </Card>
  );
}
