import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Users, Banknote, CreditCard, Clock, TrendingUp, AlertCircle, Calendar, CalendarClock, CalendarCheck } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { format, subDays, parseISO, isToday, isTomorrow, isPast, isFuture, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalClients: 0,
    activeLoans: 0,
    totalLent: 0,
    pendingLoans: 0,
    totalCollected: 0,
    totalPendingCollection: 0,
    defaultedLoans: 0,
  });

  const [loanStatuses, setLoanStatuses] = useState({
    enMora: [] as any[],
    enTiempo: [] as any[],
    proximos: [] as any[],
    hoy: [] as any[],
    manana: [] as any[]
  });

  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loansByStatus, setLoansByStatus] = useState<any[]>([]);
  const [paymentsData, setPaymentsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6'];

  const calculateNextPaymentDate = (loan: any, loanTypes: any[], payments: any[]) => {
    const loanType = loanTypes.find(t => t.id === loan.loanTypeId);
    const frequency = loan.frequency || loanType?.frequency || 'mensual';
    
    const n = loan.time;
    let currentDate = new Date(loan.createdAt);
    
    // Get all approved payments for this loan
    const loanPayments = payments
      .filter(p => p.loanId === loan.id && p.status !== 'rechazado' && p.status !== 'pendiente')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
    // Very simplified logic: assume each payment covers one period for now
    // In a real app, you'd calculate exact amortization and match payments to periods
    let periodsPaid = loanPayments.length;
    
    if (periodsPaid >= n) return null; // Fully paid
    
    // Advance date by periods paid + 1 to get next due date
    for (let i = 0; i <= periodsPaid; i++) {
      if (frequency === 'mensual') currentDate.setMonth(currentDate.getMonth() + 1);
      else if (frequency === 'quincenal') currentDate.setDate(currentDate.getDate() + 15);
      else if (frequency === 'catorcenal') currentDate.setDate(currentDate.getDate() + 14);
      else if (frequency === 'semanal') currentDate.setDate(currentDate.getDate() + 7);
      else if (frequency === 'diario') currentDate.setDate(currentDate.getDate() + 1);
      else if (frequency === 'trimestral') currentDate.setMonth(currentDate.getMonth() + 3);
      else if (frequency === 'semestral') currentDate.setMonth(currentDate.getMonth() + 6);
      else if (frequency === 'anual') currentDate.setFullYear(currentDate.getFullYear() + 1);
    }
    
    return currentDate;
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [clientsSnap, loansSnap, paymentsSnap, loanTypesSnap] = await Promise.all([
          getDocs(collection(db, 'clients')),
          getDocs(collection(db, 'loans')),
          getDocs(collection(db, 'payments')),
          getDocs(collection(db, 'loanTypes'))
        ]);
        
        const loanTypes = loanTypesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        const allPayments = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        
        let active = 0;
        let pending = 0;
        let totalLent = 0;
        let defaulted = 0;
        let totalCollected = 0;

        const statusCounts: Record<string, number> = {
          aprobado: 0,
          pendiente: 0,
          analisis: 0,
          rechazado: 0,
          desembolsado: 0
        };

        const recentLoans: any[] = [];
        
        const statuses = {
          enMora: [] as any[],
          enTiempo: [] as any[],
          proximos: [] as any[],
          hoy: [] as any[],
          manana: [] as any[]
        };

        loansSnap.forEach(doc => {
          const data = doc.data();
          const loan = { id: doc.id, ...data };
          recentLoans.push(loan);
          
          if (statusCounts[data.status] !== undefined) {
            statusCounts[data.status]++;
          }

          if (data.status === 'aprobado' || data.status === 'desembolsado') {
            active++;
            totalLent += data.amount;
            
            // Calculate status
            const nextPaymentDate = calculateNextPaymentDate(loan, loanTypes, allPayments);
            
            if (nextPaymentDate) {
              const today = startOfDay(new Date());
              const paymentDay = startOfDay(nextPaymentDate);
              
              // Add grace days
              const graceDays = data.graceDays || 0;
              const limitDate = new Date(paymentDay);
              limitDate.setDate(limitDate.getDate() + graceDays);
              
              if (isPast(limitDate) && !isToday(limitDate)) {
                statuses.enMora.push({...loan, nextPaymentDate});
                defaulted++;
              } else if (isToday(paymentDay)) {
                statuses.hoy.push({...loan, nextPaymentDate});
                statuses.enTiempo.push({...loan, nextPaymentDate});
              } else if (isTomorrow(paymentDay)) {
                statuses.manana.push({...loan, nextPaymentDate});
                statuses.enTiempo.push({...loan, nextPaymentDate});
                statuses.proximos.push({...loan, nextPaymentDate});
              } else if (isFuture(paymentDay)) {
                statuses.enTiempo.push({...loan, nextPaymentDate});
                
                // If within 7 days
                const diffTime = Math.abs(paymentDay.getTime() - today.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                if (diffDays <= 7) {
                  statuses.proximos.push({...loan, nextPaymentDate});
                }
              }
            }
            
          } else if (data.status === 'pendiente' || data.status === 'analisis') {
            pending++;
          }
        });

        setLoanStatuses(statuses);

        // Process Payments for Chart
        const paymentsByDate: Record<string, number> = {};
        const last30Days = Array.from({length: 30}, (_, i) => {
          const d = subDays(new Date(), i);
          return format(d, 'yyyy-MM-dd');
        }).reverse();

        last30Days.forEach(date => {
          paymentsByDate[date] = 0;
        });

        allPayments.forEach(data => {
          if (data.status !== 'rechazado') {
            totalCollected += data.amount;
            const dateStr = data.date ? data.date.split('T')[0] : null;
            if (dateStr && paymentsByDate[dateStr] !== undefined) {
              paymentsByDate[dateStr] += data.amount;
            }
          }
        });

        const chartData = last30Days.map(date => ({
          name: format(parseISO(date), 'dd MMM', { locale: es }),
          amount: paymentsByDate[date]
        }));

        setPaymentsData(chartData);

        const pieData = Object.keys(statusCounts).map(key => ({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          value: statusCounts[key]
        })).filter(item => item.value > 0);

        setLoansByStatus(pieData);

        setStats({
          totalClients: clientsSnap.size,
          activeLoans: active,
          totalLent,
          pendingLoans: pending,
          totalCollected,
          totalPendingCollection: totalLent - totalCollected,
          defaultedLoans: defaulted
        });

        setRecentActivity(recentLoans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5));
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const statCards = [
    { name: 'Total Clientes', value: stats.totalClients, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Préstamos Activos', value: stats.activeLoans, icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { name: 'Capital Prestado', value: `$${stats.totalLent.toLocaleString()}`, icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { name: 'Total Recaudado', value: `$${stats.totalCollected.toLocaleString()}`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
    { name: 'Solicitudes Pendientes', value: stats.pendingLoans, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { name: 'Préstamos en Mora', value: stats.defaultedLoans, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  if (loading) {
    return <div className="flex justify-center items-center h-64 text-slate-500">Cargando dashboard...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Resumen General</h2>
        <p className="text-sm text-slate-500 mt-1">Monitorea el estado general de tu negocio de préstamos.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4 tracking-tight">Estado de Cobros</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div onClick={() => navigate('/admin/loans?filter=mora')} className="card-modern p-4 cursor-pointer hover:border-rose-300 border border-transparent transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-lg"><AlertCircle size={20} /></div>
              <span className="text-2xl font-bold text-slate-900">{loanStatuses.enMora.length}</span>
            </div>
            <p className="text-sm font-medium text-slate-600">En Mora</p>
          </div>
          
          <div onClick={() => navigate('/admin/loans?filter=hoy')} className="card-modern p-4 cursor-pointer hover:border-amber-300 border border-transparent transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><CalendarClock size={20} /></div>
              <span className="text-2xl font-bold text-slate-900">{loanStatuses.hoy.length}</span>
            </div>
            <p className="text-sm font-medium text-slate-600">Cobros Hoy</p>
          </div>
          
          <div onClick={() => navigate('/admin/loans?filter=manana')} className="card-modern p-4 cursor-pointer hover:border-blue-300 border border-transparent transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Calendar size={20} /></div>
              <span className="text-2xl font-bold text-slate-900">{loanStatuses.manana.length}</span>
            </div>
            <p className="text-sm font-medium text-slate-600">Cobros Mañana</p>
          </div>
          
          <div onClick={() => navigate('/admin/loans?filter=proximos')} className="card-modern p-4 cursor-pointer hover:border-indigo-300 border border-transparent transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><TrendingUp size={20} /></div>
              <span className="text-2xl font-bold text-slate-900">{loanStatuses.proximos.length}</span>
            </div>
            <p className="text-sm font-medium text-slate-600">Próximos (7 días)</p>
          </div>
          
          <div onClick={() => navigate('/admin/loans?filter=tiempo')} className="card-modern p-4 cursor-pointer hover:border-emerald-300 border border-transparent transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><CalendarCheck size={20} /></div>
              <span className="text-2xl font-bold text-slate-900">{loanStatuses.enTiempo.length}</span>
            </div>
            <p className="text-sm font-medium text-slate-600">En Tiempo</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card-modern p-6 lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 mb-6 tracking-tight">Recaudación (Últimos 30 días)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={paymentsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `$${value}`} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'Recaudado']}
                />
                <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-modern p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6 tracking-tight">Estado de Préstamos</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={loansByStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {loansByStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card-modern p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-6 tracking-tight">Actividad Reciente</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Monto</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {recentActivity.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {new Date(loan.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{loan.clientName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{loan.loanTypeName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">${loan.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize
                      ${loan.status === 'aprobado' ? 'bg-emerald-100 text-emerald-800' : 
                        loan.status === 'rechazado' ? 'bg-red-100 text-red-800' : 
                        loan.status === 'desembolsado' ? 'bg-purple-100 text-purple-800' :
                        'bg-amber-100 text-amber-800'}`}>
                      {loan.status}
                    </span>
                  </td>
                </tr>
              ))}
              {recentActivity.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No hay actividad reciente.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
