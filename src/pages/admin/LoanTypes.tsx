import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

interface LoanType {
  id: string;
  name: string;
  minTime: number;
  maxTime: number;
  frequency: string;
  minInterest: number;
  maxInterest: number;
  lateFeePercentage: number; // Nuevo campo: % de mora
  isActive: boolean;
}

export default function LoanTypes() {
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    minTime: 1,
    maxTime: 12,
    frequency: 'mensual',
    minInterest: 1,
    maxInterest: 5,
    lateFeePercentage: 0,
    isActive: true
  });

  const frequencies = ['diario', 'semanal', 'quincenal', 'catorcenal', 'mensual', 'trimestral', 'semestral', 'anual'];

  const fetchLoanTypes = async () => {
    const querySnapshot = await getDocs(collection(db, 'loanTypes'));
    const types: LoanType[] = [];
    querySnapshot.forEach((doc) => {
      types.push({ id: doc.id, ...doc.data() } as LoanType);
    });
    setLoanTypes(types);
  };

  useEffect(() => {
    fetchLoanTypes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateDoc(doc(db, 'loanTypes', editingId), formData);
    } else {
      await addDoc(collection(db, 'loanTypes'), formData);
    }
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: '', minTime: 1, maxTime: 12, frequency: 'mensual', minInterest: 1, maxInterest: 5, lateFeePercentage: 0, isActive: true });
    fetchLoanTypes();
  };

  const handleEdit = (type: LoanType) => {
    setFormData({
      name: type.name,
      minTime: type.minTime,
      maxTime: type.maxTime,
      frequency: type.frequency,
      minInterest: type.minInterest,
      maxInterest: type.maxInterest,
      lateFeePercentage: type.lateFeePercentage || 0,
      isActive: type.isActive
    });
    setEditingId(type.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este tipo de préstamo?')) {
      await deleteDoc(doc(db, 'loanTypes', id));
      fetchLoanTypes();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Tipos de Préstamos</h2>
          <p className="text-sm text-slate-500 mt-1">Gestiona las configuraciones de los préstamos disponibles.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', minTime: 1, maxTime: 12, frequency: 'mensual', minInterest: 1, maxInterest: 5, lateFeePercentage: 0, isActive: true });
            setIsModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus size={20} className="mr-2" />
          <span>Nuevo Tipo</span>
        </button>
      </div>

      <div className="card-modern">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tiempo (Min-Max)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Frecuencia</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Interés (%)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Mora (%)</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loanTypes.map((type) => (
                <tr key={type.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{type.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{type.minTime} - {type.maxTime} meses</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 capitalize">{type.frequency}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{type.minInterest}% - {type.maxInterest}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{type.lateFeePercentage || 0}%</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${type.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'}`}>
                      {type.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => handleEdit(type)} className="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDelete(type.id)} className="text-red-500 hover:text-red-700 transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {loanTypes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">No hay tipos de préstamos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 sm:p-8 transform transition-all">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                {editingId ? 'Editar Tipo de Préstamo' : 'Nuevo Tipo de Préstamo'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-modern" placeholder="Ej: Préstamo Personal" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tiempo Mínimo</label>
                  <input type="number" required min="1" value={formData.minTime} onChange={e => setFormData({...formData, minTime: Number(e.target.value)})} className="input-modern" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tiempo Máximo</label>
                  <input type="number" required min="1" value={formData.maxTime} onChange={e => setFormData({...formData, maxTime: Number(e.target.value)})} className="input-modern" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Frecuencia de Pago</label>
                <select value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value})} className="input-modern">
                  {frequencies.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interés Mínimo (%)</label>
                  <input type="number" required min="0" step="0.1" value={formData.minInterest} onChange={e => setFormData({...formData, minInterest: Number(e.target.value)})} className="input-modern" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interés Máximo (%)</label>
                  <input type="number" required min="0" step="0.1" value={formData.maxInterest} onChange={e => setFormData({...formData, maxInterest: Number(e.target.value)})} className="input-modern" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Porcentaje de Mora (%)</label>
                <input type="number" required min="0" step="0.1" value={formData.lateFeePercentage} onChange={e => setFormData({...formData, lateFeePercentage: Number(e.target.value)})} className="input-modern" placeholder="Ej: 5" />
                <p className="text-xs text-slate-500 mt-1">Se aplicará después de los días de gracia.</p>
              </div>
              <div className="flex items-center pt-2">
                <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded" />
                <label htmlFor="isActive" className="ml-3 block text-sm font-medium text-slate-900">Disponible para utilizarse</label>
              </div>
              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
