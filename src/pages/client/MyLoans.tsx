import React, { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { FileSignature, CheckCircle, Clock, AlertCircle, Banknote, Download, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { generateLoanDocumentation } from '../../utils/pdfGenerator';

export default function MyLoans() {
  const [loans, setLoans] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;

      try {
        const q = query(collection(db, 'loans'), where('clientId', '==', auth.currentUser.uid));
        const loansSnap = await getDocs(q);
        const loansData = loansSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        const contractsSnap = await getDocs(collection(db, 'contracts'));
        const contractsData = contractsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

        setLoans(loansData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setContracts(contractsData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleDownloadDocs = async (loanId: string) => {
    setDownloadingId(loanId);
    await generateLoanDocumentation(loanId);
    setDownloadingId(null);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64 text-slate-500">Cargando préstamos...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Mis Préstamos</h2>
        <p className="text-sm text-slate-500 mt-1">Historial y estado de todas tus solicitudes.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {loans.map(loan => {
          const contract = contracts.find(c => c.loanTypeId === loan.loanTypeId);
          const needsSignature = loan.status === 'aprobado' && contract && loan.contractPrepared && !loan.contractSigned;

          return (
            <div key={loan.id} className="card-modern p-6 hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-slate-900">{loan.loanTypeName}</h3>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize
                      ${loan.status === 'aprobado' ? 'bg-emerald-100 text-emerald-800' : 
                        loan.status === 'rechazado' ? 'bg-red-100 text-red-800' : 
                        'bg-amber-100 text-amber-800'}`}>
                      {loan.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mt-4">
                    <div>
                      <p className="text-slate-500">Monto</p>
                      <p className="font-bold text-slate-900">${loan.amount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Tiempo</p>
                      <p className="font-medium text-slate-900">{loan.time} periodos</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Tasa</p>
                      <p className="font-medium text-slate-900">{loan.interestRate}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Fecha</p>
                      <p className="font-medium text-slate-900">{new Date(loan.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-auto flex flex-col items-end gap-3 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                  {needsSignature ? (
                    <div className="text-right w-full">
                      <p className="text-xs font-medium text-amber-600 mb-2 flex items-center justify-end">
                        <AlertCircle size={14} className="mr-1" /> Requiere tu firma
                      </p>
                      <Link 
                        to={`/sign-contract/${loan.id}/${contract.id}`}
                        className="btn-primary w-full md:w-auto bg-emerald-600 hover:bg-emerald-700"
                      >
                        <FileSignature size={18} className="mr-2" />
                        Firmar Contrato
                      </Link>
                    </div>
                  ) : loan.contractSigned ? (
                    <div className="text-right w-full flex flex-col items-end gap-2">
                      <p className="text-sm font-medium text-emerald-600 flex items-center justify-end">
                        <CheckCircle size={16} className="mr-1.5" /> Contrato Firmado
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <Link 
                          to={`/client/view-contract/${loan.id}`}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Ver Contrato
                        </Link>
                        <button
                          onClick={() => handleDownloadDocs(loan.id)}
                          disabled={downloadingId === loan.id}
                          className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center"
                        >
                          <Download size={14} className="mr-1" />
                          {downloadingId === loan.id ? 'Descargando...' : 'Descargar Todo'}
                        </button>
                      </div>
                    </div>
                  ) : loan.status === 'aprobado' ? (
                    <div className="text-right w-full">
                      <p className="text-sm font-medium text-slate-500 flex items-center justify-end">
                        <Clock size={16} className="mr-1.5" /> Esperando contrato
                      </p>
                    </div>
                  ) : null}
                  
                  {(!loan.contractSigned && loan.status !== 'aprobado') && (
                    <div className="text-right w-full">
                      <button
                        onClick={() => handleDownloadDocs(loan.id)}
                        disabled={downloadingId === loan.id}
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium flex items-center justify-end w-full mt-2"
                      >
                        <Download size={14} className="mr-1" />
                        {downloadingId === loan.id ? 'Descargando...' : 'Descargar Documentación'}
                      </button>
                    </div>
                  )}

                  <div className="text-right w-full mt-2">
                    <Link 
                      to={`/client/loans/${loan.id}`}
                      className="btn-secondary w-full md:w-auto text-xs py-1.5 px-3 flex justify-center items-center"
                    >
                      <Search size={14} className="mr-1.5" />
                      Ver Detalles y Pagos
                    </Link>
                  </div>
                </div>

              </div>
            </div>
          );
        })}

        {loans.length === 0 && (
          <div className="card-modern p-12 text-center">
            <Banknote className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No tienes préstamos</h3>
            <p className="text-slate-500 mt-1">Aún no has solicitado ningún préstamo con nosotros.</p>
          </div>
        )}
      </div>
    </div>
  );
}
