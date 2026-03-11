import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { 
  LayoutDashboard, 
  Banknote, 
  LogOut,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';

export default function ClientLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  // Se añadió 'shortName' para que los textos no se desborden en la barra inferior móvil
  const navItems = [
    { name: 'Mi Resumen', shortName: 'Resumen', path: '/client', icon: LayoutDashboard },
    { name: 'Mis Préstamos', shortName: 'Préstamos', path: '/client/my-loans', icon: Banknote },
    { name: 'Reclamaciones', shortName: 'Reclamos', path: '/client/claims', icon: MessageSquare },
  ];

  // Componente Sidebar solo para Escritorio (Desktop)
  const DesktopSidebar = () => (
    <div className="hidden md:flex w-72 flex-col bg-white border-r border-slate-200 shadow-sm z-20 h-full shrink-0">
      <div className="p-6 flex items-center space-x-3">
        <ShieldCheck className="w-8 h-8 text-emerald-600" />
        <span className="text-xl font-bold text-slate-900 tracking-tight">Adonai Cliente</span>
      </div>
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                isActive 
                  ? 'bg-emerald-50 text-emerald-700 font-medium' 
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-emerald-600' : 'text-slate-400'} />
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
    </div>
  );

  // Componente Bottom Nav bar solo para Móviles (Mobile)
  const MobileBottomNav = () => (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 flex justify-between items-center px-2 py-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.name}
            to={item.path}
            className={`flex flex-col items-center justify-center w-full py-2 transition-colors ${
              isActive ? 'text-emerald-600' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <div className={`p-1 rounded-full ${isActive ? 'bg-emerald-50' : ''}`}>
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={`text-[10px] mt-0.5 ${isActive ? 'font-semibold' : 'font-medium'}`}>
              {item.shortName || item.name}
            </span>
          </Link>
        );
      })}
      <button
        onClick={handleLogout}
        className="flex flex-col items-center justify-center w-full py-2 text-slate-500 hover:text-red-600 transition-colors"
      >
        <div className="p-1 rounded-full">
          <LogOut size={22} strokeWidth={2} />
        </div>
        <span className="text-[10px] font-medium mt-0.5">Salir</span>
      </button>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* Sidebar - Visible solo en Desktop */}
      <DesktopSidebar />

      {/* Contenido Principal */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="bg-white border-b border-slate-200 z-10 sticky top-0 shrink-0">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
                {navItems.find(item => item.path === location.pathname)?.name || 'Portal de Cliente'}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0 shadow-sm border border-emerald-200">
                CL
              </div>
            </div>
          </div>
        </header>
        
        {/* Agregado pb-24 en móviles para que el Nav Bar inferior no tape el contenido */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-4 pb-24 md:pb-8 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom Nav - Visible solo en Móviles */}
      <MobileBottomNav />

    </div>
  );
}