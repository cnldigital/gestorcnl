import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  X, 
  Pencil, 
  Phone, 
  MapPin,
  AlertCircle,
  Calendar,
  Clock,
  Wrench,
  Printer,
  FileCheck,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  FilePlus2,
  MessageSquare,
  Send
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  getDocs,
  query,
  orderBy
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { Client, User, Budget, BudgetItem, ClientData, View } from '../types';

interface Appointment {
  id: string;
  userId: string;
  clientId?: string;
  client: ClientData;
  date: string;
  time: string;
  serviceDescription: string;
  equipment?: string;
  totalAmount: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';
  notes?: string;
  createdAt: string;
}

interface AppointmentWithId extends Appointment {
  id: string;
}

interface AppointmentsViewProps {
  currentUser: User | null;
  selectedAccountId: string | null;
  setView: (view: View) => void;
}

const statusLabels: Record<Appointment['status'], string> = {
  SCHEDULED: 'Agendado',
  IN_PROGRESS: 'Em Andamento',
  COMPLETED: 'Concluído',
  CANCELED: 'Cancelado'
};

const statusColors: Record<Appointment['status'], string> = {
  SCHEDULED: 'bg-indigo-50 border-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-400',
  IN_PROGRESS: 'bg-amber-50 border-amber-100 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400',
  COMPLETED: 'bg-emerald-50 border-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400',
  CANCELED: 'bg-slate-50 border-slate-100 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-slate-400'
};

const formatBRL = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(val);
};

const sanitizePhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return '';
  if (cleaned.length === 10 || cleaned.length === 11) {
    return '55' + cleaned;
  }
  return cleaned;
};

const getWhatsAppMessage = (app: Appointment, companyNameVal?: string): string => {
  const dateFormatted = app.date ? app.date.split('-').reverse().join('/') : '';
  const valFormatted = formatBRL(app.totalAmount || 0);
  const company = companyNameVal || '';
  
  return `Olá, *${app.client.name}*! 👋

Passando para confirmar o seu agendamento de serviço com a empresa *${company || 'nossa equipe'}*:

📅 *Data do Serviço:* ${dateFormatted}
⏰ *Horário:* ${app.time}h
🛠️ *Descrição dos Serviços:* ${app.serviceDescription}
${app.equipment ? `📱 *Tipo de Atendimento:* ${app.equipment}\n` : ''}💰 *Preço Preliminar Estimado:* ${valFormatted}
${app.notes ? `📝 *Observações Internas:* ${app.notes}\n` : ''}
*Por favor, confirme respondendo a esta mensagem com "Sim".*

Agradecemos a preferência! 😊`;
};

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({ currentUser, selectedAccountId, setView }) => {
  const [appointments, setAppointments] = useState<AppointmentWithId[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Appointment['status']>('ALL');
  
  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithId | null>(null);
  const [deletingAppointment, setDeletingAppointment] = useState<AppointmentWithId | null>(null);
  const [selectedOS, setSelectedOS] = useState<AppointmentWithId | null>(null);
  const [isGeneratingBudget, setIsGeneratingBudget] = useState<string | null>(null);
  const [generatedBudgetSuccess, setGeneratedBudgetSuccess] = useState<{ budgetId: string, clientName: string } | null>(null);

  // WhatsApp states
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [selectedAppForWhatsApp, setSelectedAppForWhatsApp] = useState<Appointment | null>(null);
  const [whatsAppMessageText, setWhatsAppMessageText] = useState('');
  const [whatsAppClientPhone, setWhatsAppClientPhone] = useState('');

  const [formError, setFormError] = useState('');
  
  // Form states
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearchText, setClientSearchText] = useState('');
  const [showClientList, setShowClientList] = useState(false);
  const clientSelectorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (clientSelectorRef.current && !clientSelectorRef.current.contains(event.target as Node)) {
        setShowClientList(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);
  
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '09:00',
    serviceDescription: '',
    equipment: '',
    totalAmountString: '',
    status: 'SCHEDULED' as Appointment['status'],
    notes: '',
    // Backwards client info if typing manually
    clientName: '',
    clientContact: '',
    clientDocument: '',
    clientEmail: '',
    clientAddress: '',
  });

  // Load clients and appointments
  useEffect(() => {
    if (!currentUser || !selectedAccountId) return;

    const appointmentsRef = collection(db, `users/${selectedAccountId}/appointments`);
    const qApp = query(appointmentsRef, orderBy('date', 'desc'));
    
    const unsubApp = onSnapshot(qApp, (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as AppointmentWithId));
      setAppointments(list);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${selectedAccountId}/appointments`);
      setLoading(false);
    });

    const clientsRef = collection(db, `users/${selectedAccountId}/clients`);
    const unsubClients = onSnapshot(clientsRef, (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Client));
      setClients(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${selectedAccountId}/clients`);
    });

    return () => {
      unsubApp();
      unsubClients();
    };
  }, [currentUser, selectedAccountId]);

  // Client suggestions search
  const filteredClientSuggestions = clients.filter(c => {
    const text = clientSearchText.trim().toLowerCase();
    if (!text) return false;
    return (
      c.name.toLowerCase().includes(text) ||
      (c.tradeName && c.tradeName.toLowerCase().includes(text)) ||
      c.document.includes(text)
    );
  });

  const handleSelectClientFromList = (client: Client) => {
    setSelectedClient(client);
    setClientSearchText(client.name);
    setShowClientList(false);
    setForm(prev => ({
      ...prev,
      clientName: client.name,
      clientContact: client.contact || '',
      clientDocument: client.document,
      clientEmail: client.email || '',
      clientAddress: `${client.address || ''}, ${client.number || ''} ${client.bairro || ''} - ${client.city || ''}/${client.state || ''}`.trim()
    }));
  };

  const handleManualClientChange = (nameStr: string) => {
    setClientSearchText(nameStr);
    setSelectedClient(null);
    setForm(prev => ({
      ...prev,
      clientName: nameStr
    }));
    setShowClientList(true);
  };

  const openForm = (app?: AppointmentWithId) => {
    setFormError('');
    setSelectedClient(null);
    setShowClientList(false);

    if (app) {
      setEditingAppointment(app);
      setClientSearchText(app.client.name || '');
      
      const found = clients.find(c => c.name === app.client.name) || null;
      if (found) setSelectedClient(found);

      setForm({
        date: app.date || new Date().toISOString().split('T')[0],
        time: app.time || '09:00',
        serviceDescription: app.serviceDescription || '',
        equipment: app.equipment || '',
        totalAmountString: app.totalAmount ? formatBRLString((app.totalAmount * 100).toString()) : '',
        status: app.status || 'SCHEDULED',
        notes: app.notes || '',
        clientName: app.client.name || '',
        clientContact: app.client.contact || '',
        clientDocument: app.client.document || '',
        clientEmail: app.client.email || '',
        clientAddress: app.client.address || ''
      });
    } else {
      setEditingAppointment(null);
      setClientSearchText('');
      setForm({
        date: new Date().toISOString().split('T')[0],
        time: '09:00',
        serviceDescription: '',
        equipment: '',
        totalAmountString: '',
        status: 'SCHEDULED',
        notes: '',
        clientName: '',
        clientContact: '',
        clientDocument: '',
        clientEmail: '',
        clientAddress: ''
      });
    }
    setIsFormOpen(true);
  };

  const formatBRLString = (value: string): string => {
    const cleanValue = value.replace(/\D/g, '');
    if (!cleanValue) return '';
    const numValue = parseInt(cleanValue, 10) / 100;
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numValue);
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setForm(prev => ({
      ...prev,
      totalAmountString: formatBRLString(rawVal)
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedAccountId) return;

    const trimmedClientName = clientSearchText.trim();
    if (!trimmedClientName) {
      setFormError('Por favor informe o nome do cliente.');
      return;
    }

    if (!form.serviceDescription.trim()) {
      setFormError('Por favor descreva o serviço/motivo do agendamento.');
      return;
    }

    const cleanAmount = form.totalAmountString.replace(/\D/g, '');
    const amountNum = cleanAmount ? parseInt(cleanAmount, 10) / 100 : 0;

    let finalClient: ClientData = {
      name: trimmedClientName,
      contact: form.clientContact.trim() || '',
      document: form.clientDocument.trim() || '',
      email: form.clientEmail.trim() || '',
      address: form.clientAddress.trim() || ''
    };

    if (selectedClient) {
      finalClient = {
        name: selectedClient.name,
        document: selectedClient.document || '',
        contact: selectedClient.contact || '',
        email: selectedClient.email || '',
        address: `${selectedClient.address || ''}, ${selectedClient.number || ''} ${selectedClient.bairro || ''} - ${selectedClient.city || ''}/${selectedClient.state || ''}`.trim()
      };
    }

    const payload: Omit<Appointment, 'id'> = {
      userId: selectedAccountId,
      clientId: selectedClient?.id || '',
      client: finalClient,
      date: form.date,
      time: form.time,
      serviceDescription: form.serviceDescription.trim(),
      equipment: form.equipment.trim() || '',
      totalAmount: amountNum,
      status: form.status,
      notes: form.notes.trim() || '',
      createdAt: editingAppointment ? editingAppointment.createdAt : new Date().toISOString()
    };

    try {
      const path = `users/${selectedAccountId}/appointments`;
      let savedApp: Appointment;
      if (editingAppointment) {
        const docRef = doc(db, path, editingAppointment.id);
        await updateDoc(docRef, payload);
        savedApp = { ...payload, id: editingAppointment.id } as Appointment;
      } else {
        const docRef = await addDoc(collection(db, path), payload);
        savedApp = { ...payload, id: docRef.id } as Appointment;
      }
      setIsFormOpen(false);

      if (savedApp.client?.contact) {
        setSelectedAppForWhatsApp(savedApp);
        setWhatsAppMessageText(getWhatsAppMessage(savedApp, currentUser?.companyName || currentUser?.name));
        setWhatsAppClientPhone(savedApp.client.contact);
        setWhatsAppModalOpen(true);
      }
    } catch (err) {
      console.error(err);
      setFormError('Ocorreu um erro ao salvar o agendamento.');
    }
  };

  const handleOpenWhatsAppManual = (app: Appointment) => {
    setSelectedAppForWhatsApp(app);
    setWhatsAppMessageText(getWhatsAppMessage(app, currentUser?.companyName || currentUser?.name));
    setWhatsAppClientPhone(app.client?.contact || '');
    setWhatsAppModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedAccountId || !deletingAppointment) return;

    try {
      const docRef = doc(db, `users/${selectedAccountId}/appointments`, deletingAppointment.id);
      await deleteDoc(docRef);
      setDeletingAppointment(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleQuickUpdateStatus = async (appId: string, newStatus: Appointment['status']) => {
    if (!selectedAccountId) return;
    try {
      const docRef = doc(db, `users/${selectedAccountId}/appointments`, appId);
      await updateDoc(docRef, { status: newStatus });
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Convert OS to Budget
  const handleGenerateBudget = async (app: AppointmentWithId) => {
    if (!selectedAccountId) return;
    setIsGeneratingBudget(app.id);

    try {
      // Fetch budgets to estimate next number
      const budgetsRef = collection(db, `users/${selectedAccountId}/budgets`);
      const snapshot = await getDocs(budgetsRef);
      const budgetsList = snapshot.docs.map(doc => doc.data() as Budget);
      
      const maxNumber = budgetsList.reduce((max, b) => (b.number && b.number > max ? b.number : max), 0);
      const nextNumber = maxNumber + 1;

      const item: BudgetItem = {
        id: crypto.randomUUID(),
        quantity: 1,
        unit: 'UN',
        description: app.serviceDescription,
        unitPrice: app.totalAmount,
        total: app.totalAmount
      };

      const newBudget: Omit<Budget, 'id'> = {
        userId: selectedAccountId,
        client: app.client,
        items: [item],
        totalAmount: app.totalAmount,
        date: new Date().toISOString().split('T')[0],
        status: 'PENDING',
        notes: `Gerado automaticamente a partir da Ordem de Serviço da data ${app.date}. Equipamento/Aparelho do serviço: ${app.equipment || 'N/A'}.`,
        createdAt: new Date().toISOString(),
        number: nextNumber
      };

      const docRef = await addDoc(budgetsRef, newBudget);
      
      setGeneratedBudgetSuccess({
        budgetId: docRef.id,
        clientName: app.client.name || 'Cliente'
      });
    } catch (err) {
      console.error(err);
      alert('Houve um erro ao tentar gerar o orçamento.');
    } finally {
      setIsGeneratingBudget(null);
    }
  };

  const handlePrint = () => {
    if (!selectedOS) return;

    const generatePdf = (logoBase64?: string) => {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const nextNo = selectedOS.id.slice(0, 8).toUpperCase();

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
            console.error('Error rendering logo in OS PDF:', e);
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
        doc.text(`Ordem de Serviço (OS) Nº ${nextNo}`, textStartX, 21);

        // Metadata on right
        doc.setFontSize(8);
        doc.setTextColor(100, 110, 130);
        const rightX = 195;
        
        doc.text(`Emissão: ${new Date(selectedOS.createdAt).toLocaleDateString()}`, rightX, 15, { align: 'right' });
        doc.text(`Status: ${
          statusLabels[selectedOS.status].toUpperCase()
        }`, rightX, 20, { align: 'right' });

        // Divider line
        doc.setDrawColor(220, 225, 235);
        doc.setLineWidth(0.4);
        doc.line(15, 25, 195, 25);
      };

      addHeader();

      let currentY = 32;

      // 1. DADOS DO PRESTADOR & CLIENTE
      // Card 1: Prestador
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, currentY, 85, 28, 1.5, 1.5, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(13, 20, 40);
      doc.text('DADOS DO PRESTADOR / EMISSOR', 18, currentY + 5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Nome/Empresa: ${currentUser?.companyName || currentUser?.name || 'Sem nome'}`, 18, currentY + 11);
      doc.text(`CNPJ/CPF: ${currentUser?.companyDocument || 'Não informado'}`, 18, currentY + 16);
      doc.text(`Contato: ${currentUser?.companyPhone || currentUser?.companyEmail || currentUser?.email || 'Não informado'}`, 18, currentY + 21);
      
      let companyAddrStr = currentUser?.companyAddress || 'Não informado';
      if (currentUser?.companyCep) {
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
      doc.text(`Nome: ${selectedOS.client.name || 'Sem nome'}`, 113, currentY + 11);
      doc.text(`CPF/CNPJ: ${selectedOS.client.document || 'Não informado'}`, 113, currentY + 16);
      doc.text(`Contato: ${selectedOS.client.contact || 'Não informado'}`, 113, currentY + 21);
      
      const clientAddrStr = selectedOS.client.address || 'Não informado';
      const clientAddressLines = doc.splitTextToSize(`Endereço: ${clientAddrStr}`, 78);
      doc.text(clientAddressLines[0], 113, currentY + 26);

      currentY += 31;

      // Card 3: Informações do Atendimento
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, currentY, 180, 18, 1.5, 1.5, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(13, 20, 40);
      doc.text('INFORMAÇÕES DE AGENDAMENTO', 18, currentY + 5);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Data do Serviço: ${selectedOS.date.split('-').reverse().join('/')}`, 18, currentY + 11);
      doc.text(`Horário Programado: ${selectedOS.time}`, 110, currentY + 11);

      currentY += 21;

      // Card 4: Detalhes Técnicos e Equipamentos
      const descLines = doc.splitTextToSize(selectedOS.serviceDescription || 'Nenhuma descrição técnica inserida', 170);
      const outputLines = descLines.slice(0, 50); // Aumento significativo do limite para 50 linhas para suportar mais caracteres
      const card4Height = Math.max(35, 24 + outputLines.length * 4.5);

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, currentY, 180, card4Height, 1.5, 1.5, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(13, 20, 40);
      doc.text('DETALHES DA OS', 18, currentY + 6);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(`Tipo de Atendimento:`, 18, currentY + 14);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(13, 20, 40);
      doc.text(`${selectedOS.equipment || 'Não informado'}`, 50, currentY + 14);

      // Descrição Técnica
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Descrição do serviço:', 18, currentY + 22);
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      doc.text(outputLines, 18, currentY + 28);

      currentY += card4Height + 4;

      // Card 5: Preço e condições financeiras
      if (currentY + 25 > 275) {
        doc.addPage();
        currentY = 18;
      }

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(15, currentY, 180, 16, 1.5, 1.5, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(13, 20, 40);
      doc.text('TOTAL PRELIMINAR DOS SERVIÇOS', 18, currentY + 6);
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 110, 125);
      doc.text('Sujeito a reajustes adicionais conforme aprovação técnica.', 18, currentY + 11);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(13, 20, 40);
      doc.text(formatBRL(selectedOS.totalAmount), 190, currentY + 10, { align: 'right' });

      currentY += 21;

      // Notes / Observações Gerais
      if (selectedOS.notes) {
        if (currentY > 230) {
          doc.addPage();
          currentY = 18;
        }
        doc.setFillColor(254, 243, 199); // soft amber bg
        doc.setDrawColor(245, 158, 11);
        doc.setLineWidth(0.2);

        const noteText = `OBSERVAÇÕES ADICIONAIS:\n${selectedOS.notes}`;
        const wrappedNotes = doc.splitTextToSize(noteText, 170);
        const notesHeight = wrappedNotes.length * 4.5 + 6;

        doc.roundedRect(15, currentY, 180, notesHeight, 1, 1, 'FD');
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(120, 53, 4);

        doc.text(wrappedNotes, 18, currentY + 5);
        currentY += notesHeight + 10;
      }

      // Assinaturas
      if (currentY > 220) {
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
      doc.text('Assinatura do Técnico Responsável', 57.5, currentY + 5, { align: 'center' });
      doc.text('Assinatura / Autorização do Cliente', 152.5, currentY + 5, { align: 'center' });

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
        doc.text('Gestor CNL Software • Ordem de Serviço (OS)', 15, 287);
        doc.text(`Ficha de Serviço Oficial • Página ${i} de ${totalPages}`, 195, 287, { align: 'right' });
      }

      doc.save(`OS_${nextNo}_${selectedOS.client.name?.replace(/\s+/g, '_') || 'Cliente'}.pdf`);
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

  const filteredAppointments = appointments.filter(app => {
    // Search filter
    const searchLow = search.toLowerCase();
    const matchesSearch = 
      (app.client.name || '').toLowerCase().includes(searchLow) ||
      (app.serviceDescription || '').toLowerCase().includes(searchLow) ||
      (app.equipment || '').toLowerCase().includes(searchLow);
      
    // Status filter
    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Printable Area Hack styling */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area-wrapper, #print-area-wrapper * {
            visibility: visible;
          }
          #print-area-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Header Cards Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Geral</span>
            <p className="text-3xl font-black text-slate-800 dark:text-white mt-1">{appointments.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-500">
            <Calendar size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Agendados</span>
            <p className="text-3xl font-black text-slate-800 dark:text-white mt-1">
              {appointments.filter(a => a.status === 'SCHEDULED').length}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-[#7184cf]/10 dark:text-[#7184cf] flex items-center justify-center">
            <Clock size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Em Andamento</span>
            <p className="text-3xl font-black text-slate-800 dark:text-white mt-1">
              {appointments.filter(a => a.status === 'IN_PROGRESS').length}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400 flex items-center justify-center">
            <Wrench size={22} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl p-6 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Concluídos</span>
            <p className="text-3xl font-black text-slate-800 dark:text-white mt-1">
              {appointments.filter(a => a.status === 'COMPLETED').length}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* Main Filter / Search Area */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[2rem] p-6 shadow-sm space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button 
              onClick={() => setStatusFilter('ALL')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                statusFilter === 'ALL' 
                ? 'bg-[#7184cf] text-white shadow-md' 
                : 'bg-slate-50 border border-slate-100 dark:bg-white/5 dark:border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${statusFilter === 'ALL' ? 'bg-white' : 'bg-slate-300 dark:bg-slate-500'}`} />
              Todos ({appointments.length})
            </button>
            <button 
              onClick={() => setStatusFilter('SCHEDULED')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                statusFilter === 'SCHEDULED' 
                ? 'bg-indigo-500 text-white shadow-md' 
                : 'bg-slate-50 border border-slate-100 dark:bg-white/5 dark:border-transparent text-indigo-500 dark:text-indigo-400 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${statusFilter === 'SCHEDULED' ? 'bg-white' : 'bg-indigo-500'}`} />
              Agendados ({appointments.filter(a => a.status === 'SCHEDULED').length})
            </button>
            <button 
              onClick={() => setStatusFilter('IN_PROGRESS')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                statusFilter === 'IN_PROGRESS' 
                ? 'bg-amber-500 text-white shadow-md' 
                : 'bg-slate-50 border border-slate-100 dark:bg-white/5 dark:border-transparent text-amber-500 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${statusFilter === 'IN_PROGRESS' ? 'bg-white' : 'bg-amber-500'}`} />
              Em Andamento ({appointments.filter(a => a.status === 'IN_PROGRESS').length})
            </button>
            <button 
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                statusFilter === 'COMPLETED' 
                ? 'bg-emerald-500 text-white shadow-md' 
                : 'bg-slate-50 border border-slate-100 dark:bg-white/5 dark:border-transparent text-emerald-500 dark:text-emerald-400 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${statusFilter === 'COMPLETED' ? 'bg-white' : 'bg-emerald-500'}`} />
              Concluídos ({appointments.filter(a => a.status === 'COMPLETED').length})
            </button>
            <button 
              onClick={() => setStatusFilter('CANCELED')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                statusFilter === 'CANCELED' 
                ? 'bg-slate-500 text-white shadow-md' 
                : 'bg-slate-50 border border-slate-100 dark:bg-white/5 dark:border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${statusFilter === 'CANCELED' ? 'bg-white' : 'bg-slate-500'}`} />
              Cancelados ({appointments.filter(a => a.status === 'CANCELED').length})
            </button>
          </div>

          <button 
            onClick={() => openForm()}
            className="bg-[#7184cf] hover:bg-[#5c6db3] text-white px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 transition-all w-full lg:w-auto cursor-pointer"
          >
            <Plus size={16} /> Novo Agendamento
          </button>
        </div>

        <div className="relative">
          <input 
            type="text"
            placeholder="Buscar por nome do cliente, serviço ou equipamento..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:border-[#7184cf]/50 transition-all dark:text-white"
          />
          <Search size={18} className="absolute left-4 top-4 text-slate-400" />
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            <div className="w-10 h-10 border-4 border-[#7184cf] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            Carregando agendamentos...
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="col-span-full p-12 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[2rem] text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-slate-50 dark:bg-white/5 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
              <Calendar size={28} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">Nenhum agendamento encontrado</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Crie um novo agendamento ou ajuste seus filtros.</p>
            </div>
          </div>
        ) : (
          filteredAppointments.map(app => (
            <div 
              key={app.id} 
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden pl-8"
            >
              {/* Visual side-marker stripe matching appointment status */}
              <div className={`absolute left-0 top-0 bottom-0 w-2.5 ${
                app.status === 'SCHEDULED' ? 'bg-indigo-500' :
                app.status === 'IN_PROGRESS' ? 'bg-amber-500' :
                app.status === 'COMPLETED' ? 'bg-emerald-500' :
                'bg-slate-400'
              }`} />
              <div className="space-y-4">
                {/* Header status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex items-center group/status">
                    <select
                      value={app.status}
                      onChange={(e) => handleQuickUpdateStatus(app.id, e.target.value as Appointment['status'])}
                      className={`appearance-none border px-3 py-1 pr-6 rounded-full text-[10px] font-black uppercase tracking-widest ${statusColors[app.status]} cursor-pointer focus:outline-none transition-all select-none shadow-sm`}
                      title="Clique para alterar o status rapidamente"
                    >
                      <option value="SCHEDULED" className="bg-white dark:bg-[#111a30] text-slate-900 dark:text-indigo-400 font-bold uppercase text-[10px]">Agendado</option>
                      <option value="IN_PROGRESS" className="bg-white dark:bg-[#111a30] text-slate-900 dark:text-amber-400 font-bold uppercase text-[10px]">Em Andamento</option>
                      <option value="COMPLETED" className="bg-white dark:bg-[#111a30] text-slate-900 dark:text-emerald-400 font-bold uppercase text-[10px]">Concluído</option>
                      <option value="CANCELED" className="bg-white dark:bg-[#111a30] text-slate-900 dark:text-slate-400 font-bold uppercase text-[10px]">Cancelado</option>
                    </select>
                    <ChevronDown size={10} className="absolute right-2 text-current pointer-events-none opacity-80" />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 dark:text-slate-500">
                    <Calendar size={13} /> {app.date.split('-').reverse().join('/')}
                    <Clock size={13} className="ml-1.5" /> {app.time}
                  </div>
                </div>

                {/* Client detail */}
                <div>
                  <h4 className="font-extrabold text-slate-800 dark:text-white text-base leading-tight">
                    {app.client.name}
                  </h4>
                  {app.client.contact && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-1 font-semibold">
                      <Phone size={12} /> {app.client.contact}
                    </p>
                  )}
                </div>

                {/* Main service details */}
                <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl p-4 space-y-2">
                  {app.equipment && (
                    <div className="flex items-start gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                      <span className="font-black uppercase tracking-wider text-[9px] bg-slate-200/50 dark:bg-white/10 dark:text-slate-300 px-1.5 py-0.5 rounded mr-1">Aparelho/Objeto</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300 truncate">{app.equipment}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">Descrição do Serviço</span>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-relaxed line-clamp-2">
                      {app.serviceDescription}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Preliminar</span>
                    <span className="text-sm font-black text-slate-800 dark:text-white">
                      {formatBRL(app.totalAmount)}
                    </span>
                  </div>
                </div>

                {app.notes && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 italic line-clamp-1">
                    Obs: {app.notes}
                  </p>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-4 mt-4 border-t border-slate-150 dark:border-white/5 flex flex-col gap-2">
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedOS(app)}
                    className="flex-1 py-2.5 bg-slate-50 border border-slate-200 dark:bg-white/5 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Imprimir Ficha Ordem de Serviço"
                  >
                    <Printer size={14} /> Ficha OS
                  </button>

                  <button 
                    disabled={isGeneratingBudget !== null}
                    onClick={() => handleGenerateBudget(app)}
                    className="flex-1 py-2.5 bg-[#7184cf]/10 hover:bg-[#7184cf]/20 text-[#7184cf] dark:hover:bg-[#7184cf]/25 border border-[#7184cf]/20 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isGeneratingBudget === app.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-[#7184cf] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FilePlus2 size={14} />
                    )}
                    Gerar Orçamento
                  </button>
                </div>

                <div className="flex justify-between items-center mt-1 pt-1.5 border-t border-slate-100 dark:border-white/5">
                  {app.client.contact ? (
                    <button
                      onClick={() => handleOpenWhatsAppManual(app)}
                      className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-xl font-bold text-xs transition-all cursor-pointer select-none"
                      title="Enviar contato ou lembrete via WhatsApp"
                    >
                      <MessageSquare size={13} /> Confirmar WhatsApp
                    </button>
                  ) : (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold italic pl-1">Sem contato salvo</span>
                  )}

                  <div className="flex gap-1">
                    <button 
                      onClick={() => openForm(app)}
                      className="p-2 text-slate-400 hover:text-[#7184cf] hover:bg-[#7184cf]/5 rounded-lg transition-all cursor-pointer"
                      title="Editar Agendamento"
                    >
                      <Pencil size={15} />
                    </button>
                    <button 
                      onClick={() => setDeletingAppointment(app)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-all cursor-pointer"
                      title="Excluir Permanentemente"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form Dialog Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden relative">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-white/5">
              <h3 className="text-lg font-black text-slate-800 dark:text-white">
                {editingAppointment ? 'Editar Agendamento' : 'Novo Agendamento'}
              </h3>
              <button 
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:bg-slate-50 dark:hover:bg-white/10 p-2 rounded-full transition-all cursor-pointer"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
              {/* Scrollable form content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {formError && (
                  <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-550/20 p-4 rounded-2xl text-xs text-red-500 font-bold flex items-center gap-2">
                    <AlertCircle size={14} /> {formError}
                  </div>
                )}

                {/* Client Auto-complete Input */}
                <div className="relative" ref={clientSelectorRef}>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                    Nome do Cliente / Razão Social
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={clientSearchText}
                      onChange={e => handleManualClientChange(e.target.value)}
                      onFocus={() => setShowClientList(true)}
                      placeholder="Comece a digitar o nome do cliente..."
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-250 dark:border-white/5 rounded-2xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-[#7184cf] transition-all dark:text-white font-semibold"
                    />
                    <Search size={16} className="absolute right-4 top-3.5 text-slate-400" />
                  </div>

                  {/* Suggestions dropdown list */}
                  {showClientList && clientSearchText.trim().length > 0 && (
                    <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-2xl shadow-xl divide-y divide-slate-100 dark:divide-white/5">
                      {filteredClientSuggestions.length === 0 ? (
                        <div className="p-4 text-xs text-slate-400 text-center">
                          Nenhum cliente cadastrado correspondente. Cadastrará como cliente sob demanda.
                        </div>
                      ) : (
                        filteredClientSuggestions.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSelectClientFromList(c);
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSelectClientFromList(c);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 flex flex-col transition-all cursor-pointer"
                          >
                            <span className="text-xs font-bold text-slate-800 dark:text-white">{c.name}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">{c.document} {c.contact ? `• ${c.contact}` : ''}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Sub-fields pre-fill info if chosen, or for manual typing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Telefone de Contato
                    </label>
                    <input 
                      type="text"
                      value={form.clientContact}
                      onChange={e => setForm(prev => ({ ...prev, clientContact: e.target.value }))}
                      placeholder="(99) 99999-9999"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#7184cf] transition-all dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Documento (CPF / CNPJ)
                    </label>
                    <input 
                      type="text"
                      value={form.clientDocument}
                      onChange={e => setForm(prev => ({ ...prev, clientDocument: e.target.value }))}
                      placeholder="Apenas números ou formatado"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#7184cf] transition-all dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Data do Serviço
                    </label>
                    <input 
                      type="date"
                      value={form.date}
                      onChange={e => setForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#7184cf] transition-all dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Horário
                    </label>
                    <input 
                      type="time"
                      value={form.time}
                      onChange={e => setForm(prev => ({ ...prev, time: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#7184cf] transition-all dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Tipo de Atendimento
                    </label>
                    <input 
                      type="text"
                      value={form.equipment}
                      onChange={e => setForm(prev => ({ ...prev, equipment: e.target.value }))}
                      placeholder="Ex: Visita Técnica, Instalação, Reforma"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#7184cf] transition-all dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Preço Preliminar Estimado (R$)
                    </label>
                    <input 
                      type="text"
                      inputMode="numeric"
                      value={form.totalAmountString}
                      onChange={handlePriceChange}
                      placeholder="0,00"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#7184cf] transition-all dark:text-white font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    Descrição dos Serviços
                  </label>
                  <textarea 
                    value={form.serviceDescription}
                    onChange={e => setForm(prev => ({ ...prev, serviceDescription: e.target.value }))}
                    placeholder="Escreva detalhadamente o serviço que será executado nesta OS"
                    rows={3}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#7184cf] transition-all dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Status
                    </label>
                    <div className="relative">
                      <select
                        value={form.status}
                        onChange={e => setForm(prev => ({ ...prev, status: e.target.value as Appointment['status'] }))}
                        className="w-full appearance-none bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-[#7184cf] transition-all text-slate-900 dark:text-white font-bold cursor-pointer"
                      >
                        <option value="SCHEDULED" className="bg-white dark:bg-[#111a30] text-slate-900 dark:text-slate-100 font-semibold">Agendado</option>
                        <option value="IN_PROGRESS" className="bg-white dark:bg-[#111a30] text-slate-900 dark:text-slate-100 font-semibold">Em Andamento</option>
                        <option value="COMPLETED" className="bg-white dark:bg-[#111a30] text-slate-900 dark:text-slate-100 font-semibold">Concluído</option>
                        <option value="CANCELED" className="bg-white dark:bg-[#111a30] text-slate-900 dark:text-slate-100 font-semibold">Cancelado</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                      Endereço de Atendimento (se houver)
                    </label>
                    <input 
                      type="text"
                      value={form.clientAddress}
                      onChange={e => setForm(prev => ({ ...prev, clientAddress: e.target.value }))}
                      placeholder="Rua, Número, Bairro, Cidade - UF"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#7184cf] transition-all dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    Observações Internas (Não aparecem na ficha impressa)
                  </label>
                  <input 
                    type="text"
                    value={form.notes}
                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Instruções particulares de execução..."
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-[#7184cf] transition-all dark:text-white"
                  />
                </div>
              </div>

              {/* Pinned Modal Footer */}
              <div className="flex gap-4 p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/50">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[#7184cf] hover:bg-[#5c6db3] text-white rounded-xl font-bold text-sm tracking-wide shadow-md transition-all cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl p-6 shadow-2xl w-full max-w-sm relative">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-500">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-white">Deseja Excluir?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Tem certeza que deseja apagar o registro de agendamento do cliente <span className="font-bold text-slate-700 dark:text-slate-200">{deletingAppointment.client.name}</span>? Esta ação é irreversível.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setDeletingAppointment(null)}
                  className="w-full border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 font-bold text-sm px-4 py-2.5 rounded-2xl transition-all cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  onClick={handleDelete}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold text-sm px-4 py-2.5 rounded-2xl shadow-lg shadow-red-500/10 transition-all cursor-pointer"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printed / Styled Certificate of Work Order OS Modal Overlay */}
      {selectedOS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-white border rounded-3xl p-8 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative text-slate-900">
            {/* Header control buttons */}
            <div className="sticky top-0 bg-white pb-4 mb-4 border-b flex justify-between items-center no-print">
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Wrench size={20} className="text-[#7184cf]" /> Ficha de Ordem de Serviço (OS)
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={handlePrint}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow transition-all cursor-pointer"
                >
                  <Printer size={14} /> Imprimir / PDF
                </button>
                <button 
                  onClick={() => setSelectedOS(null)}
                  className="bg-slate-50 hover:bg-slate-100 text-slate-500 font-bold text-xs uppercase px-4 py-2.5 border rounded-xl transition-all cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>

            {/* Print wrapper area */}
            <div id="print-area-wrapper" className="space-y-6 text-sm leading-relaxed p-2">
              {/* Receipt Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-200 pb-4 gap-4">
                <div className="space-y-1">
                  <div className="font-black text-lg tracking-tight uppercase flex items-center gap-1">
                    Gestor CNL <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold ml-1">OS</span>
                  </div>
                  <p className="text-xs text-slate-500">Sistema Administrador de Serviços e Finanças</p>
                </div>
                <div className="text-right sm:text-right w-full sm:w-auto">
                  <div className="text-xs font-black uppercase tracking-widest text-[#7184cf]">Controle OS</div>
                  <div className="font-mono text-base font-black text-slate-800">#{selectedOS.id.slice(0, 8).toUpperCase()}</div>
                  <div className="text-xs text-slate-400 mt-1">Status: <span className="font-bold text-slate-700">{statusLabels[selectedOS.status]}</span></div>
                </div>
              </div>

              {/* Informações Dates */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border">
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Data do Atendimento</span>
                  <span className="font-extrabold text-slate-700">{selectedOS.date.split('-').reverse().join('/')}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Horário Agendado</span>
                  <span className="font-extrabold text-slate-700">{selectedOS.time}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Ficha Emitida em</span>
                  <span className="font-semibold text-slate-500">{new Date(selectedOS.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Client specifications */}
              <div className="space-y-2">
                <h5 className="font-extrabold text-slate-800 border-b pb-1 uppercase text-xs tracking-wider">Identificação do Cliente</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block">Nome / Razão Social</span>
                    <span className="font-black text-slate-800">{selectedOS.client.name}</span>
                  </div>
                  {selectedOS.client.document && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest block">CPF / CNPJ</span>
                      <span className="font-bold text-slate-700">{selectedOS.client.document}</span>
                    </div>
                  )}
                  {selectedOS.client.contact && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest block">Telefone / Contato</span>
                      <span className="font-bold text-slate-700">{selectedOS.client.contact}</span>
                    </div>
                  )}
                  {selectedOS.client.email && (
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-widest block">E-mail</span>
                      <span className="font-bold text-slate-700">{selectedOS.client.email}</span>
                    </div>
                  )}
                </div>

                {selectedOS.client.address && (
                  <div className="pt-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest block">Endereço de Atendimento</span>
                    <span className="font-semibold text-slate-700 flex items-center gap-1">
                      <MapPin size={12} className="text-slate-400 shrink-0" /> {selectedOS.client.address}
                    </span>
                  </div>
                )}
              </div>

              {/* Service technical detail specifications */}
              <div className="space-y-3">
                <h5 className="font-extrabold text-slate-800 border-b pb-1 uppercase text-xs tracking-wider">Descrição dos Serviços</h5>
                
                {selectedOS.equipment && (
                  <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl border">
                    <Wrench size={14} className="text-[#7184cf]" />
                    <span className="text-xs font-semibold text-slate-700">
                      <strong>Tipo de Atendimento:</strong> {selectedOS.equipment}
                    </span>
                  </div>
                )}

                <div className="p-4 bg-[#7184cf]/5 border border-[#7184cf]/10 rounded-2xl">
                  <span className="text-[10px] font-black text-[#5c6db3] uppercase tracking-widest block mb-1">Serviço Solicitado</span>
                  <p className="text-sm font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {selectedOS.serviceDescription}
                  </p>
                </div>
              </div>

              {/* Pricing section */}
              <div className="pt-4 border-t-2 border-slate-200 flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                <div>
                  <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Total Preliminar dos Serviços</span>
                  <p className="text-xs text-slate-500 italic mt-0.5">Sujeito a reajustes conforme aprovação técnica adicional.</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black text-slate-800">
                    {formatBRL(selectedOS.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-16 grid grid-cols-1 md:grid-cols-2 gap-12 text-center text-xs">
                <div className="space-y-2">
                  <div className="border-t border-slate-300 w-full max-w-xs mx-auto"></div>
                  <p className="font-bold text-slate-600 uppercase tracking-widest text-[10px]">Assinatura do Técnico Responsável</p>
                </div>
                <div className="space-y-2">
                  <div className="border-t border-slate-300 w-full max-w-xs mx-auto"></div>
                  <p className="font-bold text-slate-600 uppercase tracking-widest text-[10px]">Assinatura / Autorização do Cliente</p>
                </div>
              </div>

              {/* Fine details footer of print sheet */}
              <div className="text-center text-[10px] text-slate-400 pt-8 border-t border-dashed">
                A Ordem de Serviço valida o agendamento prévio. Em caso de cancelamento, favor contatar com antecedência.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generated Budget Success Toast Modal */}
      {generatedBudgetSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 no-print">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl p-6 shadow-2xl w-full max-w-sm text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-500">
              <FileCheck size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-white">Orçamento Gerado!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Um novo orçamento pendente para <span className="font-black text-slate-700 dark:text-slate-200">{generatedBudgetSuccess.clientName}</span> foi gerado com sucesso a partir desta Ordem de Serviço!
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setGeneratedBudgetSuccess(null)}
                className="w-full border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 font-extrabold text-xs px-4 py-3 rounded-2xl transition-all cursor-pointer"
              >
                Continuar Aqui
              </button>
              <button
                onClick={() => {
                  setGeneratedBudgetSuccess(null);
                  setView('BUDGETS');
                }}
                className="w-full bg-[#7184cf] hover:bg-[#5c6db3] text-white font-extrabold text-xs px-4 py-3 rounded-2xl shadow-lg shadow-[#7184cf]/15 transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                Ver Orçamentos <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Modal Notification Confirmation */}
      {whatsAppModalOpen && selectedAppForWhatsApp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 no-print select-none">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl p-6 shadow-2xl w-full max-w-lg flex flex-col space-y-4 max-h-[90vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 dark:text-white leading-none">Confirmar via WhatsApp</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-1 uppercase tracking-wider">Agendamento de Serviços</p>
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
                  
                  // Use standardized api.whatsapp.com for best client/device compatibility (mobiles & web)
                  const url = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodedText}`;
                  window.open(url, '_blank');
                  setWhatsAppModalOpen(false);
                }}
                className="w-full bg-[#25d366] hover:bg-[#20ba5a] text-white font-extrabold text-xs px-4 py-3.5 rounded-2xl shadow-lg shadow-emerald-500/10 transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Send size={14} /> Confirmar & Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
