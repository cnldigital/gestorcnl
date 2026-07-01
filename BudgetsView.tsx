import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Search, 
  XCircle, 
  PlusCircle, 
  Save, 
  User, 
  MapPin, 
  Phone, 
  Tag,
  AlertTriangle,
  FileText,
  Edit,
  Check,
  CheckCircle,
  RotateCcw,
  Calendar,
  Building,
  List,
  Table,
  FileDown,
  MessageSquare,
  Send,
  X,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { jsPDF } from 'jspdf';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { Budget, BudgetItem, ClientData, User as AppUser, BudgetInstallment, Client } from '../types';
import { fetchCNPJData } from '../utils/cnpjHelper';

interface BudgetsViewProps {
  selectedAccountId: string | null;
  currentUser: AppUser;
  onFinalizeBudget?: (budget: Budget) => void;
}

// BRL formattes
const formatBRL = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const sanitizePhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.length === 10 || cleaned.length === 11) {
    return '55' + cleaned;
  }
  return cleaned;
};

const getWhatsAppBudgetInvoiceMessage = (
  budget: Budget, 
  getBudgetNumberFn: (b: Budget) => number | string, 
  companyNameVal?: string
): string => {
  const dateFormatted = budget.date ? budget.date.split('-').reverse().join('/') : '';
  const valFormatted = formatBRL(budget.totalAmount || 0);
  const company = companyNameVal || '';
  const seqNumber = getBudgetNumberFn(budget);

  const itemsText = budget.items.map(item => `• ${item.quantity}x ${item.description} (${formatBRL(item.unitPrice)})`).slice(0, 5).join('\n');
  const moreItemsText = budget.items.length > 5 ? `\n• ... (+ ${budget.items.length - 5} outros itens)` : '';

  return `Olá, *${budget.client.name || 'Cliente'}*! 👋

Passando para enviar o seu orçamento com a empresa *${company || 'nossa equipe'}*:

📄 *Orçamento Nº:* ${seqNumber}
📅 *Data de Emissão:* ${dateFormatted}
💰 *Valor Total:* ${valFormatted}

🛠️ *Descrição dos Serviços:*
${itemsText}${moreItemsText}

${budget.notes ? `📝 *Observações:* ${budget.notes}\n` : ''}
*Ficamos à disposição para tirar qualquer dúvida e aguardamos sua aprovação para iniciarmos os serviços!* 😊`;
};

// Formatting helpers
const formatCEP = (val: string): string => {
  const clean = val.replace(/\D/g, '');
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 5)}-${clean.slice(5, 8)}`;
};

const formatCPFOrCNPJ = (val: string): string => {
  const clean = val.replace(/\D/g, '');
  if (clean.length <= 11) {
    // CPF
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
    if (clean.length <= 9) return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
  } else {
    // CNPJ
    const limited = clean.slice(0, 14);
    if (limited.length <= 2) return limited;
    if (limited.length <= 5) return `${limited.slice(0, 2)}.${limited.slice(2)}`;
    if (limited.length <= 8) return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5)}`;
    if (limited.length <= 12) return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8)}`;
    return `${limited.slice(0, 2)}.${limited.slice(2, 5)}.${limited.slice(5, 8)}/${limited.slice(8, 12)}-${limited.slice(12, 14)}`;
  }
};

const BudgetsView: React.FC<BudgetsViewProps> = ({ selectedAccountId, currentUser, onFinalizeBudget }) => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<'PENDING' | 'FINALIZED'>('PENDING');
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

  // WhatsApp States
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [selectedBudgetForWhatsApp, setSelectedBudgetForWhatsApp] = useState<Budget | null>(null);
  const [whatsAppMessageText, setWhatsAppMessageText] = useState('');
  const [whatsAppClientPhone, setWhatsAppClientPhone] = useState('');

  const getCurrentMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0]
    };
  };

  const monthRange = getCurrentMonthRange();
  const [startDate, setStartDate] = useState(monthRange.start);
  const [endDate, setEndDate] = useState(monthRange.end);
  const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null);
  const [viewLayout, setViewLayout] = useState<'list' | 'table'>('list');

  const getBudgetNumber = (b: Budget) => {
    if (b.number !== undefined && b.number !== null) return b.number;
    // Fallback: sort all budgets chronologically (oldest to newest)
    const sorted = [...budgets].sort((x, y) => x.createdAt.localeCompare(y.createdAt));
    const idx = sorted.findIndex(x => x.id === b.id);
    return idx !== -1 ? idx + 1 : 1;
  };

  const handleOpenWhatsAppManual = (budget: Budget) => {
    setSelectedBudgetForWhatsApp(budget);
    setWhatsAppMessageText(getWhatsAppBudgetInvoiceMessage(budget, getBudgetNumber, currentUser?.companyName || currentUser?.name));
    setWhatsAppClientPhone(budget.client?.contact || '');
    setWhatsAppModalOpen(true);
  };

  // Auto-fill loading state
  const [cepLoading, setCepLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);

  // New Budget Form State
  const [clientData, setClientData] = useState<ClientData>({
    name: '',
    address: '',
    number: '',
    complement: '',
    contact: '',
    document: '',
    cep: ''
  });
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [budgetDiscountString, setBudgetDiscountString] = useState<string>('');
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const cleanBudgetDiscount = budgetDiscountString.replace(/\D/g, '');
  const budgetDiscount = cleanBudgetDiscount ? parseInt(cleanBudgetDiscount, 10) / 100 : 0;
  const totalAmount = Math.max(0, subtotal - budgetDiscount);
  const [notes, setNotes] = useState('');
  const [budgetDate, setBudgetDate] = useState(new Date().toISOString().split('T')[0]);
  const [hasInstallments, setHasInstallments] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(3);
  const [customInstallments, setCustomInstallments] = useState<BudgetInstallment[]>([]);

  // Generate / align installments when count, total or budget date changes
  useEffect(() => {
    if (!hasInstallments) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomInstallments([]);
      return;
    }
    
    const count = installmentsCount || 3;
    const baseAmount = Math.floor((totalAmount / count) * 100) / 100;
    const centsDifference = Math.round((totalAmount - (baseAmount * count)) * 100) / 100;
    
    const baseDate = budgetDate ? new Date(budgetDate + 'T12:00:00') : new Date();

    setCustomInstallments(prev => {
      const updated: BudgetInstallment[] = [];
      for (let i = 1; i <= count; i++) {
        const existing = prev.find(ex => ex.number === i);
        
        let dueDateStr: string;
        if (existing) {
          dueDateStr = existing.dueDate;
        } else {
          const dueDate = new Date(baseDate);
          dueDate.setMonth(baseDate.getMonth() + i);
          if (dueDate.getDate() !== baseDate.getDate()) {
            dueDate.setDate(0);
          }
          dueDateStr = dueDate.toISOString().split('T')[0];
        }

        const installmentAmount = i === count ? Number((baseAmount + centsDifference).toFixed(2)) : baseAmount;

        updated.push({
          number: i,
          amount: existing && existing.amount !== undefined ? existing.amount : installmentAmount,
          dueDate: dueDateStr,
          paymentMethod: existing ? existing.paymentMethod : 'Pix'
        });
      }
      return updated;
    });
  }, [hasInstallments, installmentsCount, totalAmount, budgetDate]);

  const handleUpdateInstallment = (index: number, field: keyof BudgetInstallment, value: string | number) => {
    setCustomInstallments(prev => prev.map((inst, idx) => {
      if (idx === index) {
        return {
          ...inst,
          [field]: field === 'amount' ? (value === '' ? 0 : Number(value)) : value
        };
      }
      return inst;
    }));
  };

  // Form inputs for the item currently being added
  const [itemInput, setItemInput] = useState({
    quantity: 1,
    unit: 'UN',
    description: '',
    unitPriceString: '',
    totalPriceString: '',
    discountString: '',
    observation: ''
  });

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [priceInputMode, setPriceInputMode] = useState<'unit' | 'total'>('unit');

  const accountId = selectedAccountId || currentUser.id;

  // Synchronize available registered clients
  const [availableClients, setAvailableClients] = useState<Client[]>([]);

  useEffect(() => {
    if (!accountId) return;
    const unsub = onSnapshot(collection(db, `users/${accountId}/clients`), (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Client));
      list.sort((a, b) => a.name.localeCompare(b.name));
      setAvailableClients(list);
    }, (error) => {
      console.error("Error fetching clients in BudgetsView", error);
    });
    return () => unsub();
  }, [accountId]);

  // Listen to Firestore Budgets
  useEffect(() => {
    if (!accountId) return;
    
    const timeoutId = setTimeout(() => {
      setLoading(true);
    }, 0);

    const path = `users/${accountId}/budgets`;
    const q = query(collection(db, path));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const budgetList: Budget[] = [];
      snapshot.forEach((doc) => {
        budgetList.push({ id: doc.id, ...doc.data() } as Budget);
      });
      // Sort by creation date descending
      budgetList.sort((a, b) => {
        const dateA = a.createdAt || '';
        const dateB = b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
      setBudgets(budgetList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [accountId]);

  // Cep auto-fill
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatCEP(rawVal);
    setClientData(prev => ({ ...prev, cep: formatted }));

    const clean = rawVal.replace(/\D/g, '');
    if (clean.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (!data.erro) {
          const formattedAddress = `${data.logradouro} - ${data.bairro} - ${data.localidade}/${data.uf}`;
          setClientData(prev => ({ 
            ...prev, 
            address: formattedAddress,
            number: '',
            complement: ''
          }));
        }
      } catch (err) {
        console.error("Erro ao carregar o CEP", err);
      } finally {
        setCepLoading(false);
      }
    }
  };

  // CNPJ autofill
  const handleDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatCPFOrCNPJ(rawVal);
    setClientData(prev => ({ ...prev, document: formatted }));

    const clean = rawVal.replace(/\D/g, '').slice(0, 14);
    if (clean.length === 14) {
      setDocLoading(true);
      try {
        const data = await fetchCNPJData(clean);
        if (data) {
          setClientData(prev => ({
            ...prev,
            name: data.razao_social || data.nome_fantasia || prev.name,
            address: data.logradouro ? `${data.logradouro} - ${data.bairro || ''} - ${data.municipio || ''}/${data.uf || ''}` : prev.address,
            number: data.numero || '',
            complement: data.complemento || '',
            cep: data.cep ? formatCEP(data.cep) : prev.cep,
            contact: data.telefone || data.email || prev.contact
          }));
        }
      } catch (err) {
        console.error("Erro ao carregar o CNPJ", err);
      } finally {
        setDocLoading(false);
      }
    }
  };

  // Item management
  const handleStartEditItem = (item: BudgetItem) => {
    setEditingItemId(item.id);
    setPriceInputMode('unit');
    const calculatedTotalVal = item.quantity * item.unitPrice;
    setItemInput({
      quantity: item.quantity,
      unit: item.unit,
      description: item.description,
      unitPriceString: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.unitPrice),
      totalPriceString: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(calculatedTotalVal),
      discountString: item.discount ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(item.discount) : '',
      observation: item.observation || ''
    });
  };

  const handleCancelEditItem = () => {
    setEditingItemId(null);
    setPriceInputMode('unit');
    setItemInput({
      quantity: 1,
      unit: 'UN',
      description: '',
      unitPriceString: '',
      totalPriceString: '',
      discountString: '',
      observation: ''
    });
  };

  const handleAddItem = () => {
    if (!itemInput.description) return;
    
    // Parse unit price from local BRL string
    const cleanPrice = itemInput.unitPriceString.replace(/\D/g, '');
    const unitPrice = cleanPrice ? parseInt(cleanPrice, 10) / 100 : 0;

    // Parse discount from local BRL string
    const cleanDiscount = (itemInput.discountString || '').replace(/\D/g, '');
    const itemDiscount = cleanDiscount ? parseInt(cleanDiscount, 10) / 100 : 0;

    // Total is (quantity * unitPrice) - discount, ensuring it's not negative
    const total = Math.max(0, (itemInput.quantity * unitPrice) - itemDiscount);

    if (editingItemId) {
      setItems(prev => prev.map(item => {
        if (item.id === editingItemId) {
          return {
            ...item,
            quantity: itemInput.quantity,
            unit: itemInput.unit || 'UN',
            description: itemInput.description,
            unitPrice,
            discount: itemDiscount,
            total,
            observation: itemInput.observation || null
          };
        }
        return item;
      }));
      setEditingItemId(null);
    } else {
      const newItem: BudgetItem = {
        id: crypto.randomUUID(),
        quantity: itemInput.quantity,
        unit: itemInput.unit || 'UN',
        description: itemInput.description,
        unitPrice,
        discount: itemDiscount,
        total,
        observation: itemInput.observation || null
      };
      setItems(prev => [...prev, newItem]);
    }
    
    // Reset item inputs
    setPriceInputMode('unit');
    setItemInput({
      quantity: 1,
      unit: 'UN',
      description: '',
      unitPriceString: '',
      totalPriceString: '',
      discountString: '',
      observation: ''
    });
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  // Start editing a budget from list view or details modal
  const handleStartEditBudget = (budget: Budget) => {
    setEditingBudget(budget);
    
    const client = budget.client || {};
    setClientData({
      name: client.name || '',
      address: client.address || '',
      number: client.number || '',
      complement: client.complement || '',
      contact: client.contact || '',
      document: client.document || '',
      cep: client.cep || ''
    });

    setItems(budget.items);
    setNotes(budget.notes || '');
    setBudgetDate(budget.date);
    setBudgetDiscountString(budget.discount ? new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(budget.discount) : '');

    if (budget.installments && budget.installments.length > 0) {
      setHasInstallments(true);
      setInstallmentsCount(budget.installments.length);
      setCustomInstallments(budget.installments);
    } else {
      setHasInstallments(false);
      setInstallmentsCount(3);
      setCustomInstallments([]);
    }
    setIsCreating(true);
  };

  // Submit Budget creation or update
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert("Adicione pelo menos um produto ou serviço ao orçamento.");
      return;
    }

    const path = `users/${accountId}/budgets`;
    
    // Sanitize data to prevent undefined values in Firestore
    const cleanClientData = {
      name: clientData.name || null,
      address: clientData.address || null,
      number: clientData.number || null,
      complement: clientData.complement || null,
      contact: clientData.contact || null,
      document: clientData.document || null,
      cep: clientData.cep || null
    };

    const cleanItems = items.map(item => ({
      id: item.id,
      quantity: item.quantity,
      unit: item.unit || 'UN',
      description: item.description,
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      total: item.total,
      observation: item.observation || null
    }));

    try {
      if (editingBudget) {
        // Edit existing budget
        const budgetRef = doc(db, path, editingBudget.id);
        const payload = {
          client: cleanClientData,
          items: cleanItems,
          totalAmount,
          discount: budgetDiscount,
          date: budgetDate,
          notes: notes || null,
          status: 'PENDING' as Budget['status'], // always returns to PENDING
          updatedAt: new Date().toISOString(),
          installments: hasInstallments ? customInstallments : null,
          createdAt: editingBudget.createdAt || new Date().toISOString(),
          number: editingBudget.number || 1
        };
        await updateDoc(budgetRef, payload);
        alert("Orçamento atualizado com sucesso como Pendente!");
        setEditingBudget(null);

        const savedBudget = { ...payload, id: editingBudget.id } as Budget;
        setIsCreating(false);
        resetForm();

        if (savedBudget.client?.contact) {
          setSelectedBudgetForWhatsApp(savedBudget);
          setWhatsAppMessageText(getWhatsAppBudgetInvoiceMessage(savedBudget, getBudgetNumber, currentUser?.companyName || currentUser?.name));
          setWhatsAppClientPhone(savedBudget.client.contact);
          setWhatsAppModalOpen(true);
        }
      } else {
        // Create new budget from scratch
        const maxNumber = budgets.reduce((max, b) => (b.number && b.number > max ? b.number : max), 0);
        const nextNumber = maxNumber + 1;

        const newBudget: Omit<Budget, 'id'> = {
          userId: accountId,
          client: cleanClientData,
          items: cleanItems,
          totalAmount,
          discount: budgetDiscount,
          date: budgetDate,
          status: 'PENDING',
          notes: notes || null,
          createdAt: new Date().toISOString(),
          number: nextNumber,
          installments: hasInstallments ? customInstallments : null
        };

        const docRef = await addDoc(collection(db, path), newBudget);
        alert("Orçamento salvo com sucesso como Pendente!");

        const savedBudget = { ...newBudget, id: docRef.id } as Budget;
        setIsCreating(false);
        resetForm();

        if (savedBudget.client?.contact) {
          setSelectedBudgetForWhatsApp(savedBudget);
          setWhatsAppMessageText(getWhatsAppBudgetInvoiceMessage(savedBudget, () => nextNumber, currentUser?.companyName || currentUser?.name));
          setWhatsAppClientPhone(savedBudget.client.contact);
          setWhatsAppModalOpen(true);
        }
      }
    } catch (error) {
      handleFirestoreError(error, editingBudget ? OperationType.UPDATE : OperationType.CREATE, editingBudget ? `${path}/${editingBudget.id}` : path);
      alert("Erro ao salvar orçamento: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const resetForm = () => {
    setClientData({
      name: '',
      address: '',
      number: '',
      complement: '',
      contact: '',
      document: '',
      cep: ''
    });
    setItems([]);
    setNotes('');
    setBudgetDate(new Date().toISOString().split('T')[0]);
    setItemInput({
      quantity: 1,
      unit: 'UN',
      description: '',
      unitPriceString: '',
      totalPriceString: '',
      discountString: '',
      observation: ''
    });
    setBudgetDiscountString('');
    setEditingItemId(null);
    setEditingBudget(null);
    setHasInstallments(false);
    setInstallmentsCount(3);
    setCustomInstallments([]);
  };

  // Change status
  const handleUpdateStatus = async (budgetId: string, newStatus: Budget['status']) => {
    const path = `users/${accountId}/budgets`;
    try {
      const budgetRef = doc(db, path, budgetId);
      await updateDoc(budgetRef, { status: newStatus });
      alert(`Status do orçamento atualizado com sucesso!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${path}/${budgetId}`);
      alert("Erro ao atualizar status: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Delete budget
  const handleDeleteBudget = async (budgetId: string) => {
    const path = `users/${accountId}/budgets`;
    try {
      const budgetRef = doc(db, path, budgetId);
      await deleteDoc(budgetRef);
      setBudgetToDelete(null);
      alert("Orçamento excluído com sucesso!");
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${path}/${budgetId}`);
      alert("Erro ao excluir orçamento: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  // Filter list
  const filteredBudgets = budgets.filter(b => {
    const clientName = b.client.name || '';
    const document = b.client.document || '';
    const searchMatch = clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        document.includes(searchTerm) || 
                        b.items.some(item => item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (startDate && b.date < startDate) return false;
    if (endDate && b.date > endDate) return false;

    return searchMatch;
  });

  const handlePrint = (budget: Budget) => {
    const generatePdf = (logoBase64?: string) => {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const nextNo = String(getBudgetNumber(budget));

      const addHeader = () => {
        // Top accent banner matching other report standards
        doc.setFillColor(13, 20, 40); // Navy #0d1428
        doc.rect(0, 0, 210, 8, 'F');

        let textStartX = 15;
        if (logoBase64) {
          try {
            doc.addImage(logoBase64, 'PNG', 15, 11, 11, 11);
            textStartX = 29;
          } catch (e) {
            console.error('Error rendering logo in budget PDF:', e);
          }
        }

        // Title and Subtitle
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(13, 20, 40);
        doc.text('GESTOR CNL', textStartX, 16);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(113, 132, 207); // Slate Blue #7184cf
        doc.text(`Proposta de Orçamento Nº ${nextNo}`, textStartX, 21);

        // Metadata on right
        doc.setFontSize(8);
        doc.setTextColor(100, 110, 130);
        const rightX = 195;
        
        doc.text(`Emissão: ${budget.date.split('-').reverse().join('/')}`, rightX, 15, { align: 'right' });
        doc.text(`Status: ${
          budget.status === 'APPROVED' ? 'APROVADO / FINALIZADO' : 'PENDENTE'
        }`, rightX, 20, { align: 'right' });

        // Divider line
        doc.setDrawColor(220, 225, 235);
        doc.setLineWidth(0.4);
        doc.line(15, 25, 195, 25);
      };

      addHeader();

      let currentY = 32;

      // 1. DADOS DO CONTRATADO, CLIENTE & ENTREGA
      // Card 1: Contratado
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, currentY, 85, 28, 1.5, 1.5, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(13, 20, 40);
      doc.text('DADOS DO CONTRATADO', 18, currentY + 5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Nome/Empresa: ${currentUser.companyName || currentUser.name || 'Sem nome'}`, 18, currentY + 11);
      doc.text(`CNPJ/CPF: ${currentUser.companyDocument || 'Não informado'}`, 18, currentY + 16);
      doc.text(`Contato: ${currentUser.companyPhone || currentUser.companyEmail || currentUser.email || 'Não informado'}`, 18, currentY + 21);
      
      let companyAddrStr = currentUser.companyAddress || 'Não informado';
      if (currentUser.companyCep) {
        companyAddrStr = `CEP: ${currentUser.companyCep} - ${companyAddrStr}`;
      }
      const companyAddressLines = doc.splitTextToSize(`Endereço: ${companyAddrStr}`, 78);
      doc.text(companyAddressLines[0], 18, currentY + 26);

      // Card 2: Cliente
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(110, currentY, 85, 28, 1.5, 1.5, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(13, 20, 40);
      doc.text('DADOS DO CLIENTE / CONTRATANTE', 113, currentY + 5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Nome: ${budget.client.name || 'Sem nome'}`, 113, currentY + 11);
      doc.text(`CPF/CNPJ: ${budget.client.document || 'Não informado'}`, 113, currentY + 16);
      doc.text(`Contato: ${budget.client.contact || 'Não informado'}`, 113, currentY + 21);

      currentY += 31;

      // Card 3: Entrega/Prestação (Full width)
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, currentY, 180, 18, 1.5, 1.5, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(13, 20, 40);
      doc.text('ENDEREÇO DE ENTREGA / PRESTAÇÃO DOS SERVIÇOS', 18, currentY + 4.5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);

      const fullAddr = `${budget.client.address || 'Não informado'}${budget.client.number ? `, Nº ${budget.client.number}` : ''}${budget.client.complement ? ` - ${budget.client.complement}` : ''}`;
      const cepText = budget.client.cep ? `CEP: ${budget.client.cep}  •  ` : '';
      const formattedAddressLine = `${cepText}Endereço: ${fullAddr}`;
      
      const wrappedAddress = doc.splitTextToSize(formattedAddressLine, 174);
      doc.text(wrappedAddress, 18, currentY + 10);

      currentY += 24;

      // 2. ITENS DO ORÇAMENTO TABLE
      doc.setFillColor(113, 132, 207); // Blue #7184cf
      doc.rect(15, currentY, 3, 5, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(13, 20, 40);
      doc.text('ITENS DO ORÇAMENTO', 21, currentY + 4);

      currentY += 8;

      // Table Header row (styled like professional standard report tables)
      doc.setFillColor(241, 245, 249);
      doc.rect(15, currentY, 180, 7, 'F');
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('#', 18, currentY + 4.8);
      doc.text('QTD', 25, currentY + 4.8);
      doc.text('UNID', 38, currentY + 4.8);
      doc.text('DESCRIÇÃO DO PRODUTO / SERVIÇO', 52, currentY + 4.8);
      doc.text('UNITÁRIO', 145, currentY + 4.8, { align: 'right' });
      doc.text('DESCONTO', 167, currentY + 4.8, { align: 'right' });
      doc.text('TOTAL', 190, currentY + 4.8, { align: 'right' });

      currentY += 7;

      // Table body
      budget.items.forEach((item, index) => {
        // Check page break if needed
        if (currentY > 250) {
          doc.addPage();
          // Miniature header
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(100, 110, 130);
          doc.text(`GESTOR CNL • ORÇAMENTO NO #${nextNo}`, 15, 11);
          doc.setDrawColor(220, 225, 235);
          doc.setLineWidth(0.3);
          doc.line(15, 12, 195, 12);
          currentY = 18;
        }

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);

        doc.text(String(index + 1), 18, currentY + 5);
        doc.text(String(item.quantity), 25, currentY + 5);
        doc.text(item.unit || 'UN', 38, currentY + 5);

        // Word wrap description to prevent overlap
        const descText = item.description + (item.observation ? ` (Obs: ${item.observation})` : '');
        const wrappedDesc = doc.splitTextToSize(descText, 80);
        doc.text(wrappedDesc, 52, currentY + 5);

        const linesOfDesc = wrappedDesc.length;
        const rowHeight = Math.max(8, linesOfDesc * 4.5 + 3);

        doc.text(formatBRL(item.unitPrice), 145, currentY + 5, { align: 'right' });
        doc.text(item.discount && item.discount > 0 ? `-${formatBRL(item.discount)}` : '-', 167, currentY + 5, { align: 'right' });

        doc.setFont('Helvetica', 'bold');
        doc.text(formatBRL(item.total), 190, currentY + 5, { align: 'right' });

        // divider line
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

        currentY += rowHeight;
      });

      // Total block
      if (currentY > 230) {
        doc.addPage();
        currentY = 18;
      }

      currentY += 6;

      // Summary Total card
      const hasInst = budget.installments && budget.installments.length > 0;
      doc.setFillColor(248, 250, 252);
      const hasDiscount = budget.discount && budget.discount > 0;
      let cardHeight = 18;
      if (hasDiscount) cardHeight += 6;
      if (hasInst) cardHeight += 6;

      doc.roundedRect(120, currentY, 75, cardHeight, 1, 1, 'F');

      let labelY = currentY + 6;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 130);
      
      const pdfSubtotal = budget.items.reduce((sum, item) => sum + item.total, 0);

      doc.text('Subtotal:', 125, labelY);
      doc.text(formatBRL(pdfSubtotal), 190, labelY, { align: 'right' });

      if (hasDiscount) {
        labelY += 6;
        doc.text('Desconto Geral:', 125, labelY);
        doc.setTextColor(239, 68, 68); // Soft Red for discount
        doc.text(`-${formatBRL(budget.discount || 0)}`, 190, labelY, { align: 'right' });
        doc.setTextColor(100, 110, 130); // Reset color
      }

      labelY += 6;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(13, 20, 40);
      doc.text('TOTAL DO ORÇAMENTO:', 125, labelY);
      doc.text(formatBRL(budget.totalAmount), 190, labelY, { align: 'right' });

      if (hasInst) {
        labelY += 6;
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(113, 132, 207); // Slate Blue #7184cf
        const installmentSummaryText = `${budget.installments!.length}x de ${formatBRL(budget.installments![0].amount)}`;
        doc.text('Condição de Pagamento:', 125, labelY);
        doc.text(installmentSummaryText, 190, labelY, { align: 'right' });
      }

      currentY += cardHeight + 6;

      // 3.5. Condições de Pagamento / Parcelamento
      if (budget.installments && budget.installments.length > 0) {
        if (currentY > 210) {
          doc.addPage();
          currentY = 18;
        }
        
        doc.setFillColor(113, 132, 207); // Blue #7184cf
        doc.rect(15, currentY, 3, 5, 'F');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(13, 20, 40);
        doc.text('CONDIÇÕES DE PAGAMENTO / CRONOGRAMA DE PARCELAMENTO', 21, currentY + 4);

        currentY += 8;

        // Table Header
        doc.setFillColor(241, 245, 249);
        doc.rect(15, currentY, 180, 6, 'F');
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text('PARCELA', 18, currentY + 4);
        doc.text('VALOR', 60, currentY + 4);
        doc.text('VENCIMENTO', 110, currentY + 4);
        doc.text('FORMA DE PAGAMENTO', 150, currentY + 4);

        currentY += 6;

        budget.installments.forEach((inst) => {
          if (currentY > 265) {
            doc.addPage();
            currentY = 18;
          }
          
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85);
          
          doc.text(`Parcela ${inst.number}`, 18, currentY + 4);
          doc.text(formatBRL(inst.amount), 60, currentY + 4);
          doc.text(inst.dueDate.split('-').reverse().join('/'), 110, currentY + 4);
          doc.text(inst.paymentMethod || 'Não informada', 150, currentY + 4);
          
          // divider line
          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.1);
          doc.line(15, currentY + 6, 195, currentY + 6);
          
          currentY += 6;
        });

        currentY += 6;
      }

      // 3. Notes / Observações Gerais
      if (budget.notes) {
        if (currentY > 240) {
          doc.addPage();
          currentY = 18;
        }
        doc.setFillColor(254, 243, 199); // soft amber
        doc.setDrawColor(245, 158, 11);
        doc.setLineWidth(0.2);
        
        const noteText = `OBSERVAÇÕES GERAIS:\n${budget.notes}`;
        const wrappedNotes = doc.splitTextToSize(noteText, 170);
        const notesHeight = wrappedNotes.length * 4.5 + 6;

        doc.roundedRect(15, currentY, 180, notesHeight, 1, 1, 'FD');
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 53, 4); // amber-900

        doc.text(wrappedNotes, 18, currentY + 5);
        currentY += notesHeight + 10;
      }

      // 4. Assinaturas
      if (currentY > 230) {
        doc.addPage();
        currentY = 18;
      }

      currentY += 15;
      doc.setDrawColor(180, 185, 200);
      doc.setLineWidth(0.3);
      doc.line(20, currentY, 95, currentY);
      doc.line(115, currentY, 190, currentY);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 110, 125);
      doc.text('Assinatura do Prestador / Emissor', 57.5, currentY + 5, { align: 'center' });
      doc.text('Aprovação do Cliente (De acordo)', 152.5, currentY + 5, { align: 'center' });

      // Add footers on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(220, 225, 235);
        doc.setLineWidth(0.3);
        doc.line(15, 282, 195, 282);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 130, 145);
        doc.text('Gestor CNL Software • Central de Orçamentos Comerciais', 15, 287);
        doc.text(`Proposta Comercial válida por 10 dias • Página ${i} de ${totalPages}`, 195, 287, { align: 'right' });
      }

      doc.save(`Orcamento_${nextNo}_${budget.client.name?.replace(/\s+/g, '_') || 'Cliente'}.pdf`);
    };

    // Load logo-192.png and convert to base64, then generate the PDF
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/logo-192.png';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL('image/png');
          generatePdf(dataURL);
        } else {
          generatePdf();
        }
      } catch (err) {
        console.error("Error converting logo to base64:", err);
        generatePdf();
      }
    };
    img.onerror = () => {
      generatePdf();
    };
  };



  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#0d1428] dark:text-white">Central de Orçamentos</h2>
          <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">Crie, imprima e gerencie orçamentos comerciais elegantes para seus clientes</p>
        </div>
        {!isCreating && (
          <button 
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-5 py-3 bg-[#7184cf] hover:bg-[#5c6eb1] text-white rounded-2xl font-bold shadow-lg shadow-[#7184cf]/20 transition-all active:scale-[0.98] self-start"
          >
            <Plus size={20} />
            Novo Orçamento
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isCreating ? (
          // CREATE BUDGET VIEW
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-3xl p-6 lg:p-8 shadow-2xl relative"
          >
            <div className="flex items-center gap-2 mb-8">
              <button 
                onClick={() => { resetForm(); setIsCreating(false); }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition"
              >
                <ArrowLeft size={18} />
              </button>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white">Criar Nova Proposta de Orçamento</h3>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-8">
              {/* Informação do Emitente / Contratado */}
              <div className="p-5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#7184cf]/10 rounded-xl flex items-center justify-center text-[#7184cf] shrink-0">
                    <Building size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Contratado / Emitente do Orçamento</h4>
                    <p className="text-sm font-bold text-slate-700 dark:text-white mt-0.5">
                      {currentUser?.companyName || currentUser?.name || 'Não configurado'} 
                      {currentUser?.companyDocument && <span className="text-slate-400 dark:text-slate-500 font-medium"> • {currentUser.companyDocument}</span>}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-[#7184cf] font-medium flex items-center gap-1.5 bg-[#7184cf]/5 dark:bg-[#7184cf]/10 px-3 py-1.5 rounded-lg border border-[#7184cf]/10">
                  <span>Configure estes dados na aba <strong>Meu Perfil</strong> em Configurações</span>
                </div>
              </div>

              {/* Client Info (Section 1) */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <User size={18} className="text-[#7184cf]" />
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">Passo 1: Dados do Cliente (Opcional)</h4>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* CPF/CNPJ */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center justify-between">
                      <span>CPF / CNPJ</span>
                      {docLoading && <span className="text-[10px] text-[#7184cf] animate-pulse">Buscando...</span>}
                    </label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                      placeholder="00.000.000/0000-00"
                      value={clientData.document || ''}
                      onChange={handleDocChange}
                    />
                  </div>

                  {/* Name with Autocomplete Filter */}
                  <div className="space-y-1 md:col-span-2 relative">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Nome Completo / Razão Social</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                      placeholder="Nome do cliente ou empresa"
                      value={clientData.name || ''}
                      onChange={e => {
                        setClientData({ ...clientData, name: e.target.value });
                        setShowClientSuggestions(true);
                      }}
                      onFocus={() => setShowClientSuggestions(true)}
                      onBlur={() => {
                        // Delay blurring so click can register on suggestions selection
                        setTimeout(() => setShowClientSuggestions(false), 200);
                      }}
                    />

                    {/* Suggestions Autocomplete List */}
                    {showClientSuggestions && (clientData.name || '').trim().length > 0 && availableClients.length > 0 && (
                      <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-xl divide-y divide-slate-100 dark:divide-white/5">
                        {(() => {
                          const queryText = (clientData.name || '').trim();
                          const removeAccents = (str: string) => {
                            return str
                              .normalize("NFD")
                              .replace(/[\u0300-\u036f]/g, "")
                              .toLowerCase();
                          };
                          const queryNormalized = removeAccents(queryText);
                          const queryWords = queryNormalized.split(/\s+/).filter(Boolean);

                          const filtered = availableClients.filter(c => {
                            if (!queryNormalized) return false;

                            const nameNorm = removeAccents(c.name);
                            const tradeNorm = removeAccents(c.tradeName || '');
                            const docNumbers = c.document.replace(/\D/g, '');
                            const queryNumbers = queryNormalized.replace(/\D/g, '');

                            // 1. Map CNPJ/CPF digits if numbers are typed
                            if (queryNumbers.length > 0 && docNumbers.includes(queryNumbers)) {
                              return true;
                            }

                            // 2. Exact word prefix match (all query words must be starting prefixes of some words in client)
                            const nameWords = nameNorm.split(/\s+/).filter(Boolean);
                            const tradeWords = tradeNorm.split(/\s+/).filter(Boolean);
                            const allClientWords = [...nameWords, ...tradeWords];

                            return queryWords.every(qw => 
                              allClientWords.some(cw => cw.startsWith(qw))
                            );
                          });

                          if (filtered.length === 0) {
                            return (
                              <div className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500 font-semibold text-center select-none">
                                Nenhum cliente encontrado
                              </div>
                            );
                          }

                          return filtered.map(cli => (
                            <button
                              key={cli.id}
                              type="button"
                              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.03] flex flex-col transition-colors first:rounded-t-2xl last:rounded-b-2xl cursor-pointer"
                              onMouseDown={() => {
                                // onMouseDown fires before onBlur, avoiding dismissal race condition
                                setClientData({
                                  name: cli.name,
                                  document: cli.document,
                                  contact: cli.contact || cli.email || '',
                                  cep: cli.cep || '',
                                  address: cli.address || '',
                                  number: cli.number || '',
                                  complement: cli.complement || '',
                                });
                                setShowClientSuggestions(false);
                              }}
                            >
                              <span className="text-sm font-bold text-slate-800 dark:text-white truncate">
                                {cli.name}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                                <span className="bg-[#7184cf]/10 text-[#7184cf] px-1.5 py-0.5 rounded">
                                  {cli.document}
                                </span>
                                {cli.tradeName && (
                                  <span className="truncate">
                                    • {cli.tradeName}
                                  </span>
                                )}
                              </div>
                            </button>
                          ));
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Contact */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <Phone size={12} /> Contato
                    </label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                      placeholder="(DD) 99999-9999 ou e-mail"
                      value={clientData.contact || ''}
                      onChange={e => setClientData({ ...clientData, contact: e.target.value })}
                    />
                  </div>

                  {/* CEP */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center justify-between">
                      <span>CEP</span>
                      {cepLoading && <span className="text-[10px] text-[#7184cf] animate-pulse">Buscando...</span>}
                    </label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                      placeholder="00000-000"
                      value={clientData.cep || ''}
                      onChange={handleCepChange}
                    />
                  </div>

                  {/* Endereço */}
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <MapPin size={12} /> Endereço Completo
                    </label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                      placeholder="Ex: Av. Paulista"
                      value={clientData.address || ''}
                      onChange={e => setClientData({ ...clientData, address: e.target.value })}
                    />
                  </div>

                  {/* Número */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Número</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                      placeholder="Nº 123"
                      value={clientData.number || ''}
                      onChange={e => setClientData({ ...clientData, number: e.target.value })}
                    />
                  </div>

                  {/* Complemento */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Complemento</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                      placeholder="Ex: Apto 45, Bloco B"
                      value={clientData.complement || ''}
                      onChange={e => setClientData({ ...clientData, complement: e.target.value })}
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Data do Orçamento</label>
                    <input 
                      type="date"
                      className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                      value={budgetDate}
                      onChange={e => setBudgetDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Products & Services (Section 2) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                  <Tag size={18} className="text-[#7184cf]" />
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">Passo 2: Itens do Orçamento</h4>
                </div>

                {/* Items Spreadsheet and Quick Add Block */}
                <div className="bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-white/5 rounded-2xl p-4 lg:p-6 space-y-6">
                  
                  {/* Inline Item Addition Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    {/* Qtd */}
                    <div className="md:col-span-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">QTD</label>
                      <input 
                        type="number" 
                        min="1"
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none font-bold text-center"
                        value={itemInput.quantity}
                        onChange={e => {
                          const q = parseInt(e.target.value, 10) || 1;
                          if (priceInputMode === 'total') {
                            const cleanTotal = itemInput.totalPriceString.replace(/\D/g, '');
                            const totalPrice = cleanTotal ? parseInt(cleanTotal, 10) / 100 : 0;
                            const computedUnit = totalPrice / q;
                            const formattedUnit = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(computedUnit);
                            setItemInput({
                              ...itemInput,
                              quantity: q,
                              unitPriceString: totalPrice > 0 ? formattedUnit : itemInput.unitPriceString
                            });
                          } else {
                            const cleanPrice = itemInput.unitPriceString.replace(/\D/g, '');
                            const unitPrice = cleanPrice ? parseInt(cleanPrice, 10) / 100 : 0;
                            const computedTotal = q * unitPrice;
                            const formattedTotal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(computedTotal);
                            setItemInput({
                              ...itemInput,
                              quantity: q,
                              totalPriceString: computedTotal > 0 ? formattedTotal : itemInput.totalPriceString
                            });
                          }
                        }}
                      />
                    </div>

                    {/* Unidade */}
                    <div className="md:col-span-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">UNID.</label>
                      <input 
                        type="text" 
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none font-medium text-center"
                        placeholder="UN"
                        value={itemInput.unit}
                        onChange={e => setItemInput({ ...itemInput, unit: e.target.value.toUpperCase() })}
                      />
                    </div>

                    {/* Descrição */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">DESCRIÇÃO DO PRODUTO / SERVIÇO</label>
                      <input 
                        type="text" 
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none font-medium"
                        placeholder="O que está sendo orçado?"
                        value={itemInput.description}
                        onChange={e => setItemInput({ ...itemInput, description: e.target.value })}
                      />
                    </div>

                    {/* Valor Unitario */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">VALOR UNITÁRIO (R$)</label>
                      <input 
                        type="text" 
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none font-black text-right"
                        placeholder="0,00"
                        value={itemInput.unitPriceString}
                        onChange={e => {
                          setPriceInputMode('unit');
                          const clean = e.target.value.replace(/\D/g, '');
                          if (!clean) {
                            setItemInput({ ...itemInput, unitPriceString: '', totalPriceString: '' });
                            return;
                          }
                          const priceVal = parseInt(clean, 10) / 100;
                          const formattedPrice = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(priceVal);
                          // Calculate total based on qty
                          const computedTotal = itemInput.quantity * priceVal;
                          const formattedTotal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(computedTotal);
                          
                          setItemInput({
                            ...itemInput,
                            unitPriceString: formattedPrice,
                            totalPriceString: formattedTotal
                          });
                        }}
                      />
                    </div>

                    {/* Valor Total do Item */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">VALOR TOTAL DO ITEM (R$)</label>
                      <input 
                        type="text" 
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none font-black text-right text-[#7184cf]"
                        placeholder="0,00"
                        value={itemInput.totalPriceString}
                        onChange={e => {
                          setPriceInputMode('total');
                          const clean = e.target.value.replace(/\D/g, '');
                          if (!clean) {
                            setItemInput({ ...itemInput, totalPriceString: '', unitPriceString: '' });
                            return;
                          }
                          const totalVal = parseInt(clean, 10) / 100;
                          const formattedTotal = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalVal);
                          // Calculate unit price based on qty
                          const q = itemInput.quantity || 1;
                          const computedUnit = totalVal / q;
                          const formattedUnit = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(computedUnit);
                          
                          setItemInput({
                            ...itemInput,
                            totalPriceString: formattedTotal,
                            unitPriceString: formattedUnit
                          });
                        }}
                      />
                    </div>

                    {/* Desconto Item (R$) */}
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">DESCONTO (R$)</label>
                      <input 
                        type="text" 
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none font-black text-right text-rose-500 placeholder-rose-300"
                        placeholder="0,00"
                        value={itemInput.discountString}
                        onChange={e => {
                          const clean = e.target.value.replace(/\D/g, '');
                          if (!clean) {
                            setItemInput({ ...itemInput, discountString: '' });
                            return;
                          }
                          const num = parseInt(clean, 10) / 100;
                          setItemInput({ ...itemInput, discountString: new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num) });
                        }}
                      />
                    </div>

                    {/* Observação item */}
                    <div className="md:col-span-1 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">OBS. ITEM (OPC)</label>
                      <input 
                        type="text" 
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none font-medium"
                        placeholder="Obs."
                        value={itemInput.observation}
                        onChange={e => setItemInput({ ...itemInput, observation: e.target.value })}
                      />
                    </div>

                    {/* Botão de adicionar item */}
                    <div className="md:col-span-1 flex gap-2">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={!itemInput.description}
                        className={`flex-1 flex items-center justify-center p-2.5 ${editingItemId ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-[#7184cf] hover:bg-[#5c6eb1]'} disabled:opacity-40 text-white rounded-xl font-bold transition active:scale-95 shadow-md`}
                        title={editingItemId ? 'Atualizar item' : 'Adicionar item'}
                      >
                        {editingItemId ? <Check size={20} /> : <PlusCircle size={20} />}
                      </button>
                      {editingItemId && (
                        <button
                          type="button"
                          onClick={handleCancelEditItem}
                          className="p-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold transition active:scale-95 shadow-md hover:scale-105"
                          title="Cancelar edição"
                        >
                          <XCircle size={20} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Active Items Table list */}
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/50 rounded-xl bg-white dark:bg-slate-800/30">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700/70">
                        <tr>
                          <th className="px-4 py-3 text-center w-12">Item</th>
                          <th className="px-4 py-3 text-center w-16">Qtd</th>
                          <th className="px-4 py-3 text-center w-20">Unidade</th>
                          <th className="px-4 py-3">Descrição do Item</th>
                          <th className="px-4 py-3 text-right">Unitário</th>
                          <th className="px-4 py-3 text-right">Desconto</th>
                          <th className="px-4 py-3 text-right">Total</th>
                          <th className="px-4 py-3 text-center w-24">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-medium">
                              Nenhum item adicionado ainda. Preencha os campos acima para preencher o orçamento.
                            </td>
                          </tr>
                        ) : (
                          items.map((item, idx) => (
                            <tr key={item.id} className="border-b border-slate-150 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/10 transition">
                              <td className="px-4 py-3.5 text-center font-bold text-slate-400">{idx + 1}</td>
                              <td className="px-4 py-3.5 text-center font-bold">{item.quantity}</td>
                              <td className="px-4 py-3.5 text-center font-medium"><span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-bold text-xs">{item.unit}</span></td>
                              <td className="px-4 py-3.5">
                                <div className="font-bold text-slate-800 dark:text-slate-200">{item.description}</div>
                                {item.observation && <div className="text-[11px] text-slate-400 italic mt-0.5">Obs: {item.observation}</div>}
                              </td>
                              <td className="px-4 py-3.5 text-right font-medium">{formatBRL(item.unitPrice)}</td>
                              <td className="px-4 py-3.5 text-right font-medium text-rose-500">
                                {item.discount && item.discount > 0 ? `-${formatBRL(item.discount)}` : '-'}
                              </td>
                              <td className="px-4 py-3.5 text-right font-black text-slate-900 dark:text-white">{formatBRL(item.total)}</td>
                              <td className="px-4 py-3.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditItem(item)}
                                    className={`p-1.5 rounded-lg transition ${editingItemId === item.id ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20' : 'text-[#7184cf] hover:bg-slate-100 dark:hover:bg-white/5'}`}
                                    title="Editar item"
                                  >
                                    <Edit size={15} />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => handleRemoveItem(item.id)}
                                    className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition"
                                    title="Remover item"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Grand total display */}
                  {items.length > 0 && (
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between pt-6 border-t border-slate-200 dark:border-slate-700 gap-4 mt-6">
                      {/* Desconto Geral */}
                      <div className="flex items-center gap-3">
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                          Desconto Geral (R$):
                        </label>
                        <div className="relative w-40">
                          <input 
                            type="text" 
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none font-bold text-right text-rose-500 placeholder-rose-300"
                            placeholder="0,00"
                            value={budgetDiscountString}
                            onChange={e => {
                              const clean = e.target.value.replace(/\D/g, '');
                              if (!clean) {
                                setBudgetDiscountString('');
                                return;
                              }
                              const num = parseInt(clean, 10) / 100;
                              setBudgetDiscountString(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num));
                            }}
                          />
                        </div>
                      </div>

                      {/* Totals */}
                      <div className="flex flex-col items-end gap-1">
                        {budgetDiscount > 0 && (
                          <div className="text-xs font-medium text-slate-400 dark:text-slate-500">
                            Subtotal Geral: <span className="font-bold">{formatBRL(subtotal)}</span>
                          </div>
                        )}
                        {budgetDiscount > 0 && (
                          <div className="text-xs font-medium text-rose-500">
                            Desconto Geral: <span className="font-bold">-{formatBRL(budgetDiscount)}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Valor Geral do Orçamento:</span>
                          <span className="text-3xl font-black text-[#7184cf] dark:text-violet-400">{formatBRL(totalAmount)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* General details step 3 */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-white/5 pb-2">
                  <FileText size={18} className="text-[#7184cf]" />
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">Passo 3: Observações Gerais (Opcional)</h4>
                </div>
                <textarea
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium min-h-[100px]"
                  placeholder="Instruções de pagamento, prazo de entrega, validade da proposta ou detalhes adicionais..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              {/* Installments options step 4 */}
              <div className="space-y-4 bg-slate-50/50 dark:bg-white/5 p-6 rounded-3xl border border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-[#7184cf] dark:text-violet-400" />
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase tracking-wider">Passo 4: Parcelamento e Condições (Opcional)</h4>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={hasInstallments}
                      onChange={e => setHasInstallments(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    <span className="ml-3 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ativar Parcelamento</span>
                  </label>
                </div>

                {hasInstallments && (
                  <div className="space-y-6 pt-2 animate-in fade-in duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Quantidade de Parcelas</label>
                        <select
                          className="w-full bg-white dark:bg-[#121826] border border-slate-100 dark:border-white/10 rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-[#7184cf] font-medium text-slate-800 dark:text-white"
                          value={installmentsCount}
                          onChange={e => setInstallmentsCount(Number(e.target.value))}
                        >
                          {[...Array(12)].map((_, i) => (
                            <option key={i+1} value={i+1} className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white font-medium">
                              {i+1 === 1 ? '1 parcela (À vista)' : `${i+1} parcelas`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2 flex flex-col justify-end">
                        <div className="text-right text-xs text-slate-400 dark:text-slate-500 font-medium">
                          Valor total do orçamento: <strong className="text-slate-700 dark:text-slate-300 font-bold">{formatBRL(totalAmount)}</strong>
                        </div>
                        <div className="text-right text-xs mt-1">
                          {(() => {
                            const sum = customInstallments.reduce((acc, curr) => acc + (curr.amount || 0), 0);
                            const matches = Math.abs(sum - totalAmount) < 0.05;
                            return (
                              <div className="flex items-center justify-end gap-1.5 font-bold">
                                <span>Soma das parcelas:</span>
                                <span className={matches ? 'text-emerald-500' : 'text-rose-500 animate-pulse'}>
                                  {formatBRL(sum)}
                                </span>
                                {matches ? (
                                  <span className="text-emerald-500 text-[10px] bg-emerald-500/10 px-1.5 py-0.5 rounded">Preenchimento Correto</span>
                                ) : (
                                  <span className="text-rose-500 text-[10px] bg-rose-500/10 px-1.5 py-0.5 rounded">Diferença de {formatBRL(Math.abs(sum - totalAmount))}</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    <div className="border border-slate-100 dark:border-white/5 rounded-2xl overflow-hidden bg-white dark:bg-[#0d1428]/35 divide-y divide-slate-100 dark:divide-white/5">
                      {customInstallments.map((inst, index) => (
                        <div key={inst.number} className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                          <div className="text-xs font-extrabold text-[#7184cf] dark:text-[#7184cf] uppercase tracking-wider">
                            Parcela {inst.number}
                          </div>
                          
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Valor (R$)</label>
                            <input
                              type="number"
                              step="0.01"
                              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-white"
                              value={inst.amount || ''}
                              onChange={e => handleUpdateInstallment(index, 'amount', e.target.value)}
                              placeholder="0,00"
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Vencimento</label>
                            <input
                              type="date"
                              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-white"
                              value={inst.dueDate}
                              onChange={e => handleUpdateInstallment(index, 'dueDate', e.target.value)}
                              required
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Meio de Pagamento</label>
                            <select
                              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-xl py-2 px-3 text-xs font-semibold text-slate-800 dark:text-white"
                              value={inst.paymentMethod || 'Pix'}
                              onChange={e => handleUpdateInstallment(index, 'paymentMethod', e.target.value)}
                            >
                              <option value="Pix" className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">Pix</option>
                              <option value="Cartão de Crédito" className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">Cartão de Crédito</option>
                              <option value="Boleto" className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">Boleto</option>
                              <option value="Transferência" className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">Transferência</option>
                              <option value="Dinheiro" className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">Dinheiro</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex gap-4 pt-6 justify-end items-center border-t border-slate-100 dark:border-white/5 flex-wrap">
                <button
                  type="button"
                  onClick={() => { resetForm(); setIsCreating(false); }}
                  className="px-6 py-3.5 bg-slate-100 dark:bg-white/5 font-bold rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition active:scale-95"
                >
                  Cancelar
                </button>
                {editingBudget && (
                  <button
                    type="button"
                    onClick={() => handlePrint(editingBudget)}
                    className="flex items-center gap-2 px-6 py-3.5 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl transition active:scale-95 shadow-lg shadow-sky-500/20"
                    title="Exportar este orçamento como PDF imediatamente"
                  >
                    <FileDown size={18} />
                    Exportar PDF
                  </button>
                )}
                <button
                  type="submit"
                  className="flex items-center gap-2 px-8 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition active:scale-95 shadow-lg shadow-emerald-500/20"
                >
                  <Save size={18} />
                  Salvar Orçamento
                </button>
              </div>
            </form>
          </motion.div>
        ) : (
          // LIST BUDGETS VIEW
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Filters block (Search + Dates) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              {/* Text Search Input */}
              <div className="md:col-span-6 flex bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 px-4 py-3 rounded-2xl shadow-md items-center gap-3">
                <Search size={18} className="text-[#7184cf]" />
                <input 
                  type="text"
                  placeholder="Buscar por cliente, CPF/CNPJ, produto..."
                  className="bg-transparent border-none outline-none flex-1 text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-800 dark:text-white"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Date Filter: Start Date */}
              <div className="md:col-span-3 flex bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 px-4 py-3 rounded-2xl shadow-md items-center gap-3 text-slate-800 dark:text-white">
                <Calendar size={16} className="text-[#7184cf]" />
                <span className="text-[11px] font-black tracking-wider uppercase text-[#7184cf] whitespace-nowrap">De:</span>
                <input 
                  type="date"
                  className="bg-transparent border-none outline-none flex-1 text-xs font-semibold text-slate-800 dark:text-white dark:[color-scheme:dark]"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>

              {/* Date Filter: End Date */}
              <div className="md:col-span-3 flex bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 px-4 py-3 rounded-2xl shadow-md items-center gap-3 text-slate-800 dark:text-white">
                <Calendar size={16} className="text-[#7184cf]" />
                <span className="text-[11px] font-black tracking-wider uppercase text-[#7184cf] whitespace-nowrap">Até:</span>
                <input 
                  type="date"
                  className="bg-transparent border-none outline-none flex-1 text-xs font-semibold text-slate-800 dark:text-white dark:[color-scheme:dark]"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                />
                
                {(startDate || endDate) && (
                  <button 
                    type="button" 
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="text-slate-400 hover:text-rose-500 text-xs font-bold whitespace-nowrap px-1 ml-1"
                    title="Limpar Datas"
                  >
                    X
                  </button>
                )}
              </div>
            </div>

            {/* Tab buttons and Layout Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-white/5 pb-px gap-4 mb-2">
              <div className="flex gap-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('PENDING')}
                  className={`pb-4 px-1 text-sm font-bold border-b-2 transition relative ${
                    activeTab === 'PENDING' 
                      ? 'border-[#7184cf] text-[#7184cf]' 
                      : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white'
                  }`}
                >
                  Em Aberto / Pendentes
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('FINALIZED')}
                  className={`pb-4 px-1 text-sm font-bold border-b-2 transition relative ${
                    activeTab === 'FINALIZED' 
                      ? 'border-[#7184cf] text-[#7184cf]' 
                      : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-white'
                  }`}
                >
                  Finalizados
                </button>
              </div>

              {/* View layout switcher */}
              <div className="flex bg-slate-100 dark:bg-white/5 p-1 rounded-xl self-end sm:self-auto mb-2 sm:mb-0">
                <button
                  type="button"
                  onClick={() => setViewLayout('list')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewLayout === 'list' 
                      ? 'bg-white dark:bg-[#1a233d] text-[#7184cf] shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
                  }`}
                  title="Visualizar como Lista de Cards"
                >
                  <List size={14} />
                  Lista
                </button>
                <button
                  type="button"
                  onClick={() => setViewLayout('table')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    viewLayout === 'table' 
                      ? 'bg-white dark:bg-[#1a233d] text-[#7184cf] shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'
                  }`}
                  title="Visualizar como Tabela"
                >
                  <Table size={14} />
                  Tabela
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-24 text-center">
                <div className="inline-block w-8 h-8 border-4 border-[#7184cf]/20 border-t-[#7184cf] rounded-full animate-spin mb-4"></div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Carregando Orçamentos...</p>
              </div>
            ) : budgets.length === 0 ? (
              <div className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-3xl py-24 text-center shadow-xl">
                <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FileText size={32} />
                </div>
                <h3 className="text-xl font-bold mb-2">Nenhum orçamento cadastrado</h3>
                <p className="text-slate-400 dark:text-slate-500 text-sm max-w-sm mx-auto mb-6">
                  Você ainda não registrou nenhum orçamento comercial na sua conta.
                </p>
                <button 
                  onClick={() => setIsCreating(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-[#7184cf] text-white font-bold rounded-2xl shadow-lg hover:bg-[#5c6eb1] transition"
                >
                  <Plus size={18} /> Criar Primeiro Orçamento
                </button>
              </div>
            ) : (() => {
              const tabBudgets = filteredBudgets.filter(b => {
                const isPending = b.status === 'PENDING';
                return activeTab === 'PENDING' ? isPending : !isPending;
              });

              if (tabBudgets.length === 0) {
                return (
                  <div className="bg-white dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-3xl py-20 text-center shadow-md">
                    <p className="text-slate-400 dark:text-slate-500 text-sm font-bold uppercase tracking-wider">
                      Nenhum orçamento {activeTab === 'PENDING' ? 'pendente ou em aberto' : 'finalizado'} correspondente.
                    </p>
                  </div>
                );
              }

              if (viewLayout === 'list') {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tabBudgets.map((b) => {
                      const seqNum = getBudgetNumber(b);
                      return (
                        <div 
                          key={b.id}
                          className="bg-white dark:bg-[#1a233d]/70 border border-slate-100 dark:border-white/5 rounded-[2rem] p-6 shadow-md hover:shadow-lg transition-all flex flex-col justify-between relative overflow-hidden pl-8"
                        >
                          {/* Left visual stripe matching budget status */}
                          <div className={`absolute left-0 top-0 bottom-0 w-2.5 ${
                            b.status === 'APPROVED' ? 'bg-emerald-500' : 'bg-sky-500'
                          }`} />

                          <div className="space-y-4">
                            {/* Card Header: Doc Number & Date */}
                            <div className="flex items-center justify-between">
                              <span className="font-mono text-xs font-black text-[#7184cf] tracking-wider bg-[#7184cf]/10 dark:bg-[#7184cf]/20 px-2.5 py-1 rounded-xl">
                                ORÇ-{seqNum.toString().padStart(3, '0')}
                              </span>
                              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500">
                                <Calendar size={13} />
                                {b.date.split('-').reverse().join('/')}
                              </div>
                            </div>

                            {/* Client detail */}
                            <div>
                              <div className="flex items-start gap-2">
                                <User size={16} className="text-[#7184cf] shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <h4 className="font-extrabold text-[#0d1428] dark:text-white text-base leading-tight truncate">
                                    {b.client.name || 'Cliente Sem Nome'}
                                  </h4>
                                  {b.client.document && (
                                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                                      CPF/CNPJ: {b.client.document}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Items breakdown summary & visual tags */}
                            <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl p-4 space-y-2">
                              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold">
                                <span className="flex items-center gap-1.5 text-slate-400">
                                  <FileText size={14} />
                                  Itens no Orçamento:
                                </span>
                                <span className="text-slate-700 dark:text-white font-extrabold">
                                  {b.items.length} {b.items.length === 1 ? 'item' : 'itens'}
                                </span>
                              </div>

                              {/* Preview of first 2 items */}
                              {b.items.length > 0 && (
                                <div className="pt-2 border-t border-slate-150 dark:border-white/5 space-y-1">
                                  {b.items.slice(0, 2).map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                                      <span className="truncate max-w-[150px]">{item.description}</span>
                                      <span>{item.quantity}x {formatBRL(item.unitPrice)}</span>
                                    </div>
                                  ))}
                                  {b.items.length > 2 && (
                                    <p className="text-[10px] text-[#7184cf] font-bold italic pt-0.5">
                                      + {b.items.length - 2} {b.items.length - 2 === 1 ? 'outro item' : 'outros itens'}...
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Amount Summary Row */}
                              <div className="pt-3 border-t border-slate-150 dark:border-white/5 flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor do Orçamento</span>
                                <div className="text-right">
                                  <span className="text-base font-black text-slate-900 dark:text-white">
                                    {formatBRL(b.totalAmount)}
                                  </span>
                                  {b.installments && b.installments.length > 0 && (
                                    <div className="text-[10px] text-[#7184cf] dark:text-violet-400 font-bold leading-none mt-0.5">
                                      {b.installments.length}x {formatBRL(b.installments[0].amount)}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Footer Actions */}
                          <div className="pt-4 mt-4 border-t border-slate-150 dark:border-white/5 flex flex-col gap-3">
                            {/* Status and Primary action */}
                            <div className="flex items-center justify-between">
                              <span className={`px-2.5 py-1 text-[10px] font-extrabold rounded-full tracking-wider uppercase ${
                                b.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-sky-500/10 text-sky-500'
                              }`}>
                                {b.status === 'APPROVED' ? 'Aprovado / Finalizado' : 'Pendente'}
                              </span>

                              {/* Direct Finalize buttons if pending */}
                              {b.status === 'PENDING' && onFinalizeBudget && (
                                <button
                                  type="button"
                                  onClick={() => onFinalizeBudget(b)}
                                  className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500 hover:text-white px-3 py-1.5 rounded-xl font-bold transition duration-300 shadow-sm cursor-pointer"
                                  title="Finalizar e Registrar Financeiro"
                                >
                                  <CheckCircle size={14} />
                                  <span>Registrar Caixa</span>
                                </button>
                              )}
                            </div>

                            {/* Quick Tool Actions row */}
                            <div className="flex items-center justify-between gap-1 pt-1">
                              <div className="flex gap-1 items-center">
                                {/* Quick Toggle direct Approved state */}
                                {b.status === 'PENDING' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(b.id, 'APPROVED')}
                                    className="p-2 text-slate-400 hover:text-[#5c6db3] hover:bg-[#5c6db3]/5 dark:hover:bg-[#5c6db3]/10 rounded-xl transition cursor-pointer"
                                    title="Aprovar Orçamento"
                                  >
                                    <Check size={16} />
                                  </button>
                                )}

                                {/* Quick Switch to Pending state */}
                                {b.status === 'APPROVED' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(b.id, 'PENDING')}
                                    className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-500/5 dark:hover:bg-amber-500/10 rounded-xl transition cursor-pointer"
                                    title="Mudar status para Pendente"
                                  >
                                    <RotateCcw size={16} />
                                  </button>
                                )}

                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => handleStartEditBudget(b)}
                                  className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-500/5 dark:hover:bg-amber-500/10 rounded-xl transition cursor-pointer"
                                  title="Editar Orçamento"
                                >
                                  <Edit size={16} />
                                </button>

                                {/* Print / Export PDF button */}
                                <button
                                  type="button"
                                  onClick={() => handlePrint(b)}
                                  className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/15 dark:hover:bg-emerald-500/10 rounded-xl transition flex items-center gap-1 font-extrabold text-[11px] cursor-pointer"
                                  title="Exportar PDF direto"
                                >
                                  <FileDown size={16} className="text-emerald-500" />
                                  <span className="text-emerald-500 uppercase">PDF</span>
                                </button>

                                {/* WhatsApp Button */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenWhatsAppManual(b)}
                                  className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/15 dark:hover:bg-emerald-500/10 rounded-xl transition flex items-center gap-1 font-extrabold text-[11px] cursor-pointer"
                                  title="Enviar Orçamento via WhatsApp"
                                >
                                  <MessageSquare size={16} className="text-emerald-500" />
                                  <span className="text-emerald-500 uppercase">WhatsApp</span>
                                </button>
                              </div>

                              {/* Trash/Delete Column right */}
                              <button
                                type="button"
                                onClick={() => setBudgetToDelete(b)}
                                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/5 dark:hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                                title="Excluir Orçamento"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                // LIST VIEW TABLE OF BUDGETS
                <div className="overflow-x-auto border border-slate-150 dark:border-white/5 rounded-2xl bg-white dark:bg-[#111a30]/30 shadow-xl">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 dark:bg-slate-800/40 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-white/5">
                        <th className="px-6 py-4 text-center w-24">Nº Seq</th>
                        <th className="px-6 py-4">Cliente</th>
                        <th className="px-6 py-4 text-center">Itens</th>
                        <th className="px-6 py-4">Data Emissão</th>
                        <th className="px-6 py-4 text-right">Valor Total</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center w-40">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {tabBudgets.map((b) => {
                        const seqNum = getBudgetNumber(b);

                        return (
                          <tr 
                            key={b.id}
                            className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group"
                          >
                            <td className="px-6 py-4 text-center font-mono text-sm font-black text-slate-400 group-hover:text-[#7184cf] dark:group-hover:text-[#7184cf] transition-colors">
                              {seqNum}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-800 dark:text-white group-hover:text-[#7184cf] transition-colors">
                                {b.client.name || 'Cliente Sem Nome'}
                              </div>
                              {b.client.document && (
                                <div className="text-[11px] text-slate-400 font-medium mt-0.5">CPF/CNPJ: {b.client.document}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center font-semibold text-slate-500 dark:text-slate-400">
                              {b.items.length} {b.items.length === 1 ? 'item' : 'itens'}
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                              {b.date.split('-').reverse().join('/')}
                            </td>
                            <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              <div>{formatBRL(b.totalAmount)}</div>
                              {b.installments && b.installments.length > 0 && (
                                <div className="text-[10px] text-[#7184cf] dark:text-violet-400 font-bold mt-0.5 whitespace-nowrap">
                                  {b.installments.length}x {formatBRL(b.installments[0].amount)}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full tracking-wider uppercase ${
                                b.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-sky-500/10 text-sky-500'
                              }`}>
                                {b.status === 'APPROVED' ? 'Aprovado / Finalizado' : 'Pendente'}
                              </span>
                            </td>
                            <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                {/* Launch Financial (if pending) */}
                                {b.status === 'PENDING' && onFinalizeBudget && (
                                  <button
                                    type="button"
                                    onClick={() => onFinalizeBudget(b)}
                                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-[#10b981]/5 dark:hover:bg-[#10b981]/10 rounded-xl transition cursor-pointer"
                                    title="Finalizar e Registrar Financeiro"
                                  >
                                    <CheckCircle size={16} />
                                  </button>
                                )}

                                {/* Quick Approve directly (if pending) */}
                                {b.status === 'PENDING' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(b.id, 'APPROVED')}
                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-500/5 dark:hover:bg-blue-500/10 rounded-xl transition cursor-pointer"
                                    title="Aprovar Diretamente"
                                  >
                                    <Check size={16} />
                                  </button>
                                )}

                                {/* Reverse to Pending (if approved) */}
                                {b.status === 'APPROVED' && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStatus(b.id, 'PENDING')}
                                    className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-500/5 dark:hover:bg-amber-500/10 rounded-xl transition cursor-pointer"
                                    title="Mudar status para Pendente"
                                  >
                                    <RotateCcw size={16} />
                                  </button>
                                )}

                                {/* Edit Button */}
                                <button
                                  type="button"
                                  onClick={() => handleStartEditBudget(b)}
                                  className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-500/5 dark:hover:bg-amber-500/10 rounded-xl transition cursor-pointer"
                                  title="Editar Orçamento"
                                >
                                  <Edit size={16} />
                                </button>

                                {/* Print PDF Button */}
                                <button
                                  type="button"
                                  onClick={() => handlePrint(b)}
                                  className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/15 dark:hover:bg-[#7184cf]/10 rounded-xl transition cursor-pointer flex items-center gap-1 font-bold text-xs"
                                  title="Exportar PDF direto"
                                >
                                  <FileDown size={16} className="text-emerald-500" />
                                  <span className="text-emerald-500 uppercase">PDF</span>
                                </button>

                                {/* WhatsApp Button */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenWhatsAppManual(b)}
                                  className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/15 dark:hover:bg-[#7184cf]/10 rounded-xl transition cursor-pointer flex items-center gap-1 font-bold text-xs"
                                  title="Enviar Orçamento via WhatsApp"
                                >
                                  <MessageSquare size={16} className="text-emerald-500" />
                                  <span className="text-emerald-500 uppercase">WhatsApp</span>
                                </button>

                                {/* Delete Button */}
                                <button
                                  type="button"
                                  onClick={() => setBudgetToDelete(b)}
                                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/5 dark:hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                                  title="Excluir Orçamento"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {budgetToDelete && (
          <div className="fixed inset-0 bg-[#0d1428]/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#1a233d] rounded-[2rem] max-w-sm w-full p-8 shadow-2xl border border-slate-100 dark:border-white/5 text-[#0d1428] dark:text-white"
            >
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-black text-[#0d1428] dark:text-white text-center mb-2">Excluir Orçamento?</h3>
              <p className="text-slate-500 dark:text-slate-400 text-center text-sm mb-6">
                Deseja realmente excluir o orçamento nº <strong className="text-[#7184cf]">{getBudgetNumber(budgetToDelete)}</strong> para <strong className="text-[#7184cf]">{budgetToDelete.client.name || 'Cliente Sem Nome'}</strong>? Esta ação é irreversível.
              </p>
              
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setBudgetToDelete(null)}
                  className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-2xl font-bold transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="button"
                  onClick={() => handleDeleteBudget(budgetToDelete.id)}
                  className="flex-1 py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-bold transition-all"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WhatsApp Modal Notification Confirmation */}
      <AnimatePresence>
        {whatsAppModalOpen && selectedBudgetForWhatsApp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 no-print select-none">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[2rem] p-6 shadow-2xl w-full max-w-lg flex flex-col space-y-4 max-h-[90vh] overflow-hidden"
            >
              
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                    <MessageSquare size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-white leading-none">Confirmar via WhatsApp</h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 uppercase tracking-wider">Envio de Orçamento</p>
                  </div>
                </div>
                <button 
                  onClick={() => setWhatsAppModalOpen(false)}
                  className="text-slate-400 hover:bg-slate-50 dark:hover:bg-white/10 p-2 rounded-full transition-all cursor-pointer"
                  aria-label="Fechar"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Número de WhatsApp do Cliente</label>
                  <input
                    type="text"
                    value={whatsAppClientPhone}
                    onChange={(e) => setWhatsAppClientPhone(e.target.value)}
                    placeholder="Ex: (11) 99999-9999"
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#0b101c] text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7184cf] transition-all font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Visualização da Mensagem</label>
                    <span className="text-[9px] text-slate-300 dark:text-slate-500 font-bold uppercase tracking-wider">Formato WhatsApp</span>
                  </div>
                  
                  {/* Simulated WhatsApp Chat Bubble */}
                  <div className="border border-slate-200 dark:border-white/5 rounded-2xl p-4 bg-slate-100 dark:bg-[#070b12] relative overflow-hidden min-h-[220px]">
                    <div className="absolute inset-0 bg-[#e5ddd5]/30 dark:bg-[#0c1320] opacity-40 pointer-events-none" style={{ backgroundImage: "radial-gradient(#ccc 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
                    <div className="relative bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-800 dark:text-slate-100 p-3.5 rounded-2xl rounded-tr-none shadow-sm text-xs font-semibold whitespace-pre-wrap ml-auto max-w-[95%] border border-[#d1f4cc]/40 dark:border-emerald-600/20">
                      <textarea
                        value={whatsAppMessageText}
                        onChange={(e) => setWhatsAppMessageText(e.target.value)}
                        className="w-full bg-transparent border-none p-0 focus:outline-none focus:ring-0 text-xs font-semibold font-sans leading-relaxed text-slate-800 dark:text-slate-100 resize-none min-h-[160px]"
                        placeholder="Mensagem..."
                        rows={8}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-3 text-center">
                      Você pode editar livremente o texto acima antes de enviar.
                    </div>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 text-[11px] text-amber-600 dark:text-amber-400 font-bold leading-relaxed flex gap-2.5 items-start">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <p className="uppercase text-[9px] tracking-wider mb-0.5">Nota sobre o Envio Gratuito</p>
                    Ao confirmar, abriremos o WhatsApp Web ou aplicativo oficial com o número e o texto já preenchidos. Só será necessário tocar/clicar em "Enviar". Sem taxas adicionais ou necessidade de contratar APIs de terceiros.
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-slate-100 dark:border-white/5">
                <button
                  onClick={() => setWhatsAppModalOpen(false)}
                  className="w-full border border-[#e2e8f0] dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 font-extrabold text-xs px-4 py-3.5 rounded-2xl transition-all cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  onClick={() => {
                    const cleanedPhone = sanitizePhoneNumber(whatsAppClientPhone);
                    if (!cleanedPhone) {
                      alert('Por favor, informe ou valide o número de contato do cliente.');
                      return;
                    }
                    const encodedText = encodeURIComponent(whatsAppMessageText);
                    
                    // Use standardized api.whatsapp.com for best compatibility (mobiles & web)
                    const url = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodedText}`;
                    window.open(url, '_blank');
                    setWhatsAppModalOpen(false);
                  }}
                  className="w-full bg-[#25d366] hover:bg-[#20ba5a] text-white font-extrabold text-xs px-4 py-3.5 rounded-[1.25rem] shadow-lg shadow-emerald-500/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Send size={14} /> Confirmar & Enviar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default BudgetsView;
