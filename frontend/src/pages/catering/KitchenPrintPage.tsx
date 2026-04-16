import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import type { CateringOrder } from '../../types';

export default function KitchenPrintPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<CateringOrder | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !id) return;
    api.getOrderById(user.id, id)
      .then(o => { setOrder(o); setTimeout(() => window.print(), 600); })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load'));
  }, [user, id]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!order) return <div className="p-8 text-gray-400">Loading order…</div>;

  const traySizes = order.tray_sizes;
  const hasTray = traySizes && Object.values(traySizes).some(v => v > 0);

  return (
    <>
      {/* Screen: show a print button */}
      <div className="print:hidden fixed top-4 right-4 flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg shadow hover:bg-indigo-700"
        >
          Print
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg shadow hover:bg-gray-200"
        >
          Close
        </button>
      </div>

      {/* Print-optimized layout */}
      <div className="p-8 max-w-2xl mx-auto font-sans text-gray-900" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* Header */}
        <div className="text-center border-b-2 border-gray-900 pb-4 mb-6">
          <h1 className="text-3xl font-bold tracking-wide">BASERA</h1>
          <p className="text-sm text-gray-500 mt-1">Kitchen Order</p>
        </div>

        {/* Order meta */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Order #</p>
            <p className="text-lg font-mono font-bold text-gray-900">
              {order.order_number ?? order.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Date Placed</p>
            <p className="text-sm font-semibold">{new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Customer & Event */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="border border-gray-300 rounded p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-2">Customer</p>
            <p className="font-semibold">{order.customer_name}</p>
            <p className="text-sm text-gray-600">{order.customer_phone}</p>
            {order.customer_email && <p className="text-sm text-gray-600">{order.customer_email}</p>}
            {order.customer_company && <p className="text-sm text-gray-600">{order.customer_company}</p>}
            {order.customer_point_of_contact && <p className="text-sm text-gray-500">Contact: {order.customer_point_of_contact}</p>}
          </div>
          <div className="border border-gray-300 rounded p-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-2">Event</p>
            <p className="font-semibold">{order.event_type}</p>
            <p className="text-sm text-gray-600">
              {new Date(order.event_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <p className="text-sm text-gray-600">{order.head_count} guests</p>
          </div>
        </div>

        {/* Tray Sizes */}
        {hasTray && (
          <div className="border border-gray-900 rounded p-4 mb-6 bg-gray-50">
            <p className="text-sm font-bold uppercase tracking-wide mb-3">Tray Sizes</p>
            <div className="grid grid-cols-4 gap-4 text-center">
              {(['small', 'medium', 'large', 'xlarge'] as const).map(size => (
                traySizes![size] > 0 ? (
                  <div key={size} className="border border-gray-300 rounded p-2">
                    <p className="text-xs text-gray-500 uppercase">{size === 'xlarge' ? 'X-Large' : size.charAt(0).toUpperCase() + size.slice(1)}</p>
                    <p className="text-2xl font-bold">{traySizes![size]}</p>
                  </div>
                ) : null
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="border-2 border-dashed border-amber-400 rounded p-3 mb-6 bg-amber-50">
            <p className="text-xs text-amber-800 uppercase font-bold mb-1">Special Instructions / Notes</p>
            <p className="text-sm">{order.notes}</p>
          </div>
        )}

        {/* Menu Items */}
        {order.items.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-wide mb-3 border-b border-gray-300 pb-1">Menu Items</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 font-semibold">Item</th>
                  <th className="text-center py-2 font-semibold w-16">Qty</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-2">
                      <p className="font-medium">{item.name}</p>
                      {item.special_instructions && (
                        <p className="text-xs text-amber-700 mt-0.5">⚠ {item.special_instructions}</p>
                      )}
                    </td>
                    <td className="text-center py-2 font-bold text-lg">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Signature line */}
        <div className="mt-12 grid grid-cols-2 gap-12">
          <div>
            <div className="border-b border-gray-400 mb-1 pb-6" />
            <p className="text-xs text-gray-500">Kitchen Staff Signature</p>
          </div>
          <div>
            <div className="border-b border-gray-400 mb-1 pb-6" />
            <p className="text-xs text-gray-500">Date Fulfilled</p>
          </div>
        </div>

        <style>{`
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            @page { margin: 0.75in; }
          }
        `}</style>
      </div>
    </>
  );
}
