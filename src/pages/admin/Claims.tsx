import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { MessageSquare, Clock, CheckCircle, Search, X } from 'lucide-react';

export default function AdminClaims() {
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedClaim, setSelectedClaim] = useState<any>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const snap = await getDocs(collection(db, 'claims'));
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

  const handleResponseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responseMessage || !selectedClaim) return;

    setSubmitting(true);
    try {
      const claimRef = doc(db, 'claims', selectedClaim.id);
      await updateDoc(claimRef, {
        status: 'resuelto',
        responses: arrayUnion({
          message: responseMessage,
          createdAt: new Date().toISOString()
        })
      });
      
      setSelectedClaim(null);
      setResponseMessage('');
      fetchData();
    } catch (error) {
      console.error(error);
      alert('Error al enviar respuesta');
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

  const filteredClaims = claims.filter(c => 
    (c.clientEmail || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.subject || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center text-slate-500">Cargando reclamaciones...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Reclamaciones</h2>
          <p className="text-sm text-slate-500 mt-1">Gestiona y responde las solicitudes de soporte de los clientes.</p>
        </div>
      </div>

      <div className="card-modern">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por cliente o asunto..."
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
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Asunto</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredClaims.map((claim) => (
                <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    {new Date(claim.createdAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{claim.clientEmail}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{claim.subject}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(claim.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => setSelectedClaim(claim)}
                      className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end transition-colors"
                      title="Ver Detalles"
                    >
                      <MessageSquare size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredClaims.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No se encontraron reclamaciones.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedClaim && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                Detalles de Reclamación
              </h3>
              <button onClick={() => setSelectedClaim(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-bold text-slate-900">{selectedClaim.subject}</p>
                  <span className="text-xs text-slate-500">{new Date(selectedClaim.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-slate-500 mb-2">De: {selectedClaim.clientEmail}</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap mt-4">{selectedClaim.description}</p>
              </div>

              {selectedClaim.responses && selectedClaim.responses.length > 0 && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Respuestas Anteriores</h4>
                  {selectedClaim.responses.map((resp: any, idx: number) => (
                    <div key={idx} className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 ml-8">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-indigo-900">Soporte Adonai</span>
                        <span className="text-xs text-indigo-400">{new Date(resp.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-indigo-800 whitespace-pre-wrap">{resp.message}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedClaim.status === 'abierto' && (
                <form onSubmit={handleResponseSubmit} className="space-y-4 pt-4 border-t border-slate-100">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Responder y Resolver</label>
                    <textarea 
                      required 
                      value={responseMessage} 
                      onChange={e => setResponseMessage(e.target.value)} 
                      rows={4} 
                      className="input-modern resize-none" 
                      placeholder="Escribe tu respuesta al cliente..." 
                    />
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setSelectedClaim(null)} className="flex-1 btn-secondary">
                      Cancelar
                    </button>
                    <button type="submit" disabled={submitting} className="flex-1 btn-primary disabled:opacity-50">
                      {submitting ? 'Enviando...' : 'Enviar Respuesta'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
