import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/layout/Layout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import CateringListPage from './pages/catering/CateringListPage';
import CreateOrderPage from './pages/catering/CreateOrderPage';
import OrderDetailPage from './pages/catering/OrderDetailPage';
import OrderHistoryPage from './pages/catering/OrderHistoryPage';
import KitchenPrintPage from './pages/catering/KitchenPrintPage';
import ExpensesPage from './pages/expenses/ExpensesPage';
import CreateExpensePage from './pages/expenses/CreateExpensePage';
import ChequesPage from './pages/expenses/ChequesPage';
import EmployeesPage from './pages/employees/EmployeesPage';
import CashPage from './pages/cash/CashPage';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/catering"
        element={
          <ProtectedRoute>
            <Layout>
              <CateringListPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/catering/create"
        element={
          <ProtectedRoute>
            <Layout>
              <CreateOrderPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/catering/history"
        element={
          <ProtectedRoute>
            <Layout>
              <OrderHistoryPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/catering/:id/print"
        element={
          <ProtectedRoute>
            <KitchenPrintPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/catering/:id"
        element={
          <ProtectedRoute>
            <Layout>
              <OrderDetailPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/expenses"
        element={
          <ProtectedRoute allowedRoles={['owner', 'cashier']}>
            <Layout>
              <ExpensesPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/expenses/create"
        element={
          <ProtectedRoute allowedRoles={['owner', 'cashier']}>
            <Layout>
              <CreateExpensePage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/expenses/cheques"
        element={
          <ProtectedRoute allowedRoles={['owner', 'cashier']}>
            <Layout>
              <ChequesPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/employees"
        element={
          <ProtectedRoute allowedRoles={['owner', 'cashier']}>
            <Layout>
              <EmployeesPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/cash"
        element={
          <ProtectedRoute allowedRoles={['owner', 'cashier']}>
            <Layout>
              <CashPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={['owner']}>
            <Layout>
              <ReportsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <SettingsPage />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
