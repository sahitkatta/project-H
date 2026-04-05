import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import type { ReportsData } from '../types';
import { Card, LoadingSpinner } from '../components/ui';

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-indigo-700' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError('');
    api
      .getReports(user.id, period)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load reports'))
      .finally(() => setLoading(false));
  }, [user, period]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                period === p
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading reports..." />
      ) : data ? (
        <div className="space-y-6">
          {/* Revenue */}
          <Card className="p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Revenue</h2>
            <StatRow label="Restaurant Revenue" value={formatCurrency(data.revenue.restaurant_revenue)} />
            <StatRow label="Catering Revenue" value={formatCurrency(data.revenue.catering_revenue)} />
            <div className="pt-2 mt-1">
              <div className="flex justify-between">
                <span className="text-sm font-bold text-gray-900">Total Revenue</span>
                <span className="text-lg font-bold text-green-700">
                  {formatCurrency(data.revenue.total_revenue)}
                </span>
              </div>
            </div>
          </Card>

          {/* Expenses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Expenses by Type
              </h2>
              <StatRow label="Total" value={formatCurrency(data.expenses.total)} highlight />
              <StatRow label="Cash" value={formatCurrency(data.expenses.by_type.cash)} />
              <StatRow label="Card" value={formatCurrency(data.expenses.by_type.card)} />
              <StatRow label="Cheque" value={formatCurrency(data.expenses.by_type.cheque)} />
              <StatRow label="Zelle" value={formatCurrency(data.expenses.by_type.zelle)} />
              <StatRow label="Mix" value={formatCurrency(data.expenses.by_type.mix)} />
            </Card>

            <Card className="p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                Expenses by Category
              </h2>
              <StatRow label="Groceries" value={formatCurrency(data.expenses.by_category.groceries)} />
              <StatRow label="Catering" value={formatCurrency(data.expenses.by_category.catering)} />
              <StatRow label="Supplies" value={formatCurrency(data.expenses.by_category.supplies)} />
              <StatRow label="Salary" value={formatCurrency(data.expenses.by_category.salary)} />
              <StatRow label="Rent" value={formatCurrency(data.expenses.by_category.rent)} />
              <StatRow label="Utilities" value={formatCurrency(data.expenses.by_category.utilities)} />
              <StatRow label="Other" value={formatCurrency(data.expenses.by_category.other)} />
            </Card>
          </div>

          {/* Cash Flow */}
          <Card className="p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-3">Cash Flow</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-xs text-green-700 mb-1">Current Balance</p>
                <p className="text-2xl font-bold text-green-800">
                  {formatCurrency(data.cash_flow.current_balance)}
                </p>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 text-center">
                <p className="text-xs text-orange-700 mb-1">Outstanding Cheques</p>
                <p className="text-2xl font-bold text-orange-800">
                  {data.cash_flow.outstanding_cheques_count}
                </p>
                <p className="text-xs text-orange-600">
                  {formatCurrency(data.cash_flow.outstanding_cheques_total)}
                </p>
              </div>
              <div className="bg-indigo-50 rounded-lg p-4 text-center">
                <p className="text-xs text-indigo-700 mb-1">Net Flow</p>
                <p className={`text-2xl font-bold ${
                  data.revenue.total_revenue - data.expenses.total >= 0
                    ? 'text-green-800'
                    : 'text-red-700'
                }`}>
                  {formatCurrency(data.revenue.total_revenue - data.expenses.total)}
                </p>
              </div>
            </div>

            {data.cash_flow.upcoming_salary_payments.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Upcoming Salary Payments
                </h3>
                <div className="space-y-1">
                  {data.cash_flow.upcoming_salary_payments.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                      <span className="text-gray-700">{p.employee_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 text-xs">
                          {new Date(p.date).toLocaleDateString()}
                        </span>
                        <span className="font-semibold">{formatCurrency(p.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
