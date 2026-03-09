import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ArrowLeft, FileText, CheckCircle } from 'lucide-react';

export default function PrepareContract() {
  const { loanId } = useParams();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [contractTemplate, setContractTemplate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [adminFields, setAdminFields] = useState<string[]>([]);
  const [adminValues, setAdminValues] = useState<Record<string, string>>({});
  const [previewContent, setPreviewContent] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!loanId) return;
      try {
        const loanDoc = await getDoc(doc(db, 'loans', loanId));
        if (!loanDoc.exists()) throw new Error('Préstamo no encontrado');
        const loanData = loanDoc.data();
        setLoan({ id: loanDoc.id, ...loanData });

        const clientDoc = await getDoc(doc(db, 'clients', loanData.clientId));
        if (clientDoc.exists()) setClient(clientDoc.data());

        const q = query(collection(db, 'contracts'), where('loanTypeId', '==', loanData.loanTypeId));
        const contractSnap = await getDocs(q);
        
        if (!contractSnap.empty) {
          const templateDoc = contractSnap.docs[0];
          const template = { id: templateDoc.id, ...templateDoc.data() } as any;
          setContractTemplate(template);
          
          // Extract admin fields: [admin:FieldName] and [cliente:FieldName_Admin]
          const adminRegex = /\[admin:(.*?)\]|\[cliente:(.*?_Admin)\]/g;
          const matches = [...template.content.matchAll(adminRegex)];
          const fields = matches.map((m: any, index: number) => `${m[1] || m[2]}_${index}`);
          setAdminFields(fields);
          
          // Initialize values from existing contractData if any
          if (loanData.contractData?.adminValues) {
            setAdminValues(loanData.contractData.adminValues);
          }
        }
      } catch (error) {
        console.error(error);
        alert('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [loanId]);

  useEffect(() => {
    if (!contractTemplate || !loan || !client) return;

    let content = contractTemplate.content;
    
    // Replace system variables
    content = content.replace(/\{\{cliente_nombre\}\}/g, `${client.firstName} ${client.lastName}`);
    content = content.replace(/\{\{cliente_cedula\}\}/g, client.documentId);
    content = content.replace(/\{\{prestamo_monto\}\}/g, `$${loan.amount.toLocaleString()}`);
    content = content.replace(/\{\{fecha_actual\}\}/g, new Date().toLocaleDateString());

    // Replace client fields with disabled spans (excluding _Admin)
    let clientIndex = 0;
    content = content.replace(/\[cliente:(.*?)\]/g, (match, fieldName) => {
      if (fieldName.endsWith('_Admin')) return match; // Leave for admin replacement
      clientIndex++;
      return `<span class="inline-block min-w-[150px] border-b-2 border-slate-300 bg-slate-100 px-2 py-1 text-slate-500 cursor-not-allowed mx-1">${fieldName} (Cliente)</span>`;
    });

    // Replace admin fields with active contenteditable spans
    let adminIndex = 0;
    content = content.replace(/\[admin:(.*?)\]|\[cliente:(.*?_Admin)\]/g, (match, g1, g2) => {
      const fieldName = g1 || g2;
      const uniqueFieldId = `${fieldName}_${adminIndex++}`;
      const value = adminValues[uniqueFieldId] || '';
      return `<span contenteditable="true" data-admin-field="${uniqueFieldId}" data-placeholder="${fieldName}" class="inline-block min-w-[150px] border-b-2 border-indigo-500 bg-indigo-50 px-2 py-1 text-indigo-900 focus:outline-none focus:border-indigo-700 focus:bg-indigo-100 transition-colors mx-1 empty:before:content-[attr(data-placeholder)] empty:before:text-indigo-300 cursor-text">${value}</span>`;
    });

    setPreviewContent(content);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractTemplate, loan, client, adminFields]);

  useEffect(() => {
    if (containerRef.current && previewContent && !containerRef.current.innerHTML) {
      containerRef.current.innerHTML = previewContent;
    }
  }, [previewContent]);

  const handleContainerInput = (e: React.FormEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const span = target.closest('span[data-admin-field]') as HTMLElement;
    if (span && span.dataset.adminField) {
      const field = span.dataset.adminField;
      const val = span.innerText;
      setAdminValues(prev => ({ ...prev, [field]: val }));
    }
  };

  const handleSave = async () => {
    try {
      // Harvest latest values from DOM to ensure we capture all contenteditable changes
      const container = document.querySelector('.prose');
      const currentValues = { ...adminValues };
      if (container) {
        const spans = container.querySelectorAll('span[data-admin-field]');
        spans.forEach(span => {
          const field = (span as HTMLElement).dataset.adminField;
          if (field) {
            currentValues[field] = (span as HTMLElement).innerText.trim();
          }
        });
      }

      await updateDoc(doc(db, 'loans', loanId!), {
        contractPrepared: true,
        'contractData.adminValues': currentValues,
        'contractData.templateId': contractTemplate.id
      });

      alert('Contrato preparado exitosamente. El cliente ya puede firmarlo.');
      navigate('/admin/loans');
    } catch (error: any) {
      alert('Error al guardar: ' + error.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando...</div>;

  if (!contractTemplate) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-slate-900 mb-2">No hay plantilla de contrato</h2>
        <p className="text-slate-500 mb-4">No se ha configurado una plantilla de contrato para este tipo de préstamo.</p>
        <button onClick={() => navigate('/admin/loans')} className="btn-secondary">Volver a Préstamos</button>
      </div>
    );
  }

  const allAdminFieldsFilled = adminFields.length === 0 || adminFields.every(field => adminValues[field] && adminValues[field].trim() !== '');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/admin/loans')} className="text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Preparar Contrato</h2>
          <p className="text-sm text-slate-500 mt-1">Completa los campos administrativos antes de enviar al cliente.</p>
        </div>
      </div>

      <div className="card-modern p-8">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <h3 className="text-lg font-bold text-slate-900">Documento del Contrato</h3>
          <button 
            onClick={handleSave} 
            className="btn-primary flex items-center bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle size={20} className="mr-2" />
            Marcar como Listo para Firma
          </button>
        </div>
        
        {adminFields.length > 0 && (
          <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg flex items-start">
            <FileText size={20} className="text-indigo-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-indigo-900">Campos requeridos</h4>
              <p className="text-sm text-indigo-700 mt-1">
                Por favor, completa los campos resaltados en el documento a continuación antes de guardar.
              </p>
            </div>
          </div>
        )}

        <div 
          ref={containerRef}
          className="prose prose-slate max-w-none prose-p:leading-relaxed prose-headings:text-slate-900 bg-white p-6 rounded-lg border border-slate-200"
          onInput={handleContainerInput}
        />
      </div>
    </div>
  );
}
