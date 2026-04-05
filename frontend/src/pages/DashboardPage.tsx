import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import type { CloverDailySummary, CateringOrder } from '../types';
import { Card, LoadingSpinner, Badge, Button } from '../components/ui';

function StatCard({
  label,
  value,
  sub,
  color = 'indigo',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <Card className="p-5">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colorMap[color] ?? colorMap.indigo}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </Card>
  );
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<CloverDailySummary | null>(null);
  const [orders, setOrders] = useState<CateringOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const [s, o] = await Promise.all([
          api.getDailySummary(user!.id),
          api.getOrders(user!.id),
        ]);
        setSummary(s);
        setOrders(o);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const acceptedOrders = orders.filter((o) => o.status === 'accepted');
  const todayRevenue = summary?.total_revenue ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Good {getGreeting()}, {user?.name}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {(user?.role === 'owner' || user?.role === 'manager') && (
          <>
            <StatCard
              label="Today's Revenue"
              value={formatCurrency(todayRevenue)}
              sub={summary?.date ?? ''}
              color="green"
            />
            <StatCard
              label="Cash Revenue"
              value={formatCurrency(summary?.cash_revenue ?? 0)}
              color="indigo"
            />
            <StatCard
              label="Card Revenue"
              value={formatCurrency(summary?.card_revenue ?? 0)}
              color="blue"
            />
            <StatCard
              label="Transactions"
              value={String(summary?.transaction_count ?? 0)}
              sub="Today"
              color="amber"
            />
          </>
        )}
        {user?.role === 'cashier' && (
          <>
            <StatCard
              label="Today's Revenue"
              value={formatCurrency(todayRevenue)}
              sub={summary?.date ?? ''}
              color="green"
            />
            <StatCard
              label="Transactions"
              value={String(summary?.transaction_count ?? 0)}
              sub="Today"
              color="amber"
            />
          </>
        )}
        <StatCard
          label="Pending Catering"
          value={String(pendingOrders.length)}
          sub="Needs attention"
          color="amber"
        />
        <StatCard
          label="Active Orders"
          value={String(acceptedOrders.length)}
          sub="In progress"
          color="indigo"
        />
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" onClick={() => navigate('/catering')}>
            View Catering Orders
          </Button>
          {(user?.role === 'manager' || user?.role === 'owner') && (
            <Button variant="secondary" onClick={() => navigate('/catering/create')}>
              New Catering Order
            </Button>
          )}
          {(user?.role === 'owner' || user?.role === 'cashier') && (
            <Button variant="secondary" onClick={() => navigate('/expenses/create')}>
              Add Expense
            </Button>
          )}
          {user?.role === 'owner' && (
            <Button variant="secondary" onClick={() => navigate('/reports')}>
              View Reports
            </Button>
          )}
        </div>
      </div>

      {/* Recent pending orders */}
      {pendingOrders.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Pending Orders</h2>
          <div className="space-y-3">
            {pendingOrders.slice(0, 5).map((order) => (
              <Card
                key={order.id}
                className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/catering/${order.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">{order.customer_name}</p>
                    <p className="text-sm text-gray-500">{order.event_type} · {order.head_count} guests</p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {new Date(order.event_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="pending" />
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(order.negotiated_price || order.estimated_price)}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
