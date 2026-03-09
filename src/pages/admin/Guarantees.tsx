import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Plus, Edit2, Trash2, X } from 'lucide-react';

interface GuaranteeType {
  id: string;
  name: string;
  description: string;
  requiredFields: string[];
}

export default function Guarantees() {
  const [guaranteeTypes, setGuaranteeTypes] = useState<GuaranteeType[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    requiredFields: [] as string[]
  });
  const [newField, setNewField] = useState('');

  const fetchGuaranteeTypes = async () => {
    const querySnapshot = await getDocs(collection(db, 'guaranteeTypes'));
    const types: GuaranteeType[] = [];
    querySnapshot.forEach((doc) => {
      types.push({ id: doc.id, ...doc.data() } as GuaranteeType);
    });
    setGuaranteeTypes(types);
  };

  useEffect(() => {
    fetchGuaranteeTypes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await updateDoc(doc(db, 'guaranteeTypes', editingId), formData);
    } else {
      await addDoc(collection(db, 'guaranteeTypes'), formData);
    }
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: '', description: '', requiredFields: [] });
    fetchGuaranteeTypes();
  };

  const handleEdit = (type: GuaranteeType) => {
    setFormData({
      name: type.name,
      description: type.description,
      requiredFields: type.requiredFields || []
    });
    setEditingId(type.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este tipo de garantía?')) {
      await deleteDoc(doc(db, 'guaranteeTypes', id));
      fetchGuaranteeTypes();
    }
  };

  const addField = () => {
    if (newField.trim() && !formData.requiredFields.includes(newField.trim())) {
      setFormData({
        ...formData,
        requiredFields: [...formData.requiredFields, newField.trim()]
      });
      setNewField('');
    }
  };

  const removeField = (fieldToRemove: string) => {
    setFormData({
      ...formData,
      requiredFields: formData.requiredFields.filter(f => f !== fieldToRemove)
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Tipos de Garantías</h2>
          <p className="text-sm text-slate-500 mt-1">Configura los tipos de garantías aceptadas y sus requisitos.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', description: '', requiredFields: [] });
            setIsModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus size={20} className="mr-2" />
          <span>Nueva Garantía</span>
        </button>
      </div>

      <div className="card-modern">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Descripción</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Campos Requeridos</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {guaranteeTypes.map((type) => (
                <tr key={type.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{type.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">{type.description}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <div className="flex flex-wrap gap-1">
                      {type.requiredFields?.map(field => (
                        <span key={field} className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-medium">
                          {field}
                        </span>
                      ))}
                      {(!type.requiredFields || type.requiredFields.length === 0) && (
                        <span className="text-slate-400 italic">Ninguno</span>
                      )}
                    </div>
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
              {guaranteeTypes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No hay tipos de garantías registrados.</td>
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
                {editingId ? 'Editar Garantía' : 'Nueva Garantía'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-modern" placeholder="Ej: Vehículo" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} className="input-modern resize-none" placeholder="Descripción de la garantía..." />
              </div>
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <label className="block text-sm font-bold text-slate-900 mb-2">Campos Requeridos</label>
                <p className="text-xs text-slate-500 mb-3">Añade los campos que el usuario deberá llenar al elegir esta garantía (ej: Marca, Modelo, Chasis).</p>
                
                <div className="flex gap-2 mb-4">
                  <input 
                    type="text" 
                    value={newField} 
                    onChange={e => setNewField(e.target.value)} 
                    onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), addField())}
                    className="input-modern mt-0" 
                    placeholder="Nombre del campo" 
                  />
                  <button type="button" onClick={addField} className="btn-secondary px-3">
                    Añadir
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.requiredFields.map(field => (
                    <div key={field} className="flex justify-between items-center bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-sm">
                      <span className="text-sm font-medium text-slate-700">{field}</span>
                      <button type="button" onClick={() => removeField(field)} className="text-red-500 hover:text-red-700 transition-colors">
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  {formData.requiredFields.length === 0 && (
                    <p className="text-sm text-slate-400 italic text-center py-2">No hay campos requeridos definidos.</p>
                  )}
                </div>
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
