import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Printer } from 'lucide-react';

export default function ClientViewContract() {
  const { loanId } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [contractTemplate, setContractTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [previewContent, setPreviewContent] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) {
        navigate('/login');
        return;
      }

      if (!loanId) return;
      try {
        const loanDoc = await getDoc(doc(db, 'loans', loanId));
        if (!loanDoc.exists()) throw new Error('Préstamo no encontrado');
        const loanData = loanDoc.data();
        
        if (loanData.clientId !== auth.currentUser.uid) {
          throw new Error('No tienes permiso para ver este contrato');
        }

        setLoan({ id: loanDoc.id, ...loanData });

        const clientDoc = await getDoc(doc(db, 'clients', loanData.clientId));
        if (clientDoc.exists()) setClient(clientDoc.data());

        if (loanData.contractData?.templateId) {
          const templateDoc = await getDoc(doc(db, 'contracts', loanData.contractData.templateId));
          if (templateDoc.exists()) {
            setContractTemplate(templateDoc.data());
          }
        }
      } catch (error: any) {
        console.error(error);
        alert(error.message || 'Error al cargar datos');
        navigate('/client/my-loans');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [loanId, navigate]);

  useEffect(() => {
    if (!contractTemplate || !loan || !client) return;

    let content = contractTemplate.content;
    const contractData = loan.contractData || {};
    
    // Replace system variables
    content = content.replace(/\{\{cliente_nombre\}\}/g, `${client.firstName} ${client.lastName}`);
    content = content.replace(/\{\{cliente_cedula\}\}/g, client.documentId);
    content = content.replace(/\{\{prestamo_monto\}\}/g, `$${loan.amount.toLocaleString()}`);
    content = content.replace(/\{\{fecha_actual\}\}/g, new Date(loan.contractSignedAt || loan.createdAt).toLocaleDateString());

    // Replace client fields
    const clientValues = contractData.clientValues || {};
    let clientIndex = 0;
    content = content.replace(/\[cliente:(.*?)\]/g, (match, fieldName) => {
      if (fieldName.endsWith('_Admin')) return match; // Leave for admin replacement
      const uniqueFieldId = `${fieldName}_${clientIndex++}`;
      const val = clientValues[uniqueFieldId] || '';
      return `<span class="inline-block min-w-[150px] border-b-2 border-slate-300 bg-slate-100 px-2 py-1 text-slate-700 mx-1 font-bold">${val}</span>`;
    });

    // Replace admin fields
    const adminValues = contractData.adminValues || {};
    let adminIndex = 0;
    content = content.replace(/\[admin:(.*?)\]|\[cliente:(.*?_Admin)\]/g, (match, g1, g2) => {
      const fieldName = g1 || g2;
      const uniqueFieldId = `${fieldName}_${adminIndex++}`;
      const val = adminValues[uniqueFieldId] || '';
      return `<span class="inline-block min-w-[150px] border-b-2 border-slate-300 bg-slate-100 px-2 py-1 text-slate-700 mx-1 font-bold">${val}</span>`;
    });

    // Replace signatures
    const signatures = contractData.signatures || {};
    let sigIndex = 0;
    content = content.replace(/\[firma:(.*?)\]/g, (match, fieldName) => {
      const uniqueFieldId = `${fieldName}_${sigIndex++}`;
      const sigData = signatures[uniqueFieldId];
      if (sigData) {
        return `<div class="mt-4"><img src="${sigData}" alt="Firma ${fieldName}" class="max-h-24 border-b border-slate-300" /><p class="text-xs text-slate-500 mt-1">${fieldName}</p></div>`;
      }
      return `<span class="italic text-slate-400">[Firma no encontrada: ${fieldName}]</span>`;
    });

    setPreviewContent(content);
  }, [contractTemplate, loan, client]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando...</div>;

  if (!contractTemplate || !loan?.contractSigned) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Contrato no disponible</h2>
        <p className="text-slate-500 mb-4">El contrato no ha sido firmado o no se encontró la plantilla.</p>
        <button onClick={() => navigate('/client/my-loans')} className="btn-secondary">Volver a Mis Préstamos</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto print:max-w-none print:m-0 print:p-0">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/client/my-loans')} className="text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Contrato Firmado</h2>
            <p className="text-sm text-slate-500 mt-1">
              Firmado el {new Date(loan.contractSignedAt).toLocaleString()}
            </p>
          </div>
        </div>
        <button onClick={handlePrint} className="btn-secondary">
          <Printer size={18} className="mr-2" />
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="card-modern p-8 md:p-12 print:shadow-none print:border-none print:p-0 bg-white">
        <div 
          className="prose prose-slate max-w-none prose-p:leading-relaxed prose-headings:text-slate-900 print:prose-sm"
          dangerouslySetInnerHTML={{ __html: previewContent }}
        />
      </div>
    </div>
  );
}
