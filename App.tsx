
// v20260515_2038
import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  Receipt, 
  Plus, 
  X,
  Menu,
  ChevronRight,
  LogOut,
  BarChart2,
  AlertTriangle,
  Clock,
  Globe,
  ChevronDown,
  FileText,
  Users,
  CalendarClock
} from 'lucide-react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  serverTimestamp,
  orderBy,
  where,
  getDocs,
  writeBatch,
  or,
  and,
  disableNetwork,
  enableNetwork
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import TransactionForm from './components/TransactionForm';
import SettingsView from './components/SettingsView';
import ReportsView from './components/ReportsView';
import LoginView from './components/LoginView';
import BudgetsView from './components/BudgetsView';
import { ClientsView } from './components/ClientsView';
import { AppointmentsView } from './components/AppointmentsView';
import LandingPage from './components/LandingPage';
import OnboardingTutorial from './components/OnboardingTutorial';
import { Transaction, Category, Supplier, Bank, View, TransactionType, User, Budget } from './types';
import { db, auth, signUserOut, handleFirestoreError, OperationType } from './services/firebase';

const formatBRLString = (value: string): string => {
  const cleanValue = value.replace(/\D/g, '');
  if (!cleanValue) return '';
  const numValue = parseInt(cleanValue, 10) / 100;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(numValue);
};

// Error Boundary Component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-rose-950 text-white p-10 font-mono">
          <h1 className="text-2xl font-bold mb-4">OPPS! OCORREU UM ERRO CRÍTICO</h1>
          <pre className="bg-black/50 p-6 rounded-xl overflow-auto text-xs border border-rose-500/30">
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-3 bg-white text-rose-950 rounded-xl font-bold"
          >
            Recarregar Aplicativo
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const App: React.FC = () => {
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // --- UI State ---
  const [view, setView] = useState<View>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isVerifyingStatus, setIsVerifyingStatus] = useState(false);
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [partialPayTransaction, setPartialPayTransaction] = useState<Transaction | null>(null);
  const [partialAmountInput, setPartialAmountInput] = useState<string>('');
  const [showTutorial, setShowTutorial] = useState(false);
  const [showLogin, setShowLogin] = useState(() => window.location.hash === '#login');
  const [finalizingBudgetId, setFinalizingBudgetId] = useState<string | null>(null);
  const [finalizingBudget, setFinalizingBudget] = useState<Budget | null>(null);

  // --- Navigation & Hash Effect ---
  useEffect(() => {
    const handleHashChange = () => {
      setShowLogin(window.location.hash === '#login');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleOpenLogin = () => {
    window.location.hash = 'login';
  };

  const handleCloseLogin = () => {
    window.location.hash = '';
  };

  const [manualId, setManualId] = useState("");

  const handleVerifyStatus = useCallback(async (manualIdFromInput?: string) => {
    if (!currentUser) return;
    setIsVerifyingStatus(true);
    try {
      const getUrlParam = (name: string) => {
        const url = window.location.href;
        const results = new RegExp('[?&]' + name + '=([^&#]*)').exec(url);
        return results ? results[1] : null;
      };

      const urlId = getUrlParam('payment_id') || getUrlParam('collection_id');
      const finalPaymentId = manualIdFromInput || manualId || urlId;
      
      console.log("Verifying with Payment ID:", finalPaymentId);
      
      const cacheBust = `&v=${Date.now()}`;
      const emailQuery = `&email=${encodeURIComponent(currentUser.email)}`;
      const query = finalPaymentId ? `?paymentId=${finalPaymentId}${cacheBust}${emailQuery}` : `?${cacheBust.substring(1)}${emailQuery}`;
      const response = await fetch(`/api/payments/verify/${currentUser.id}${query}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Erro interno no servidor');
      }
      
      if (data.status === 'APPROVED' || data.status === 'approved' || data.hasAccess) {
        let msg = "✅ Pagamento confirmado! Seu acesso foi liberado com sucesso.";
        
        // If backend sync failed, try to sync from client as a backup
        if (data.syncResult && data.syncResult.startsWith('failed')) {
          console.warn("Backend sync failed, attempting client-side sync backup...");
          try {
            const profileRef = doc(db, `system_profiles/${currentUser.id}`);
            await updateDoc(profileRef, {
              status: 'APPROVED',
              updatedAt: serverTimestamp(),
              paymentId: finalPaymentId || data.paymentId || 'verified_on_client'
            });
            console.log("Client-side sync backup SUCCESS.");
            msg = "✅ Pagamento confirmado via Mercado Pago! Tentando sincronizar seu acesso...";
          } catch (syncErr: unknown) {
            console.error("Client-side sync backup ALSO FAILED:", syncErr);
            const errMessage = syncErr instanceof Error ? syncErr.message : String(syncErr);
            msg += `\n\n⚠️ Atenção: Não conseguimos atualizar seu status no banco de dados (${errMessage}). Por favor, entre em contato com o suporte enviando seu ID: ${currentUser.id}`;
          }
        }

        alert(msg);
        
        // No reload, just let onSnapshot or current state update
        if (currentUser) {
           setCurrentUser(prev => prev ? { ...prev, status: 'APPROVED' } : null);
        }
        setIsMobileMenuOpen(false); // Close menu if open
      } else {
        if (data.configStatus === 'missing') {
          alert("⚠️ Configuração incompleta: O Token do Mercado Pago não foi encontrado no servidor. Por favor, verifique as configurações no menu de segredos.");
          return;
        }

        console.log("Status check response:", data);
        const statusMsg = data.status === 'pending' ? 'PENDENTE' : 
                         data.status === 'in_process' ? 'EM PROCESSAMENTO' : 
                         data.status === 'rejected' ? 'REJEITADO' : 
                         data.status === 'approved' ? 'APROVADO' : 
                         data.status === 'APPROVED' ? 'APROVADO' : 
                         data.status === 'PENDING' ? 'PENDENTE' : data.status;
        
        const detailMsg = data.statusDetail ? ` (${data.statusDetail})` : '';
        alert(`ℹ️ Status do pagamento: ${statusMsg || 'Não encontrado'}${detailMsg}\n\nSe você já pagou e o status aparece como Pendente, aguarde alguns instantes. Se o problema persistir, use o ID de transação do comprovante no campo de verificação manual.`);
      }
    } catch (error: unknown) {
      console.error("DEBUG: Error verifying status:", error);
      const errMessage = error instanceof Error ? error.message : String(error);
      alert(`❌ Erro técnico na verificação: ${errMessage}\n\nPor favor, atualize a página e tente novamente. Se persistir, entre em contato com o suporte.`);
    } finally {
      setTimeout(() => setIsVerifyingStatus(false), 1000);
    }
  }, [currentUser, manualId]);

  // Check status on hash change to #access-granted
  useEffect(() => {
    if (window.location.hash === '#access-granted') {
      window.location.hash = ''; // Clear hash
      setTimeout(() => {
        handleVerifyStatus();
      }, 0);
    }
  }, [currentUser, handleVerifyStatus]);

  // Periodic check when in pending screen
  useEffect(() => {
    if (currentUser && currentUser.status === 'PENDING' && !currentUser.isAdmin) {
      const interval = setInterval(() => {
        handleVerifyStatus();
      }, 10000); // Check every 10s
      return () => clearInterval(interval);
    }
  }, [currentUser, handleVerifyStatus]);

  // --- Account Sharing State ---
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [availableAccounts, setAvailableAccounts] = useState<{id: string, name: string, email: string}[]>([]);
  const [isAccountSelectorOpen, setIsAccountSelectorOpen] = useState(false);
  const [receivedPendingRequests, setReceivedPendingRequests] = useState<ShareRequest[]>([]);

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

  // --- Theme Effect ---
  useEffect(() => {
    const theme = currentUser?.theme || 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [currentUser?.theme]);

  // --- Data State ---
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);

  // --- Auth Effect ---
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    
    // Safety timeout for loading state
    const loadingTimeout = setTimeout(() => {
      setIsAuthLoading(prev => {
        if (prev) {
          console.warn("Auth loading timed out after 5s. Forcing UI load.");
          return false;
        }
        return false;
      });
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(loadingTimeout);
      try {
        if (user) {
          const userId = user.uid;
          const profilePath = `system_profiles/${userId}`;
          const userEmail = (user.email || '').toLowerCase();
          const isMasterAdmin = userEmail === 'caiquel555@gmail.com';

          // Initial state from Auth
          const initialUser: User = {
            id: userId,
            name: user.displayName || 'Usuário',
            email: userEmail,
            avatarUrl: user.photoURL || undefined,
            status: isMasterAdmin ? 'APPROVED' : 'PENDING',
            isAdmin: isMasterAdmin,
            theme: 'dark'
          };
          setCurrentUser(initialUser);
          setSelectedAccountId(userId);

          // Check if profile exists and create if needed
          const profileRef = doc(db, profilePath);
          
          if (unsubProfile) unsubProfile();
          unsubProfile = onSnapshot(profileRef, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setCurrentUser(prev => prev ? {
                ...prev,
                name: data.name || prev.name,
                avatarUrl: data.avatarUrl || prev.avatarUrl,
                status: data.status || 'PENDING',
                isAdmin: data.isAdmin || isMasterAdmin,
                theme: data.theme || 'dark',
                tutorialEnabled: data.tutorialEnabled !== false,
                hasCompletedTutorial: data.hasCompletedTutorial || false,
                hasCompletedTransactionTutorial: data.hasCompletedTransactionTutorial || false,
                companyName: data.companyName || '',
                companyDocument: data.companyDocument || '',
                companyPhone: data.companyPhone || '',
                companyEmail: data.companyEmail || '',
                companyAddress: data.companyAddress || '',
                companyCep: data.companyCep || ''
              } : null);

              if (data.tutorialEnabled !== false && !data.hasCompletedTutorial) {
                setShowTutorial(true);
              }

              // Sync email to lowercase if it's not already
              if (data.email && data.email !== data.email.toLowerCase()) {
                updateDoc(profileRef, { email: data.email.toLowerCase() })
                  .catch(err => console.error("Error normalizing email:", err));
              }
            } else {
              // Document doesn't exist, create it once with merge true to never overwrite existing fields during timing delays
              setDoc(profileRef, {
                name: initialUser.name,
                email: initialUser.email,
                avatarUrl: initialUser.avatarUrl || '',
                status: isMasterAdmin ? 'APPROVED' : 'PENDING',
                isAdmin: isMasterAdmin,
                theme: 'dark',
                updatedAt: serverTimestamp()
              }, { merge: true }).catch(e => {
                console.error("Critical error creating profile:", e);
                handleFirestoreError(e, OperationType.WRITE, profilePath);
              });
            }
          }, (error) => {
            console.error("Profile sync error details:", error);
            if (error.code !== 'permission-denied' || isMasterAdmin) {
              handleFirestoreError(error, OperationType.GET, profilePath);
            }
          });
        } else {
          setCurrentUser(null);
          setTransactions([]);
          setCategories([]);
          setSuppliers([]);
          setBanks([]);
          if (unsubProfile) {
            unsubProfile();
            unsubProfile = null;
          }
        }
      } catch (err) {
        console.error("Error in onAuthStateChanged:", err);
      } finally {
        setIsAuthLoading(false);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(loadingTimeout);
      if (unsubProfile) unsubProfile();
    };
  }, []);

  // --- Shared Accounts Discovery ---
  useEffect(() => {
    if (!currentUser) return;

    // Accounts shared WITH me OR BY me (Reciprocal) - Use OR to satisfy rules
    const q = query(
      collection(db, 'share_requests'), 
      and(
        where('status', '==', 'ACCEPTED'),
        or(
          where('senderId', '==', currentUser.id),
          where('receiverId', '==', currentUser.id)
        )
      )
    );

    const unsub = onSnapshot(q, async (snapshot) => {
      const accounts = [{ id: currentUser.id, name: currentUser.name, email: currentUser.email }];
      
      const sharedPromises = snapshot.docs.map(async (d) => {
        const data = d.data();
        const isMeSender = data.senderId === currentUser.id;
        
        if (isMeSender) {
          // I am the sender, so I want the receiver's info
          return {
            id: data.receiverId,
            name: data.receiverName || 'Conta de ' + (data.receiverEmail.split('@')[0]), 
            email: data.receiverEmail
          };
        } else {
          // I am the receiver, I want the sender's info
          return {
            id: data.senderId,
            name: data.senderName || 'Conta Compartilhada',
            email: data.senderEmail
          };
        }
      });

      const sharedAccounts = await Promise.all(sharedPromises);
      setAvailableAccounts([...accounts, ...sharedAccounts]);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'share_requests'));

    // PENDING requests discovery (for PendingView)
    const qPending = query(
      collection(db, 'share_requests'), 
      where('receiverId', '==', currentUser.id),
      where('status', '==', 'PENDING')
    );
    const unsubPending = onSnapshot(qPending, (snapshot) => {
      setReceivedPendingRequests(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as unknown as ShareRequest));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'share_requests'));

    return () => {
      unsub();
      unsubPending();
    };
  }, [currentUser]);

  const handleAcceptShare = async (request: ShareRequest) => {
    try {
      await updateDoc(doc(db, 'share_requests', request.id), {
        status: 'ACCEPTED',
        updatedAt: serverTimestamp()
      });
      setSelectedAccountId(request.senderId);
      alert("Convite aceito! Você agora pode acessar a conta compartilhada.");
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'share_requests');
    }
  };

  const handleRejectShare = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'share_requests', requestId), {
        status: 'REJECTED',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'share_requests');
    }
  };

  // --- Data Sync Effect ---
  useEffect(() => {
    if (!currentUser || currentUser.status !== 'APPROVED' || !selectedAccountId) return;

    // Derived states and listeners will handle the update
    const userId = selectedAccountId;

    // Sync categories
    const unsubCategories = onSnapshot(collection(db, `users/${userId}/categories`), 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
        if (items.length === 0) {
          // Initialize default categories if none exist
          const defaults = [
            { id: '1', name: 'Vendas', type: TransactionType.INCOME },
            { id: '2', name: 'Serviços', type: TransactionType.INCOME },
            { id: '3', name: 'Aluguel', type: TransactionType.EXPENSE },
            { id: '4', name: 'Marketing', type: TransactionType.EXPENSE },
            { id: '5', name: 'Folha de Pagamento', type: TransactionType.EXPENSE },
            { id: '6', name: 'Software/SaaS', type: TransactionType.EXPENSE },
          ];
          defaults.forEach(cat => {
            const { id, ...data } = cat;
            setDoc(doc(db, `users/${userId}/categories`, id), data);
          });
        } else {
          setCategories(items);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/categories`)
    );

    // Sync suppliers
    const unsubSuppliers = onSnapshot(collection(db, `users/${userId}/suppliers`), 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));
        if (items.length === 0) {
          const defaults = [
            { id: 's1', name: 'Google Cloud' },
            { id: 's2', name: 'Amazon AWS' },
            { id: 's3', name: 'Imobiliária Central' },
          ];
          defaults.forEach(sup => {
            const { id, ...data } = sup;
            setDoc(doc(db, `users/${userId}/suppliers`, id), data);
          });
        } else {
          setSuppliers(items);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/suppliers`)
    );

    // Sync banks
    const unsubBanks = onSnapshot(collection(db, `users/${userId}/banks`), 
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Bank));
        if (items.length === 0) {
          const defaults = [
            { id: 'b1', name: 'Nubank' },
            { id: 'b2', name: 'Itaú' },
          ];
          defaults.forEach(bank => {
            const { id, ...data } = bank;
            setDoc(doc(db, `users/${userId}/banks`, id), data);
          });
        } else {
          setBanks(items);
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/banks`)
    );

    // Sync transactions
    const q = query(collection(db, `users/${userId}/transactions`), orderBy('date', 'desc'));
    const unsubTransactions = onSnapshot(q, 
      (snapshot) => {
        setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${userId}/transactions`)
    );

    return () => {
      unsubCategories();
      unsubSuppliers();
      unsubBanks();
      unsubTransactions();
    };
  }, [currentUser, selectedAccountId]);

  // --- Fixed Transactions Generation Logic (Optimized for Mobile with single writeBatch) ---
  useEffect(() => {
    if (!currentUser || currentUser.status !== 'APPROVED' || transactions.length === 0) return;

    const today = new Date();
    const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const lastCheck = localStorage.getItem(`cnl_last_fixed_check_${selectedAccountId}`);

    if (lastCheck !== currentYearMonth) {
      const uniqueTemplates = new Map<string, Transaction>();
      
      transactions.filter(t => t.isFixed).forEach(t => {
        const key = `${t.description}-${t.categoryId}`;
        const existing = uniqueTemplates.get(key);
        if (!existing || new Date(t.date + 'T00:00:00') > new Date(existing.date + 'T00:00:00')) {
          uniqueTemplates.set(key, t);
        }
      });

      const batch = writeBatch(db);
      let runBatch = false;

      uniqueTemplates.forEach((template) => {
        const alreadyExists = transactions.some(t => {
          const tDate = new Date(t.date + 'T00:00:00');
          const tYearMonth = `${tDate.getFullYear()}-${String(tDate.getMonth() + 1).padStart(2, '0')}`;
          return tYearMonth === currentYearMonth && t.description === template.description && t.categoryId === template.categoryId;
        });

        if (!alreadyExists) {
          const templateDate = new Date(template.date + 'T00:00:00');
          const newDate = new Date(today.getFullYear(), today.getMonth(), templateDate.getDate());
          
          if (newDate.getMonth() !== today.getMonth()) {
            newDate.setMonth(today.getMonth());
            newDate.setDate(0);
          }

          const dataToSave: Partial<Transaction> = { ...template };
          delete dataToSave.id;
          delete dataToSave.installmentsCount;
          delete dataToSave.installmentNumber;
          
          const newDocRef = doc(collection(db, `users/${selectedAccountId}/transactions`));
          batch.set(newDocRef, {
            ...dataToSave,
            date: newDate.toISOString().split('T')[0],
            status: 'PENDING',
            createdAt: serverTimestamp()
          });
          runBatch = true;
        }
      });

      if (runBatch) {
        batch.commit()
          .then(() => {
            localStorage.setItem(`cnl_last_fixed_check_${selectedAccountId}`, currentYearMonth);
          })
          .catch((e) => {
            console.error("Error committing batch fixed transactions:", e);
            handleFirestoreError(e, OperationType.CREATE, `users/${selectedAccountId}/transactions`);
          });
      } else {
        localStorage.setItem(`cnl_last_fixed_check_${selectedAccountId}`, currentYearMonth);
      }
    }
  }, [currentUser, transactions, selectedAccountId]);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem('cnl_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('cnl_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('cnl_suppliers', JSON.stringify(suppliers));
  }, [suppliers]);

  useEffect(() => {
    localStorage.setItem('cnl_banks', JSON.stringify(banks));
  }, [banks]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('cnl_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('cnl_current_user');
    }
  }, [currentUser]);

  // --- Network socket auto-reconnect on Mobile / Tab Focus ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("Smartphone focused/unlocked, instantly refreshing Firestore network...");
        disableNetwork(db)
          .then(() => enableNetwork(db))
          .catch(err => console.error("Error reconnecting Firestore network on focus:", err));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // --- Handlers ---
  const handleAddTransaction = async (t: Transaction) => {
    if (!currentUser || !selectedAccountId) return;
    const { id, ...data } = t;
    const path = `users/${selectedAccountId}/transactions`;
    
    const isEditingReal = !!(editingTransaction && transactions.some(trans => trans.id === id));

    // Help function to get next month date
    const getNextMonthDate = (dateStr: string, monthsToAdd: number) => {
      const d = new Date(dateStr + 'T00:00:00');
      const originalDay = d.getDate();
      d.setMonth(d.getMonth() + monthsToAdd);
      // Handle month overflow (e.g. Jan 31 -> Feb 28)
      if (d.getDate() !== originalDay) {
        d.setDate(0);
      }
      return d.toISOString().split('T')[0];
    };

    // Base cleaned data helper
    const getCleanData = (trans: Partial<Transaction>, index?: number, total?: number, customDate?: string, isRecurrence?: boolean, groupId?: string) => {
      let description = trans.description;
      let status = trans.status;

      if (total && index) {
        description = `${trans.description} (${String(index).padStart(2, '0')}/${String(total).padStart(2, '0')})`;
        if (index > 1) status = 'PENDING';
      } else if (isRecurrence && index) {
        if (index > 0) status = 'PENDING';
      }

      const cleaned: Partial<Transaction> = {
        description: description,
        amount: total ? (trans.amount || 0) / total : (trans.amount || 0),
        type: trans.type,
        categoryId: trans.categoryId,
        bankId: trans.bankId,
        paymentMethod: trans.paymentMethod,
        date: customDate || trans.date,
        status: status,
        isFixed: trans.isFixed || false,
      };

      if (trans.supplierId) cleaned.supplierId = trans.supplierId;
      if (groupId) cleaned.groupId = groupId;
      
      if (total) {
        cleaned.installmentsCount = total;
        cleaned.installmentNumber = index;
      } else if (trans.installmentsCount) {
        cleaned.installmentsCount = trans.installmentsCount;
        cleaned.installmentNumber = trans.installmentNumber;
      }

      return cleaned;
    };

    try {
      if (isEditingReal) {
        const cleaned = getCleanData(data);
        await updateDoc(doc(db, path, id), { 
          ...cleaned, 
          updatedAt: serverTimestamp() 
        });
        setEditingTransaction(undefined);
      } else if (finalizingBudget && finalizingBudget.installments && finalizingBudget.installments.length > 0 && data.installmentsCount && data.installmentsCount > 1) {
        const total = finalizingBudget.installments.length;
        const groupId = crypto.randomUUID();
        const batch = writeBatch(db);
        
        finalizingBudget.installments.forEach((inst) => {
          const isFirst = inst.number === 1;
          const newDocRef = doc(collection(db, path));
          
          const installmentTransaction = {
            description: `${data.description} (Parcela ${inst.number}/${total})`,
            amount: inst.amount,
            type: TransactionType.INCOME,
            categoryId: data.categoryId || '',
            bankId: data.bankId || '',
            paymentMethod: inst.paymentMethod || data.paymentMethod,
            date: inst.dueDate,
            status: isFirst ? data.status : 'PENDING',
            groupId: groupId,
            installmentsCount: total,
            installmentNumber: inst.number,
            createdAt: serverTimestamp()
          };
          
          batch.set(newDocRef, installmentTransaction);
        });
        
        await batch.commit();
      } else if (data.customInstallments && data.customInstallments.length > 1) {
        const total = data.customInstallments.length;
        const groupId = crypto.randomUUID();
        const batch = writeBatch(db);
        data.customInstallments.forEach((inst) => {
          const isFirst = inst.number === 1;
          const cleaned = getCleanData(data, inst.number, total, inst.dueDate, false, groupId);
          cleaned.amount = inst.amount;
          if (!isFirst) cleaned.status = 'PENDING';
          const newDocRef = doc(collection(db, path));
          batch.set(newDocRef, {
            ...cleaned,
            createdAt: serverTimestamp()
          });
        });
        await batch.commit();
      } else if (data.installmentsCount && data.installmentsCount > 1) {
        const total = data.installmentsCount;
        const groupId = crypto.randomUUID();
        const batch = writeBatch(db);
        for (let i = 1; i <= total; i++) {
          const installmentDate = getNextMonthDate(data.date, i - 1);
          const cleaned = getCleanData(data, i, total, installmentDate, false, groupId);
          const newDocRef = doc(collection(db, path));
          batch.set(newDocRef, {
            ...cleaned,
            createdAt: serverTimestamp()
          });
        }
        await batch.commit();
      } else if (data.isFixed) {
        // For fixed transactions, create the first one and 11 future ones (total 12 months)
        const groupId = crypto.randomUUID();
        const batch = writeBatch(db);
        for (let i = 0; i < 12; i++) {
          const recurrenceDate = getNextMonthDate(data.date, i);
          const cleaned = getCleanData(data, i, undefined, recurrenceDate, true, groupId);
          const newDocRef = doc(collection(db, path));
          batch.set(newDocRef, {
            ...cleaned,
            createdAt: serverTimestamp()
          });
        }
        await batch.commit();
      } else {
        const cleaned = getCleanData(data);
        await addDoc(collection(db, path), { 
          ...cleaned, 
          createdAt: serverTimestamp() 
        });
      }

      if (finalizingBudgetId) {
        const budgetPath = `users/${selectedAccountId}/budgets`;
        try {
          await updateDoc(doc(db, budgetPath, finalizingBudgetId), {
            status: 'APPROVED'
          });
        } catch (budgetErr) {
          console.error("Erro ao atualizar status do orçamento para aprovado:", budgetErr);
        }
        setFinalizingBudgetId(null);
        setFinalizingBudget(null);
      }

      setIsTransactionFormOpen(false);
      setEditingTransaction(undefined);
    } catch (e: unknown) {
      console.error("Erro ao salvar lançamento:", e);
      const errorMessage = e instanceof Error ? e.message : "Erro desconhecido";
      alert(`Erro ao salvar lançamento: ${errorMessage}. Verifique se todos os campos estão preenchidos corretamente.`);
      handleFirestoreError(e, isEditingReal ? OperationType.UPDATE : OperationType.CREATE, path);
    }
  };

  const confirmDeleteTransaction = async () => {
    if (transactionToDelete && currentUser && selectedAccountId) {
      const path = `users/${selectedAccountId}/transactions`;
      try {
        if (isDeletingAll && (transactionToDelete.groupId || transactionToDelete.isFixed)) {
          // Se tiver groupId, deleta tudo do grupo. Se for fixo sem groupId (legado?), deleta por descrição/categoria?
          // Melhor focar no groupId que acabamos de adicionar.
          if (transactionToDelete.groupId) {
            const q = query(collection(db, path), where('groupId', '==', transactionToDelete.groupId));
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
          } else {
            // Fallback para legados ou se por algum motivo não tiver groupId
            await deleteDoc(doc(db, path, transactionToDelete.id));
          }
        } else {
          await deleteDoc(doc(db, path, transactionToDelete.id));
        }
        setTransactionToDelete(null);
        setIsDeletingAll(false);
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, path);
      }
    }
  };

  const handleToggleStatus = async (id: string) => {
    if (!currentUser || !selectedAccountId) return;
    const t = transactions.find(item => item.id === id);
    if (!t) return;

    const path = `users/${selectedAccountId}/transactions`;
    try {
      await updateDoc(doc(db, path, id), { 
        status: t.status === 'PAID' ? 'PENDING' : 'PAID',
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const confirmPartialPay = async () => {
    if (!currentUser || !selectedAccountId || !partialPayTransaction) return;
    const cleanAmount = partialAmountInput.replace(/\D/g, '');
    const paidAmount = cleanAmount ? parseInt(cleanAmount, 10) / 100 : 0;
    if (isNaN(paidAmount) || paidAmount <= 0 || paidAmount >= partialPayTransaction.amount) return;

    const path = `users/${selectedAccountId}/transactions`;
    const remainingAmount = partialPayTransaction.amount - paidAmount;

    try {
      // 1. Update the original transaction to be PAID with the paidAmount
      await updateDoc(doc(db, path, partialPayTransaction.id), {
        amount: paidAmount,
        status: 'PAID',
        description: `${partialPayTransaction.description} (Baixa Parcial)`,
        updatedAt: serverTimestamp()
      });

      // 2. Create the remaining pending transaction with the remainingAmount
      const { id: splitId, ...residualData } = partialPayTransaction;
      if (splitId) {
        console.log(`Realizando baixa parcial para lançamento ${splitId}`);
      }
      await addDoc(collection(db, path), {
        ...residualData,
        amount: remainingAmount,
        status: 'PENDING',
        description: `${partialPayTransaction.description} (Saldo Restante)`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setPartialPayTransaction(null);
      setPartialAmountInput('');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  };

  const handleEditTransaction = (t: Transaction) => {
    setEditingTransaction(t);
    setIsTransactionFormOpen(true);
  };

  const handleCompleteTutorial = async () => {
    setShowTutorial(false);
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, `system_profiles/${currentUser.id}`), {
        hasCompletedTutorial: true,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Error completing tutorial:", e);
    }
  };

  const handleCompleteTransactionTutorial = async () => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, `system_profiles/${currentUser.id}`), {
        hasCompletedTransactionTutorial: true,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Error completing transaction tutorial:", e);
    }
  };

  const logout = async () => {
    await signUserOut();
    setView('DASHBOARD');
  };

  // --- Render Loading ---
  if (isAuthLoading) {
    return (
      <ErrorBoundary>
        <div className="flex h-screen items-center justify-center bg-[#0d1428] text-white">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#7184cf] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-bold tracking-widest text-slate-400">CARREGANDO SISTEMA...</p>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  const handleBuyNow = async () => {
    if (!currentUser) {
      handleOpenLogin();
      return;
    }
    try {
      const response = await fetch('/api/payments/create-preference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: currentUser.id,
          userEmail: currentUser.email,
        }),
      });

      const data = await response.json();
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        throw new Error(data.error || "Erro ao gerar pagamento");
      }
    } catch (error) {
      console.error("Payment error:", error);
      alert("Houve um erro ao iniciar o pagamento. Tente novamente ou entre em contato com o suporte.");
    }
  };

  // --- Render Auth ---
  if (!currentUser) {
    if (showLogin) {
      return (
        <ErrorBoundary>
          <LoginView onBack={handleCloseLogin} />
        </ErrorBoundary>
      );
    }
    return (
      <ErrorBoundary>
        <LandingPage 
          onLoginClick={handleOpenLogin} 
          onBuyClick={handleBuyNow}
        />
      </ErrorBoundary>
    );
  }

  // --- Render Access Control ---
  // Allow entering if an approved shared account is selected, even if personal account is pending
  const isViewingSharedAccount = selectedAccountId && selectedAccountId !== currentUser.id;
  const hasAccess = currentUser.status === 'APPROVED' || isViewingSharedAccount || currentUser.isAdmin;

  if (!hasAccess) {
    return (
      <ErrorBoundary>
        <div className="flex min-h-screen items-center justify-center bg-[#0d1428] text-white p-6 overflow-y-auto py-20">
        <div className="max-w-2xl w-full space-y-8 animate-in zoom-in-95 duration-500">
          <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-10 border border-white/10 text-center shadow-2xl">
            <div className="w-20 h-20 bg-[#7184cf]/20 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <Clock size={40} className="text-[#7184cf]" />
            </div>
            <h2 className="text-3xl font-black tracking-tighter mb-4">Acesso Pendente</h2>
            <p className="text-slate-400 mb-8 leading-relaxed">
              Olá, <span className="text-white font-bold">{currentUser.name}</span>! <br />
              Seu cadastro foi realizado com sucesso, mas o acesso ao sistema ainda não foi liberado. 
            </p>

            <div className="bg-[#7184cf]/10 border border-[#7184cf]/30 rounded-3xl p-8 mb-8">
              <h3 className="text-xl font-black uppercase tracking-widest mb-2">Libere seu Acesso Agora</h3>
              <p className="text-sm text-slate-400 mb-6 font-medium">Garanta acesso vitalício ao Gestor CNL e domine suas finanças.</p>
              
              <div className="flex items-center justify-center gap-2 mb-8">
                <span className="text-xl font-bold">R$</span>
                <span className="text-5xl font-black">39,90</span>
                <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Pagamento Único</span>
              </div>

              <div className="space-y-4">
                <button 
                  onClick={handleBuyNow}
                  className="w-full py-5 bg-[#5c6db3] hover:bg-[#7184cf] text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 active:scale-95"
                >
                  ATIVAR MINHA CONTA
                </button>

                <div className="relative pt-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/5"></span>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-500">
                    <span className="bg-[#141d33] px-2">Já efetuou o pagamento?</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <button 
                    onClick={() => handleVerifyStatus()}
                    disabled={isVerifyingStatus}
                    className={`w-full py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all hover:bg-white/10 active:scale-95 flex items-center justify-center gap-2 ${isVerifyingStatus ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isVerifyingStatus ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        VERIFICANDO...
                      </>
                    ) : (
                      <>
                        <Clock size={14} />
                        VERIFICAR AUTOMATICAMENTE
                      </>
                    )}
                  </button>

                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="ID do Pagamento (comprovante)"
                      value={manualId}
                      onChange={(e) => setManualId(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-indigo-500 transition-colors text-white"
                    />
                    <button 
                      onClick={() => handleVerifyStatus(manualId)}
                      disabled={isVerifyingStatus || !manualId}
                      className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-500/30 transition-all disabled:opacity-50"
                    >
                      Verificar ID
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 text-center italic">Use o "Número da transação" que aparece no seu comprovante.</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left opacity-50 hover:opacity-100 transition-opacity">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-xs uppercase tracking-widest text-[#7184cf] font-black mb-1">E-mail Cadastrado</p>
                <p className="text-sm font-medium truncate">{currentUser.email}</p>
              </div>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                <p className="text-xs uppercase tracking-widest text-[#7184cf] font-black mb-1">Código de Perfil</p>
                <p className="text-sm font-medium font-mono">{currentUser.id}</p>
              </div>
            </div>

            <button 
              onClick={logout}
              className="mt-8 px-8 py-3 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] hover:text-rose-400 transition-all"
            >
              Sair da Conta
            </button>
          </div>

          {/* Invitations on Pending Screen */}
          {receivedPendingRequests.length > 0 && (
            <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-8 border border-emerald-500/20 shadow-2xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-400">
                  <Globe size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg">Convites de Compartilhamento</h3>
                  <p className="text-xs text-slate-400">Você foi convidado para gerenciar outras contas.</p>
                </div>
              </div>

              <div className="space-y-4">
                {receivedPendingRequests.map(req => (
                  <div key={req.id} className="p-5 bg-white/5 rounded-3xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[#7184cf] font-black text-xl">
                        {req.senderName?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="font-bold text-white leading-tight">{req.senderName}</p>
                        <p className="text-xs text-slate-400">{req.senderEmail}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button 
                        onClick={() => handleAcceptShare(req)}
                        className="flex-1 sm:px-6 py-3 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:brightness-110 shadow-lg shadow-emerald-500/20 transition-all"
                      >
                        Aceitar
                      </button>
                      <button 
                        onClick={() => handleRejectShare(req.id)}
                        className="flex-1 sm:px-6 py-3 bg-white/5 text-slate-400 rounded-xl text-xs font-bold hover:bg-rose-500/10 hover:text-rose-400 transition-all"
                      >
                        Recusar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Account Selector on Pending Screen (if they accepted one) */}
          {availableAccounts.length > 1 && (
            <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-8 border border-[#7184cf]/20 shadow-2xl space-y-6">
              <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Contas Disponíveis</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {availableAccounts.map(acc => (
                  <button
                    key={acc.id}
                    disabled={acc.id === currentUser.id} // Can't switch to own pending account
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={`p-4 rounded-2xl border transition-all text-left group ${
                      selectedAccountId === acc.id 
                      ? 'bg-[#7184cf] border-[#7184cf] text-white shadow-lg' 
                      : acc.id === currentUser.id
                        ? 'opacity-40 border-white/5 cursor-not-allowed'
                        : 'bg-white/5 border-white/10 hover:border-[#7184cf]/50 text-slate-300'
                    }`}
                  >
                    <p className="font-bold text-sm truncate">{acc.id === currentUser.id ? 'Sua Conta (Pendente)' : acc.name}</p>
                    <p className={`text-[10px] truncate ${selectedAccountId === acc.id ? 'text-white/70' : 'text-slate-500'}`}>{acc.email}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      </ErrorBoundary>
    );
  }

  const menuItems = [
    { id: 'DASHBOARD' as View, icon: <LayoutDashboard size={22} />, label: 'Dashboard' },
    { id: 'TRANSACTIONS' as View, icon: <Receipt size={22} />, label: 'Financeiro' },
    { id: 'REPORTS' as View, icon: <BarChart2 size={22} />, label: 'Relatórios' },
    { id: 'BUDGETS' as View, icon: <FileText size={22} />, label: 'Orçamentos' },
    { id: 'CLIENTS' as View, icon: <Users size={22} />, label: 'Clientes' },
    { id: 'APPOINTMENTS' as View, icon: <CalendarClock size={22} />, label: 'Agendamentos' },
    { id: 'SETTINGS' as View, icon: <Settings size={22} />, label: 'Ajustes' },
  ];

  const viewLabels: Record<View, string> = {
    DASHBOARD: 'Dashboard',
    TRANSACTIONS: 'Financeiro',
    REPORTS: 'Relatórios',
    BUDGETS: 'Orçamentos',
    CLIENTS: 'Clientes',
    APPOINTMENTS: 'Agendamentos & OS',
    SETTINGS: 'Ajustes'
  };

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-slate-50 dark:bg-[#0d1428] text-slate-900 dark:text-white font-['Inter'] overflow-hidden transition-colors duration-300">
      
      {/* Sidebar Desktop */}
      <aside className={`bg-[#0d1428] text-white flex-col transition-all duration-500 hidden lg:flex shrink-0 border-r border-white/5 ${isSidebarOpen ? 'w-72' : 'w-24'}`}>
        <div className="p-8 flex items-center gap-4 overflow-hidden">
          <div 
            className="w-10 h-10 min-w-[40px] min-h-[40px] max-w-[40px] max-h-[40px] rounded-xl overflow-hidden shadow-sm flex items-center justify-center shrink-0 border border-white/10 bg-white/5 relative"
          >
            <img 
              src="/logo-192.png" 
              alt="Logo" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer" 
            />
          </div>
          {isSidebarOpen && <h1 className="font-black text-xl tracking-tighter truncate">GESTOR CNL</h1>}
        </div>

        <nav className="flex-1 mt-6 px-4 space-y-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${
                view === item.id 
                ? 'bg-[#7184cf] text-white shadow-lg shadow-[#7184cf]/20' 
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className={view === item.id ? 'text-white' : 'text-slate-500'}>
                {item.icon}
              </div>
              {isSidebarOpen && <span className="font-bold text-sm tracking-wide">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-6">
          <button 
            onClick={logout}
            className="w-full flex items-center gap-4 px-4 py-4 text-rose-400 hover:bg-rose-400/10 rounded-2xl transition-all"
          >
            <LogOut size={22} />
            {isSidebarOpen && <span className="font-bold text-sm">Sair do Sistema</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Header - Otimizado para Mobile */}
        <header className="h-16 lg:h-20 bg-white dark:bg-[#0d1428] border-b border-slate-200 dark:border-white/5 flex items-center justify-between px-4 lg:px-8 shrink-0 z-20 transition-colors duration-300">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
              className="p-2.5 bg-slate-50 dark:bg-white/5 text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors hidden lg:block"
            >
              <Menu size={20} />
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(true)} 
              className="lg:hidden p-2 bg-slate-50 dark:bg-white/5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors shrink-0"
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <h2 className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1 sm:gap-2 truncate font-black">
                Visão <ChevronRight size={12} className="shrink-0" /> <span className="text-[#0d1428] dark:text-white truncate">{viewLabels[view]}</span>
              </h2>
            </div>
            <div className="flex items-center gap-2 lg:hidden min-w-0">
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 shrink-0">
                <img src="/logo-192.png" className="w-full h-full object-cover" />
              </div>
              <h1 className="font-black text-sm tracking-tight truncate text-[#0d1428] dark:text-white">GESTOR CNL</h1>
            </div>

            {/* Account Selector - Enhanced UX */}
            {availableAccounts.length > 1 && (
              <div className="relative ml-4">
                <button 
                  onClick={() => setIsAccountSelectorOpen(!isAccountSelectorOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 border transition-all duration-300 rounded-xl ${
                    selectedAccountId === currentUser.id 
                    ? 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10' 
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  <Globe size={14} className={selectedAccountId === currentUser.id ? 'text-[#7184cf]' : 'text-emerald-500'} />
                  <div className="flex flex-col items-start leading-tight">
                    <span className="text-[8px] font-black uppercase tracking-widest opacity-50">Conta Ativa</span>
                    <span className="text-[10px] font-black uppercase tracking-tight max-w-[80px] sm:max-w-none truncate">
                      {availableAccounts.find(a => a.id === selectedAccountId)?.name || 'Minha Conta'}
                    </span>
                  </div>
                  <ChevronDown size={12} className={`transition-transform duration-300 ${isAccountSelectorOpen ? 'rotate-180' : ''}`} />
                </button>

                {isAccountSelectorOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsAccountSelectorOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-[#0d1428] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-40 overflow-hidden animate-in zoom-in-95">
                      <div className="p-3 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Alternar Conta</p>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {availableAccounts.map(acc => (
                          <button
                            key={acc.id}
                            onClick={() => { setSelectedAccountId(acc.id); setIsAccountSelectorOpen(false); }}
                            className={`w-full flex flex-col items-start px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-all border-l-4 ${
                              selectedAccountId === acc.id ? 'border-[#7184cf] bg-[#7184cf]/5' : 'border-transparent'
                            }`}
                          >
                            <span className={`text-xs font-bold ${selectedAccountId === acc.id ? 'text-[#7184cf]' : 'text-[#0d1428] dark:text-white'}`}>
                              {acc.id === currentUser.id ? 'Minha Conta' : acc.name}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate w-full text-left">{acc.email}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {view === 'TRANSACTIONS' && (
              <button 
                onClick={() => { setEditingTransaction(undefined); setIsTransactionFormOpen(true); }}
                className="bg-[#7184cf] text-white p-2 sm:px-5 sm:py-2.5 rounded-xl font-bold text-[10px] sm:text-sm flex items-center gap-2 hover:brightness-110 shadow-lg active:scale-95 transition-all"
              >
                <Plus size={16} /> <span className="hidden sm:inline">Lançamento</span>
              </button>
            )}

            <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-200 dark:border-white/10 shrink-0">
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold text-[#0d1428] dark:text-white leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Bem-vindo(a)</p>
              </div>
              <div className="w-8 h-8 sm:w-10 sm:h-10 min-w-[32px] sm:min-w-[40px] min-h-[32px] sm:min-h-[40px] max-w-[32px] sm:max-w-[40px] max-h-[32px] sm:max-h-[40px] rounded-xl bg-slate-100 dark:bg-white/5 overflow-hidden border border-slate-200 dark:border-white/10 shrink-0 relative">
                {currentUser.avatarUrl ? (
                  <img 
                    src={currentUser.avatarUrl} 
                    alt="User" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#7184cf] bg-[#7184cf]/10 font-bold text-xs sm:text-sm">
                    {currentUser.name.charAt(0)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 relative bg-slate-50 dark:bg-[#0d1428] transition-colors duration-300">
          {view === 'DASHBOARD' && <Dashboard transactions={transactions} categories={categories} />}
          {view === 'TRANSACTIONS' && (
            <TransactionList 
              transactions={transactions} 
              categories={categories} 
              suppliers={suppliers} 
              banks={banks} 
              onDelete={setTransactionToDelete}
              onToggleStatus={handleToggleStatus}
              onEdit={handleEditTransaction}
              onPartialPay={setPartialPayTransaction}
            />
          )}
          {view === 'REPORTS' && <ReportsView transactions={transactions} categories={categories} />}
          {view === 'BUDGETS' && currentUser && (
            <BudgetsView 
              selectedAccountId={selectedAccountId}
              currentUser={currentUser}
              onFinalizeBudget={(budget) => {
                setFinalizingBudgetId(budget.id);
                setFinalizingBudget(budget);
                setEditingTransaction({
                  id: crypto.randomUUID(),
                  amount: budget.totalAmount,
                  description: `Orçamento: ${budget.client.name || 'Cliente Sem Nome'}`,
                  type: TransactionType.INCOME,
                  categoryId: '',
                  bankId: '',
                  paymentMethod: 'Pix',
                  date: budget.date,
                  status: 'PAID',
                  isFixed: false,
                  installmentsCount: (budget.installments && budget.installments.length > 0) ? budget.installments.length : undefined
                });
                setIsTransactionFormOpen(true);
              }}
            />
          )}
          {view === 'CLIENTS' && (
            <ClientsView 
              currentUser={currentUser} 
              selectedAccountId={selectedAccountId}
            />
          )}
          {view === 'APPOINTMENTS' && (
            <AppointmentsView 
              currentUser={currentUser} 
              selectedAccountId={selectedAccountId}
              setView={setView}
            />
          )}
          {view === 'SETTINGS' && (
            <SettingsView 
              currentUser={currentUser} 
              selectedAccountId={selectedAccountId}
              categories={categories}
              suppliers={suppliers}
              banks={banks}
              onTriggerTutorial={() => setShowTutorial(true)}
            />
          )}
        </div>

        {/* Onboarding Tutorial */}
        {showTutorial && (
          <OnboardingTutorial 
            onClose={handleCompleteTutorial}
            onComplete={handleCompleteTutorial}
          />
        )}

        {/* Modal Confirmação */}
        {transactionToDelete && (
          <div className="fixed inset-0 bg-[#0d1428]/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-[2rem] max-w-sm w-full p-8 shadow-2xl animate-in zoom-in-95">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-[#0d1428] text-center mb-2">Excluir Lançamento?</h3>
              <p className="text-slate-500 text-center text-sm mb-6">Ação irreversível.</p>
              
              {(transactionToDelete.groupId || transactionToDelete.installmentsCount || transactionToDelete.isFixed) && (
                <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-slate-300 text-[#7184cf] focus:ring-[#7184cf]"
                      checked={isDeletingAll}
                      onChange={e => setIsDeletingAll(e.target.checked)}
                    />
                    <span className="text-sm font-bold text-slate-700">Excluir toda a série</span>
                  </label>
                  <p className="text-[10px] text-slate-400 mt-1 ml-8">Remove todas as parcelas ou repetições deste lançamento.</p>
                </div>
              )}

              <div className="flex gap-4">
                <button onClick={() => { setTransactionToDelete(null); setIsDeletingAll(false); }} className="flex-1 py-4 font-bold text-slate-400 hover:bg-slate-50 rounded-xl transition-colors">Voltar</button>
                <button onClick={confirmDeleteTransaction} className="flex-1 py-4 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-colors">Excluir</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Baixa Parcial */}
        {partialPayTransaction && (
          <div className="fixed inset-0 bg-[#0d1428]/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] max-w-sm w-full p-8 shadow-2xl animate-in zoom-in-95 border border-slate-100 dark:border-white/5">
              <div className="w-16 h-16 bg-amber-50 dark:bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Receipt size={32} />
              </div>
              <h3 className="text-xl font-black text-[#0d1428] dark:text-white text-center mb-2">Baixa Parcial</h3>
              <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-6">
                Insira o valor que está sendo pago para este lançamento.
              </p>

              <div className="mb-6 bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5 text-left">
                <div className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Valor Total Original</div>
                <div className="text-lg font-black text-[#0d1428] dark:text-white mb-4">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(partialPayTransaction.amount)}
                </div>

                <div className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mb-1">Valor Pago (R$)</div>
                <input 
                  type="text"
                  inputMode="numeric"
                  className="w-full text-lg font-black text-[#0d1428] bg-transparent focus:outline-none border-b-2 border-slate-200 focus:border-[#7184cf] dark:text-white dark:border-slate-800"
                  placeholder="0,00"
                  value={partialAmountInput}
                  onChange={e => setPartialAmountInput(formatBRLString(e.target.value))}
                  autoFocus
                />
                
                {partialAmountInput && (
                  <div className="mt-4 text-[11px] font-bold text-slate-400">
                    O saldo restante será de:{' '}
                    <span className="text-rose-500">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                        Math.max(0, partialPayTransaction.amount - (parseInt(partialAmountInput.replace(/\D/g, ''), 10) / 100 || 0))
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => { setPartialPayTransaction(null); setPartialAmountInput(''); }} 
                  className="flex-1 py-4 font-bold text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                  Voltar
                </button>
                <button 
                  onClick={confirmPartialPay} 
                  disabled={(() => {
                    const clean = partialAmountInput.replace(/\D/g, '');
                    const num = clean ? parseInt(clean, 10) / 100 : 0;
                    return num <= 0 || num >= partialPayTransaction.amount;
                  })()}
                  className="flex-1 py-4 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transaction Form Overlay */}
        {isTransactionFormOpen && (
          <div className="fixed inset-0 bg-[#0d1428]/60 backdrop-blur-sm z-50 flex justify-end">
            <div className="w-full max-w-2xl h-full shadow-2xl animate-in slide-in-from-right duration-500">
              <TransactionForm 
                key={editingTransaction?.id || 'new'}
                onClose={() => {
                  setIsTransactionFormOpen(false);
                  setEditingTransaction(undefined);
                  setFinalizingBudgetId(null);
                  setFinalizingBudget(null);
                }} 
                onSubmit={handleAddTransaction}
                categories={categories}
                suppliers={suppliers}
                banks={banks}
                initialData={editingTransaction}
                isEdit={!!(editingTransaction && transactions.some(trans => trans.id === editingTransaction.id))}
                tutorialEnabled={currentUser.tutorialEnabled && !currentUser.hasCompletedTransactionTutorial}
                onCompleteTutorial={handleCompleteTransactionTutorial}
              />
            </div>
          </div>
        )}

        {/* Mobile Menu Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[100] lg:hidden">
            <div 
              className="absolute inset-0 bg-[#0d1428]/80 backdrop-blur-sm animate-in fade-in duration-300"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="absolute top-0 left-0 bottom-0 w-72 bg-[#0d1428] border-r border-white/5 flex flex-col p-8 shadow-2xl animate-in slide-in-from-left duration-500">
              <div className="flex justify-between items-center mb-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center overflow-hidden border border-white/10">
                    <img 
                      src="/logo-192.png" 
                      alt="Logo" 
                      className="w-full h-full object-cover" 
                    />
                  </div>
                  <h1 className="font-black text-lg tracking-tight">GESTOR CNL</h1>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
              
              <nav className="flex flex-col gap-2">
                {menuItems.map(item => (
                  <button 
                    key={item.id} 
                    onClick={() => { setView(item.id); setIsMobileMenuOpen(false); }} 
                    className={`flex items-center gap-4 px-4 py-4 rounded-2xl font-bold transition-all ${
                      view === item.id ? 'bg-[#7184cf] text-white shadow-lg shadow-[#7184cf]/20' : 'text-slate-400 hover:bg-white/5'
                    }`}
                  >
                    <span className={view === item.id ? 'text-white' : 'text-slate-500'}>{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="mt-auto pt-6 border-t border-white/5">
                <button 
                  onClick={() => { logout(); setIsMobileMenuOpen(false); }}
                  className="flex items-center gap-4 px-4 py-4 text-rose-400 font-bold hover:bg-rose-400/10 rounded-2xl transition-all"
                >
                  <LogOut size={20} /> Sair do Sistema
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
    </ErrorBoundary>
  );
};

export default App;
