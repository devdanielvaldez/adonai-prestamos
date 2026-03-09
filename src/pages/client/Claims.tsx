import React, { useState, useEffect } from 'react';
import { db, auth } from '../../firebase';
import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { Plus, MessageSquare, Clock, CheckCircle, X } from 'lucide-react';

export default function ClientClaims() {
  const [claims, setClaims] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, 'claims'), 
        where('clientId', '==', auth.currentUser.uid)
      );
      const snap = await getDocs(q);
      setClaims(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !description) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'claims'), {
        clientId: auth.currentUser?.uid,
        clientEmail: auth.currentUser?.email,
        subject,
        description,
        status: 'abierto',
        createdAt: new Date().toISOString(),
        responses: []
      });
      
      setIsModalOpen(false);
      setSubject('');
      setDescription('');
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Error al enviar reclamación');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'abierto': return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold flex items-center w-max"><Clock size={12} className="mr-1.5"/> Abierto</span>;
      case 'resuelto': return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold flex items-center w-max"><CheckCircle size={12} className="mr-1.5"/> Resuelto</span>;
      default: return null;
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando reclamaciones...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Reclamaciones y Soporte</h2>
          <p className="text-sm text-slate-500 mt-1">Envía tus dudas o problemas y te responderemos a la brevedad.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="btn-primary"
        >
          <Plus size={20} className="mr-2" />
          <span>Nueva Reclamación</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {claims.length === 0 ? (
          <div className="card-modern p-12 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No tienes reclamaciones</h3>
            <p className="text-slate-500 mt-1">Si tienes algún problema, no dudes en crear una nueva reclamación.</p>
          </div>
        ) : (
          claims.map(claim => (
            <div key={claim.id} className="card-modern p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{claim.subject}</h3>
                  <p className="text-xs text-slate-500 mt-1">{new Date(claim.createdAt).toLocaleString()}</p>
                </div>
                {getStatusBadge(claim.status)}
              </div>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{claim.description}</p>
              </div>

              {claim.responses && claim.responses.length > 0 && (
                <div className="mt-6 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">Respuestas</h4>
                  {claim.responses.map((resp: any, idx: number) => (
                    <div key={idx} className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 ml-4 md:ml-8">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-indigo-900">Soporte Adonai</span>
                        <span className="text-xs text-indigo-400">{new Date(resp.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-indigo-800 whitespace-pre-wrap">{resp.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Nueva Reclamación
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asunto</label>
                <input 
                  type="text" 
                  required 
                  value={subject} 
                  onChange={e => setSubject(e.target.value)} 
                  className="input-modern" 
                  placeholder="Ej: Problema con mi pago"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea 
                  required 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  rows={5} 
                  className="input-modern resize-none" 
                  placeholder="Describe tu problema con detalle..." 
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="flex-1 btn-primary disabled:opacity-50">
                  {submitting ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
