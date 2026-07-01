import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  Save, 
  X, 
  Pencil, 
  Phone, 
  Mail, 
  MapPin,
  MapPinOff,
  AlertCircle,
  Download
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../services/firebase';
import { Client, User } from '../types';
import { fetchCNPJData } from '../utils/cnpjHelper';

interface ClientsViewProps {
  currentUser: User | null;
  selectedAccountId: string | null;
}

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

export const ClientsView: React.FC<ClientsViewProps> = ({ currentUser, selectedAccountId }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  
  const [docLoading, setDocLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [form, setForm] = useState({
    name: '',
    tradeName: '',
    document: '',
    cep: '',
    address: '',
    number: '',
    complement: '',
    bairro: '',
    city: '',
    state: '',
    reference: '',
    contact: '',
    email: ''
  });

  // Client list Sync
  useEffect(() => {
    if (!currentUser || !selectedAccountId) return;

    const timeoutId = setTimeout(() => {
      setLoading(true);
    }, 0);

    const clientsRef = collection(db, `users/${selectedAccountId}/clients`);
    const unsubscribe = onSnapshot(clientsRef, (snapshot) => {
      clearTimeout(timeoutId);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Client));
      
      // Sort by name mapping default values
      list.sort((a, b) => a.name.localeCompare(b.name));
      setClients(list);
      setLoading(false);
    }, (error) => {
      clearTimeout(timeoutId);
      handleFirestoreError(error, OperationType.LIST, `users/${selectedAccountId}/clients`);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [currentUser, selectedAccountId]);

  // Open form for adding or editing
  const openForm = (client?: Client) => {
    setFormError('');
    if (client) {
      setEditingClient(client);
      setForm({
        name: client.name || '',
        tradeName: client.tradeName || '',
        document: client.document || '',
        cep: client.cep || '',
        address: client.address || '',
        number: client.number || '',
        complement: client.complement || '',
        bairro: client.bairro || '',
        city: client.city || '',
        state: client.state || '',
        reference: client.reference || '',
        contact: client.contact || '',
        email: client.email || ''
      });
    } else {
      setEditingClient(null);
      setForm({
        name: '',
        tradeName: '',
        document: '',
        cep: '',
        address: '',
        number: '',
        complement: '',
        bairro: '',
        city: '',
        state: '',
        reference: '',
        contact: '',
        email: ''
      });
    }
    setIsFormOpen(true);
  };

  // Backends queries for CNPJ
  const handleDocChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatCPFOrCNPJ(rawVal);
    setForm(prev => ({ ...prev, document: formatted }));

    const clean = rawVal.replace(/\D/g, '').slice(0, 14);
    if (clean.length === 14) {
      setDocLoading(true);
      setFormError('');
      try {
        const data = await fetchCNPJData(clean);
        if (data) {
          setForm(prev => ({
            ...prev,
            name: data.razao_social || data.nome_fantasia || prev.name,
            tradeName: data.nome_fantasia || data.razao_social || prev.tradeName,
            address: data.logradouro || prev.address,
            number: data.numero || prev.number,
            complement: data.complemento || prev.complement,
            bairro: data.bairro || prev.bairro,
            city: data.municipio || prev.city,
            state: data.uf || prev.state,
            cep: data.cep ? formatCEP(data.cep) : prev.cep,
            contact: data.telefone || prev.contact,
            email: data.email || prev.email
          }));
        }
      } catch (err) {
        console.error("Erro consultando CNPJ:", err);
      } finally {
        setDocLoading(false);
      }
    }
  };

  // CEP Lookup trigger
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const formatted = formatCEP(rawVal);
    setForm(prev => ({ ...prev, cep: formatted }));

    const clean = rawVal.replace(/\D/g, '').slice(0, 8);
    if (clean.length === 8) {
      setCepLoading(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        if (res.ok) {
          const data = await res.json();
          if (!data.erro) {
            setForm(prev => ({
              ...prev,
              address: data.logradouro || prev.address,
              bairro: data.bairro || prev.bairro,
              city: data.localidade || prev.city,
              state: data.uf || prev.state
            }));
          }
        }
      } catch (err) {
        console.error("Erro consultando CEP:", err);
      } finally {
        setCepLoading(false);
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) return;
    if (!form.name || !form.document) {
      setFormError('Nome/Razão Social e CPF/CNPJ são obrigatórios.');
      return;
    }

    try {
      const clientData: Omit<Client, 'id'> = {
        name: form.name,
        tradeName: form.tradeName || '',
        document: form.document,
        cep: form.cep || '',
        address: form.address || '',
        number: form.number || '',
        complement: form.complement || '',
        bairro: form.bairro || '',
        city: form.city || '',
        state: form.state || '',
        reference: form.reference || '',
        contact: form.contact || '',
        email: form.email || '',
        createdAt: editingClient ? editingClient.createdAt : new Date().toISOString()
      };

      if (editingClient) {
        const docRef = doc(db, `users/${selectedAccountId}/clients`, editingClient.id);
        await updateDoc(docRef, { ...clientData });
      } else {
        const collectionRef = collection(db, `users/${selectedAccountId}/clients`);
        await addDoc(collectionRef, clientData);
      }

      setIsFormOpen(false);
      setEditingClient(null);
    } catch (err) {
      console.error("Erro ao salvar cliente:", err);
      setFormError('Erro ao salvar os dados do cliente no Firestore.');
      handleFirestoreError(err, editingClient ? OperationType.UPDATE : OperationType.CREATE, `users/${selectedAccountId}/clients`);
    }
  };

  const confirmDelete = (client: Client) => {
    setDeletingClient(client);
  };

  const handleDelete = async () => {
    if (!selectedAccountId || !deletingClient) return;
    
    try {
      const docRef = doc(db, `users/${selectedAccountId}/clients`, deletingClient.id);
      await deleteDoc(docRef);
      setDeletingClient(null);
    } catch (err) {
      console.error("Erro ao excluir cliente:", err);
      handleFirestoreError(err, OperationType.DELETE, `users/${selectedAccountId}/clients/${deletingClient.id}`);
    }
  };

  // Filter lists based on search parameter
  const filteredClients = clients.filter(c => {
    const s = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(s) ||
      (c.tradeName || '').toLowerCase().includes(s) ||
      c.document.replace(/\D/g, '').includes(s) ||
      c.document.toLowerCase().includes(s) ||
      (c.email || '').toLowerCase().includes(s) ||
      (c.city || '').toLowerCase().includes(s)
    );
  });

  const handleExportCSV = () => {
    if (filteredClients.length === 0) return;

    const headers = [
      'Nome / Razao Social',
      'Nome Fantasia',
      'CPF / CNPJ',
      'Telefone / WhatsApp',
      'E-mail',
      'CEP',
      'Endereco',
      'Numero',
      'Complemento',
      'Bairro',
      'Cidade',
      'Estado',
      'Referencia',
      'Data de Cadastro'
    ];

    const escapeCSV = (val: string) => {
      if (!val) return '';
      const clean = val.replace(/"/g, '""');
      if (clean.includes(';') || clean.includes('\n') || clean.includes('"')) {
        return `"${clean}"`;
      }
      return clean;
    };

    const rows = filteredClients.map(client => [
      client.name,
      client.tradeName || '',
      client.document,
      client.contact || '',
      client.email || '',
      client.cep || '',
      client.address || '',
      client.number || '',
      client.complement || '',
      client.bairro || '',
      client.city || '',
      client.state || '',
      client.reference || '',
      client.createdAt ? new Date(client.createdAt).toLocaleDateString('pt-BR') : ''
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(escapeCSV).join(';'))
    ].join('\n');

    // BOM for Excel compatibility (UTF-8 Portuguese chars)
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `clientes_gestor_cnl_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (filteredClients.length === 0) return;

    const generatePdf = (logoBase64?: string) => {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const addHeader = () => {
        // Top accent banner (dark indigo navy)
        doc.setFillColor(13, 20, 40); // #0d1428
        doc.rect(0, 0, 210, 8, 'F');
        
        let textStartX = 15;
        if (logoBase64) {
          try {
            // Draw logo: 11mm x 11mm at x=15, y=11
            doc.addImage(logoBase64, 'PNG', 15, 11, 11, 11);
            textStartX = 29;
          } catch (e) {
            console.error('Error rendering logo in PDF:', e);
          }
        }

        // Document branding / title
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(13, 20, 40);
        doc.text('GESTOR CNL', textStartX, 18);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(113, 132, 207); // #7184cf
        doc.text(`Listagem de Clientes Cadastrados (${filteredClients.length} itens)`, textStartX, 23);

        // Metadata details
        doc.setFontSize(8);
        doc.setTextColor(100, 110, 130);
        const rightX = 195;
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, rightX, 16, { align: 'right' });
        
        const filterText = search ? `Filtro: "${search}"` : 'Filtro: Todos os clientes';
        doc.text(filterText, rightX, 21, { align: 'right' });
        
        // Divider line
        doc.setDrawColor(220, 225, 235);
        doc.setLineWidth(0.4);
        doc.line(15, 26, 195, 26);
      };

      const addFooter = (pageNum: number, totalPages: number) => {
        doc.setDrawColor(220, 225, 235);
        doc.setLineWidth(0.3);
        doc.line(15, 282, 195, 282);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 130, 145);
        doc.text('Gestor CNL Software • Cadastro de Clientes', 15, 287);
        doc.text(`Pagina ${pageNum} de ${totalPages}`, 195, 287, { align: 'right' });
      };

      addHeader();

      let currentY = 32;

      // Table Header setup
      doc.setFillColor(13, 20, 40);
      doc.rect(15, currentY, 180, 7, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      
      const colX = {
        name: 15,
        document: 70,
        contact: 105,
        email: 135,
        location: 170
      };

      doc.text('CLIENTE / RAZAO SOCIAL', colX.name + 1, currentY + 4.8);
      doc.text('CPF / CNPJ', colX.document + 1, currentY + 4.8);
      doc.text('CONTATO', colX.contact + 1, currentY + 4.8);
      doc.text('E-MAIL', colX.email + 1, currentY + 4.8);
      doc.text('LOCALIDADE', colX.location + 1, currentY + 4.8);

      currentY += 7;

      const truncate = (str: string, maxLen: number): string => {
        if (!str) return '';
        return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
      };

      // Render each data row
      let alternate = false;
      filteredClients.forEach((client) => {
        const rowHeight = 12;

        // Handle pagination/height check
        if (currentY + rowHeight > 275) {
          doc.addPage();
          currentY = 30; // reset to top of page
          addHeader();

          // Print header row again on subsequent page
          doc.setFillColor(13, 20, 40);
          doc.rect(15, currentY, 180, 7, 'F');
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(255, 255, 255);
          
          doc.text('CLIENTE / RAZAO SOCIAL', colX.name + 1, currentY + 4.8);
          doc.text('CPF / CNPJ', colX.document + 1, currentY + 4.8);
          doc.text('CONTATO', colX.contact + 1, currentY + 4.8);
          doc.text('E-MAIL', colX.email + 1, currentY + 4.8);
          doc.text('LOCALIDADE', colX.location + 1, currentY + 4.8);
          currentY += 7;
        }

        // Alternating shading background
        if (alternate) {
          doc.setFillColor(248, 250, 252);
          doc.rect(15, currentY, 180, rowHeight, 'F');
        }
        alternate = !alternate;

        // Draw horizontal line separator
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.25);
        doc.line(15, currentY + rowHeight, 195, currentY + rowHeight);

        // Name & Trade name
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(13, 20, 40);
        doc.text(truncate(client.name, 35), colX.name + 1, currentY + 4.5);
        
        if (client.tradeName) {
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(115, 125, 140);
          doc.text(truncate(client.tradeName, 38), colX.name + 1, currentY + 8.5);
        }

        // CPF/CNPJ
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(50, 55, 65);
        doc.text(client.document ? formatCPFOrCNPJ(client.document) : 'Nao inf.', colX.document + 1, currentY + 6.5);

        // Contact
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(50, 55, 65);
        doc.text(client.contact || 'Nao informado', colX.contact + 1, currentY + 6.5);

        // Email
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(50, 55, 65);
        doc.text(client.email ? truncate(client.email, 24) : 'Nao informado', colX.email + 1, currentY + 6.5);

        // Localidade (Cidade/Estado)
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(50, 55, 65);
        const locStr = client.city ? `${client.city}${client.state ? ` - ${client.state}` : ''}` : 'Nao informado';
        doc.text(truncate(locStr, 18), colX.location + 1, currentY + 6.5);

        currentY += rowHeight;
      });

      // Write accurate footers on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(i, totalPages);
      }

      doc.save(`listagem_clientes_${new Date().toISOString().split('T')[0]}.pdf`);
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
    <div id="clients-view-container" className="space-y-6">
      {/* Header and Add button */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Cadastro de Clientes</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Armazene e consulte as informações cadastrais de seus clientes de forma instantânea.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2.5">
          {/* CSV Export Button */}
          <button
            onClick={handleExportCSV}
            disabled={filteredClients.length === 0}
            className="border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-4 py-3 rounded-2xl font-bold text-sm tracking-wide shadow-sm flex items-center justify-center gap-2 transition-all shrink-0 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            title="Exportar clientes para arquivo CSV (Excel)"
          >
            <Download size={16} className="text-emerald-500" /> Exportar CSV
          </button>

          {/* PDF Export Button */}
          <button
            onClick={handleExportPDF}
            disabled={filteredClients.length === 0}
            className="border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-4 py-3 rounded-2xl font-bold text-sm tracking-wide shadow-sm flex items-center justify-center gap-2 transition-all shrink-0 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            title="Exportar listagem completa em PDF"
          >
            <Download size={16} className="text-red-500" /> Exportar PDF
          </button>

          <button
            onClick={() => openForm()}
            className="bg-[#7184cf] hover:bg-[#5e71bd] text-white px-5 py-3 rounded-2xl font-bold text-sm tracking-wide shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 transition-all shrink-0 active:scale-95"
          >
            <Plus size={18} /> Novo Cliente
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="space-y-4">
        {/* List and Search - Full Width */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-xl shadow-slate-100/50 dark:shadow-none p-4 rounded-3xl flex items-center gap-3">
          <Search className="text-slate-400 shrink-0" size={18} />
          <input 
            type="text"
            placeholder="Buscar por nome, fantasia, CPF/CNPJ ou e-mail..."
            className="bg-transparent text-sm font-semibold outline-none w-full text-slate-700 dark:text-white placeholder-slate-400"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
              <X size={16} />
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 bg-white/5 border border-white/5 rounded-3xl">
            <div className="w-8 h-8 rounded-full border-4 border-slate-700 border-t-[#7184cf] animate-spin"></div>
            <p className="text-slate-500 text-sm font-black uppercase tracking-widest animate-pulse">Carregando Clientes...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl p-8 shadow-sm">
            <MapPinOff className="mx-auto text-slate-300 dark:text-slate-600 mb-4" size={48} />
            <p className="text-slate-800 dark:text-slate-300 font-bold mb-1">Nenhum cliente cadastrado</p>
            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto">
              {search ? 'Nenhum resultado corresponde à sua pesquisa.' : 'Comece a cadastrar seus clientes para preencher os orçamentos de maneira automática e gerar relatórios.'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl overflow-hidden shadow-xl shadow-slate-100/10 dark:shadow-none">
            {/* Mobile Cards Layout */}
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-white/5 bg-white dark:bg-slate-900">
              {filteredClients.map(client => (
                <div key={client.id} className="p-5 flex flex-col gap-3">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#0d1428] dark:text-white truncate">
                        {client.name}
                      </div>
                      {client.tradeName && (
                        <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate mt-0.5">
                          {client.tradeName}
                        </div>
                      )}
                    </div>
                    <span className="inline-block px-2.5 py-1 rounded-xl bg-[#7184cf]/10 text-[#7184cf] text-[10px] font-extrabold tracking-wide shrink-0">
                      {client.document}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-400 font-medium bg-slate-50 dark:bg-white/5 p-3 rounded-2xl">
                    {/* Contact details */}
                    <div className="space-y-1.5">
                      {client.contact && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Phone size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{client.contact}</span>
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate text-slate-500 dark:text-slate-400" title={client.email}>{client.email}</span>
                        </div>
                      )}
                      {!client.contact && !client.email && (
                        <span className="text-slate-300 dark:text-slate-600 italic text-[11px]">Nenhum contato</span>
                      )}
                    </div>

                    {/* Location details */}
                    <div className="space-y-1.5">
                      {client.city ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <MapPin size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate text-slate-700 dark:text-slate-300">
                            {client.city}{client.state ? ` - ${client.state}` : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 italic text-[11px]">Nenhum endereço</span>
                      )}
                      {client.address && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate pl-4">
                          {client.address}{client.number ? `, ${client.number}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => openForm(client)}
                      className="p-2 text-slate-400 hover:text-[#7184cf] dark:hover:text-[#6e82ce] hover:bg-[#7184cf]/5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
                      title="Editar"
                    >
                      <Pencil size={14} /> <span>Editar</span>
                    </button>
                    <button
                      onClick={() => confirmDelete(client)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold"
                      title="Excluir"
                    >
                      <Trash2 size={14} /> <span>Excluir</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f8fafc] dark:bg-white/5 border-b border-slate-100 dark:border-white/5 select-none">
                  <tr className="text-slate-400 dark:text-slate-500 text-[10px] uppercase tracking-widest font-bold">
                    <th className="px-5 py-4 font-bold">Cliente / Razão Social</th>
                    <th className="px-5 py-4 font-bold">CPF / CNPJ</th>
                    <th className="px-5 py-4 font-bold">Contato</th>
                    <th className="px-5 py-4 font-bold">Localidade</th>
                    <th className="px-5 py-4 font-bold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-semibold">
                  {filteredClients.map(client => (
                    <tr 
                      key={client.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-white/[0.01] transition-colors duration-150 group"
                    >
                      <td className="px-5 py-4 max-w-[260px]">
                        <div className="space-y-0.5 min-w-0">
                          <div className="text-sm font-bold text-[#0d1428] dark:text-white truncate" title={client.name}>
                            {client.name}
                          </div>
                          {client.tradeName && (
                            <div className="text-xs text-slate-400 dark:text-slate-500 font-medium truncate" title={client.tradeName}>
                              {client.tradeName}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-block px-2.5 py-1 rounded-xl bg-[#7184cf]/10 text-[#7184cf] text-[11px] font-extrabold tracking-wide">
                          {client.document}
                        </span>
                      </td>
                      <td className="px-5 py-4 max-w-[220px]">
                        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 font-medium">
                          {client.contact && (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Phone size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate">{client.contact}</span>
                            </div>
                          )}
                          {client.email && (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Mail size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate text-slate-500 dark:text-slate-400" title={client.email}>{client.email}</span>
                            </div>
                          )}
                          {!client.contact && !client.email && (
                            <span className="text-slate-300 dark:text-slate-700 italic text-[11px]">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 max-w-[220px]">
                        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400 font-medium">
                          {client.city ? (
                            <div className="flex items-center gap-1.5 min-w-0">
                              <MapPin size={12} className="text-slate-400 shrink-0" />
                              <span className="truncate text-slate-700 dark:text-slate-300">
                                {client.city}{client.state ? ` - ${client.state}` : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700 italic text-[11px]">—</span>
                          )}
                          {client.address && (
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate pl-5">
                              {client.address}{client.number ? `, ${client.number}` : ''}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openForm(client)}
                            className="p-1.5 text-slate-400 hover:text-[#7184cf] dark:hover:text-[#6e82ce] hover:bg-[#7184cf]/5 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => confirmDelete(client)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Center Popup Modal Overlay for Client Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl p-6 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <form onSubmit={handleSave} className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                <h3 className="font-bold text-lg text-[#0d1428] dark:text-white">
                  {editingClient ? 'Editar Cliente' : 'Cadastrar Cliente'}
                </h3>
                <button 
                  type="button" 
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingClient(null);
                  }}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Grid System for Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Doc CPF/CNPJ */}
                <div className="space-y-1 md:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center justify-between">
                    <span>CPF / CNPJ *</span>
                    {docLoading && <span className="text-[10px] text-[#7184cf] animate-pulse">Consultando...</span>}
                  </label>
                  <input 
                    type="text"
                    placeholder="Ex: 00.000.000/0000-00"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-bold"
                    value={form.document}
                    onChange={handleDocChange}
                  />
                </div>

                {/* Nome Completo / Razão */}
                <div className="space-y-1 md:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nome / Razão Social *</label>
                  <input 
                    type="text"
                    placeholder="Ex: Minimercado LTDA"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-semibold text-[#0d1428] dark:text-white"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>

                {/* Nome Fantasia */}
                <div className="space-y-1 md:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Nome Fantasia</label>
                  <input 
                    type="text"
                    placeholder="Ex: Adega Principal"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                    value={form.tradeName}
                    onChange={e => setForm({ ...form, tradeName: e.target.value })}
                  />
                </div>

                {/* Contato (Telefone/WhatsApp) */}
                <div className="space-y-1 md:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Contato</label>
                  <input 
                    type="text"
                    placeholder="(00) 00000-0000"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                    value={form.contact}
                    onChange={e => setForm({ ...form, contact: e.target.value })}
                  />
                </div>

                {/* E-mail */}
                <div className="space-y-1 md:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">E-mail</label>
                  <input 
                    type="email"
                    placeholder="email@empresa.com"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                {/* CEP */}
                <div className="space-y-1 md:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center justify-between">
                    <span>CEP</span>
                    {cepLoading && <span className="text-[10px] text-[#7184cf] animate-pulse">Consultando...</span>}
                  </label>
                  <input 
                    type="text"
                    placeholder="00000-000"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                    value={form.cep}
                    onChange={handleCepChange}
                  />
                </div>

                {/* Endereço - Logradouro */}
                <div className="space-y-1 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Endereço (Rua, Av, etc.)</label>
                  <input 
                    type="text"
                    placeholder="Ex: Avenida Dr. Frederico M. da Costa"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                  />
                </div>

                {/* Número */}
                <div className="space-y-1 md:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Número</label>
                  <input 
                    type="text"
                    placeholder="Ex: 1085"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                    value={form.number}
                    onChange={e => setForm({ ...form, number: e.target.value })}
                  />
                </div>

                {/* Complemento */}
                <div className="space-y-1 md:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Complemento</label>
                  <input 
                    type="text"
                    placeholder="Apto/Bloco/Sala"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                    value={form.complement}
                    onChange={e => setForm({ ...form, complement: e.target.value })}
                  />
                </div>

                {/* Bairro */}
                <div className="space-y-1 md:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Bairro</label>
                  <input 
                    type="text"
                    placeholder="Bairro"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                    value={form.bairro}
                    onChange={e => setForm({ ...form, bairro: e.target.value })}
                  />
                </div>

                {/* Cidade */}
                <div className="space-y-1 md:col-span-1 flex-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Cidade</label>
                  <input 
                    type="text"
                    placeholder="Cidade"
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                    value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                  />
                </div>

                {/* UF */}
                <div className="space-y-1 md:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">UF</label>
                  <input 
                    type="text"
                    placeholder="UF"
                    maxLength={2}
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-center focus:ring-2 focus:ring-[#7184cf] outline-none font-bold uppercase"
                    value={form.state}
                    onChange={e => setForm({ ...form, state: e.target.value.toUpperCase() })}
                  />
                </div>

                {/* Ponto de Referência */}
                <div className="space-y-1 md:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Referência</label>
                  <input 
                    type="text"
                    placeholder="Próximo a..."
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#7184cf] outline-none font-medium"
                    value={form.reference}
                    onChange={e => setForm({ ...form, reference: e.target.value })}
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingClient(null);
                  }}
                  className="w-full border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 font-bold text-sm px-4 py-3 rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-full bg-[#7184cf] hover:bg-[#5e71bd] text-white font-bold text-sm px-4 py-3 rounded-2xl shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Save size={16} /> Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deletion */}
      {deletingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div 
            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 rounded-3xl p-6 shadow-2xl w-full max-w-md relative"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center text-red-500">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-white">Confirmar Exclusão</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  Tem certeza que deseja excluir permanentemente o cliente <span className="font-bold text-slate-700 dark:text-slate-200">{deletingClient.name}</span>? Esta ação não poderá ser desfeita.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingClient(null)}
                  className="w-full border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 font-bold text-sm px-4 py-3 rounded-2xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="w-full bg-red-500 hover:bg-red-605 text-white font-bold text-sm px-4 py-3 rounded-2xl shadow-lg shadow-red-500/10 transition-all cursor-pointer animate-pulse-subtle"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
