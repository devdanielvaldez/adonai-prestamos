import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Plus, Search, FileText, Download, X, Check, XCircle, Eye } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Payment {
  id: string;
  loanId: string;
  clientId: string;
  clientName?: string;
  amount: number;
  type?: 'cuota' | 'abono' | 'cancelacion';
  method?: string;
  reference?: string;
  receiptImageBase64?: string;
  status?: string;
  date: string;
  notes?: string;
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'todos' | 'pendientes'>('todos');
  
  const initialFormState = {
    loanId: '',
    amount: 0,
    type: 'cuota',
    notes: ''
  };
  
  const [formData, setFormData] = useState(initialFormState);

  const fetchData = async () => {
    const [paymentsSnap, loansSnap, clientsSnap] = await Promise.all([
      getDocs(collection(db, 'payments')),
      getDocs(collection(db, 'loans')),
      getDocs(collection(db, 'clients'))
    ]);

    const clientsData = clientsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
    setClients(clientsData);

    const paymentsData = paymentsSnap.docs.map(d => {
      const data = d.data();
      // Find client name if not present (for client-submitted payments)
      let clientName = data.clientName;
      if (!clientName && data.clientId) {
        const client = clientsData.find(c => c.id === data.clientId);
        if (client) clientName = `${client.firstName} ${client.lastName}`;
      }
      return { id: d.id, ...data, clientName } as Payment;
    });

    setPayments(paymentsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setLoans(loansSnap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(l => l.status === 'aprobado' || l.status === 'desembolsado'));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const generateTicket = (payment: Payment, loan: any) => {
    // Calculate loan totals
    const loanAmount = loan.amount || 0;
    const r = (loan.interestRate || 0) / 100;
    const n = loan.time || 1;
    let pmt = 0;
    
    if (r === 0) {
      pmt = loanAmount / n;
    } else {
      pmt = loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }
    
    const totalToPay = pmt * n;
    const totalInterest = totalToPay - loanAmount;
    
    // Calculate balances
    const loanPayments = payments
      .filter(p => p.loanId === payment.loanId && p.status !== 'rechazado' && p.status !== 'pendiente')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
    const paymentIndex = loanPayments.findIndex(p => p.id === payment.id);
    
    // If payment is not in the list (e.g. just created and state not updated yet), 
    // we calculate based on all current approved payments
    let previousPaymentsTotal = 0;
    if (paymentIndex >= 0) {
      previousPaymentsTotal = loanPayments.slice(0, paymentIndex).reduce((sum, p) => sum + p.amount, 0);
    } else {
      previousPaymentsTotal = loanPayments.reduce((sum, p) => sum + p.amount, 0);
    }
      
    const balanceBefore = totalToPay - previousPaymentsTotal;
    const balanceAfter = Math.max(0, balanceBefore - payment.amount);
    
    // Proportional split for the ticket
    const interestRatio = totalToPay > 0 ? totalInterest / totalToPay : 0;
    const principalRatio = totalToPay > 0 ? loanAmount / totalToPay : 1;
    
    const paymentInterest = payment.amount * interestRatio;
    const paymentPrincipal = payment.amount * principalRatio;

    // 80mm thermal receipt (80mm x 150mm)
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [80, 150]
    });
    
    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('ADONAI PRÉSTAMOS', 40, 12, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Ticket de Pago', 40, 18, { align: 'center' });
    
    doc.setFontSize(8);
    doc.text('--------------------------------------------------', 40, 23, { align: 'center' });
    
    // Details
    doc.text(`Fecha: ${new Date(payment.date).toLocaleString()}`, 5, 28);
    doc.text(`Recibo N°: ${payment.id.slice(0, 8).toUpperCase()}`, 5, 33);
    doc.text(`Cliente: ${payment.clientName}`, 5, 38);
    doc.text(`Préstamo: ${loan.loanTypeName}`, 5, 43);
    
    doc.text('--------------------------------------------------', 40, 48, { align: 'center' });
    
    // Payment Info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('DETALLE DEL PAGO', 40, 55, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Monto Pagado:', 5, 63);
    doc.setFont('helvetica', 'bold');
    doc.text(`$${payment.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 75, 63, { align: 'right' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Abono a Capital:', 5, 69);
    doc.text(`$${paymentPrincipal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 75, 69, { align: 'right' });
    
    doc.text('Pago de Interés:', 5, 74);
    doc.text(`$${paymentInterest.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 75, 74, { align: 'right' });
    
    doc.text('--------------------------------------------------', 40, 80, { align: 'center' });
    
    // Balance Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('ESTADO DE CUENTA', 40, 87, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Saldo Anterior:', 5, 95);
    doc.text(`$${balanceBefore.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 75, 95, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.text('Saldo Restante:', 5, 101);
    doc.text(`$${balanceAfter.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, 75, 101, { align: 'right' });
    
    doc.setFont('helvetica', 'normal');
    doc.text('--------------------------------------------------', 40, 107, { align: 'center' });
    
    // Footer
    doc.setFontSize(8);
    doc.text('¡Gracias por su pago!', 40, 115, { align: 'center' });
    doc.text('Conserve este ticket para', 40, 120, { align: 'center' });
    doc.text('cualquier aclaración.', 40, 125, { align: 'center' });
    
    doc.save(`ticket_${payment.id.slice(0, 8)}.pdf`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const loan = loans.find(l => l.id === formData.loanId);
      if (!loan) throw new Error('Préstamo no encontrado');

      const paymentData = {
        ...formData,
        clientId: loan.clientId,
        clientName: loan.clientName,
        status: 'aprobado', // Admin payments are automatically approved
        date: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'payments'), paymentData);
      
      // Update loan balance logic could go here
      
      setIsModalOpen(false);
      setFormData(initialFormState);
      fetchData();
      
      // Generate ticket automatically
      generateTicket({ id: docRef.id, ...paymentData } as Payment, loan);
      
    } catch (error: any) {
      alert('Error al registrar pago: ' + error.message);
    }
  };

  const handleUpdatePaymentStatus = async (paymentId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'payments', paymentId), { status: newStatus });
      fetchData();
      setIsReceiptModalOpen(false);
      
      if (newStatus === 'aprobado' && selectedPayment) {
        const loan = loans.find(l => l.id === selectedPayment.loanId) || { loanTypeName: 'Préstamo' };
        generateTicket({ ...selectedPayment, status: 'aprobado' }, loan);
      }
    } catch (error) {
      console.error(error);
      alert('Error al actualizar el estado del pago.');
    }
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch = (p.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.type || p.method || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.reference || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'pendientes') {
      return matchesSearch && p.status === 'pendiente';
    }
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Pagos</h2>
          <p className="text-sm text-slate-500 mt-1">Registra pagos, abonos y genera tickets de recibo.</p>
        </div>
        <button
          onClick={() => {
            setFormData(initialFormState);
            setIsModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus size={20} className="mr-2" />
          <span>Registrar Pago</span>
        </button>
      </div>

      <div className="card-modern">
        <div className="flex border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('todos')}
            className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'todos' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Todos los Pagos
          </button>
          <button 
            onClick={() => setActiveTab('pendientes')}
            className={`flex-1 py-4 text-sm font-medium text-center transition-colors relative ${activeTab === 'pendientes' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Pendientes de Validación
            {payments.filter(p => p.status === 'pendiente').length > 0 && (
              <span className="absolute top-3 ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {payments.filter(p => p.status === 'pendiente').length}
              </span>
            )}
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por cliente o tipo de pago..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 sm:text-sm transition-all shadow-sm"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Detalles</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Monto</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {new Date(payment.date).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{payment.clientName || 'Desconocido'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize w-max
                        ${payment.type === 'cuota' ? 'bg-blue-100 text-blue-800' : 
                          payment.type === 'abono' ? 'bg-indigo-100 text-indigo-800' : 
                          payment.method === 'transferencia' ? 'bg-purple-100 text-purple-800' :
                          'bg-emerald-100 text-emerald-800'}`}>
                        {payment.type || payment.method || 'Pago'}
                      </span>
                      {payment.reference && <span className="text-xs text-slate-500 mt-1">Ref: {payment.reference}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">${payment.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {payment.status === 'pendiente' ? (
                      <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-amber-100 text-amber-800">Pendiente</span>
                    ) : payment.status === 'rechazado' ? (
                      <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Rechazado</span>
                    ) : (
                      <span className="px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-100 text-emerald-800">Aprobado</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex items-center justify-end space-x-3">
                    {payment.status === 'pendiente' && payment.receiptImageBase64 && (
                      <button 
                        onClick={() => {
                          setSelectedPayment(payment);
                          setIsReceiptModalOpen(true);
                        }}
                        className="text-amber-600 hover:text-amber-900 flex items-center transition-colors"
                        title="Revisar Comprobante"
                      >
                        <Eye size={18} />
                      </button>
                    )}
                    {payment.status !== 'rechazado' && payment.status !== 'pendiente' && (
                      <button 
                        onClick={() => {
                          const loan = loans.find(l => l.id === payment.loanId) || { loanTypeName: 'Préstamo' };
                          generateTicket(payment, loan);
                        }} 
                        className="text-indigo-600 hover:text-indigo-900 flex items-center transition-colors"
                        title="Descargar Ticket"
                      >
                        <Download size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredPayments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No se encontraron pagos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Registrar Pago
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Préstamo (Cliente)</label>
                <select required value={formData.loanId} onChange={e => setFormData({...formData, loanId: e.target.value})} className="input-modern">
                  <option value="">Seleccione un préstamo</option>
                  {loans.map(l => (
                    <option key={l.id} value={l.id}>
                      {l.clientName} - {l.loanTypeName} (${l.amount.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Pago</label>
                  <select required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})} className="input-modern">
                    <option value="cuota">Cuota Regular</option>
                    <option value="abono">Abono a Capital</option>
                    <option value="cancelacion">Cancelación Total</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Monto a Pagar</label>
                  <input type="number" required min="1" value={formData.amount} onChange={e => setFormData({...formData, amount: Number(e.target.value)})} className="input-modern" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notas (Opcional)</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} rows={3} className="input-modern resize-none" placeholder="Observaciones sobre el pago..." />
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  Registrar y Generar Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Receipt Validation Modal */}
      {isReceiptModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Validar Comprobante de Pago
              </h3>
              <button onClick={() => setIsReceiptModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <p className="text-sm text-slate-500">Cliente</p>
                  <p className="font-bold text-slate-900">{selectedPayment.clientName}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Monto</p>
                  <p className="font-bold text-emerald-600 text-lg">${selectedPayment.amount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Referencia</p>
                  <p className="font-medium text-slate-900">{selectedPayment.reference || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Fecha</p>
                  <p className="font-medium text-slate-900">{new Date(selectedPayment.date).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-900 mb-2">Comprobante Adjunto</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-100 flex justify-center p-2">
                  <img 
                    src={selectedPayment.receiptImageBase64} 
                    alt="Comprobante de pago" 
                    className="max-h-[400px] object-contain"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => handleUpdatePaymentStatus(selectedPayment.id, 'rechazado')} 
                  className="flex-1 btn-secondary bg-red-50 text-red-700 border-red-200 hover:bg-red-100 flex justify-center items-center"
                >
                  <XCircle size={18} className="mr-2" /> Rechazar
                </button>
                <button 
                  onClick={() => handleUpdatePaymentStatus(selectedPayment.id, 'aprobado')} 
                  className="flex-1 btn-primary bg-emerald-600 hover:bg-emerald-700 flex justify-center items-center"
                >
                  <Check size={18} className="mr-2" /> Aprobar Pago
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
