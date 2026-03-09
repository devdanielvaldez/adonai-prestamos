import React, { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Banknote, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export default function ClientDashboard() {
  const [stats, setStats] = useState({
    activeLoans: 0,
    totalDebt: 0,
    pendingLoans: 0,
    totalPaid: 0
  });
  const [recentLoans, setRecentLoans] = useState<any[]>([]);
  const [paymentData, setPaymentData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!auth.currentUser) return;

      try {
        const q = query(collection(db, 'loans'), where('clientId', '==', auth.currentUser.uid));
        const loansSnap = await getDocs(q);
        
        let active = 0;
        let pending = 0;
        let totalDebt = 0;
        const loans: any[] = [];

        loansSnap.forEach(doc => {
          const data = doc.data();
          loans.push({ id: doc.id, ...data });
          
          if (data.status === 'aprobado' || data.status === 'desembolsado') {
            active++;
            totalDebt += data.amount; // Simplified, should calculate remaining balance
          } else if (data.status === 'pendiente' || data.status === 'analisis') {
            pending++;
          }
        });

        const paymentsQ = query(collection(db, 'payments'), where('clientId', '==', auth.currentUser.uid));
        const paymentsSnap = await getDocs(paymentsQ);
        
        let totalPaid = 0;
        const payments: any[] = [];
        
        paymentsSnap.forEach(doc => {
          const data = doc.data();
          if (data.status !== 'rechazado') {
            totalPaid += data.amount;
            payments.push({ id: doc.id, ...data });
          }
        });

        // Group payments by month for chart
        const monthlyPayments: Record<string, number> = {};
        payments.forEach(p => {
          if (p.date) {
            const month = format(parseISO(p.date), 'MMM yyyy', { locale: es });
            monthlyPayments[month] = (monthlyPayments[month] || 0) + p.amount;
          }
        });

        const chartData = Object.keys(monthlyPayments).map(month => ({
          name: month,
          amount: monthlyPayments[month]
        })).slice(-6); // Last 6 months

        setPaymentData(chartData);

        setStats({
          activeLoans: active,
          totalDebt,
          pendingLoans: pending,
          totalPaid
        });
        
        setRecentLoans(loans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5));
      } catch (error) {
        console.error("Error fetching client stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { name: 'Préstamos Activos', value: stats.activeLoans, icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { name: 'Deuda Total Estimada', value: `$${stats.totalDebt.toLocaleString()}`, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
    { name: 'Total Pagado', value: `$${stats.totalPaid.toLocaleString()}`, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { name: 'Solicitudes en Proceso', value: stats.pendingLoans, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  ];

  if (loading) {
    return <div className="flex justify-center items-center h-64 text-slate-500">Cargando tu portal...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Bienvenido a tu Portal</h2>
        <p className="text-sm text-slate-500 mt-1">Aquí puedes ver el estado de tus préstamos y obligaciones.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="card-modern p-6 flex items-center space-x-5 hover:shadow-md transition-shadow">
              <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color}`}>
                <Icon size={28} strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500 mb-1">{stat.name}</p>
                <p className="text-2xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-modern p-6 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 mb-6 tracking-tight">Historial de Pagos</h3>
          {paymentData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `$${value}`} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Pagado']}
                  />
                  <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-100 border-dashed">
              <p className="text-slate-500 font-medium">No hay historial de pagos disponible.</p>
            </div>
          )}
        </div>

        <div className="card-modern p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Préstamos Recientes</h3>
            <Link to="/client/my-loans" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">Ver todos</Link>
          </div>
          
          <div className="space-y-4">
            {recentLoans.map(loan => (
              <div key={loan.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div>
                  <p className="font-semibold text-slate-900">{loan.loanTypeName}</p>
                  <p className="text-sm text-slate-500">{new Date(loan.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">${loan.amount.toLocaleString()}</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 capitalize
                    ${loan.status === 'aprobado' ? 'bg-emerald-100 text-emerald-800' : 
                      loan.status === 'rechazado' ? 'bg-red-100 text-red-800' : 
                      loan.status === 'desembolsado' ? 'bg-purple-100 text-purple-800' :
                      'bg-amber-100 text-amber-800'}`}>
                    {loan.status}
                  </span>
                </div>
              </div>
            ))}
            {recentLoans.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No tienes préstamos recientes.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
