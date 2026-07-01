
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  ShieldCheck,
  Search,
  Mail,
  Filter
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  updateDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { User } from '../types';

const AdminUsersView: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'system_profiles'), 
      (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'system_profiles')
    );
    return () => unsub();
  }, []);

  const updateUserStatus = async (userId: string, status: 'APPROVED' | 'BLOCKED' | 'PENDING') => {
    try {
      await updateDoc(doc(db, 'system_profiles', userId), {
        status,
        updatedAt: serverTimestamp()
      });

      // If approved, trigger the welcome email via backend
      if (status === 'APPROVED') {
        triggerWelcomeEmail(userId);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `system_profiles/${userId}`);
    }
  };

  const triggerWelcomeEmail = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (user && user.email) {
      console.log(`[Admin] Triggering welcome email for ${user.email}`);
      fetch('/api/admin/trigger-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          email: user.email,
          name: user.name || 'Cliente'
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert('E-mail de boas-vindas enviado com sucesso!');
        } else {
          alert('Erro ao enviar e-mail: ' + (data.error || 'Verifique os logs do servidor'));
        }
      })
      .catch(err => {
        console.error('Failed to trigger welcome email:', err);
        alert('Erro na requisição de e-mail.');
      });
    } else {
      alert('Usuário não possui e-mail cadastrado.');
    }
  };

  const toggleAdmin = async (userId: string, currentIsAdmin: boolean) => {
    try {
      await updateDoc(doc(db, 'system_profiles', userId), {
        isAdmin: !currentIsAdmin,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `system_profiles/${userId}`);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = (u.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
                         (u.email?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    const matchesRole = roleFilter === 'ALL' || 
                       (roleFilter === 'ADMIN' ? !!u.isAdmin : !u.isAdmin);
    
    return matchesSearch && matchesStatus && matchesRole;
  });

  if (loading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-10 h-10 border-4 border-[#7184cf] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 font-bold text-sm tracking-widest">CARREGANDO USUÁRIOS...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-10 space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-[#0d1428] dark:text-white mb-1">Controle de Acesso</h3>
          <p className="text-slate-400 dark:text-slate-500 text-sm font-medium">Gerencie quem pode utilizar o sistema.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar usuário..."
              className="pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-[#7184cf] w-full text-sm text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-40">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              <select
                className="pl-9 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-[#7184cf] w-full text-sm appearance-none cursor-pointer text-slate-900 dark:text-white"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL" className="text-slate-900">Todos Status</option>
                <option value="PENDING" className="text-slate-900">Pendentes</option>
                <option value="APPROVED" className="text-slate-900">Aprovados</option>
                <option value="BLOCKED" className="text-slate-900">Bloqueados</option>
              </select>
            </div>

            <div className="relative flex-1 sm:w-40">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
              <select
                className="pl-9 pr-4 py-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none focus:ring-2 focus:ring-[#7184cf] w-full text-sm appearance-none cursor-pointer text-slate-900 dark:text-white"
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
              >
                <option value="ALL" className="text-slate-900">Todos Níveis</option>
                <option value="ADMIN" className="text-slate-900">Admin</option>
                <option value="MEMBER" className="text-slate-900">Membro</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse min-w-[600px] md:min-w-0">
          <thead>
            <tr className="bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/10">
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Usuário</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nível</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-white/5">
            {filteredUsers.map(user => (
              <tr key={user.id} className="hover:bg-slate-50/30 dark:hover:bg-white/5 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/10 overflow-hidden border border-slate-200 dark:border-white/10 flex-shrink-0">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#7184cf] bg-[#7184cf]/10 font-bold text-sm">
                          {user.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-[#0d1428] dark:text-white text-sm">{user.name}</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <Mail size={10} /> {user.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    user.isAdmin 
                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20' 
                    : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/10'
                  }`}>
                    {user.isAdmin ? <ShieldCheck size={12} /> : null}
                    {user.isAdmin ? 'Admin' : 'Membro'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    user.status === 'APPROVED' 
                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20' 
                    : user.status === 'BLOCKED'
                    ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20'
                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20'
                  }`}>
                    {user.status === 'APPROVED' ? 'Aprovado' : user.status === 'BLOCKED' ? 'Bloqueado' : 'Pendente'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {user.status === 'APPROVED' && (
                      <button 
                        onClick={() => triggerWelcomeEmail(user.id)}
                        className="p-2 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                        title="Reenviar E-mail de Boas-vindas"
                      >
                        <Mail size={18} />
                      </button>
                    )}
                    {user.status !== 'APPROVED' && (
                      <button 
                        onClick={() => updateUserStatus(user.id, 'APPROVED')}
                        className="p-2 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                        title="Aprovar Usuário"
                      >
                        <CheckCircle2 size={18} />
                      </button>
                    )}
                    {user.status !== 'BLOCKED' && (
                      <button 
                        onClick={() => updateUserStatus(user.id, 'BLOCKED')}
                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Bloquear Usuário"
                      >
                        <XCircle size={18} />
                      </button>
                    )}
                    <button 
                      onClick={() => toggleAdmin(user.id, !!user.isAdmin)}
                      className={`p-2 rounded-lg transition-colors ${user.isAdmin ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                      title={user.isAdmin ? "Remover Admin" : "Tornar Admin"}
                    >
                      <ShieldAlert size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {filteredUsers.length === 0 && (
          <div className="p-12 text-center">
            <Users size={48} className="mx-auto text-slate-200 dark:text-slate-700 mb-4" />
            <p className="text-slate-400 dark:text-slate-600 font-medium">Nenhum usuário encontrado.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUsersView;
