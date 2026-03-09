import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Upload, CheckCircle, Clock, XCircle, FileText, Download, DollarSign, Search } from 'lucide-react';
import { generateLoanDocumentation, generatePaymentReceipt, generateAmortizationPDF } from '../../utils/pdfGenerator';

export default function ClientLoanDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<any>(null);
  const [loanType, setLoanType] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [amortization, setAmortization] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<'resumen' | 'amortizacion' | 'pagos' | 'historial' | 'expediente'>('resumen');
  
  // Payment Registration
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentImage, setPaymentImage] = useState<string | null>(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [guaranteePhotoBase64, setGuaranteePhotoBase64] = useState<string | null>(null);

  const handleGuaranteePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('La imagen no debe superar los 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setGuaranteePhotoBase64(base64String);
      
      try {
        await updateDoc(doc(db, 'loans', id), {
          guaranteePhotoBase64: base64String
        });
        
        await addDoc(collection(db, 'loanHistory'), {
          loanId: id,
          action: 'Actualización de Expediente',
          details: 'El cliente subió una foto de la garantía.',
          createdBy: auth.currentUser?.email || 'Cliente',
          createdAt: new Date().toISOString()
        });
        
        // Refresh loan data
        const loanDoc = await getDoc(doc(db, 'loans', id));
        if (loanDoc.exists()) {
          setLoan({ id: loanDoc.id, ...loanDoc.data() } as any);
        }
        
        alert('Foto de garantía subida exitosamente');
      } catch (error) {
        console.error(error);
        alert('Error al guardar la foto de garantía');
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!id || !auth.currentUser) return;
      try {
        const loanDoc = await getDoc(doc(db, 'loans', id));
        if (!loanDoc.exists()) throw new Error('Préstamo no encontrado');
        
        const loanData = { id: loanDoc.id, ...loanDoc.data() } as any;
        
        // Security check
        if (loanData.clientId !== auth.currentUser.uid) {
          navigate('/client/my-loans');
          return;
        }
        
        setLoan(loanData);

        const typeDoc = await getDoc(doc(db, 'loanTypes', loanData.loanTypeId));
        if (typeDoc.exists()) setLoanType(typeDoc.data());

        // Fetch payments
        const paymentsQ = query(collection(db, 'payments'), where('loanId', '==', id));
        const paymentsSnap = await getDocs(paymentsQ);
        setPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));

        // Fetch history
        const historyQ = query(collection(db, 'loanHistory'), where('loanId', '==', id));
        const historySnap = await getDocs(historyQ);
        setHistory(historySnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));

        // Calculate Amortization
        calculateAmortization(loanData, typeDoc.exists() ? typeDoc.data() : null);

      } catch (error) {
        console.error(error);
        alert('Error al cargar datos del préstamo');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const calculateAmortization = (loanData: any, typeData: any) => {
    const frequency = loanData.frequency || typeData?.frequency || 'mensual';
    const r = loanData.interestRate / 100;
    const n = loanData.time;
    let pmt = 0;
    
    if (r === 0) {
      pmt = loanData.amount / n;
    } else {
      pmt = loanData.amount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    }

    let balance = loanData.amount;
    const schedule = [];
    let currentDate = new Date(loanData.createdAt);

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
    setAmortization(schedule);
  };

  const handleDownloadDocs = async () => {
    if (!id) return;
    setDownloading(true);
    await generateLoanDocumentation(id);
    setDownloading(false);
  };

  const handleDownloadAmortization = async () => {
    if (!id) return;
    setDownloading(true);
    await generateAmortizationPDF(id, amortization);
    setDownloading(false);
  };

  const handleDownloadReceipt = async (paymentId: string) => {
    await generatePaymentReceipt(paymentId);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPaymentImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || !paymentReference || !paymentImage) {
      return alert('Por favor complete todos los campos y suba el comprobante.');
    }

    setSubmittingPayment(true);
    try {
      await addDoc(collection(db, 'payments'), {
        loanId: id,
        clientId: auth.currentUser?.uid,
        amount: Number(paymentAmount),
        method: 'transferencia',
        reference: paymentReference,
        receiptImageBase64: paymentImage,
        status: 'pendiente', // Needs admin validation
        date: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });

      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentImage(null);
      
      // Refresh payments
      const paymentsQ = query(collection(db, 'payments'), where('loanId', '==', id));
      const paymentsSnap = await getDocs(paymentsQ);
      setPayments(paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      
      alert('Pago registrado exitosamente. Está pendiente de validación por un administrador.');
    } catch (error) {
      console.error(error);
      alert('Error al registrar el pago.');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'pendiente': return <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-semibold flex items-center w-max"><Clock size={16} className="mr-1.5"/> Pendiente</span>;
      case 'analisis': return <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold flex items-center w-max"><Search size={16} className="mr-1.5"/> En Análisis</span>;
      case 'aprobado': return <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-semibold flex items-center w-max"><CheckCircle size={16} className="mr-1.5"/> Aprobado</span>;
      case 'rechazado': return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold flex items-center w-max"><XCircle size={16} className="mr-1.5"/> Rechazado</span>;
      case 'desembolsado': return <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold flex items-center w-max"><CheckCircle size={16} className="mr-1.5"/> Desembolsado</span>;
      default: return null;
    }
  };

  const getPaymentStatusBadge = (status: string) => {
    switch(status) {
      case 'pendiente': return <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">Pendiente de Validación</span>;
      case 'aprobado': return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">Aprobado</span>;
      case 'rechazado': return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold">Rechazado</span>;
      default: return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">Completado</span>; // Legacy payments
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando detalles...</div>;
  if (!loan) return <div className="p-8 text-center text-slate-500">Préstamo no encontrado</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/client/my-loans')} className="text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Detalles de mi Préstamo</h2>
            <p className="text-sm text-slate-500 mt-1">{loan.loanTypeName}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadDocs}
            disabled={downloading}
            className="btn-secondary flex items-center"
          >
            <Download size={18} className="mr-2" />
            {downloading ? 'Descargando...' : 'Descargar Documentación'}
          </button>
          {(loan.status === 'desembolsado' || loan.status === 'aprobado') && (
            <button
              onClick={() => setIsPaymentModalOpen(true)}
              className="btn-primary flex items-center bg-emerald-600 hover:bg-emerald-700"
            >
              <DollarSign size={18} className="mr-2" />
              Registrar Pago
            </button>
          )}
        </div>
      </div>

      <div className="card-modern overflow-hidden">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('resumen')}
            className={`flex-1 py-4 px-4 text-sm font-medium text-center transition-colors whitespace-nowrap ${activeTab === 'resumen' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Resumen
          </button>
          <button 
            onClick={() => setActiveTab('amortizacion')}
            className={`flex-1 py-4 px-4 text-sm font-medium text-center transition-colors whitespace-nowrap ${activeTab === 'amortizacion' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Amortización
          </button>
          <button 
            onClick={() => setActiveTab('pagos')}
            className={`flex-1 py-4 px-4 text-sm font-medium text-center transition-colors whitespace-nowrap ${activeTab === 'pagos' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Mis Pagos ({payments.length})
          </button>
          <button 
            onClick={() => setActiveTab('historial')}
            className={`flex-1 py-4 px-4 text-sm font-medium text-center transition-colors whitespace-nowrap ${activeTab === 'historial' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Historial
          </button>
          <button 
            onClick={() => setActiveTab('expediente')}
            className={`flex-1 py-4 px-4 text-sm font-medium text-center transition-colors whitespace-nowrap ${activeTab === 'expediente' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Expediente
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'resumen' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-sm text-slate-500 mb-1">Estado Actual</p>
                  <div>{getStatusBadge(loan.status)}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-sm text-slate-500 mb-1">Monto Solicitado</p>
                  <p className="text-xl font-bold text-slate-900">${loan.amount.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-sm text-slate-500 mb-1">Tasa de Interés</p>
                  <p className="text-xl font-bold text-slate-900">{loan.interestRate}%</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-sm text-slate-500 mb-1">Tiempo</p>
                  <p className="text-xl font-bold text-slate-900">{loan.time} {loan.frequency || loanType?.frequency || 'meses'}</p>
                </div>
              </div>

              <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
                <h3 className="text-lg font-bold text-indigo-900 mb-4">Información del Contrato</h3>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${loan.contractSigned ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                    {loan.contractSigned ? <CheckCircle size={20} /> : <Clock size={20} />}
                  </div>
                  <div>
                    <p className="font-medium text-indigo-900">
                      {loan.contractSigned ? 'Contrato Firmado' : 'Pendiente de Firma'}
                    </p>
                    <p className="text-sm text-indigo-700">
                      {loan.contractSigned 
                        ? `Firmaste este contrato el ${new Date(loan.contractSignedAt).toLocaleDateString()}` 
                        : 'Debes firmar el contrato para que podamos desembolsar tu préstamo.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'amortizacion' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={handleDownloadAmortization}
                  disabled={downloading}
                  className="btn-secondary flex items-center text-sm"
                >
                  <Download size={16} className="mr-2" />
                  {downloading ? 'Descargando...' : 'Descargar Amortización'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Cuota</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Fecha Estimada</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Monto Cuota</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Interés</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Capital</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Saldo Restante</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {amortization.map((row) => (
                    <tr key={row.period} className="hover:bg-slate-50 transition-colors">
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
            </div>
          )}

          {activeTab === 'pagos' && (
            <div className="space-y-4">
              {payments.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
                  <DollarSign className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">Aún no has registrado ningún pago.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Fecha</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Monto</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Método</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Referencia</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Estado</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">{new Date(payment.date).toLocaleDateString()}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-emerald-600">${payment.amount.toLocaleString()}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600 capitalize">{payment.method}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">{payment.reference || 'N/A'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{getPaymentStatusBadge(payment.status)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            {(payment.status === 'aprobado' || !payment.status) && (
                              <button 
                                onClick={() => handleDownloadReceipt(payment.id)}
                                className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50 transition-colors"
                                title="Descargar Recibo"
                              >
                                <Download size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'historial' && (
            <div className="space-y-6">
              <div className="relative border-l-2 border-slate-200 ml-3 space-y-8">
                {history.length === 0 ? (
                  <p className="text-center text-slate-500 py-8 pl-4">No hay historial registrado.</p>
                ) : (
                  history.map((item, index) => (
                    <div key={item.id} className="relative pl-6">
                      <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-indigo-100 border-2 border-indigo-600"></div>
                      <div className="mb-1 flex justify-between items-center">
                        <h4 className="font-bold text-slate-900 text-sm">{item.action}</h4>
                        <span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-slate-600 whitespace-pre-wrap">{item.details}</p>
                    </div>
                  ))
                )}
                
                {/* Initial Creation Event */}
                <div className="relative pl-6">
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-100 border-2 border-emerald-600"></div>
                  <div className="mb-1 flex justify-between items-center">
                    <h4 className="font-bold text-slate-900 text-sm">Préstamo Solicitado</h4>
                    <span className="text-xs text-slate-500">{new Date(loan.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-slate-600">Tu solicitud fue enviada exitosamente.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'expediente' && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Expediente del Préstamo</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Foto de Garantía */}
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 md:col-span-2">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-slate-900 flex items-center">
                      <FileText size={18} className="mr-2 text-indigo-600" />
                      Foto de la Garantía
                    </h4>
                    <div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        id="guaranteePhotoClient" 
                        className="hidden" 
                        onChange={handleGuaranteePhotoUpload}
                      />
                      <label htmlFor="guaranteePhotoClient" className="btn-secondary text-sm cursor-pointer">
                        Subir Foto
                      </label>
                    </div>
                  </div>
                  
                  {(loan.guaranteePhotoBase64 || guaranteePhotoBase64) ? (
                    <div className="relative group max-w-md mx-auto">
                      <img 
                        src={guaranteePhotoBase64 || loan.guaranteePhotoBase64} 
                        alt="Garantía" 
                        className="w-full h-auto rounded-lg border border-slate-200 shadow-sm"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded-lg flex items-center justify-center">
                        <a 
                          href={guaranteePhotoBase64 || loan.guaranteePhotoBase64} 
                          download={`garantia_${loan.id}.png`}
                          className="opacity-0 group-hover:opacity-100 btn-secondary bg-white text-sm py-1.5 px-3"
                        >
                          Descargar
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic text-center py-8">No has subido una foto de la garantía.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Registrar Pago
              </h3>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <XCircle size={24} />
              </button>
            </div>
            <form onSubmit={submitPayment} className="space-y-5">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> Solo se aceptan transferencias bancarias. El pago será revisado por un administrador antes de ser aplicado a tu préstamo.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Monto Transferido ($)</label>
                <input 
                  type="number" 
                  required 
                  min="1"
                  step="0.01"
                  value={paymentAmount} 
                  onChange={e => setPaymentAmount(e.target.value)} 
                  className="input-modern" 
                  placeholder="Ej: 150.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Número de Referencia</label>
                <input 
                  type="text" 
                  required 
                  value={paymentReference} 
                  onChange={e => setPaymentReference(e.target.value)} 
                  className="input-modern" 
                  placeholder="Ej: REF-123456789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Comprobante (Imagen)</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl hover:border-indigo-500 transition-colors bg-slate-50">
                  <div className="space-y-1 text-center">
                    {paymentImage ? (
                      <div className="flex flex-col items-center">
                        <img src={paymentImage} alt="Comprobante" className="h-32 object-contain mb-3 rounded" />
                        <button type="button" onClick={() => setPaymentImage(null)} className="text-sm text-red-600 hover:text-red-800 font-medium">
                          Quitar imagen
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="mx-auto h-12 w-12 text-slate-400" />
                        <div className="flex text-sm text-slate-600 justify-center">
                          <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500 px-2 py-1">
                            <span>Subir un archivo</span>
                            <input id="file-upload" name="file-upload" type="file" accept="image/*" className="sr-only" onChange={handleImageUpload} />
                          </label>
                        </div>
                        <p className="text-xs text-slate-500">PNG, JPG, GIF hasta 5MB</p>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={submittingPayment} className="flex-1 btn-primary bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                  {submittingPayment ? 'Enviando...' : 'Enviar Pago'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
