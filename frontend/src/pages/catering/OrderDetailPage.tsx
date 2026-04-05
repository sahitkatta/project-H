import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import type { CateringOrder } from '../../types';
import { Card, Badge, Button, LoadingSpinner } from '../../components/ui';

function formatCurrency(n: number) {
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

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState<CateringOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    if (!user || !id) return;
    api
      .getOrderById(user.id, id)
      .then(setOrder)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load order'))
      .finally(() => setLoading(false));
  }, [user, id]);

  async function handleStatusChange(
    status: 'accepted' | 'rejected' | 'completed',
    reason?: string,
  ) {
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

  if (loading) return <LoadingSpinner message="Loading order..." />;

  if (error && !order) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!order) return null;

  const canManage =
    user?.role === 'owner' || user?.role === 'manager';

  const itemsTotal = order.items.reduce(
    (sum, i) => sum + i.unit_price * i.quantity,
    0,
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/catering')} className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Order Details</h1>
        <Badge variant={order.status} className="ml-2" />
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      {canManage && order.status === 'pending' && (
        <Card className="p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Actions</h3>
          {showRejectForm ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Reason
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Why is this order being rejected?"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  loading={actionLoading}
                  onClick={() => handleStatusChange('rejected', rejectionReason)}
                >
                  Confirm Rejection
                </Button>
                <Button variant="secondary" onClick={() => setShowRejectForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="success"
                loading={actionLoading}
                onClick={() => handleStatusChange('accepted')}
              >
                Accept Order
              </Button>
              <Button variant="danger" onClick={() => setShowRejectForm(true)}>
                Reject Order
              </Button>
            </div>
          )}
        </Card>
      )}

      {user?.role === 'owner' && order.status === 'accepted' && (
        <Card className="p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Actions</h3>
          <Button
            variant="primary"
            loading={actionLoading}
            onClick={() => handleStatusChange('completed')}
          >
            Mark as Completed
          </Button>
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
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Customer
        </h3>
        <div className="space-y-2">
          <InfoRow label="Name" value={order.customer_name} />
          <InfoRow label="Phone" value={order.customer_phone} />
          {order.customer_email && <InfoRow label="Email" value={order.customer_email} />}
        </div>
      </Card>

      {/* Event Info */}
      <Card className="p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Event
        </h3>
        <div className="space-y-2">
          <InfoRow label="Event Type" value={order.event_type} />
          <InfoRow
            label="Event Date"
            value={new Date(order.event_date).toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          />
          <InfoRow label="Head Count" value={`${order.head_count} guests`} />
          {order.notes && <InfoRow label="Notes" value={order.notes} />}
        </div>
      </Card>

      {/* Items */}
      {order.items.length > 0 && (
        <Card className="p-5 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Items
          </h3>
          <div className="divide-y divide-gray-100">
            {order.items.map((item) => (
              <div key={item.id} className="py-3 flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    {item.quantity} x {formatCurrency(item.unit_price)}
                  </p>
                  {item.special_instructions && (
                    <p className="text-xs text-indigo-600 mt-0.5">{item.special_instructions}</p>
                  )}
                </div>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(item.unit_price * item.quantity)}
                </span>
              </div>
            ))}
            <div className="py-3 flex justify-between">
              <span className="text-sm font-semibold text-gray-700">Items Total</span>
              <span className="text-sm font-bold text-gray-900">{formatCurrency(itemsTotal)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Pricing */}
      <Card className="p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Pricing
        </h3>
        <div className="space-y-2">
          <InfoRow label="Estimated" value={formatCurrency(order.estimated_price)} />
          <InfoRow
            label="Negotiated"
            value={
              <span className="text-green-700">
                {formatCurrency(order.negotiated_price)}
              </span>
            }
          />
        </div>
      </Card>

      {/* Metadata */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Order Info
        </h3>
        <div className="space-y-2">
          <InfoRow label="Order ID" value={<span className="font-mono text-xs">{order.id}</span>} />
          <InfoRow
            label="Created"
            value={new Date(order.created_at).toLocaleString()}
          />
          <InfoRow
            label="Updated"
            value={new Date(order.updated_at).toLocaleString()}
          />
        </div>
      </Card>
    </div>
  );
}
