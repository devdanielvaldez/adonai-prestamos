import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Plus, Edit2, Trash2, X, Search } from 'lucide-react';

interface Guarantor {
  id: string;
  firstName: string;
  lastName: string;
  documentId: string;
  phone: string;
  address: string;
  employer: string;
  salary: number;
  createdAt: Date;
}

export default function Guarantors() {
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const initialFormState = {
    firstName: '',
    lastName: '',
    documentId: '',
    phone: '',
    address: '',
    employer: '',
    salary: 0,
  };
  
  const [formData, setFormData] = useState(initialFormState);

  const fetchGuarantors = async () => {
    const querySnapshot = await getDocs(collection(db, 'guarantors'));
    const data: Guarantor[] = [];
    querySnapshot.forEach((doc) => {
      data.push({ id: doc.id, ...doc.data() } as Guarantor);
    });
    setGuarantors(data);
  };

  useEffect(() => {
    fetchGuarantors();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, 'guarantors', editingId), formData);
      } else {
        await addDoc(collection(db, 'guarantors'), {
          ...formData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData(initialFormState);
      fetchGuarantors();
    } catch (error: any) {
      alert('Error al guardar garante: ' + error.message);
    }
  };

  const handleEdit = (guarantor: Guarantor) => {
    setFormData({
      firstName: guarantor.firstName,
      lastName: guarantor.lastName,
      documentId: guarantor.documentId,
      phone: guarantor.phone,
      address: guarantor.address,
      employer: guarantor.employer,
      salary: guarantor.salary
    });
    setEditingId(guarantor.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este garante?')) {
      await deleteDoc(doc(db, 'guarantors', id));
      fetchGuarantors();
    }
  };

  const filteredGuarantors = guarantors.filter(g => 
    g.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.documentId.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Garantes</h2>
          <p className="text-sm text-slate-500 mt-1">Directorio de garantes disponibles para préstamos.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData(initialFormState);
            setIsModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus size={20} className="mr-2" />
          <span>Nuevo Garante</span>
        </button>
      </div>

      <div className="card-modern">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre, apellido o documento..."
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
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre Completo</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Documento</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Teléfono</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Empleador / Salario</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredGuarantors.map((guarantor) => (
                <tr key={guarantor.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                    {guarantor.firstName} {guarantor.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{guarantor.documentId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{guarantor.phone}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-slate-900">{guarantor.employer}</div>
                    <div className="text-sm text-slate-500">${guarantor.salary.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => handleEdit(guarantor)} className="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(guarantor.id)} className="text-red-500 hover:text-red-700 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredGuarantors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No se encontraron garantes.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                {editingId ? 'Editar Garante' : 'Nuevo Garante'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombres</label>
                  <input type="text" required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="input-modern" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Apellidos</label>
                  <input type="text" required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="input-modern" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Documento de Identidad</label>
                  <input type="text" required value={formData.documentId} onChange={e => setFormData({...formData, documentId: e.target.value})} className="input-modern" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                  <input type="tel" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="input-modern" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                  <input type="text" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="input-modern" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Empresa / Empleador</label>
                  <input type="text" required value={formData.employer} onChange={e => setFormData({...formData, employer: e.target.value})} className="input-modern" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Salario Mensual</label>
                  <input type="number" required min="0" value={formData.salary} onChange={e => setFormData({...formData, salary: Number(e.target.value)})} className="input-modern" />
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  Guardar Garante
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
