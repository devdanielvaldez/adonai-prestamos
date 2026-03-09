import React, { useState, useEffect } from 'react';
import { db, firebaseConfig } from '../../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { Plus, Edit2, Trash2, X, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  permissions: string[];
}

const AVAILABLE_PERMISSIONS = [
  { id: 'manage_users', label: 'Gestionar Usuarios' },
  { id: 'manage_loan_types', label: 'Tipos de Préstamos' },
  { id: 'manage_guarantees', label: 'Tipos de Garantías' },
  { id: 'manage_clients', label: 'Gestionar Clientes' },
  { id: 'manage_guarantors', label: 'Gestionar Garantes' },
  { id: 'manage_loans', label: 'Gestionar Préstamos' },
  { id: 'manage_payments', label: 'Gestionar Pagos' },
  { id: 'manage_contracts', label: 'Gestionar Contratos' },
];

export default function Users() {
  const { role } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff' as 'admin' | 'staff',
    permissions: [] as string[]
  });

  const fetchUsers = async () => {
    const querySnapshot = await getDocs(collection(db, 'users'));
    const usersData: UserData[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.role === 'admin' || data.role === 'staff') {
        usersData.push({ id: doc.id, ...data } as UserData);
      }
    });
    setUsers(usersData);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        // Update existing user
        const { password, ...updateData } = formData;
        await updateDoc(doc(db, 'users', editingId), updateData);
      } else {
        // Create new user using a secondary Firebase app to avoid signing out the current admin
        const secondaryApp = initializeApp(firebaseConfig, 'Secondary');
        const secondaryAuth = getAuth(secondaryApp);
        
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          permissions: formData.role === 'admin' ? AVAILABLE_PERMISSIONS.map(p => p.id) : formData.permissions,
          createdAt: new Date().toISOString()
        });

        // Sign out from secondary app
        await secondaryAuth.signOut();
      }
      
      setIsModalOpen(false);
      setEditingId(null);
      setFormData({ name: '', email: '', password: '', role: 'staff', permissions: [] });
      fetchUsers();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleEdit = (user: UserData) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Don't populate password
      role: user.role,
      permissions: user.permissions || []
    });
    setEditingId(user.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Está seguro de eliminar este usuario? (Esto no eliminará su cuenta de autenticación, solo su acceso)')) {
      await deleteDoc(doc(db, 'users', id));
      fetchUsers();
    }
  };

  const togglePermission = (permId: string) => {
    setFormData(prev => {
      const perms = prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId];
      return { ...prev, permissions: perms };
    });
  };

  if (role !== 'admin') {
    return <div className="p-8 text-center text-slate-500">No tienes permisos para ver esta página.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Usuarios y Permisos</h2>
          <p className="text-sm text-slate-500 mt-1">Gestiona el acceso del personal al sistema administrativo.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ name: '', email: '', password: '', role: 'staff', permissions: [] });
            setIsModalOpen(true);
          }}
          className="btn-primary"
        >
          <Plus size={20} className="mr-2" />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      <div className="card-modern overflow-hidden">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Nombre</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Email</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Rol</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-50/50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{user.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleEdit(user)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => handleDelete(user.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">
                {editingId ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-modern" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                  <input type="email" required disabled={!!editingId} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="input-modern disabled:bg-slate-100" />
                </div>
                
                {!editingId && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                    <input type="password" required value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="input-modern" minLength={6} />
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                  <select required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as any})} className="input-modern">
                    <option value="staff">Staff (Personalizado)</option>
                    <option value="admin">Administrador (Acceso Total)</option>
                  </select>
                </div>
              </div>

              {formData.role === 'staff' && (
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 mb-4">
                    <Shield className="text-indigo-600" size={20} />
                    <h4 className="font-bold text-slate-900">Permisos del Sistema</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {AVAILABLE_PERMISSIONS.map(perm => (
                      <label key={perm.id} className="flex items-center p-3 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="ml-3 text-sm font-medium text-slate-700">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary">Cancelar</button>
                <button type="submit" className="flex-1 btn-primary">Guardar Usuario</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
