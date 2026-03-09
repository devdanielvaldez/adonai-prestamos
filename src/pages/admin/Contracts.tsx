import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Plus, Edit2, Trash2, X, FileText, Info } from 'lucide-react';
import Editor from 'react-simple-wysiwyg';

interface Contract {
  id: string;
  name: string;
  loanTypeId: string;
  content: string;
  createdAt: string;
}

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loanTypes, setLoanTypes] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    loanTypeId: '',
    content: ''
  });

  const fetchData = async () => {
    const [contractsSnap, typesSnap] = await Promise.all([
      getDocs(collection(db, 'contracts')),
      getDocs(collection(db, 'loanTypes'))
    ]);

    setContracts(contractsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Contract)));
    setLoanTypes(typesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const contractData = {
        ...formData,
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'contracts', editingId), contractData);
      } else {
        await addDoc(collection(db, 'contracts'), {
          ...contractData,
          createdAt: new Date().toISOString()
        });
      }

      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', loanTypeId: '', content: '' });
      fetchData();
    } catch (error: any) {
      alert('Error al guardar contrato: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar esta plantilla de contrato?')) {
      await deleteDoc(doc(db, 'contracts', id));
      fetchData();
    }
  };

  const insertTag = (tag: string) => {
    setFormData(prev => ({ ...prev, content: prev.content + ' ' + tag + ' ' }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Plantillas de Contratos</h2>
          <p className="text-sm text-slate-500 mt-1">Crea contratos dinámicos con campos rellenables y firmas.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', loanTypeId: '', content: '' });
            setIsModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus size={20} className="mr-2" />
          <span>Nueva Plantilla</span>
        </button>
      </div>

      <div className="card-modern">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo de Préstamo</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {contracts.map((contract) => {
                const loanType = loanTypes.find(t => t.id === contract.loanTypeId);
                return (
                  <tr key={contract.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{contract.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{loanType?.name || 'Desconocido'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => {
                        setEditingId(contract.id);
                        setFormData({ name: contract.name, loanTypeId: contract.loanTypeId, content: contract.content || '' });
                        setIsModalOpen(true);
                      }} className="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(contract.id)} className="text-red-500 hover:text-red-700 transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {contracts.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">No hay plantillas de contratos registradas.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                {editingId ? 'Editar Plantilla' : 'Nueva Plantilla'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de Plantilla</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-modern" placeholder="Ej: Contrato Préstamo Vehicular" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Préstamo Vinculado</label>
                  <select required value={formData.loanTypeId} onChange={e => setFormData({...formData, loanTypeId: e.target.value})} className="input-modern">
                    <option value="">Seleccione un tipo</option>
                    {loanTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <div className="flex items-start gap-3">
                  <Info className="text-indigo-600 mt-0.5" size={20} />
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-indigo-900 text-sm">Variables Dinámicas</h4>
                      <button 
                        type="button" 
                        onClick={() => {
                          if(window.confirm('¿Reemplazar el contenido actual con la plantilla de Pagaré Notarial?')) {
                            setFormData(prev => ({
                              ...prev,
                              content: `<p><strong>PAGARÉ NOTARIAL AUTÉNTICO</strong></p><p><strong>ACTO Número [admin:acto_numero] – FOLIO Número [admin:folio_numero]</strong></p><p>En la ciudad de San Francisco de Macorís, Provincia Duarte, República Dominicana, a los [admin:dia_emision] días del mes de [admin:mes_emision] del año [admin:anio_emision], por ante mí, LICDA. ALTAGRACIA YNES EULALIA HENRÍQUEZ PÉREZ, Abogada Notario Público de los del Número del Municipio de San Francisco de Macorís, miembro activo del Colegio Dominicano de Notarios, Inc., matrícula No. 2017, dominicana, mayor de edad, soltera, portadora de la cédula de identidad y electoral No. 056-0011415-0, con estudio profesional abierto en la calle Santa Ana No. 92, de esta ciudad, asistida de los testigos que al final serán nombrados;</p><p>COMPARECIERON libre y voluntariamente los señores:</p><p><strong>[admin:prestamista_nombre]</strong>, dominicano, mayor de edad, estado civil [admin:prestamista_estado_civil], ocupación [admin:prestamista_ocupacion], portador de la cédula de identidad y electoral No. [admin:prestamista_cedula], domiciliado y residente en la calle [admin:prestamista_calle], casa No. [admin:prestamista_casa], sector [admin:prestamista_sector], de la ciudad de San Francisco de Macorís, provincia Duarte, República Dominicana, Presidente y Propietario de la entidad de préstamos ADONAI MULTISERVICES LLC, con RNC No. [admin:prestamista_rnc]; y</p><p><strong>{{cliente_nombre}}</strong>, dominicano, mayor de edad, estado civil [cliente:estado_civil], ocupación [cliente:ocupacion], portador de la cédula de identidad y electoral No. {{cliente_cedula}}, domiciliado y residente en la calle [cliente:calle], casa No. [cliente:casa], sector [cliente:sector], San Francisco de Macorís, provincia Duarte, República Dominicana;</p><p>Personas a quienes conozco y quienes, bajo la fe del juramento, me declaran lo siguiente:</p><p><strong>PRIMERO</strong><br>Que el señor <strong>{{cliente_nombre}}</strong> reconoce ser deudor del señor <strong>[admin:prestamista_nombre]</strong> por la suma de [admin:monto_letras], CON 00/100 (RD$ {{prestamo_monto}}) MONEDA DE CURSO LEGAL.</p><p><strong>SEGUNDO</strong><br>Que se compromete y obliga a pagar en su totalidad dichos valores desde la fecha de la suscripción y firma del presente acto, de la siguiente forma:</p><p>Por la suma de [admin:monto_letras] PESOS DOMINICANOS CON 00/100 (RD$ {{prestamo_monto}})</p><p>Con un interés de un [admin:interes_porcentaje] % mensual, pagadero a partir del día [admin:dia_pago] del mes de [admin:mes_pago]</p><p>Con vencimiento en el mes de [admin:mes_vencimiento] del año [admin:anio_vencimiento].</p><p>Para garantía del pago de dichos valores, firman el presente acto auténtico como Pagaré Notarial, con la finalidad de que sea ejecutado de acuerdo con el Artículo 545 del Código de Procedimiento Civil.</p><p>El deudor acepta que en caso de incumplimiento de la obligación principal se aplique un interés mensual de un [admin:interes_mora] % hasta el pago total de la deuda.</p><p>Y leído el presente acto, las partes lo firman conjuntamente con la Notario actuante y los testigos instrumentales.</p><br><p><strong>{{cliente_nombre}}</strong><br>Deudor<br>[firma:Deudor]</p><br><p><strong>[admin:prestamista_nombre]</strong><br>Acreedor<br>[firma:Acreedor]</p><br><p><strong>LICDA. ALTAGRACIA YNES EULALIA HENRÍQUEZ PÉREZ</strong><br>Notario Público<br>[firma:Notario]</p>`
                            }));
                          }
                        }}
                        className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-md hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                      >
                        Cargar Plantilla Pagaré Notarial
                      </button>
                    </div>
                    <p className="text-xs text-indigo-700 mt-1">Usa estos botones para insertar campos que se llenarán automáticamente o que requerirán información del administrador o cliente.</p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <button type="button" onClick={() => insertTag('{{cliente_nombre}}')} className="text-xs bg-white border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-100">Nombre Cliente</button>
                      <button type="button" onClick={() => insertTag('{{cliente_cedula}}')} className="text-xs bg-white border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-100">Cédula Cliente</button>
                      <button type="button" onClick={() => insertTag('{{prestamo_monto}}')} className="text-xs bg-white border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-100">Monto Préstamo</button>
                      <button type="button" onClick={() => insertTag('{{fecha_actual}}')} className="text-xs bg-white border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-100">Fecha Actual</button>
                      <button type="button" onClick={() => insertTag('[admin:Campo_Admin]')} className="text-xs bg-amber-100 border border-amber-200 text-amber-800 px-2 py-1 rounded hover:bg-amber-200">Campo Admin</button>
                      <button type="button" onClick={() => insertTag('[cliente:Campo_Cliente]')} className="text-xs bg-emerald-100 border border-emerald-200 text-emerald-800 px-2 py-1 rounded hover:bg-emerald-200">Campo Cliente</button>
                      <button type="button" onClick={() => insertTag('[firma:Cliente]')} className="text-xs bg-purple-100 border border-purple-200 text-purple-800 px-2 py-1 rounded hover:bg-purple-200">Firma Cliente</button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Contenido del Contrato</label>
                <div className="border border-slate-300 rounded-xl overflow-hidden">
                  <Editor 
                    value={formData.content} 
                    onChange={e => setFormData({...formData, content: e.target.value})}
                    containerProps={{ style: { height: '400px', overflowY: 'auto' } }}
                  />
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 btn-primary">
                  Guardar Plantilla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
