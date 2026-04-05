import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import type { Vendor, ExpenseType, ExpenseCategory } from '../../types';
import type { User } from '../../types';
import { Card, Button } from '../../components/ui';

const PAYMENT_TYPES: { value: ExpenseType; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'mix', label: 'Mix' },
];

const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'groceries', label: 'Groceries' },
  { value: 'catering', label: 'Catering' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'salary', label: 'Salary' },
  { value: 'rent', label: 'Rent' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'other', label: 'Other' },
];

type MixComponent = 'cash' | 'card' | 'zelle' | 'cheque';

const ADD_NEW_VENDOR_VALUE = '__add_new__';

export default function CreateExpensePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Vendors
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');
  const [showNewVendorInput, setShowNewVendorInput] = useState(false);
  const [newVendorName, setNewVendorName] = useState('');
  const [savingVendor, setSavingVendor] = useState(false);
  const [vendorError, setVendorError] = useState('');

  // Users (paid by)
  const [users, setUsers] = useState<User[]>([]);
  const [paidByUserId, setPaidByUserId] = useState<string>('');

  // Core fields
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentType, setPaymentType] = useState<ExpenseType>('cash');
  const [category, setCategory] = useState<ExpenseCategory>('groceries');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Zelle fields
  const [zelleReference, setZelleReference] = useState('');

  // Mix fields
  const [mixComponents, setMixComponents] = useState<MixComponent[]>(['cash', 'card']);
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [zelleAmount, setZelleAmount] = useState('');
  const [mixZelleReference, setMixZelleReference] = useState('');
  const [chequeAmount, setChequeAmount] = useState('');

  // Cheque fields (for standalone cheque AND mix with cheque component)
  const [chequeNumber, setChequeNumber] = useState('');
  const [chequeIssueDate, setChequeIssueDate] = useState('');
  const [chequeWithdrawalDate, setChequeWithdrawalDate] = useState('');
  const [chequeImageUri, setChequeImageUri] = useState<string>('');
  const [chequeImagePreview, setChequeImagePreview] = useState<string>('');
  const chequeFileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Auto-calculate total for mix
  const mixTotal = mixComponents.reduce((sum, c) => {
    if (c === 'cash') return sum + (parseFloat(cashAmount) || 0);
    if (c === 'card') return sum + (parseFloat(cardAmount) || 0);
    if (c === 'zelle') return sum + (parseFloat(zelleAmount) || 0);
    if (c === 'cheque') return sum + (parseFloat(chequeAmount) || 0);
    return sum;
  }, 0);

  useEffect(() => {
    if (paymentType === 'mix') {
      setAmount(String(mixTotal));
    }
  }, [cashAmount, cardAmount, zelleAmount, chequeAmount, mixComponents, paymentType, mixTotal]);

  useEffect(() => {
    if (!user) return;
    Promise.all([api.getVendors(user.id), api.getUsers()]).then(([v, u]) => {
      setVendors(v);
      setUsers(u);
    }).catch(() => {});
  }, [user]);

  function handleVendorSelect(value: string) {
    if (value === ADD_NEW_VENDOR_VALUE) {
      setShowNewVendorInput(true);
      setSelectedVendorId('');
    } else {
      setShowNewVendorInput(false);
      setSelectedVendorId(value);
    }
  }

  async function handleSaveNewVendor() {
    if (!user || !newVendorName.trim()) return;
    setSavingVendor(true);
    setVendorError('');
    try {
      const created = await api.createVendor(user.id, newVendorName.trim());
      setVendors((prev) => [...prev, created]);
      setSelectedVendorId(created.id);
      setShowNewVendorInput(false);
      setNewVendorName('');
    } catch (err) {
      setVendorError(err instanceof Error ? err.message : 'Failed to create vendor');
    } finally {
      setSavingVendor(false);
    }
  }

  function toggleMixComponent(c: MixComponent) {
    setMixComponents(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  }

  function handleChequeImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setChequeImageUri(result);
      setChequeImagePreview(result);
    };
    reader.readAsDataURL(file);
  }

  function clearChequeImage() {
    setChequeImageUri('');
    setChequeImagePreview('');
    if (chequeFileRef.current) chequeFileRef.current.value = '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');
    setSubmitting(true);

    try {
      const payload: Record<string, unknown> = {
        description,
        amount: paymentType === 'mix' ? mixTotal : parseFloat(amount),
        type: paymentType,
        category,
        date,
      };

      if (selectedVendorId) payload.vendor_id = selectedVendorId;
      if (paidByUserId) payload.paid_by_user_id = paidByUserId;

      if (paymentType === 'zelle') {
        if (zelleReference) payload.zelle_reference = zelleReference;
      }

      if (paymentType === 'mix') {
        if (mixComponents.includes('cash')) payload.cash_amount = parseFloat(cashAmount) || 0;
        if (mixComponents.includes('card')) payload.card_amount = parseFloat(cardAmount) || 0;
        if (mixComponents.includes('zelle')) {
          payload.zelle_amount = parseFloat(zelleAmount) || 0;
          if (mixZelleReference) payload.zelle_reference = mixZelleReference;
        }
        if (mixComponents.includes('cheque')) {
          payload.cheque_amount = parseFloat(chequeAmount) || 0;
          if (chequeNumber) payload.cheque_number = chequeNumber;
          if (chequeIssueDate) payload.cheque_issue_date = chequeIssueDate;
          if (chequeWithdrawalDate) payload.cheque_withdrawal_date = chequeWithdrawalDate;
          if (chequeImageUri) payload.cheque_image_uri = chequeImageUri;
        }
      }

      if (paymentType === 'cheque') {
        payload.cheque_number = chequeNumber;
        payload.cheque_issue_date = chequeIssueDate;
        if (chequeWithdrawalDate) payload.cheque_withdrawal_date = chequeWithdrawalDate;
        if (chequeImageUri) payload.cheque_image_uri = chequeImageUri;
      }

      await api.createExpense(user.id, payload as Parameters<typeof api.createExpense>[1]);
      navigate('/expenses');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create expense');
    } finally {
      setSubmitting(false);
    }
  }

  const showAmountField = paymentType !== 'mix';
  const showZelleFields = paymentType === 'zelle';
  const showMixFields = paymentType === 'mix';
  const showChequeFields = paymentType === 'cheque';
  const mixHasCheque = showMixFields && mixComponents.includes('cheque');

  const isValid =
    description.trim() !== '' &&
    category !== undefined &&
    date !== '' &&
    (paymentType !== 'mix'
      ? parseFloat(amount) > 0
      : mixTotal > 0 && mixComponents.length >= 2) &&
    (paymentType !== 'cheque' || (chequeNumber.trim() !== '' && chequeIssueDate !== ''));

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/expenses')}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Add Expense</h1>
      </div>

      <Card className="p-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 1. Vendor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
            <select
              value={showNewVendorInput ? ADD_NEW_VENDOR_VALUE : selectedVendorId}
              onChange={(e) => handleVendorSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Select Vendor --</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
              <option value={ADD_NEW_VENDOR_VALUE}>+ Add new vendor...</option>
            </select>

            {showNewVendorInput && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  placeholder="Enter vendor name"
                  className="flex-1 px-3 py-2 border border-indigo-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleSaveNewVendor(); }
                    if (e.key === 'Escape') { setShowNewVendorInput(false); setNewVendorName(''); }
                  }}
                />
                <Button type="button" variant="primary" size="sm" loading={savingVendor} onClick={handleSaveNewVendor} disabled={!newVendorName.trim()}>
                  Save
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={() => { setShowNewVendorInput(false); setNewVendorName(''); }}>
                  Cancel
                </Button>
              </div>
            )}
            {vendorError && <p className="text-xs text-red-600 mt-1">{vendorError}</p>}
          </div>

          {/* 2. Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="What was this expense for?"
            />
          </div>

          {/* 3. Amount (hidden for mix) */}
          {showAmountField && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          {/* 4. Payment Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Type *</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_TYPES.map((pt) => (
                <button
                  key={pt.value}
                  type="button"
                  onClick={() => setPaymentType(pt.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    paymentType === pt.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  {pt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 5a. Zelle fields */}
          {showZelleFields && (
            <div className="bg-green-50 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zelle Reference / Transaction ID
              </label>
              <input
                type="text"
                value={zelleReference}
                onChange={(e) => setZelleReference(e.target.value)}
                placeholder="e.g., ZLL-20240325-4892"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              />
            </div>
          )}

          {/* 5b. Mix fields */}
          {showMixFields && (
            <div className="bg-indigo-50 rounded-lg p-4 space-y-4">
              {/* Sub-type toggles */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Payment Components (select at least 2)</p>
                <div className="flex gap-2 flex-wrap">
                  {(['cash', 'card', 'zelle', 'cheque'] as MixComponent[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleMixComponent(c)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                        mixComponents.includes(c)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'
                      }`}
                    >
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash amount */}
              {mixComponents.includes('cash') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cash Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}

              {/* Card amount */}
              {mixComponents.includes('card') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Card Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={cardAmount}
                      onChange={(e) => setCardAmount(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}

              {/* Zelle amount + reference */}
              {mixComponents.includes('zelle') && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zelle Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                      <input
                        type="number" step="0.01" min="0"
                        value={zelleAmount}
                        onChange={(e) => setZelleAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zelle Reference / Transaction ID</label>
                    <input
                      type="text"
                      value={mixZelleReference}
                      onChange={(e) => setMixZelleReference(e.target.value)}
                      placeholder="e.g., ZLL-20240325-4892"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Cheque amount + details */}
              {mixComponents.includes('cheque') && (
                <div className="space-y-3 border-t border-indigo-200 pt-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                      <input
                        type="number" step="0.01" min="0"
                        value={chequeAmount}
                        onChange={(e) => setChequeAmount(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Number</label>
                      <input type="text" value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)}
                        placeholder="e.g., 1042"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date</label>
                      <input type="date" value={chequeIssueDate} onChange={(e) => setChequeIssueDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Withdrawal Date</label>
                      <input type="date" value={chequeWithdrawalDate} onChange={(e) => setChequeWithdrawalDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Image</label>
                    <input ref={chequeFileRef} type="file" accept="image/*" onChange={handleChequeImageChange}
                      className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200" />
                    {chequeImagePreview && (
                      <div className="mt-2 relative inline-block">
                        <img src={chequeImagePreview} alt="Cheque preview" className="h-24 rounded-lg border border-indigo-200 object-cover" />
                        <button type="button" onClick={clearChequeImage}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between pt-1 border-t border-indigo-200">
                <span className="text-sm font-medium text-indigo-800">Total</span>
                <span className="text-lg font-bold text-indigo-800">${mixTotal.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* 5c. Cheque fields (standalone) */}
          {showChequeFields && !mixHasCheque && (
            <div className="bg-orange-50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Number *</label>
                  <input
                    type="text"
                    value={chequeNumber}
                    onChange={(e) => setChequeNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                    placeholder="e.g., 1042"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Issue Date *</label>
                  <input
                    type="date"
                    value={chequeIssueDate}
                    onChange={(e) => setChequeIssueDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Withdrawal Date</label>
                  <input
                    type="date"
                    value={chequeWithdrawalDate}
                    onChange={(e) => setChequeWithdrawalDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cheque Image</label>
                <input
                  ref={chequeFileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleChequeImageChange}
                  className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200"
                />
                {chequeImagePreview && (
                  <div className="mt-2 relative inline-block">
                    <img src={chequeImagePreview} alt="Cheque preview" className="h-24 rounded-lg border border-orange-200 object-cover" />
                    <button type="button" onClick={clearChequeImage}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600">
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* 7. Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 8. Paid By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paid By</label>
            <select
              value={paidByUserId}
              onChange={(e) => setPaidByUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">-- Select who paid --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => navigate('/expenses')}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting} disabled={!isValid}>
              Save Expense
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
