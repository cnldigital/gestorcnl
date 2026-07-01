
import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Tag, 
  User as UserIcon, 
  Landmark, 
  Check, 
  Save,
  Briefcase,
  Camera,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  Pencil,
  Users as UsersIcon,
  Moon,
  Sun,
  UserPlus,
  Send,
  UserCheck,
  UserMinus,
  Building,
  FileText,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  getDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, handleFirestoreError, OperationType, auth } from '../services/firebase';
import { Category, Supplier, Bank, TransactionType, User } from '../types';
import AdminUsersView from './AdminUsersView';
import { fetchCNPJData } from '../utils/cnpjHelper';

interface SettingsViewProps {
  currentUser: User | null;
  selectedAccountId: string | null;
  categories: Category[];
  suppliers: Supplier[];
  banks: Bank[];
  onTriggerTutorial: () => void;
}

type SettingsTab = 'PROFILE' | 'CATEGORIES' | 'SUPPLIERS' | 'BANKS' | 'USERS';

// Define TabButton outside of the render flow logic
const TabButtonUI: React.FC<{ id: SettingsTab, icon: React.ReactNode, label: string, activeId: SettingsTab, onClick: (id: SettingsTab) => void }> = ({ id, icon, label, activeId, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm transition-all border ${
      activeId === id 
      ? 'bg-[#7184cf] text-white shadow-lg border-transparent' 
      : 'text-slate-400 border-transparent hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-white'
    }`}
  >
    {icon}
    {label}
  </button>
);

const formatCEP = (val: string): string => {
  const clean = val.replace(/\D/g, '');
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 5)}-${clean.slice(5, 8)}`;
};

const formatCPFOrCNPJ = (val: string): string => {
  const clean = val.replace(/\D/g, '');
  if (clean.length <= 11) {
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
    if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
  } else {
    const limited = clean.slice(0, 14);
    if (limited.length <= 2) return limited;
    if (limited.length <= 5) return `${limited.slice(0, 2)}.${limited.slice(2)}`;
    if (limited.length <= 8) return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5)}`;
    if (limited.length <= 12) return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8)}`;
    return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8, 12)}-${limited.slice(12, 14)}`;
  }
};

const SettingsView: React.FC<SettingsViewProps> = ({ 
  currentUser, 
  selectedAccountId,
  categories, 
  suppliers, 
  banks,
  onTriggerTutorial
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('PROFILE');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profileForm, setProfileForm] = useState({
    name: currentUser?.name || '',
    avatarUrl: currentUser?.avatarUrl || '',
    theme: currentUser?.theme || 'dark',
    tutorialEnabled: currentUser?.tutorialEnabled !== false,
    companyName: currentUser?.companyName || '',
    companyDocument: currentUser?.companyDocument || '',
    companyPhone: currentUser?.companyPhone || '',
    companyEmail: currentUser?.companyEmail || '',
    companyAddress: currentUser?.companyAddress || '',
    companyCep: currentUser?.companyCep || ''
  });

  // Sync form when currentUser changes (e.g. after update)
  useEffect(() => {
    if (currentUser) {
      const name = currentUser.name;
      const avatarUrl = currentUser.avatarUrl || '';
      const theme = currentUser.theme || 'dark';
      const tutorialEnabled = currentUser.tutorialEnabled !== false;
      const companyName = currentUser.companyName || '';
      const companyDocument = currentUser.companyDocument || '';
      const companyPhone = currentUser.companyPhone || '';
      const companyEmail = currentUser.companyEmail || '';
      const companyAddress = currentUser.companyAddress || '';
      const companyCep = currentUser.companyCep || '';

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfileForm(prev => {
        if (
          prev.name === name && 
          prev.avatarUrl === avatarUrl &&
          prev.theme === theme &&
          prev.tutorialEnabled === tutorialEnabled &&
          prev.companyName === companyName &&
          prev.companyDocument === companyDocument &&
          prev.companyPhone === companyPhone &&
          prev.companyEmail === companyEmail &&
          prev.companyAddress === companyAddress &&
          prev.companyCep === companyCep
        ) {
          return prev;
        }
        return {
          name,
          avatarUrl,
          theme,
          tutorialEnabled,
          companyName,
          companyDocument,
          companyPhone,
          companyEmail,
          companyAddress,
          companyCep
        };
      });
    }
  }, [currentUser]);

  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [newSupName, setNewSupName] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [companyDocLoading, setCompanyDocLoading] = useState(false);
  const [companyCepLoading, setCompanyCepLoading] = useState(false);

  // States para edição inline e exclusão
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTempName, setEditingTempName] = useState('');
  const [itemToDelete, setItemToDelete] = useState<{type: 'CAT' | 'SUP' | 'BANK', id: string} | null>(null);

  // Sharing states
  const [shareTarget, setShareTarget] = useState('');
  const [sentRequests, setSentRequests] = useState<ShareRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<ShareRequest[]>([]);
  const [isLoadingShare, setIsLoadingShare] = useState(false);

  interface ShareRequest {
    id: string;
    senderId: string;
    senderName: string;
    senderEmail: string;
    receiverId: string;
    receiverName: string;
    receiverEmail: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    createdAt: unknown;
    updatedAt?: unknown;
  }

  useEffect(() => {
    if (!currentUser) return;

    const qSent = query(collection(db, 'share_requests'), where('senderId', '==', currentUser.id));
    const qReceived = query(collection(db, 'share_requests'), where('receiverId', '==', currentUser.id));

    const unsubSent = onSnapshot(qSent, (snapshot) => {
      setSentRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as ShareRequest)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'share_requests'));

    const unsubReceived = onSnapshot(qReceived, (snapshot) => {
      setReceivedRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as ShareRequest)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'share_requests'));

    return () => {
      unsubSent();
      unsubReceived();
    };
  }, [currentUser]);

  const handleSendShareRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareTarget.trim() || !currentUser) return;
    
    const target = shareTarget.trim();

    if (target.toLowerCase() === currentUser.email.toLowerCase() || target === currentUser.id) {
      alert("Você não pode compartilhar a conta consigo mesmo.");
      return;
    }

    setIsLoadingShare(true);
    console.log("Sending share request to:", target);
    console.log("Current User:", currentUser);

    try {
      let receiverProfile: { id: string; email?: string; name?: string } | null = null;
      // ... (lookup logic)

      // 1. Try to find by ID first
      const directRef = doc(db, 'system_profiles', target);
      const directSnap = await getDoc(directRef);

      if (directSnap.exists()) {
        receiverProfile = { id: directSnap.id, ...directSnap.data() };
      } else {
        // 2. Try to find by email
        const q = query(
          collection(db, 'system_profiles'), 
          where('email', '==', target.toLowerCase()), 
          limit(1)
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          receiverProfile = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() };
        }
      }
      
      if (!receiverProfile) {
        alert("Usuário não encontrado. Verifique o e-mail ou código de compartilhamento.");
        setIsLoadingShare(false);
        return;
      }

      // Check if already exists
      const existingRequest = sentRequests.find(r => 
        r.receiverId === receiverProfile.id || 
        r.receiverEmail.toLowerCase() === receiverProfile.email?.toLowerCase()
      );
      if (existingRequest && existingRequest.status !== 'REJECTED') {
        alert("Já existe uma solicitação ativa para este usuário.");
        setIsLoadingShare(false);
        return;
      }

      // 2. Create request
      const requestData = {
        senderId: currentUser.id,
        senderName: currentUser.name || currentUser.email,
        senderEmail: currentUser.email,
        receiverEmail: (receiverProfile.email || '').toLowerCase(),
        receiverId: receiverProfile.id,
        receiverName: receiverProfile.name || '',
        status: 'PENDING',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Predictable ID for rules
      const requestId = `${currentUser.id}_${receiverProfile.id}`;
      await setDoc(doc(db, 'share_requests', requestId), requestData);
      
      setShareTarget('');
      alert("Solicitação enviada com sucesso! O outro usuário agora pode ver o convite na aba de Perfil.");
    } catch (error: unknown) {
      console.error("Error sending share request:", error);
      const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
      alert(`Erro ao enviar convite: ${errorMsg}\nVerifique sua conexão ou se inseriu o código/e-mail corretamente.`);
      handleFirestoreError(error, OperationType.WRITE, 'share_requests');
    } finally {
      setIsLoadingShare(false);
    }
  };

  const handleAcceptRequest = async (request: ShareRequest) => {
    try {
      await updateDoc(doc(db, 'share_requests', request.id), {
        status: 'ACCEPTED',
        receiverId: currentUser?.id,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'share_requests');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'share_requests', requestId), {
        status: 'REJECTED',
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'share_requests');
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!window.confirm("Deseja realmente cancelar este vínculo? O acesso será revogado para ambas as partes.")) return;
    try {
      await deleteDoc(doc(db, 'share_requests', requestId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'share_requests');
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !currentUser) return;

    try {
      // 1. Atualizar Profile no Auth (apenas o nome, photoURL tem limite curto)
      await updateProfile(auth.currentUser, {
        displayName: profileForm.name
      });

      // 2. Atualizar no Firestore (onde podemos guardar o avatar Base64)
      const profilePath = `system_profiles/${currentUser.id}`;
      const profileRef = doc(db, profilePath);
      await setDoc(profileRef, {
        name: profileForm.name,
        avatarUrl: profileForm.avatarUrl,
        theme: profileForm.theme,
        tutorialEnabled: profileForm.tutorialEnabled,
        hasCompletedTutorial: currentUser.hasCompletedTutorial || false,
        hasCompletedTransactionTutorial: currentUser.hasCompletedTransactionTutorial || false,
        companyName: profileForm.companyName,
        companyDocument: profileForm.companyDocument,
        companyPhone: profileForm.companyPhone,
        companyEmail: profileForm.companyEmail,
        companyAddress: profileForm.companyAddress,
        companyCep: profileForm.companyCep,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setSaveStatus('Perfil atualizado com sucesso!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error: unknown) {
      console.error("Erro ao atualizar perfil:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      alert(`Erro ao atualizar perfil: ${errorMessage}`);
    }
  };

  const handleCompanyDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatCPFOrCNPJ(rawVal);
    setProfileForm(prev => ({ ...prev, companyDocument: formatted }));

    const clean = rawVal.replace(/\D/g, '').slice(0, 14);
    if (clean.length === 14) {
      setCompanyDocLoading(true);
      try {
        const data = await fetchCNPJData(clean);
        if (data) {
          let formattedAddress = '';
          if (data.logradouro) {
            formattedAddress += data.logradouro;
            if (data.numero) formattedAddress += `, Nº ${data.numero}`;
            if (data.complemento) formattedAddress += ` - ${data.complemento}`;
            if (data.bairro) formattedAddress += `, ${data.bairro}`;
            if (data.municipio) formattedAddress += `, ${data.municipio}`;
            if (data.uf) formattedAddress += ` - ${data.uf}`;
          }

          let formattedPhone = '';
          if (data.telefone) {
            const rawPhone = data.telefone.replace(/\D/g, '');
            if (rawPhone.length >= 10) {
              const ddd = rawPhone.slice(0, 2);
              const num = rawPhone.slice(2);
              formattedPhone = `(${ddd}) ${num.slice(0, num.length - 4)}-${num.slice(num.length - 4)}`;
            } else {
              formattedPhone = data.telefone;
            }
          }

          setProfileForm(prev => ({
            ...prev,
            companyName: data.razao_social || data.nome_fantasia || prev.companyName,
            companyAddress: formattedAddress || prev.companyAddress,
            companyEmail: data.email || prev.companyEmail,
            companyPhone: formattedPhone || data.telefone || prev.companyPhone,
            companyCep: data.cep ? formatCEP(data.cep) : prev.companyCep
          }));
        }
      } catch (err) {
        console.error("Erro ao carregar o CNPJ da empresa:", err);
      } finally {
        setCompanyDocLoading(false);
      }
    }
  };

  const handleCompanyCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatCEP(rawVal);
    setProfileForm(prev => ({ ...prev, companyCep: formatted }));

    const clean = rawVal.replace(/\D/g, '');
    if (clean.length === 8) {
      setCompanyCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (!data.erro) {
          const formattedAddress = `${data.logradouro} - ${data.bairro} - ${data.localidade}/${data.uf}`;
          setProfileForm(prev => ({ 
            ...prev, 
            companyAddress: formattedAddress,
            companyCep: formatted
          }));
        }
      } catch (err) {
        console.error("Erro ao carregar o CEP da empresa", err);
      } finally {
        setCompanyCepLoading(false);
      }
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) {
        alert("A imagem deve ter no máximo 800KB para garantir a sincronização.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileForm(prev => ({ ...prev, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const addCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || !currentUser || !selectedAccountId) return;
    const path = `users/${selectedAccountId}/categories`;
    try {
      await addDoc(collection(db, path), { name: newCatName, type: newCatType });
      setNewCatName('');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const addSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupName.trim() || !currentUser || !selectedAccountId) return;
    const path = `users/${selectedAccountId}/suppliers`;
    try {
      await addDoc(collection(db, path), { name: newSupName });
      setNewSupName('');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const addBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim() || !currentUser || !selectedAccountId) return;
    const path = `users/${selectedAccountId}/banks`;
    try {
      await addDoc(collection(db, path), { name: newBankName });
      setNewBankName('');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  };

  const executeRemoval = async () => {
    if (!itemToDelete || !currentUser || !selectedAccountId) return;
    const { type, id } = itemToDelete;
    let path = '';
    if (type === 'CAT') path = `users/${selectedAccountId}/categories`;
    if (type === 'SUP') path = `users/${selectedAccountId}/suppliers`;
    if (type === 'BANK') path = `users/${selectedAccountId}/banks`;

    try {
      await deleteDoc(doc(db, path, id));
      setItemToDelete(null);
    } catch (e) {
       handleFirestoreError(e, OperationType.DELETE, path);
    }
  };

  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditingTempName(name);
  };

  const saveEdit = async (type: 'CAT' | 'SUP' | 'BANK') => {
    if (!editingId || !editingTempName.trim() || !currentUser || !selectedAccountId) return;
    let path = '';
    if (type === 'CAT') path = `users/${selectedAccountId}/categories`;
    if (type === 'SUP') path = `users/${selectedAccountId}/suppliers`;
    if (type === 'BANK') path = `users/${selectedAccountId}/banks`;

    try {
      await updateDoc(doc(db, path, editingId), { name: editingTempName });
      setEditingId(null);
      setEditingTempName('');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* Modal Interno de Confirmação de Exclusão */}
      {itemToDelete && (
        <div className="fixed inset-0 bg-[#0d1428]/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-black text-[#0d1428] mb-2">Excluir Item?</h3>
            <p className="text-slate-500 text-sm mb-8">Esta ação pode afetar lançamentos que utilizam este item. Deseja prosseguir?</p>
            <div className="flex gap-4">
              <button onClick={() => setItemToDelete(null)} className="flex-1 py-3 font-bold text-slate-400">Cancelar</button>
              <button onClick={executeRemoval} className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold">Excluir</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-72 space-y-2 shrink-0">
          <TabButtonUI id="PROFILE" icon={<UserIcon size={20} />} label="Meu Perfil" activeId={activeTab} onClick={setActiveTab} />
          <TabButtonUI id="CATEGORIES" icon={<Tag size={20} />} label="Plano de Contas" activeId={activeTab} onClick={setActiveTab} />
          <TabButtonUI id="SUPPLIERS" icon={<Briefcase size={20} />} label="Fornecedores" activeId={activeTab} onClick={setActiveTab} />
          <TabButtonUI id="BANKS" icon={<Landmark size={20} />} label="Bancos e Contas" activeId={activeTab} onClick={setActiveTab} />
          {currentUser?.isAdmin && (
            <TabButtonUI id="USERS" icon={<UsersIcon size={20} />} label="Gestão de Usuários" activeId={activeTab} onClick={setActiveTab} />
          )}
        </aside>

        <div className="flex-1 bg-white dark:bg-white/5 rounded-3xl lg:rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-white/5 overflow-hidden min-h-[600px]">
          {activeTab === 'PROFILE' && (
            <div className="p-6 sm:p-10 space-y-10">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black text-[#0d1428] dark:text-white mb-1">Configurações de Perfil</h3>
                  <p className="text-slate-400 text-sm font-medium">Gerencie sua identidade no sistema.</p>
                </div>
                {saveStatus && (
                  <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-2 rounded-xl text-xs font-bold border border-emerald-100 dark:border-emerald-500/20 animate-in fade-in slide-in-from-top-2">
                    {saveStatus}
                  </div>
                )}
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-8 max-w-2xl">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8 p-6 sm:p-8 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5">
                  <div className="relative group shrink-0">
                    <div 
                      className="w-24 h-24 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden border-4 border-white dark:border-white/10 shadow-xl relative"
                    >
                      {profileForm.avatarUrl ? (
                         <img 
                          src={profileForm.avatarUrl} 
                          alt="Avatar" 
                          className="absolute inset-0 w-full h-full object-cover rounded-full" 
                        />
                      ) : (
                        <div className="absolute inset-0 w-full h-full flex items-center justify-center text-slate-400">
                          <UserIcon size={40} />
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 bg-[#7184cf] text-white rounded-full shadow-lg border-2 border-white dark:border-[#0d1428] hover:scale-110 transition-transform"><Camera size={16} /></button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                  </div>
                  <div className="flex-1 min-w-0 text-center sm:text-left">
                    <h4 className="text-xl font-black text-[#0d1428] dark:text-white truncate">{profileForm.name || 'Usuário'}</h4>
                    <p className="text-sm text-slate-400 font-medium truncate mb-4">{currentUser?.email}</p>
                    
                    <div className="inline-flex flex-col gap-2 p-4 bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 w-full sm:w-auto">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Código de Acesso</span>
                        <button 
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(currentUser?.id || '');
                            alert('Código copiado!');
                          }}
                          className="text-[10px] font-bold text-[#7184cf] hover:underline"
                        >
                          Copiar
                        </button>
                      </div>
                      <p className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 break-all bg-slate-50 dark:bg-black/20 p-2 rounded-lg border border-slate-100 dark:border-white/5">
                        {currentUser?.id}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7184cf]" size={18} />
                      <input type="text" className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#7184cf] transition-all text-black dark:text-white" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tema do Sistema</label>
                    <div className="flex p-1.5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                      <button 
                        type="button"
                        onClick={() => setProfileForm({...profileForm, theme: 'light'})}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${profileForm.theme === 'light' ? 'bg-white shadow-md text-[#7184cf]' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        <Sun size={18} /> Claro
                      </button>
                      <button 
                        type="button"
                        onClick={() => setProfileForm({...profileForm, theme: 'dark'})}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${profileForm.theme === 'dark' ? 'bg-[#0d1428] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                      >
                        <Moon size={18} /> Escuro
                      </button>
                    </div>
                  </div>
                </div>

                {/* Dados do Contratado (Sua Empresa / Prestador) */}
                <div className="p-6 sm:p-8 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 space-y-6">
                  <div>
                    <h4 className="text-base font-black text-[#0d1428] dark:text-white flex items-center gap-2">
                      <Building size={20} className="text-[#7184cf]" /> Dados do Contratado (Sua Empresa / Prestador)
                    </h4>
                    <p className="text-slate-400 text-xs font-medium mt-1">
                      Estas informações serão salvas em seu perfil e exibidas nos orçamentos gerados como dados do prestador de serviço (CONTRATADO).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center mr-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CNPJ / CPF</label>
                        {companyDocLoading && <span className="text-[10px] text-[#7184cf] animate-pulse">Buscando...</span>}
                      </div>
                      <div className="relative">
                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7184cf]" size={18} />
                        <input 
                          type="text" 
                          className="w-full bg-white dark:bg-[#0d1428]/35 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#7184cf] transition-all text-black dark:text-white text-sm" 
                          placeholder="00.000.000/0000-00" 
                          value={profileForm.companyDocument} 
                          onChange={handleCompanyDocChange} 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Razão Social / Nome Fantasia</label>
                      <div className="relative">
                        <Building className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7184cf]" size={18} />
                        <input 
                          type="text" 
                          className="w-full bg-white dark:bg-[#0d1428]/35 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#7184cf] transition-all text-black dark:text-white text-sm" 
                          placeholder="Ex: Minha Empresa LTDA" 
                          value={profileForm.companyName} 
                          onChange={e => setProfileForm({...profileForm, companyName: e.target.value})} 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Telefone / WhatsApp</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7184cf]" size={18} />
                        <input 
                          type="text" 
                          className="w-full bg-white dark:bg-[#0d1428]/35 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#7184cf] transition-all text-black dark:text-white text-sm" 
                          placeholder="(00) 00000-0000" 
                          value={profileForm.companyPhone} 
                          onChange={e => setProfileForm({...profileForm, companyPhone: e.target.value})} 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail de Contato</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7184cf]" size={18} />
                        <input 
                          type="email" 
                          className="w-full bg-white dark:bg-[#0d1428]/35 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#7184cf] transition-all text-black dark:text-white text-sm" 
                          placeholder="email@daempresa.com" 
                          value={profileForm.companyEmail} 
                          onChange={e => setProfileForm({...profileForm, companyEmail: e.target.value})} 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center mr-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">CEP Comercial</label>
                        {companyCepLoading && <span className="text-[10px] text-[#7184cf] animate-pulse">Buscando...</span>}
                      </div>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7184cf]" size={18} />
                        <input 
                          type="text" 
                          className="w-full bg-white dark:bg-[#0d1428]/35 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#7184cf] transition-all text-black dark:text-white text-sm" 
                          placeholder="00000-000" 
                          value={profileForm.companyCep || ''} 
                          onChange={handleCompanyCepChange} 
                        />
                      </div>
                    </div>

                    <div className="col-span-1 md:col-span-2 space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Endereço Comercial</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7184cf]" size={18} />
                        <input 
                          type="text" 
                          className="w-full bg-white dark:bg-[#0d1428]/35 border border-slate-200 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-[#7184cf] transition-all text-black dark:text-white text-sm" 
                          placeholder="Rua, Número, Bairro, Cidade - UF" 
                          value={profileForm.companyAddress} 
                          onChange={e => setProfileForm({...profileForm, companyAddress: e.target.value})} 
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-3xl border border-indigo-100 dark:border-indigo-500/10 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-black text-[#0d1428] dark:text-white flex items-center gap-2">
                        <ArrowUpRight size={18} className="text-indigo-500" /> Guia de Boas-vindas
                      </h4>
                      <p className="text-slate-400 text-xs font-medium mt-1">Deseja ver o mini-tutorial de introdução ao sistema?</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={profileForm.tutorialEnabled}
                        onChange={e => setProfileForm({...profileForm, tutorialEnabled: e.target.checked})}
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      <span className="ml-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{profileForm.tutorialEnabled ? 'Ativado' : 'Desativado'}</span>
                    </label>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={async () => {
                      if (currentUser) {
                        try {
                          await updateDoc(doc(db, `system_profiles/${currentUser.id}`), {
                            hasCompletedTutorial: false,
                            hasCompletedTransactionTutorial: false
                          });
                          onTriggerTutorial();
                        } catch (e) {
                          console.error("Error resetting tutorial:", e);
                          onTriggerTutorial();
                        }
                      } else {
                        onTriggerTutorial();
                      }
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-white/5 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-100 dark:hover:bg-indigo-500/10 transition-all"
                  >
                    Ver Tutorial Novamente
                  </button>
                </div>

                <button type="submit" className="bg-[#0d1428] dark:bg-[#7184cf] text-white px-8 py-4 rounded-2xl font-bold hover:brightness-110 shadow-lg flex items-center gap-2 transition-all active:scale-95">
                  <Save size={18} /> Salvar Alterações
                </button>
              </form>

              <hr className="border-slate-100 dark:border-white/5" />
              
              {/* Active Connections Section - Reciprocal unlinking */}
              {selectedAccountId === currentUser?.id && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xl font-black text-[#0d1428] dark:text-white flex items-center gap-2">
                       <UserCheck size={22} className="text-emerald-500" /> Vínculos Ativos
                    </h4>
                    <p className="text-slate-400 text-sm font-medium">Contas com acesso recíproco. Cancelar o vínculo remove o acesso para ambos.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[...sentRequests, ...receivedRequests].filter(r => r.status === 'ACCEPTED').map(req => {
                      const isMeSender = req.senderId === currentUser?.id;
                      const partnerName = isMeSender ? (req.receiverName || req.receiverEmail.split('@')[0]) : req.senderName;
                      const partnerEmail = isMeSender ? req.receiverEmail : req.senderEmail;
                      
                      return (
                        <div key={req.id} className="p-5 bg-white dark:bg-white/5 border border-emerald-500/20 rounded-3xl flex items-center justify-between group hover:border-rose-500/30 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                              <UserIcon size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-[#0d1428] dark:text-white capitalize">{partnerName}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{partnerEmail}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleCancelRequest(req.id)}
                            className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                            title="Cancelar Vínculo"
                          >
                            <UserMinus size={18} />
                          </button>
                        </div>
                      );
                    })}
                    
                    {[...sentRequests, ...receivedRequests].filter(r => r.status === 'ACCEPTED').length === 0 && (
                      <div className="col-span-full py-8 text-center bg-slate-50 dark:bg-white/5 rounded-3xl border border-dashed border-slate-200 dark:border-white/10">
                        <p className="text-sm text-slate-400 font-medium">Nenhum vínculo ativo no momento.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <hr className="border-slate-100 dark:border-white/5" />

              {/* Account Sharing Section - Only visible if in own account */}
              {selectedAccountId === currentUser?.id && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xl font-black text-[#0d1428] dark:text-white flex items-center gap-2">
                      <UserPlus size={22} className="text-[#7184cf]" /> Compartilhamento de Conta
                    </h4>
                    <p className="text-slate-400 text-sm font-medium">Convide outros membros aprovados para gerenciar suas finanças.</p>
                  </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Send Invitation */}
                  <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 space-y-4">
                    <h5 className="font-bold text-sm text-[#0d1428] dark:text-white uppercase tracking-wider">Nova Solicitação</h5>
                    <form onSubmit={handleSendShareRequest} className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail ou Código do Membro</label>
                        <input 
                          type="text" 
                          placeholder="Digite o e-mail ou código..." 
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#7184cf] text-slate-900 dark:text-white"
                          value={shareTarget}
                          onChange={e => setShareTarget(e.target.value)}
                          required
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={isLoadingShare}
                        className="w-full bg-[#7184cf] text-white py-3 rounded-xl font-bold hover:brightness-110 shadow-md flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                      >
                        <Send size={18} /> {isLoadingShare ? 'Pesquisando...' : 'Enviar Convite'}
                      </button>
                    </form>

                    {/* Sent Requests List */}
                    {sentRequests.filter(r => r.status !== 'ACCEPTED').length > 0 && (
                      <div className="pt-4 space-y-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Convites Enviados</p>
                        {sentRequests.filter(r => r.status !== 'ACCEPTED').map(req => (
                          <div key={req.id} className="flex items-center justify-between p-3 bg-white dark:bg-white/10 rounded-xl border border-slate-100 dark:border-white/10">
                            <div className="overflow-hidden">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{req.receiverEmail}</p>
                              <span className={`text-[10px] font-bold uppercase ${
                                req.status === 'ACCEPTED' ? 'text-emerald-500' : 
                                req.status === 'REJECTED' ? 'text-rose-500' : 'text-amber-500'
                              }`}>
                                {req.status === 'ACCEPTED' ? 'Aceito' : 
                                 req.status === 'REJECTED' ? 'Recusado' : 'Pendente'}
                              </span>
                            </div>
                            <button 
                              onClick={() => handleCancelRequest(req.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                              title="Cancelar Solicitação"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Received Invitations */}
                  <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-3xl border border-slate-100 dark:border-white/5 space-y-4">
                    <h5 className="font-bold text-sm text-[#0d1428] dark:text-white uppercase tracking-wider">Solicitações Recebidas</h5>
                    {receivedRequests.filter(r => r.status !== 'ACCEPTED').length === 0 ? (
                      <div className="h-40 flex flex-col items-center justify-center text-center space-y-2 opacity-50">
                        <UsersIcon size={32} className="text-slate-300" />
                        <p className="text-xs font-medium text-slate-400">Nenhum convite pendente.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {receivedRequests.filter(r => r.status !== 'ACCEPTED').map(req => (
                          <div key={req.id} className="p-4 bg-white dark:bg-white/10 rounded-2xl border border-slate-200 dark:border-white/10 space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-[#7184cf]/10 flex items-center justify-center text-[#7184cf]">
                                <ArrowDownLeft size={20} />
                              </div>
                              <div>
                                <p className="text-sm font-black text-[#0d1428] dark:text-white">{req.senderName}</p>
                                <p className="text-[10px] text-slate-400 font-medium">{req.senderEmail}</p>
                              </div>
                            </div>
                            
                            {req.status === 'PENDING' ? (
                              <div className="flex gap-2 pt-1">
                                <button 
                                  onClick={() => handleAcceptRequest(req)}
                                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-[#7184cf] text-white rounded-xl text-xs font-bold hover:brightness-110 shadow-sm"
                                >
                                  <UserCheck size={14} /> Aceitar
                                </button>
                                <button 
                                  onClick={() => handleRejectRequest(req.id)}
                                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-100 dark:bg-white/5 text-slate-500 rounded-xl text-xs font-bold hover:bg-rose-50"
                                >
                                  <UserMinus size={14} /> Recusar
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                <span className={`text-[10px] font-black uppercase ${
                                  req.status === 'ACCEPTED' ? 'text-emerald-500' : 'text-rose-500'
                                }`}>
                                  Você {req.status === 'ACCEPTED' ? 'Aceitou' : 'Recusou'} este convite
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

          {activeTab === 'CATEGORIES' && (
            <div className="p-6 sm:p-10 space-y-10">
              <div>
                <h3 className="text-2xl font-black text-[#0d1428] dark:text-white mb-1">Plano de Contas</h3>
                <p className="text-slate-400 text-sm font-medium">Categorize suas movimentações para melhores relatórios.</p>
              </div>

              <form onSubmit={addCategory} className="flex flex-wrap gap-4 items-end bg-slate-50 dark:bg-white/5 p-6 rounded-3xl border border-slate-100 dark:border-white/5">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome da Categoria</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Assinaturas, Marketing..." 
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#7184cf] text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600" 
                    value={newCatName} 
                    onChange={e => setNewCatName(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Tipo</label>
                  <select 
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none font-bold text-slate-600 dark:text-slate-400 cursor-pointer"
                    value={newCatType}
                    onChange={e => setNewCatType(e.target.value as TransactionType)}
                  >
                    <option value={TransactionType.EXPENSE} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Despesa</option>
                    <option value={TransactionType.INCOME} className="bg-white dark:bg-slate-800 text-slate-900 dark:text-white">Receita</option>
                  </select>
                </div>
                <button type="submit" className="bg-[#7184cf] text-white p-3 rounded-xl hover:brightness-110 shadow-md">
                  <Plus size={20} />
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h4 className="font-black text-xs uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                    <ArrowUpRight size={14} /> Receitas
                  </h4>
                  <div className="space-y-2">
                    {categories.filter(c => c.type === TransactionType.INCOME).map(cat => (
                      <div key={cat.id} className="flex items-center justify-between p-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl group hover:border-slate-200 dark:hover:border-white/10 transition-all">
                        {editingId === cat.id ? (
                          <div className="flex items-center gap-2 flex-1 mr-4">
                            <input 
                              autoFocus
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-3 outline-none focus:ring-2 focus:ring-[#7184cf] text-sm text-slate-900 dark:text-white"
                              value={editingTempName}
                              onChange={e => setEditingTempName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && saveEdit('CAT')}
                            />
                            <button onClick={() => saveEdit('CAT')} className="text-emerald-500 p-1.5"><Check size={16}/></button>
                            <button onClick={() => setEditingId(null)} className="text-slate-400 p-1.5"><X size={16}/></button>
                          </div>
                        ) : (
                          <>
                            <span className="font-bold text-slate-700 dark:text-slate-300">{cat.name}</span>
                            <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => startEditing(cat.id, cat.name)} className="p-2 text-slate-300 hover:text-[#7184cf]">
                                <Pencil size={16} />
                              </button>
                              <button onClick={() => setItemToDelete({type: 'CAT', id: cat.id})} className="p-2 text-slate-300 hover:text-rose-500">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="font-black text-xs uppercase tracking-widest text-rose-600 flex items-center gap-2">
                    <ArrowDownLeft size={14} /> Despesas
                  </h4>
                  <div className="space-y-2">
                    {categories.filter(c => c.type === TransactionType.EXPENSE).map(cat => (
                      <div key={cat.id} className="flex items-center justify-between p-4 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl group hover:border-slate-200 dark:hover:border-white/10 transition-all">
                        {editingId === cat.id ? (
                          <div className="flex items-center gap-2 flex-1 mr-4">
                            <input 
                              autoFocus
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1 px-3 outline-none focus:ring-2 focus:ring-[#7184cf] text-sm text-slate-900 dark:text-white"
                              value={editingTempName}
                              onChange={e => setEditingTempName(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && saveEdit('CAT')}
                            />
                            <button onClick={() => saveEdit('CAT')} className="text-emerald-500 p-1.5"><Check size={16}/></button>
                            <button onClick={() => setEditingId(null)} className="text-slate-400 p-1.5"><X size={16}/></button>
                          </div>
                        ) : (
                          <>
                            <span className="font-bold text-slate-700 dark:text-slate-300">{cat.name}</span>
                            <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all">
                              <button onClick={() => startEditing(cat.id, cat.name)} className="p-2 text-slate-300 hover:text-[#7184cf]">
                                <Pencil size={16} />
                              </button>
                              <button onClick={() => setItemToDelete({type: 'CAT', id: cat.id})} className="p-2 text-slate-300 hover:text-rose-500">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'SUPPLIERS' && (
            <div className="p-6 sm:p-10 space-y-10">
              <div>
                <h3 className="text-2xl font-black text-[#0d1428] dark:text-white mb-1">Gestão de Fornecedores</h3>
                <p className="text-slate-400 text-sm font-medium">Controle para quem os pagamentos são direcionados.</p>
              </div>

              <form onSubmit={addSupplier} className="flex gap-4 items-end bg-slate-50 dark:bg-white/5 p-6 rounded-3xl border border-slate-100 dark:border-white/5">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Nome do Fornecedor</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Google Cloud, Amazon, Aluguel..." 
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#7184cf] text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600" 
                    value={newSupName} 
                    onChange={e => setNewSupName(e.target.value)} 
                  />
                </div>
                <button type="submit" className="bg-[#0d1428] dark:bg-[#7184cf] text-white px-6 py-3 rounded-xl font-bold hover:brightness-110 shadow-md flex items-center gap-2">
                  <Plus size={18} /> Adicionar
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {suppliers.map(sup => (
                  <div key={sup.id} className="p-5 bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl flex items-center justify-between group hover:border-[#7184cf]/30 dark:hover:border-[#7184cf]/50 transition-all min-h-[80px]">
                    {editingId === sup.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input 
                          autoFocus
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 px-3 outline-none focus:ring-2 focus:ring-[#7184cf] text-sm text-slate-900 dark:text-white"
                          value={editingTempName}
                          onChange={e => setEditingTempName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveEdit('SUP')}
                        />
                        <button onClick={() => saveEdit('SUP')} className="text-emerald-500 p-1.5"><Check size={16}/></button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-50 dark:bg-white/10 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500">
                            <Briefcase size={20} />
                          </div>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{sup.name}</span>
                        </div>
                        <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => startEditing(sup.id, sup.name)} className="p-2 text-slate-300 hover:text-[#7184cf]">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => setItemToDelete({type: 'SUP', id: sup.id})} className="p-2 text-slate-300 hover:text-rose-500">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'BANKS' && (
            <div className="p-6 sm:p-10 space-y-10">
              <div>
                <h3 className="text-2xl font-black text-[#0d1428] dark:text-white mb-1">Contas e Bancos</h3>
                <p className="text-slate-400 text-sm font-medium">Gerencie suas fontes de saldo.</p>
              </div>

              <form onSubmit={addBank} className="flex gap-4 items-end bg-slate-50 dark:bg-white/5 p-6 rounded-3xl border border-slate-100 dark:border-white/5">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Instituição Financeira</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Itaú, Nubank, Caixa..." 
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#7184cf] text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600" 
                    value={newBankName} 
                    onChange={e => setNewBankName(e.target.value)} 
                  />
                </div>
                <button type="submit" className="bg-[#0d1428] dark:bg-[#7184cf] text-white px-6 py-3 rounded-xl font-bold hover:brightness-110 shadow-md flex items-center gap-2">
                  <Plus size={18} /> Cadastrar
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {banks.map(bank => (
                  <div key={bank.id} className="p-6 bg-gradient-to-br from-white to-slate-50 dark:from-white/5 dark:to-white/10 border border-slate-100 dark:border-white/5 rounded-3xl flex items-center justify-between group hover:shadow-md transition-all min-h-[90px]">
                    {editingId === bank.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input 
                          autoFocus
                          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-4 outline-none focus:ring-2 focus:ring-[#7184cf] font-bold text-slate-900 dark:text-white"
                          value={editingTempName}
                          onChange={e => setEditingTempName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveEdit('BANK')}
                        />
                        <button onClick={() => saveEdit('BANK')} className="text-emerald-500 p-2"><Check size={20}/></button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-[#7184cf]/10 rounded-2xl flex items-center justify-center text-[#7184cf]">
                            <Landmark size={24} />
                          </div>
                          <span className="font-black text-[#0d1428] dark:text-white">{bank.name}</span>
                        </div>
                        <div className="flex gap-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => startEditing(bank.id, bank.name)} className="p-2 text-slate-300 hover:text-[#7184cf]">
                            <Pencil size={20} />
                          </button>
                          <button onClick={() => setItemToDelete({type: 'BANK', id: bank.id})} className="p-2 text-slate-300 hover:text-rose-500">
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'USERS' && currentUser?.isAdmin && <AdminUsersView />}
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
