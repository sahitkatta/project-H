import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import type { CateringOrder, OrderStatus } from '../../types';
import { Card, LoadingSpinner, Badge, Button } from '../../components/ui';

const TABS: { label: string; status?: OrderStatus }[] = [
  { label: 'All' },
  { label: 'Pending', status: 'pending' },
  { label: 'Accepted', status: 'accepted' },
  { label: 'Completed', status: 'completed' },
  { label: 'Rejected', status: 'rejected' },
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function PaymentBadge({ status }: { status?: string }) {
  if (!status) return null;
  const styles: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    unpaid: 'bg-red-100 text-red-700',
    partial: 'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function CateringListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<OrderStatus | undefined>(undefined);

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api.getOrders(user!.id, activeTab);
        setOrders(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user, activeTab]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Catering Orders</h1>
        <Button variant="primary" onClick={() => navigate('/catering/create')}>
          + New Order
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(tab.status)}
            className={`flex-shrink-0 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.status
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading orders..." />
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No orders found</p>
          <Button variant="primary" className="mt-4" onClick={() => navigate('/catering/create')}>
            Create First Order
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card
              key={order.id}
              className="p-4 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/catering/${order.id}`)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{order.customer_name}</p>
                    <Badge variant={order.status} />
                    {order.status === 'completed' && order.payment_status && (
                      <PaymentBadge status={order.payment_status} />
                    )}
                    {order.price_approval_status === 'pending_approval' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                        Price Needs Approval
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {order.event_type} &mdash; {order.head_count} guests
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Event: {new Date(order.event_date).toLocaleDateString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                    {' · '}
                    Placed: {new Date(order.created_at).toLocaleDateString()}
                    {order.created_by_name && ` by ${order.created_by_name}`}
                  </p>
                  {order.rejection_reason && (
                    <p className="text-xs text-red-600 mt-1">Rejected: {order.rejection_reason}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-gray-900">
                    {formatCurrency(order.negotiated_price || order.estimated_price)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Est: {formatCurrency(order.estimated_price)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
