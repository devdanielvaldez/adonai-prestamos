import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

import Login from "./pages/Login";
import AdminLayout from "./layouts/AdminLayout";
import ClientLayout from "./layouts/ClientLayout";

// Admin Pages
import Dashboard from "./pages/admin/Dashboard";
import LoanTypes from "./pages/admin/LoanTypes";
import Guarantees from "./pages/admin/Guarantees";
import Clients from "./pages/admin/Clients";
import Guarantors from "./pages/admin/Guarantors";
import Loans from "./pages/admin/Loans";
import Payments from "./pages/admin/Payments";
import Contracts from "./pages/admin/Contracts";
import PrepareContract from "./pages/admin/PrepareContract";
import ViewContract from "./pages/admin/ViewContract";
import LoanDetails from "./pages/admin/LoanDetails";
import AdminClaims from "./pages/admin/Claims";

import Users from "./pages/admin/Users";

// Client Pages
import ClientDashboard from "./pages/client/Dashboard";
import MyLoans from "./pages/client/MyLoans";
import ClientLoanDetails from "./pages/client/LoanDetails";
import SignContract from "./pages/client/SignContract";
import ClientViewContract from "./pages/client/ViewContract";
import ClientClaims from "./pages/client/Claims";

const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: ("admin" | "staff" | "client")[];
}) => {
  const { user, role, loading } = useAuth();

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Cargando...
      </div>
    );
  if (!user) return <Navigate to="/login" />;
  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={role === "client" ? "/client" : "/admin"} />;
  }

  return <>{children}</>;
};

const AuthRoute = () => {
  const { user, role, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        Cargando...
      </div>
    );
  if (user) {
    return <Navigate to={role === "client" ? "/client" : "/admin"} />;
  }
  return <Login />;
};

const AdminInitializer = () => {
  useEffect(() => {
    const initAdmin = async () => {
      try {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          "admin@adonai.com",
          "Admin123",
        );
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: "admin@adonai.com",
          role: "admin",
          name: "Administrador Principal",
        });
      } catch (e: any) {
        // Ignore error if user already exists
      }
    };
    initAdmin();
  }, []);
  return null;
};

export default function App() {
  return (
    <AuthProvider>
      <AdminInitializer />
      <Router>
        <Routes>
          <Route path="/login" element={<AuthRoute />} />

          {/* Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin", "staff"]}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="users" element={<Users />} />
            <Route path="loan-types" element={<LoanTypes />} />
            <Route path="guarantees" element={<Guarantees />} />
            <Route path="clients" element={<Clients />} />
            <Route path="guarantors" element={<Guarantors />} />
            <Route path="loans" element={<Loans />} />
            <Route path="payments" element={<Payments />} />
            <Route path="contracts" element={<Contracts />} />
            <Route path="prepare-contract/:loanId" element={<PrepareContract />} />
            <Route path="view-contract/:loanId" element={<ViewContract />} />
            <Route path="loans/:id" element={<LoanDetails />} />
            <Route path="claims" element={<AdminClaims />} />
          </Route>

          {/* Client Routes */}
          <Route
            path="/client"
            element={
              <ProtectedRoute allowedRoles={["client"]}>
                <ClientLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<ClientDashboard />} />
            <Route path="my-loans" element={<MyLoans />} />
            <Route path="loans/:id" element={<ClientLoanDetails />} />
            <Route path="view-contract/:loanId" element={<ClientViewContract />} />
            <Route path="claims" element={<ClientClaims />} />
          </Route>

          {/* Public / Shared Routes */}
          <Route
            path="/sign-contract/:loanId/:contractId"
            element={<SignContract />}
          />

          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
