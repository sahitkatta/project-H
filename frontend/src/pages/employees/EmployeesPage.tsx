import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import type { Employee, EmployeeHour } from '../../types';
import { Button, Card, LoadingSpinner } from '../../components/ui';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Hourly Tracker ────────────────────────────────────────────────────────────

function HourlyTrackerTab({ userId }: { userId: string }) {
  const [entries, setEntries] = useState<EmployeeHour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = { employee_name: '', date: '', hours_worked: '', hourly_rate: '', notes: '', is_paid: false };
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    try {
      setEntries(await api.getEmployeeHours(userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function updateForm(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    if (!form.employee_name || !form.date || !form.hours_worked || !form.hourly_rate) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        employee_name: form.employee_name.trim(),
        date: form.date,
        hours_worked: parseFloat(form.hours_worked),
        hourly_rate: parseFloat(form.hourly_rate),
        notes: form.notes.trim() || undefined,
        is_paid: form.is_paid,
      };
      if (editingId) {
        await api.updateEmployeeHour(userId, editingId, payload);
      } else {
        await api.createEmployeeHour(userId, payload);
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(entry: EmployeeHour) {
    setForm({
      employee_name: entry.employee_name,
      date: entry.date,
      hours_worked: String(entry.hours_worked),
      hourly_rate: String(entry.hourly_rate),
      notes: entry.notes ?? '',
      is_paid: entry.is_paid,
    });
    setEditingId(entry.id);
    setShowForm(true);
  }

  async function togglePaid(entry: EmployeeHour) {
    try {
      const updated = await api.updateEmployeeHour(userId, entry.id, { is_paid: !entry.is_paid });
      setEntries(prev => prev.map(e => e.id === entry.id ? updated : e));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteEmployeeHour(userId, id);
      setEntries(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  const isValid = form.employee_name.trim() && form.date && form.hours_worked && form.hourly_rate;
  const liveAmount = form.hours_worked && form.hourly_rate
    ? parseFloat(form.hours_worked) * parseFloat(form.hourly_rate)
    : null;

  const totalUnpaid = entries.filter(e => !e.is_paid).reduce((s, e) => s + e.hours_worked * e.hourly_rate, 0);

  if (loading) return <LoadingSpinner message="Loading entries..." />;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Summary banner */}
      {totalUnpaid > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Unpaid Balance</p>
            <p className="text-2xl font-bold text-amber-800">{fmt(totalUnpaid)}</p>
          </div>
          <p className="text-sm text-amber-600">
            {entries.filter(e => !e.is_paid).length} unpaid {entries.filter(e => !e.is_paid).length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm ? (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Entry' : 'New Entry'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Employee Name</label>
              <input
                type="text"
                value={form.employee_name}
                onChange={e => updateForm('employee_name', e.target.value)}
                placeholder="e.g. Zaid"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => updateForm('date', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hours Worked</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={form.hours_worked}
                onChange={e => updateForm('hours_worked', e.target.value)}
                placeholder="e.g. 8"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Hourly Rate ($)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.hourly_rate}
                  onChange={e => updateForm('hourly_rate', e.target.value)}
                  placeholder="e.g. 15.00"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => updateForm('notes', e.target.value)}
                placeholder="Optional notes"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>

          {/* Amount preview + paid toggle */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-4">
              {liveAmount !== null && (
                <div>
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="text-xl font-bold text-indigo-600">{fmt(liveAmount)}</p>
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_paid}
                  onChange={e => updateForm('is_paid', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                />
                <span className="text-sm font-medium text-gray-700">Mark as Paid</span>
              </label>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" loading={submitting} onClick={handleSubmit} disabled={!isValid}>
                {editingId ? 'Save Changes' : 'Add Entry'}
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setShowForm(true)}>
          + Add Entry
        </Button>
      )}

      {/* Entries list */}
      {entries.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm">No hour entries yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <Card key={entry.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{entry.employee_name}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                      entry.is_paid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {entry.is_paid ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                    <span>{fmtDate(entry.date)}</span>
                    <span>{entry.hours_worked} hrs @ ${entry.hourly_rate}/hr</span>
                    {entry.notes && <span className="text-gray-400 italic">{entry.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-lg font-bold text-gray-900">{fmt(entry.hours_worked * entry.hourly_rate)}</span>
                  <button
                    onClick={() => togglePaid(entry)}
                    className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
                      entry.is_paid
                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {entry.is_paid ? 'Unpay' : 'Pay'}
                  </button>
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

// ── Contact Details ───────────────────────────────────────────────────────────

function ContactsTab({ userId }: { userId: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyForm = { name: '', contact_number: '' };
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    try {
      setEmployees(await api.getEmployees(userId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit() {
    if (!form.name.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = { name: form.name.trim(), contact_number: form.contact_number.trim() || undefined };
      if (editingId) {
        await api.updateEmployee(userId, editingId, payload);
      } else {
        await api.createEmployee(userId, payload);
      }
      setForm(emptyForm);
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(emp: Employee) {
    setForm({ name: emp.name, contact_number: emp.contact_number ?? '' });
    setEditingId(emp.id);
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteEmployee(userId, id);
      setEmployees(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  if (loading) return <LoadingSpinner message="Loading contacts..." />;

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {showForm ? (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            {editingId ? 'Edit Contact' : 'New Contact'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Employee name"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contact Number</label>
              <input
                type="tel"
                value={form.contact_number}
                onChange={e => setForm(p => ({ ...p, contact_number: e.target.value }))}
                placeholder="e.g. (555) 123-4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={submitting} onClick={handleSubmit} disabled={!form.name.trim()}>
              {editingId ? 'Save Changes' : 'Add Contact'}
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="primary" onClick={() => setShowForm(true)}>
          + Add Contact
        </Button>
      )}

      {employees.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm">No contacts yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {employees.map(emp => (
            <Card key={emp.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm flex-shrink-0">
                    {emp.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{emp.name}</p>
                    {emp.contact_number ? (
                      <p className="text-sm text-gray-500">{emp.contact_number}</p>
                    ) : (
                      <p className="text-sm text-gray-300 italic">No number</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(emp)} className="text-gray-400 hover:text-gray-600 p-1" title="Edit">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(emp.id)} className="text-gray-400 hover:text-red-600 p-1" title="Delete">
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function EmployeesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'hours' | 'contacts'>('hours');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        {([
          { key: 'hours', label: 'Hourly Tracker' },
          { key: 'contacts', label: 'Contact Details' },
        ] as const).map(tab => (
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

      {activeTab === 'hours' && <HourlyTrackerTab userId={user!.id} />}
      {activeTab === 'contacts' && <ContactsTab userId={user!.id} />}
    </div>
  );
}
