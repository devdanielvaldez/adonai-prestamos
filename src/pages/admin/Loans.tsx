import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Plus, Edit2, Trash2, X, Search, CheckCircle, XCircle, Clock, Calculator, FileSignature, FileText } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isToday, isTomorrow, isPast, isFuture, startOfDay } from 'date-fns';

interface Loan {
  id: string;
  clientId: string;
  clientName: string;
  loanTypeId: string;
  loanTypeName: string;
  amount: number;
  time: number;
  interestRate: number;
  graceDays: number;
  lateFeePercentage: number;
  guarantorId?: string;
  guaranteeTypeId?: string;
  guaranteeData?: any;
  status: 'pendiente' | 'analisis' | 'aprobado' | 'rechazado' | 'desembolsado';
  contractPrepared?: boolean;
  contractSigned?: boolean;
  contractSignedAt?: string;
  contractData?: any;
  createdAt: string;
  loanNumber?: string;
  nextPaymentDate?: Date | null;
  frequency?: string;
}

export default function Loans() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialFilter = queryParams.get('filter') || 'todos';

  const [loans, setLoans] = useState<Loan[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  const [guarantors, setGuarantors] = useState<any[]>([]);
  const [guaranteeTypes, setGuaranteeTypes] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAmortization, setShowAmortization] = useState(false);
  const [currentAmortization, setCurrentAmortization] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  
  const initialFormState = {
    clientId: '',
    loanTypeId: '',
    amount: 0,
    time: 1,
    interestRate: 0,
    graceDays: 0,
    guarantorId: '',
    guaranteeTypeId: '',
    guaranteeData: {} as any,
    frequency: 'mensual'
  };
  
  const [formData, setFormData] = useState(initialFormState);

  const calculateNextPaymentDate = (loan: any, types: any[], allPayments: any[]) => {
    const loanType = types.find(t => t.id === loan.loanTypeId);
    const frequency = loan.frequency || loanType?.frequency || 'mensual';
    
    const n = loan.time;
    let currentDate = new Date(loan.createdAt);
    
    const loanPayments = allPayments
      .filter(p => p.loanId === loan.id && p.status !== 'rechazado' && p.status !== 'pendiente')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
    let periodsPaid = loanPayments.length;
    
    if (periodsPaid >= n) return null;
    
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

  const fetchData = async () => {
    const [loansSnap, clientsSnap, typesSnap, guarantorsSnap, guaranteesSnap, paymentsSnap] = await Promise.all([
      getDocs(collection(db, 'loans')),
      getDocs(collection(db, 'clients')),
      getDocs(collection(db, 'loanTypes')),
      getDocs(collection(db, 'guarantors')),
      getDocs(collection(db, 'guaranteeTypes')),
      getDocs(collection(db, 'payments'))
    ]);

    const typesData = typesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const paymentsData = paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const loansData = loansSnap.docs.map(d => {
      const data = d.data();
      const nextPaymentDate = calculateNextPaymentDate({id: d.id, ...data}, typesData, paymentsData);
      return { id: d.id, ...data, nextPaymentDate } as Loan;
    });

    setLoans(loansData);
    setClients(clientsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoanTypes(typesData);
    setGuarantors(guarantorsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setGuaranteeTypes(guaranteesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setPayments(paymentsData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const client = clients.find(c => c.id === formData.clientId);
      const loanType = loanTypes.find(t => t.id === formData.loanTypeId);
      
      const uniqueNumber = `PR-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;
      
      await addDoc(collection(db, 'loans'), {
        ...formData,
        loanNumber: uniqueNumber,
        clientName: `${client.firstName} ${client.lastName}`,
        loanTypeName: loanType.name,
        lateFeePercentage: loanType.lateFeePercentage || 0,
        status: 'pendiente',
        createdAt: new Date().toISOString()
      });
      
      setIsModalOpen(false);
      setFormData(initialFormState);
      fetchData();
    } catch (error: any) {
      alert('Error al crear préstamo: ' + error.message);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await updateDoc(doc(db, 'loans', id), { status: newStatus });
    fetchData();
  };

  const calculateAmortization = (loan: Loan) => {
    const loanType = loanTypes.find(t => t.id === loan.loanTypeId);
    const frequency = loan.frequency || loanType?.frequency || 'mensual';
    
    const r = loan.interestRate / 100;
    const n = loan.time;
    let pmt = 0;
    
    if (r === 0) {
      pmt = loan.amount / n;
    } else {
      pmt = loan.amount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }

    let balance = loan.amount;
    const schedule = [];
    let currentDate = new Date(loan.createdAt);

    for (let i = 1; i <= n; i++) {
      const interest = balance * r;
      let principal = pmt - interest;
      
      if (i === n) {
        principal = balance;
        pmt = principal + interest;
      }
      balance -= principal;

      if (frequency === 'mensual') currentDate.setMonth(currentDate.getMonth() + 1);
      else if (frequency === 'quincenal') currentDate.setDate(currentDate.getDate() + 15);
      else if (frequency === 'catorcenal') currentDate.setDate(currentDate.getDate() + 14);
      else if (frequency === 'semanal') currentDate.setDate(currentDate.getDate() + 7);
      else if (frequency === 'diario') currentDate.setDate(currentDate.getDate() + 1);
      else if (frequency === 'trimestral') currentDate.setMonth(currentDate.getMonth() + 3);
      else if (frequency === 'semestral') currentDate.setMonth(currentDate.getMonth() + 6);
      else if (frequency === 'anual') currentDate.setFullYear(currentDate.getFullYear() + 1);

      schedule.push({
        period: i,
        date: new Date(currentDate).toISOString(),
        payment: pmt,
        principal: principal,
        interest: interest,
        balance: Math.max(0, balance)
      });
    }
    
    setCurrentAmortization(schedule);
    setShowAmortization(true);
  };

  const selectedGuaranteeType = guaranteeTypes.find(g => g.id === formData.guaranteeTypeId);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'pendiente': return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold flex items-center w-max"><Clock size={12} className="mr-1.5"/> Pendiente</span>;
      case 'analisis': return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold flex items-center w-max"><Search size={12} className="mr-1.5"/> En Análisis</span>;
      case 'aprobado': return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold flex items-center w-max"><CheckCircle size={12} className="mr-1.5"/> Aprobado</span>;
      case 'rechazado': return <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold flex items-center w-max"><XCircle size={12} className="mr-1.5"/> Rechazado</span>;
      case 'desembolsado': return <span className="px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold flex items-center w-max"><CheckCircle size={12} className="mr-1.5"/> Desembolsado</span>;
      default: return null;
    }
  };

  const filteredLoans = loans.filter(loan => {
    const matchesSearch = 
      loan.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (loan as any).loanNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loan.loanTypeName.toLowerCase().includes(searchTerm.toLowerCase());
      
    let matchesStatus = false;
    
    if (statusFilter === 'todos') {
      matchesStatus = true;
    } else if (['pendiente', 'analisis', 'aprobado', 'rechazado', 'desembolsado'].includes(statusFilter)) {
      matchesStatus = loan.status === statusFilter;
    } else if (loan.status === 'aprobado' || loan.status === 'desembolsado') {
      // Custom filters from dashboard
      if (loan.nextPaymentDate) {
        const today = startOfDay(new Date());
        const paymentDay = startOfDay(loan.nextPaymentDate);
        const limitDate = new Date(paymentDay);
        limitDate.setDate(limitDate.getDate() + (loan.graceDays || 0));
        
        if (statusFilter === 'mora') {
          matchesStatus = isPast(limitDate) && !isToday(limitDate);
        } else if (statusFilter === 'hoy') {
          matchesStatus = isToday(paymentDay);
        } else if (statusFilter === 'manana') {
          matchesStatus = isTomorrow(paymentDay);
        } else if (statusFilter === 'tiempo') {
          matchesStatus = isFuture(limitDate) || isToday(limitDate);
        } else if (statusFilter === 'proximos') {
          const diffTime = Math.abs(paymentDay.getTime() - today.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          matchesStatus = isFuture(paymentDay) && diffDays <= 7;
        }
      }
    }
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Préstamos</h2>
          <p className="text-sm text-slate-500 mt-1">Gestión de solicitudes y préstamos activos.</p>
        </div>
        <button
          onClick={() => {
            setFormData(initialFormState);
            setIsModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus size={20} className="mr-2" />
          <span>Nuevo Préstamo</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por cliente, número o tipo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
        >
          <optgroup label="Estados Generales">
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="analisis">En Análisis</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
            <option value="desembolsado">Desembolsado</option>
          </optgroup>
          <optgroup label="Estado de Cobro (Aprobados)">
            <option value="mora">En Mora</option>
            <option value="hoy">Cobros Hoy</option>
            <option value="manana">Cobros Mañana</option>
            <option value="proximos">Próximos (7 días)</option>
            <option value="tiempo">En Tiempo</option>
          </optgroup>
        </select>
      </div>

      <div className="card-modern">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Monto</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    <div>{loan.clientName}</div>
                    <div className="text-xs text-slate-500 font-normal">{(loan as any).loanNumber}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{loan.loanTypeName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-semibold">${loan.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(loan.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{new Date(loan.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex items-center justify-end space-x-3">
                    <button 
                      onClick={() => navigate(`/admin/loans/${loan.id}`)}
                      className="text-slate-600 hover:text-slate-900 flex items-center transition-colors"
                      title="Ver Detalles"
                    >
                      <Search size={18} />
                    </button>
                    {loan.contractSigned && (
                      <button 
                        onClick={() => navigate(`/admin/view-contract/${loan.id}`)}
                        className="text-purple-600 hover:text-purple-900 flex items-center transition-colors"
                        title="Ver Contrato Firmado"
                      >
                        <FileText size={18} />
                      </button>
                    )}
                    {loan.status === 'aprobado' && !loan.contractPrepared && (
                      <button 
                        onClick={() => navigate(`/admin/prepare-contract/${loan.id}`)}
                        className="text-emerald-600 hover:text-emerald-900 flex items-center transition-colors"
                        title="Preparar Contrato"
                      >
                        <FileSignature size={18} />
                      </button>
                    )}
                    <button 
                      onClick={() => calculateAmortization(loan)}
                      className="text-indigo-600 hover:text-indigo-900 flex items-center transition-colors"
                      title="Ver Amortización"
                    >
                      <Calculator size={18} />
                    </button>
                    <select 
                      value={loan.status}
                      onChange={(e) => updateStatus(loan.id, e.target.value)}
                      className="text-sm border-slate-200 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 py-1.5 pl-3 pr-8"
                    >
                      <option value="pendiente">Pendiente</option>
                      <option value="analisis">En Análisis</option>
                      <option value="aprobado">Aprobar</option>
                      <option value="rechazado">Rechazar</option>
                      <option value="desembolsado">Desembolsado</option>
                    </select>
                  </td>
                </tr>
              ))}
              {loans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No hay préstamos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear Préstamo */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Crear Solicitud de Préstamo
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                  <select required value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})} className="input-modern">
                    <option value="">Seleccione un cliente</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} - {c.documentId}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Préstamo</label>
                  <select required value={formData.loanTypeId} onChange={e => setFormData({...formData, loanTypeId: e.target.value})} className="input-modern">
                    <option value="">Seleccione un tipo</option>
                    {loanTypes.filter(t => t.isActive).map(t => <option key={t.id} value={t.id}>{t.name} ({t.minInterest}% - {t.maxInterest}%)</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Frecuencia de Pago</label>
                  <select required value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value})} className="input-modern">
                    <option value="diario">Diario</option>
                    <option value="semanal">Semanal</option>
                    <option value="catorcenal">Catorcenal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="semestral">Semestral</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monto Solicitado</label>
                  <input type="number" required min="1" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} className="input-modern" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tiempo (según frecuencia)</label>
                  <input type="number" required min="1" value={formData.time} onChange={e => setFormData({...formData, time: Number(e.target.value)})} className="input-modern" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tasa de Interés (%)</label>
                  <input type="number" required min="0" step="0.1" value={formData.interestRate} onChange={e => setFormData({...formData, interestRate: Number(e.target.value)})} className="input-modern" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Días de Gracia</label>
                  <input type="number" required min="0" value={formData.graceDays} onChange={e => setFormData({...formData, graceDays: Number(e.target.value)})} className="input-modern" placeholder="Ej: 5" />
                  <p className="text-xs text-slate-500 mt-1">Días antes de generar mora.</p>
                </div>

                <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
                  <h4 className="text-sm font-semibold text-slate-900 mb-4">Garantías (Opcional)</h4>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Garante</label>
                  <select value={formData.guarantorId} onChange={e => setFormData({...formData, guarantorId: e.target.value})} className="input-modern">
                    <option value="">Sin garante</option>
                    {guarantors.map(g => <option key={g.id} value={g.id}>{g.firstName} {g.lastName} - {g.documentId}</option>)}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Garantía</label>
                  <select value={formData.guaranteeTypeId} onChange={e => setFormData({...formData, guaranteeTypeId: e.target.value, guaranteeData: {}})} className="input-modern">
                    <option value="">Sin garantía</option>
                    {guaranteeTypes.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>

                {selectedGuaranteeType && selectedGuaranteeType.requiredFields?.length > 0 && (
                  <div className="md:col-span-2 bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
                    <h4 className="text-sm font-semibold text-slate-900">Datos de la Garantía</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {selectedGuaranteeType.requiredFields.map((field: string) => (
                        <div key={field}>
                          <label className="block text-sm font-medium text-slate-700 mb-1">{field}</label>
                          <input 
                            type="text" 
                            required 
                            value={formData.guaranteeData[field] || ''} 
                            onChange={e => setFormData({
                              ...formData, 
                              guaranteeData: { ...formData.guaranteeData, [field]: e.target.value }
                            })} 
                            className="input-modern" 
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  Crear Solicitud
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Amortización */}
      {showAmortization && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-6 sm:p-8 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Tabla de Amortización
              </h3>
              <button onClick={() => setShowAmortization(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 pr-2">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cuota</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Monto Cuota</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Interés</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Capital</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Saldo Restante</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {currentAmortization.map((row) => (
                    <tr key={row.period} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900 font-medium">{row.period}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{new Date(row.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900 font-semibold text-right">${row.payment.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">${row.interest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">${row.principal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-right">${row.balance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pt-6 flex justify-end flex-shrink-0">
              <button onClick={() => setShowAmortization(false)} className="btn-secondary">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
