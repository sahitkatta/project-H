import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, Button } from '../components/ui';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  if (!user) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Profile */}
      <Card className="p-5 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Profile</h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-indigo-600 text-white text-xl font-bold flex items-center justify-center flex-shrink-0">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">{user.name}</p>
            <div className="mt-1">
              <Badge variant={user.role} />
            </div>
            <p className="text-xs text-gray-400 mt-1">ID: {user.id}</p>
          </div>
        </div>
      </Card>

      {/* Role info */}
      <Card className="p-5 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Access Level</h2>
        <div className="space-y-2 text-sm text-gray-600">
          {user.role === 'owner' && (
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Full dashboard access
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Catering order management
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Expenses and cheques
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Reports
              </li>
            </ul>
          )}
          {user.role === 'manager' && (
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Dashboard access
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Catering order management
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-300">—</span> Expenses (restricted)
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-300">—</span> Reports (restricted)
              </li>
            </ul>
          )}
          {user.role === 'cashier' && (
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Dashboard access
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> View catering orders
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-500">✓</span> Expenses and cheques
              </li>
              <li className="flex items-center gap-2">
                <span className="text-gray-300">—</span> Reports (restricted)
              </li>
            </ul>
          )}
        </div>
      </Card>

      {/* Sign out */}
      <Card className="p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Account</h2>
        <p className="text-sm text-gray-500 mb-4">
          Sign out of your current session. Your data will remain on the server.
        </p>
        <Button variant="danger" onClick={handleLogout}>
          Sign Out
        </Button>
      </Card>
    </div>
  );
}
