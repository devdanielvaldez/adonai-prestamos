import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  Settings, 
  ShieldCheck, 
  Users, 
  UserPlus, 
  Banknote, 
  CreditCard, 
  FileText,
  LogOut,
  Menu,
  X,
  Shield,
  MessageSquare
} from 'lucide-react';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, permissions } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const hasPermission = (perm: string) => {
    if (role === 'admin') return true;
    return permissions.includes(perm);
  };

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard, perm: null },
    { name: 'Usuarios', path: '/admin/users', icon: Shield, perm: 'manage_users' },
    { name: 'Tipos de Préstamos', path: '/admin/loan-types', icon: Settings, perm: 'manage_loan_types' },
    { name: 'Garantías', path: '/admin/guarantees', icon: ShieldCheck, perm: 'manage_guarantees' },
    { name: 'Clientes', path: '/admin/clients', icon: Users, perm: 'manage_clients' },
    { name: 'Garantes', path: '/admin/guarantors', icon: UserPlus, perm: 'manage_guarantors' },
    { name: 'Préstamos', path: '/admin/loans', icon: Banknote, perm: 'manage_loans' },
    { name: 'Pagos', path: '/admin/payments', icon: CreditCard, perm: 'manage_payments' },
    { name: 'Reclamaciones', path: '/admin/claims', icon: MessageSquare, perm: null },
    { name: 'Contratos', path: '/admin/contracts', icon: FileText, perm: 'manage_contracts' },
  ].filter(item => item.perm === null || hasPermission(item.perm));

  const SidebarContent = () => (
    <>
      <div className="p-6 flex items-center space-x-3">
        <ShieldCheck className="w-8 h-8 text-indigo-600" />
        <span className="text-xl font-bold text-slate-900 tracking-tight">Adonai Admin</span>
      </div>
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-indigo-50 text-indigo-700 font-medium' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={handleLogout}
          className="flex items-center space-x-3 text-slate-600 hover:text-red-600 hover:bg-red-50 w-full px-4 py-3 rounded-xl transition-colors font-medium"
        >
          <LogOut size={20} />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-72 flex-col bg-white border-r border-slate-200 shadow-sm z-20">
        <SidebarContent />
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl flex flex-col">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="bg-white border-b border-slate-200 z-10 sticky top-0">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden mr-4 text-slate-500 hover:text-slate-900 focus:outline-none"
              >
                <Menu size={24} />
              </button>
              <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
                {navItems.find(item => item.path === location.pathname)?.name || 'Panel de Administración'}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                AD
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
