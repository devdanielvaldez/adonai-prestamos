import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, orderBy, getDocs } from 'firebase/firestore';
import { ArrowLeft, Clock, CheckCircle, XCircle, Search, FileText, MessageSquare, History, User, Save, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { generateLoanDocumentation, generateAmortizationPDF } from '../../utils/pdfGenerator';

export default function LoanDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loan, setLoan] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [loanType, setLoanType] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [amortization, setAmortization] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'amortizacion' | 'notes' | 'history' | 'expediente'>('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
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
          details: 'Se subió una foto de la garantía.',
          createdBy: user?.email || 'Sistema',
          createdAt: new Date().toISOString()
        });
        
        fetchData();
        alert('Foto de garantía subida exitosamente');
      } catch (error) {
        console.error(error);
        alert('Error al guardar la foto de garantía');
      }
    };
    reader.readAsDataURL(file);
  };

  const fetchData = async () => {
    if (!id) return;
    try {
      const loanDoc = await getDoc(doc(db, 'loans', id));
      if (!loanDoc.exists()) throw new Error('Préstamo no encontrado');
      
      const loanData = { id: loanDoc.id, ...loanDoc.data() } as any;
      setLoan(loanData);
      setEditData(loanData);

      const [clientDoc, typeDoc] = await Promise.all([
        getDoc(doc(db, 'clients', loanData.clientId)),
        getDoc(doc(db, 'loanTypes', loanData.loanTypeId))
      ]);

      if (clientDoc.exists()) setClient(clientDoc.data());
      if (typeDoc.exists()) setLoanType(typeDoc.data());

      // Fetch notes
      const notesQ = query(collection(db, 'loanNotes'), where('loanId', '==', id), orderBy('createdAt', 'desc'));
      const notesSnap = await getDocs(notesQ);
      setNotes(notesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Fetch history
      const historyQ = query(collection(db, 'loanHistory'), where('loanId', '==', id), orderBy('createdAt', 'desc'));
      const historySnap = await getDocs(historyQ);
      setHistory(historySnap.docs.map(d => ({ id: d.id, ...d.data() })));

      calculateAmortization(loanData, typeDoc.exists() ? typeDoc.data() : null);

    } catch (error) {
      console.error(error);
      alert('Error al cargar datos del préstamo');
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !id) return;

    try {
      await addDoc(collection(db, 'loanNotes'), {
        loanId: id,
        content: newNote,
        createdBy: user?.email || 'Sistema',
        createdAt: new Date().toISOString()
      });
      
      setNewNote('');
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Error al añadir nota');
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!id || !loan) return;
    try {
      await updateDoc(doc(db, 'loans', id), { status: newStatus });
      
      await addDoc(collection(db, 'loanHistory'), {
        loanId: id,
        action: 'Cambio de Estado',
        details: `Estado cambiado de ${loan.status} a ${newStatus}`,
        createdBy: user?.email || 'Sistema',
        createdAt: new Date().toISOString()
      });

      fetchData();
    } catch (error) {
      console.error(error);
      alert('Error al actualizar estado');
    }
  };

  const handleSaveEdits = async () => {
    if (!id || !loan) return;
    try {
      const changes: string[] = [];
      if (editData.amount !== loan.amount) changes.push(`Monto: ${loan.amount} -> ${editData.amount}`);
      if (editData.interestRate !== loan.interestRate) changes.push(`Interés: ${loan.interestRate}% -> ${editData.interestRate}%`);
      if (editData.time !== loan.time) changes.push(`Tiempo: ${loan.time} -> ${editData.time}`);
      if (editData.graceDays !== loan.graceDays) changes.push(`Días de gracia: ${loan.graceDays} -> ${editData.graceDays}`);

      if (changes.length > 0) {
        await updateDoc(doc(db, 'loans', id), {
          amount: Number(editData.amount),
          interestRate: Number(editData.interestRate),
          time: Number(editData.time),
          graceDays: Number(editData.graceDays)
        });

        await addDoc(collection(db, 'loanHistory'), {
          loanId: id,
          action: 'Modificación de Datos',
          details: `Se modificaron los siguientes campos:\n${changes.join('\n')}`,
          createdBy: user?.email || 'Sistema',
          createdAt: new Date().toISOString()
        });
      }

      setIsEditing(false);
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Error al guardar cambios');
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

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando detalles...</div>;
  if (!loan) return <div className="p-8 text-center text-slate-500">Préstamo no encontrado</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/admin/loans')} className="text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Detalles del Préstamo</h2>
            <p className="text-sm text-slate-500 mt-1">ID: {loan.id}</p>
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
          <select 
            value={loan.status}
            onChange={(e) => handleUpdateStatus(e.target.value)}
            className="input-modern py-2"
          >
            <option value="pendiente">Pendiente</option>
            <option value="analisis">En Análisis</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
            <option value="desembolsado">Desembolsado</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="card-modern p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                <User size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{loan.clientName}</h3>
                <p className="text-sm text-slate-500">{client?.documentId}</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Teléfono</span>
                <span className="font-medium text-slate-900">{client?.phone}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Email</span>
                <span className="font-medium text-slate-900">{client?.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Estado Actual</span>
                <span>{getStatusBadge(loan.status)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Fecha Solicitud</span>
                <span className="font-medium text-slate-900">{new Date(loan.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="card-modern p-6">
            <h3 className="font-bold text-slate-900 mb-4">Estado del Contrato</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${loan.contractPrepared ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  <FileText size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Preparación</p>
                  <p className="text-xs text-slate-500">{loan.contractPrepared ? 'Contrato preparado por Admin' : 'Pendiente de preparación'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${loan.contractSigned ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  <FileText size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-900">Firma del Cliente</p>
                  <p className="text-xs text-slate-500">{loan.contractSigned ? `Firmado el ${new Date(loan.contractSignedAt).toLocaleDateString()}` : 'Pendiente de firma'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card-modern overflow-hidden">
            <div className="flex border-b border-slate-200">
              <button 
                onClick={() => setActiveTab('details')}
                className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'details' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Detalles Financieros
              </button>
              <button 
                onClick={() => setActiveTab('amortizacion')}
                className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'amortizacion' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Amortización
              </button>
              <button 
                onClick={() => setActiveTab('notes')}
                className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'notes' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Notas ({notes.length})
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'history' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Historial
              </button>
              <button 
                onClick={() => setActiveTab('expediente')}
                className={`flex-1 py-4 text-sm font-medium text-center transition-colors ${activeTab === 'expediente' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Expediente
              </button>
            </div>

            <div className="p-6">
              {activeTab === 'details' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900">Condiciones del Préstamo</h3>
                    {!isEditing ? (
                      <button onClick={() => setIsEditing(true)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                        Modificar Condiciones
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => { setIsEditing(false); setEditData(loan); }} className="text-slate-500 hover:text-slate-700 text-sm font-medium">
                          Cancelar
                        </button>
                        <button onClick={handleSaveEdits} className="text-emerald-600 hover:text-emerald-800 text-sm font-medium flex items-center">
                          <Save size={16} className="mr-1" /> Guardar
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Tipo de Préstamo</label>
                      <p className="text-slate-900 font-medium">{loan.loanTypeName}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Frecuencia de Pago</label>
                      <p className="text-slate-900 font-medium capitalize">{loan.frequency || loanType?.frequency || 'Mensual'}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Monto Solicitado</label>
                      {isEditing ? (
                        <input type="number" value={editData.amount} onChange={e => setEditData({...editData, amount: e.target.value})} className="input-modern" />
                      ) : (
                        <p className="text-slate-900 font-medium text-lg">${loan.amount.toLocaleString()}</p>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Tasa de Interés (%)</label>
                      {isEditing ? (
                        <input type="number" step="0.1" value={editData.interestRate} onChange={e => setEditData({...editData, interestRate: e.target.value})} className="input-modern" />
                      ) : (
                        <p className="text-slate-900 font-medium">{loan.interestRate}%</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Tiempo (Cuotas)</label>
                      {isEditing ? (
                        <input type="number" value={editData.time} onChange={e => setEditData({...editData, time: e.target.value})} className="input-modern" />
                      ) : (
                        <p className="text-slate-900 font-medium">{loan.time}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Días de Gracia</label>
                      {isEditing ? (
                        <input type="number" value={editData.graceDays} onChange={e => setEditData({...editData, graceDays: e.target.value})} className="input-modern" />
                      ) : (
                        <p className="text-slate-900 font-medium">{loan.graceDays} días</p>
                      )}
                    </div>
                  </div>

                  {loan.guarantorId && (
                    <div className="mt-8 pt-6 border-t border-slate-100">
                      <h3 className="text-lg font-bold text-slate-900 mb-4">Garantía</h3>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <p className="text-sm text-slate-600 mb-2"><span className="font-medium text-slate-900">ID Garante:</span> {loan.guarantorId}</p>
                        {loan.guaranteeData && Object.entries(loan.guaranteeData).map(([key, value]) => (
                          <p key={key} className="text-sm text-slate-600"><span className="font-medium text-slate-900 capitalize">{key}:</span> {String(value)}</p>
                        ))}
                      </div>
                    </div>
                  )}
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

              {activeTab === 'notes' && (
                <div className="space-y-6">
                  <form onSubmit={handleAddNote} className="flex gap-3">
                    <input 
                      type="text" 
                      value={newNote} 
                      onChange={e => setNewNote(e.target.value)} 
                      placeholder="Escribe una nota sobre este préstamo..." 
                      className="input-modern flex-1"
                    />
                    <button type="submit" className="btn-primary whitespace-nowrap">
                      Añadir Nota
                    </button>
                  </form>

                  <div className="space-y-4">
                    {notes.length === 0 ? (
                      <p className="text-center text-slate-500 py-8">No hay notas registradas.</p>
                    ) : (
                      notes.map(note => (
                        <div key={note.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-slate-900 text-sm">{note.createdBy}</span>
                            <span className="text-xs text-slate-500">{new Date(note.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-slate-700 text-sm whitespace-pre-wrap">{note.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
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
                          <p className="text-xs text-slate-400 mt-1">Por: {item.createdBy}</p>
                        </div>
                      ))
                    )}
                    
                    {/* Initial Creation Event */}
                    <div className="relative pl-6">
                      <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-emerald-100 border-2 border-emerald-600"></div>
                      <div className="mb-1 flex justify-between items-center">
                        <h4 className="font-bold text-slate-900 text-sm">Préstamo Creado</h4>
                        <span className="text-xs text-slate-500">{new Date(loan.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-slate-600">Solicitud inicial registrada en el sistema.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'expediente' && (
                <div className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Expediente del Préstamo</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Foto de Cédula */}
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-900 mb-4 flex items-center">
                        <User size={18} className="mr-2 text-indigo-600" />
                        Documento de Identidad
                      </h4>
                      {loan.idPhotoBase64 ? (
                        <div className="relative group">
                          <img 
                            src={loan.idPhotoBase64} 
                            alt="Cédula del cliente" 
                            className="w-full h-auto rounded-lg border border-slate-200 shadow-sm"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all rounded-lg flex items-center justify-center">
                            <a 
                              href={loan.idPhotoBase64} 
                              download={`cedula_${loan.clientName.replace(/\s+/g, '_')}.png`}
                              className="opacity-0 group-hover:opacity-100 btn-secondary bg-white text-sm py-1.5 px-3"
                            >
                              Descargar
                            </a>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 italic">No se ha subido foto de cédula.</p>
                      )}
                    </div>

                    {/* Ubicación */}
                    <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-900 mb-4 flex items-center">
                        <Search size={18} className="mr-2 text-indigo-600" />
                        Ubicación al Firmar
                      </h4>
                      {loan.location ? (
                        <div className="space-y-4">
                          <div className="bg-white p-4 rounded-lg border border-slate-200">
                            <p className="text-sm text-slate-600"><span className="font-medium text-slate-900">Latitud:</span> {loan.location.lat}</p>
                            <p className="text-sm text-slate-600"><span className="font-medium text-slate-900">Longitud:</span> {loan.location.lng}</p>
                          </div>
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${loan.location.lat},${loan.location.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary w-full flex justify-center text-sm"
                          >
                            Ver en Google Maps
                          </a>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 italic">No se registró ubicación.</p>
                      )}
                    </div>

                    {/* Foto de Garantía */}
                    {loan.guarantorId && (
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
                              id="guaranteePhoto" 
                              className="hidden" 
                              onChange={handleGuaranteePhotoUpload}
                            />
                            <label htmlFor="guaranteePhoto" className="btn-secondary text-sm cursor-pointer">
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
                          <p className="text-sm text-slate-500 italic text-center py-8">No se ha subido foto de la garantía.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
