import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import type { CloverMenuItem } from '../../types';
import type { CustomerInfo } from '../../services/api';
import { Card, Button, LoadingSpinner } from '../../components/ui';

interface OrderItem {
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  special_instructions: string;
}

interface FormData {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  event_date: string;
  event_type: string;
  head_count: string;
  notes: string;
  estimated_price: string;
  negotiated_price: string;
}

interface TraySizes {
  small: number;
  medium: number;
  large: number;
  xlarge: number;
}

const STEPS = ['Customer Info', 'Items & Trays', 'Pricing', 'Review & Submit'];
const TRAY_LABELS: { key: keyof TraySizes; label: string }[] = [
  { key: 'small', label: 'Small' },
  { key: 'medium', label: 'Medium' },
  { key: 'large', label: 'Large' },
  { key: 'xlarge', label: 'X-Large' },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <React.Fragment key={i}>
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              i < step
                ? 'bg-indigo-600 text-white'
                : i === step
                ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-600'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {i < step ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              i + 1
            )}
          </div>
          {i < total - 1 && (
            <div className={`flex-1 h-0.5 ${i < step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function CreateOrderPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [menuItems, setMenuItems] = useState<CloverMenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [traySizes, setTraySizes] = useState<TraySizes>({ small: 0, medium: 0, large: 0, xlarge: 0 });

  // Customer lookup
  const [customerResults, setCustomerResults] = useState<CustomerInfo[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const lookupRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState<FormData>({
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    event_date: '',
    event_type: '',
    head_count: '',
    notes: '',
    estimated_price: '',
    negotiated_price: '',
  });

  function updateForm(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handlePhoneChange(value: string) {
    updateForm('customer_phone', value);
    if (lookupRef.current) clearTimeout(lookupRef.current);
    if (value.length >= 4 && user) {
      lookupRef.current = setTimeout(async () => {
        try {
          const results = await api.searchCustomers(user.id, value);
          setCustomerResults(results);
          setShowCustomerDropdown(results.length > 0);
        } catch { /* ignore */ }
      }, 400);
    } else {
      setCustomerResults([]);
      setShowCustomerDropdown(false);
    }
  }

  function prefillCustomer(c: CustomerInfo) {
    setForm(prev => ({
      ...prev,
      customer_name: c.customer_name,
      customer_phone: c.customer_phone,
      customer_email: c.customer_email ?? '',
      event_type: c.last_event_type ?? prev.event_type,
    }));
    setShowCustomerDropdown(false);
  }

  useEffect(() => {
    if (step === 1 && user && menuItems.length === 0) {
      setMenuLoading(true);
      api.getMenuItems(user.id)
        .then((items) => setMenuItems(items.filter((i) => i.available)))
        .catch(() => {})
        .finally(() => setMenuLoading(false));
    }
  }, [step, user, menuItems.length]);

  function addItem(menuItem: CloverMenuItem) {
    setSelectedItems((prev) => {
      const existing = prev.find((i) => i.menu_item_id === menuItem.id);
      if (existing) {
        return prev.map((i) => i.menu_item_id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { menu_item_id: menuItem.id, name: menuItem.name, quantity: 1, unit_price: menuItem.price, special_instructions: '' }];
    });
  }

  function updateItemQty(menuItemId: string, qty: number) {
    if (qty <= 0) {
      setSelectedItems((prev) => prev.filter((i) => i.menu_item_id !== menuItemId));
    } else {
      setSelectedItems((prev) => prev.map((i) => i.menu_item_id === menuItemId ? { ...i, quantity: qty } : i));
    }
  }

  function updateTraySize(key: keyof TraySizes, val: number) {
    setTraySizes(prev => ({ ...prev, [key]: Math.max(0, val) }));
  }

  const hasTraySelection = Object.values(traySizes).some(v => v > 0);
  const itemsTotal = selectedItems.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  async function handleSubmit() {
    if (!user) return;
    setSubmitting(true);
    setError('');
    try {
      await api.createOrder(user.id, {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email || undefined,
        event_date: form.event_date,
        event_type: form.event_type,
        head_count: parseInt(form.head_count, 10),
        estimated_price: parseFloat(form.estimated_price) || itemsTotal,
        negotiated_price: parseFloat(form.negotiated_price) || 0,
        notes: form.notes || undefined,
        tray_sizes: hasTraySelection ? traySizes : undefined,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: selectedItems.map((i) => ({
          menu_item_id: i.menu_item_id,
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          special_instructions: i.special_instructions || undefined,
          add_ons: [],
        })) as any,
      });
      navigate('/catering');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  }

  const categoryGroups = menuItems.reduce<Record<string, CloverMenuItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const isCashier = user?.role === 'cashier';

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/catering')} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">New Catering Order</h1>
      </div>

      {isCashier && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <strong>Note:</strong> Orders created by cashiers require price approval from a manager or owner before they can be accepted.
        </div>
      )}

      <Card className="p-6">
        <div className="flex items-center gap-1 mb-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <span className={`text-xs font-medium ${i === step ? 'text-indigo-600' : 'text-gray-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <span className="text-gray-300 mx-1">/</span>}
            </React.Fragment>
          ))}
        </div>
        <StepIndicator step={step} total={STEPS.length} />

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Step 0: Customer Info */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Customer Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Phone with lookup */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={form.customer_phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Search by phone to prefill"
                  required
                />
                {showCustomerDropdown && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {customerResults.map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => prefillCustomer(c)}
                        className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 border-b border-gray-100 last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-900">{c.customer_name}</p>
                        <p className="text-xs text-gray-500">{c.customer_phone}{c.customer_email ? ` · ${c.customer_email}` : ''} · {c.order_count} order{c.order_count !== 1 ? 's' : ''}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={form.customer_name}
                  onChange={(e) => updateForm('customer_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => updateForm('customer_email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Date *</label>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={(e) => updateForm('event_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Type *</label>
                <input
                  type="text"
                  value={form.event_type}
                  onChange={(e) => updateForm('event_type', e.target.value)}
                  placeholder="e.g., Wedding, Corporate, Birthday"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Head Count *</label>
                <input
                  type="number"
                  value={form.head_count}
                  onChange={(e) => updateForm('head_count', e.target.value)}
                  min={1}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Step 1: Items & Trays */}
        {step === 1 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Items & Tray Sizes</h2>

            {/* Tray Sizes */}
            <div className="bg-amber-50 rounded-lg p-4 mb-6">
              <h3 className="text-sm font-semibold text-amber-900 mb-3">Tray Sizes (Optional)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {TRAY_LABELS.map(({ key, label }) => (
                  <div key={key} className="text-center">
                    <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateTraySize(key, traySizes[key] - 1)}
                        className="w-7 h-7 rounded-full bg-white border border-gray-300 text-sm flex items-center justify-center hover:bg-gray-50"
                      >-</button>
                      <span className="w-8 text-center text-sm font-semibold">{traySizes[key]}</span>
                      <button
                        type="button"
                        onClick={() => updateTraySize(key, traySizes[key] + 1)}
                        className="w-7 h-7 rounded-full bg-white border border-gray-300 text-sm flex items-center justify-center hover:bg-gray-50"
                      >+</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Menu Items */}
            {menuLoading ? (
              <LoadingSpinner message="Loading menu..." />
            ) : (
              <div className="space-y-6">
                {selectedItems.length > 0 && (
                  <div className="bg-indigo-50 rounded-lg p-4 mb-4">
                    <h3 className="text-sm font-semibold text-indigo-800 mb-2">Selected ({selectedItems.length} items)</h3>
                    <div className="space-y-2">
                      {selectedItems.map((item) => (
                        <div key={item.menu_item_id} className="flex items-center gap-3">
                          <span className="flex-1 text-sm text-gray-900">{item.name}</span>
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateItemQty(item.menu_item_id, item.quantity - 1)}
                              className="w-6 h-6 rounded-full bg-white border border-gray-300 text-sm flex items-center justify-center hover:bg-gray-50">-</button>
                            <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                            <button onClick={() => updateItemQty(item.menu_item_id, item.quantity + 1)}
                              className="w-6 h-6 rounded-full bg-white border border-gray-300 text-sm flex items-center justify-center hover:bg-gray-50">+</button>
                          </div>
                          <span className="text-sm font-medium w-20 text-right">{formatCurrency(item.unit_price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-indigo-200 mt-3 pt-2 flex justify-between">
                      <span className="text-sm font-semibold text-indigo-800">Total</span>
                      <span className="text-sm font-bold text-indigo-800">{formatCurrency(itemsTotal)}</span>
                    </div>
                  </div>
                )}

                {Object.entries(categoryGroups).map(([category, items]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">{category}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {items.map((item) => {
                        const selected = selectedItems.find((s) => s.menu_item_id === item.id);
                        return (
                          <button key={item.id} onClick={() => addItem(item)}
                            className={`text-left p-3 rounded-lg border transition-colors ${selected ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}>
                            <div className="flex justify-between items-start">
                              <span className="text-sm font-medium text-gray-900">{item.name}</span>
                              <span className="text-sm font-semibold text-indigo-600 ml-2">{formatCurrency(item.price)}</span>
                            </div>
                            {item.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>}
                            {selected && <p className="text-xs text-indigo-600 mt-1 font-medium">x{selected.quantity} in order</p>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {menuItems.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-8">No menu items available</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Pricing */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Pricing</h2>
            {itemsTotal > 0 && (
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700">
                Items subtotal: <span className="font-bold">{formatCurrency(itemsTotal)}</span>
              </div>
            )}
            {isCashier && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                The negotiated price you enter will require approval by a manager or owner.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Price *</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                <input
                  type="number" step="0.01"
                  value={form.estimated_price}
                  onChange={(e) => updateForm('estimated_price', e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={itemsTotal > 0 ? String(itemsTotal) : '0.00'}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Negotiated Price</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                <input
                  type="number" step="0.01"
                  value={form.negotiated_price}
                  onChange={(e) => updateForm('negotiated_price', e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Leave blank if same as estimated</p>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Review & Submit</h2>
            <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
              <div className="px-4 py-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Customer</p>
                <p className="text-sm font-medium">{form.customer_name}</p>
                <p className="text-sm text-gray-600">{form.customer_phone}</p>
                {form.customer_email && <p className="text-sm text-gray-600">{form.customer_email}</p>}
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Event</p>
                <p className="text-sm font-medium">{form.event_type}</p>
                <p className="text-sm text-gray-600">
                  {new Date(form.event_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-sm text-gray-600">{form.head_count} guests</p>
              </div>
              {hasTraySelection && (
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Tray Sizes</p>
                  <div className="flex gap-4 flex-wrap">
                    {TRAY_LABELS.filter(({ key }) => traySizes[key] > 0).map(({ key, label }) => (
                      <span key={key} className="text-sm text-gray-700">{label}: <strong>{traySizes[key]}</strong></span>
                    ))}
                  </div>
                </div>
              )}
              <div className="px-4 py-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Items ({selectedItems.length})</p>
                {selectedItems.length === 0 ? (
                  <p className="text-sm text-gray-400">No items selected</p>
                ) : (
                  <div className="space-y-1">
                    {selectedItems.map((item) => (
                      <div key={item.menu_item_id} className="flex justify-between text-sm">
                        <span>{item.name} x{item.quantity}</span>
                        <span className="font-medium">{formatCurrency(item.unit_price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Pricing</p>
                <div className="flex justify-between text-sm">
                  <span>Estimated Price</span>
                  <span className="font-medium">{formatCurrency(parseFloat(form.estimated_price) || itemsTotal)}</span>
                </div>
                {form.negotiated_price && (
                  <div className="flex justify-between text-sm">
                    <span>Negotiated Price{isCashier ? ' (pending approval)' : ''}</span>
                    <span className="font-medium text-green-600">{formatCurrency(parseFloat(form.negotiated_price))}</span>
                  </div>
                )}
              </div>
              {form.notes && (
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{form.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
          <Button variant="secondary" onClick={() => (step === 0 ? navigate('/catering') : setStep(step - 1))}>
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              variant="primary"
              onClick={() => setStep(step + 1)}
              disabled={
                step === 0 &&
                (!form.customer_name || !form.customer_phone || !form.event_date || !form.event_type || !form.head_count)
              }
            >
              Next
            </Button>
          ) : (
            <Button variant="success" loading={submitting} onClick={handleSubmit}>
              Submit Order
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
