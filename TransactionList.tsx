import React, { useState } from 'react';
import { Search, Trash2, ArrowUpRight, ArrowDownLeft, CheckCircle2, Clock, Pencil, Repeat, CreditCard, X, FileSpreadsheet, FileText, Scissors } from 'lucide-react';
import { Transaction, Category, Supplier, Bank, TransactionType } from '../types';
import { jsPDF } from 'jspdf';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  suppliers: Supplier[];
  banks: Bank[];
  onDelete: (transaction: Transaction) => void;
  onToggleStatus: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onPartialPay: (transaction: Transaction) => void;
}

const TransactionList: React.FC<TransactionListProps> = ({ 
  transactions, 
  categories, 
  suppliers, 
  banks, 
  onDelete, 
  onToggleStatus,
  onEdit,
  onPartialPay
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | string>('ALL');
  const [fixedFilter, setFixedFilter] = useState<'ALL' | 'FIXED' | 'NOT_FIXED'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const normalizeText = (text: string) => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  const filtered = transactions.filter(t => {
    const matchesSearch = normalizeText(t.description).includes(normalizeText(searchTerm));
    const matchesType = typeFilter === 'ALL' || t.type === typeFilter;
    const matchesCategory = categoryFilter === 'ALL' || t.categoryId === categoryFilter;
    const matchesFixed = fixedFilter === 'ALL' || 
      (fixedFilter === 'FIXED' && t.isFixed) || 
      (fixedFilter === 'NOT_FIXED' && !t.isFixed);
    
    // Status filter logic
    let matchesStatus = true;
    if (statusFilter === 'PAID') matchesStatus = t.status === 'PAID';
    if (statusFilter === 'PENDING') matchesStatus = t.status === 'PENDING';
    
    // Date filter logic
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && t.date >= startDate;
    }
    if (endDate) {
      matchesDate = matchesDate && t.date <= endDate;
    }

    return matchesSearch && matchesType && matchesCategory && matchesFixed && matchesDate && matchesStatus;
  }).sort((a, b) => a.date.localeCompare(b.date));

  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');

  const monthTotals = filtered.reduce((acc, t) => {
    if (!t.date) {
      return acc;
    }

    const isPaid = t.status === 'PAID';
    const isOverdue = !isPaid && t.date < todayStr;
    const isUpcoming = !isPaid && t.date >= todayStr;

    if (isPaid) {
      if (t.type === TransactionType.INCOME) {
        acc.paid.income += t.amount;
      } else {
        acc.paid.expense += t.amount;
      }
    } else if (isOverdue) {
      if (t.type === TransactionType.INCOME) {
        acc.overdue.income += t.amount;
      } else {
        acc.overdue.expense += t.amount;
      }
    } else if (isUpcoming) {
      if (t.type === TransactionType.INCOME) {
        acc.upcoming.income += t.amount;
      } else {
        acc.upcoming.expense += t.amount;
      }
    }
    return acc;
  }, {
    paid: { income: 0, expense: 0 },
    overdue: { income: 0, expense: 0 },
    upcoming: { income: 0, expense: 0 }
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'N/A';
  const getBankName = (id: string) => banks.find(b => b.id === id)?.name || 'N/A';
  const getSupplierName = (id: string) => suppliers.find(s => s.id === id)?.name || '-';

  // Selection Logic
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const allSelectedInFiltered = filtered.length > 0 && filtered.every(t => selectedIds.has(t.id));
    if (allSelectedInFiltered) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(t => next.delete(t.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        filtered.forEach(t => next.add(t.id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Compute Selected Totals
  const selectedTransactions = transactions.filter(t => selectedIds.has(t.id));
  const hasSelection = selectedTransactions.length > 0;

  const selectedTotals = selectedTransactions.reduce((acc, t) => {
    if (t.type === TransactionType.INCOME) {
      acc.income += t.amount;
    } else {
      acc.expense += t.amount;
    }
    return acc;
  }, { income: 0, expense: 0 });

  const selectedBalance = selectedTotals.income - selectedTotals.expense;

  // Export handlers
  const handleExportCSV = () => {
    const dataToExport = hasSelection ? selectedTransactions : filtered;
    if (dataToExport.length === 0) return;

    const currentMonthLabel = `${currentMonthStr}/${currentYear}`;

    const csvLines = [
      "GESTOR CNL - RELATORIO DE LANCAMENTOS",
      `Gerado em:;${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
      `Mes de Referencia dos Totalizadores:;${currentMonthLabel}`,
      "",
      "MONITORAMENTO DOS LANCAMENTOS (FILTRADOS)",
      `PAGOS - Receitas:;${formatCurrency(monthTotals.paid.income).replace(/\s/g, ' ')}`,
      `PAGOS - Despesas:;${formatCurrency(monthTotals.paid.expense).replace(/\s/g, ' ')}`,
      `VENCIDOS - Receitas:;${formatCurrency(monthTotals.overdue.income).replace(/\s/g, ' ')}`,
      `VENCIDOS - Despesas:;${formatCurrency(monthTotals.overdue.expense).replace(/\s/g, ' ')}`,
      `A VENCER - Receitas:;${formatCurrency(monthTotals.upcoming.income).replace(/\s/g, ' ')}`,
      `A VENCER - Despesas:;${formatCurrency(monthTotals.upcoming.expense).replace(/\s/g, ' ')}`,
      "",
      "DETALHAMENTO DOS LANCAMENTOS",
      ["Data", "Tipo", "Descricao", "Categoria", "Banco / Conta", "Fornecedor / Forma Pagamento", "Status", "Valor (R$)"].join(';'),
      ...dataToExport.map(t => {
        const dateFormatted = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
        const typeText = t.type === TransactionType.INCOME ? "RECEITA" : "DESPESA";
        const desc = t.description.replace(/;/g, ',').replace(/"/g, '""');
        const category = getCategoryName(t.categoryId).replace(/;/g, ',').replace(/"/g, '""');
        const bank = getBankName(t.bankId).replace(/;/g, ',').replace(/"/g, '""');
        
        const suppOrMethod = (t.supplierId ? getSupplierName(t.supplierId) : t.paymentMethod)
          .replace(/;/g, ',')
          .replace(/"/g, '""');
          
        const statusText = t.status === 'PAID' ? "PAGO" : (t.date < new Date().toISOString().split('T')[0] ? "VENCIDO" : "PENDENTE");
        const amountVal = t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        return [
          dateFormatted,
          typeText,
          `"${desc}"`,
          `"${category}"`,
          `"${bank}"`,
          `"${suppOrMethod}"`,
          statusText,
          `"${amountVal}"`
        ].join(';');
      })
    ];

    const blob = new Blob(["\uFEFF" + csvLines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const fileSuffix = hasSelection ? 'selecionados' : 'filtrados';
    link.setAttribute('download', `relatorio_lancamentos_${fileSuffix}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const dataToExport = hasSelection ? selectedTransactions : filtered;
    if (dataToExport.length === 0) return;

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
        doc.text(hasSelection ? `Relatório de Lançamentos Selecionados (${dataToExport.length} itens)` : 'Relatório Consolidado de Lançamentos', textStartX, 23);

        // Metadata details
        doc.setFontSize(8);
        doc.setTextColor(100, 110, 130);
        const rightX = 195;
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, rightX, 16, { align: 'right' });
        
        const filterText = hasSelection 
          ? `Filtro: Seleção Manual (${dataToExport.length} itens)`
          : `Filtro: ` + (startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Início') + ' até ' + (endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Fim');
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
        doc.text('Gestor CNL Software • Relatório de Lançamentos', 15, 287);
        doc.text(`Página ${pageNum} de ${totalPages}`, 195, 287, { align: 'right' });
      };

      addHeader();

      // Summary Card Panels on Y:32 (PAGOS, VENCIDOS, A VENCER do mês atual)
      let currentY = 32;

      // Card 1: PAGOS
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, currentY, 56, 24, 1.5, 1.5, 'F');
      doc.setDrawColor(230, 235, 242);
      doc.setLineWidth(0.2);
      doc.roundedRect(15, currentY, 56, 24, 1.5, 1.5, 'S');

      doc.setFillColor(240, 253, 244); // light green bg
      doc.roundedRect(18, currentY + 3, 50, 4.5, 1, 1, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(22, 163, 74); // green-600
      doc.text('PAGOS', 43, currentY + 6.2, { align: 'center' });

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(115, 125, 140);
      doc.text('Receitas:', 19, currentY + 13);
      doc.setTextColor(22, 163, 74);
      doc.text(formatCurrency(monthTotals.paid.income), 67, currentY + 13, { align: 'right' });

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(115, 125, 140);
      doc.text('Despesas:', 19, currentY + 20);
      doc.setTextColor(113, 132, 207);
      doc.text(formatCurrency(monthTotals.paid.expense), 67, currentY + 20, { align: 'right' });

      // Card 2: VENCIDOS
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(77, currentY, 56, 24, 1.5, 1.5, 'F');
      doc.roundedRect(77, currentY, 56, 24, 1.5, 1.5, 'S');

      doc.setFillColor(254, 242, 242); // light red/rose bg
      doc.roundedRect(80, currentY + 3, 50, 4.5, 1, 1, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(220, 38, 38); // rose-600
      doc.text('VENCIDOS', 105, currentY + 6.2, { align: 'center' });

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(115, 125, 140);
      doc.text('Receitas:', 81, currentY + 13);
      doc.setTextColor(22, 163, 74);
      doc.text(formatCurrency(monthTotals.overdue.income), 129, currentY + 13, { align: 'right' });

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(115, 125, 140);
      doc.text('Despesas:', 81, currentY + 20);
      doc.setTextColor(220, 38, 38);
      doc.text(formatCurrency(monthTotals.overdue.expense), 129, currentY + 20, { align: 'right' });

      // Card 3: A VENCER
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(139, currentY, 56, 24, 1.5, 1.5, 'F');
      doc.roundedRect(139, currentY, 56, 24, 1.5, 1.5, 'S');

      doc.setFillColor(254, 243, 199); // light amber bg
      doc.roundedRect(142, currentY + 3, 50, 4.5, 1, 1, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(217, 119, 6); // amber-600
      doc.text('A VENCER', 167, currentY + 6.2, { align: 'center' });

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(115, 125, 140);
      doc.text('Receitas:', 143, currentY + 13);
      doc.setTextColor(22, 163, 74);
      doc.text(formatCurrency(monthTotals.upcoming.income), 191, currentY + 13, { align: 'right' });

      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(115, 125, 140);
      doc.text('Despesas:', 143, currentY + 20);
      doc.setTextColor(217, 119, 6);
      doc.text(formatCurrency(monthTotals.upcoming.expense), 191, currentY + 20, { align: 'right' });

      currentY += 28;

      // Table Header setup
      doc.setFillColor(13, 20, 40);
      doc.rect(15, currentY, 180, 7, 'F');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      
      const colX = {
        date: 15,
        type: 37,
        description: 55,
        bank: 107,
        status: 152,
        value: 172
      };

      doc.text('DATA', colX.date + 1, currentY + 4.8);
      doc.text('TIPO', colX.type + 1, currentY + 4.8);
      doc.text('DESCRIÇÃO / CATEGORIA', colX.description + 1, currentY + 4.8);
      doc.text('BANCO / RESP.', colX.bank + 1, currentY + 4.8);
      doc.text('STATUS', colX.status + 10, currentY + 4.8, { align: 'center' });
      doc.text('VALOR', colX.value + 21, currentY + 4.8, { align: 'right' });

      currentY += 7;

      // Render each data row
      let alternate = false;
      dataToExport.forEach((t) => {
        const rowHeight = 9;

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
          
          doc.text('DATA', colX.date + 1, currentY + 4.8);
          doc.text('TIPO', colX.type + 1, currentY + 4.8);
          doc.text('DESCRIÇÃO / CATEGORIA', colX.description + 1, currentY + 4.8);
          doc.text('BANCO / RESP.', colX.bank + 1, currentY + 4.8);
          doc.text('STATUS', colX.status + 10, currentY + 4.8, { align: 'center' });
          doc.text('VALOR', colX.value + 21, currentY + 4.8, { align: 'right' });
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

        // Set text details
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(50, 55, 65);

        // Date column
        const dateStr = new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR');
        doc.text(dateStr, colX.date + 1, currentY + 5.5);

        // Type column
        const isIncome = t.type === TransactionType.INCOME;
        doc.setFont('Helvetica', 'bold');
        if (isIncome) {
          doc.setTextColor(16, 185, 129); // emerald green
          doc.text('RECEITA', colX.type + 1, currentY + 5.5);
        } else {
          doc.setTextColor(239, 68, 68); // rose red
          doc.text('DESPESA', colX.type + 1, currentY + 5.5);
        }

        // Description and Category Column
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        
        let descText = t.description;
        const maxLen = 35;
        if (descText.length > maxLen) {
          // Check if it ends with installment indications like (01/10) or (Parcela 1/10)
          const match = descText.match(/\s*\((\d+\/\d+|Parcela\s+\d+\/\d+)\)$/i);
          if (match) {
            const suffix = match[0]; // e.g. " (Parcela 01/03)"
            const allowedBaseLen = maxLen - suffix.length - 3;
            const baseText = descText.slice(0, Math.max(5, allowedBaseLen)) + '...';
            descText = baseText + suffix;
          } else {
            descText = descText.substring(0, maxLen - 3) + '...';
          }
        }
        doc.text(descText, colX.description + 1, currentY + 4);
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(110, 120, 135);
        const catText = getCategoryName(t.categoryId);
        doc.text(catText.toUpperCase(), colX.description + 1, currentY + 7.2);

        // Bank, Supplier / Method Column
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(50, 55, 65);
        const bankText = getBankName(t.bankId);
        const truncatedBank = bankText.length > 18 ? bankText.substring(0, 17) + '...' : bankText;
        doc.text(truncatedBank, colX.bank + 1, currentY + 4);

        doc.setFontSize(6.5);
        doc.setTextColor(110, 120, 135);
        const suppText = t.supplierId ? getSupplierName(t.supplierId) : t.paymentMethod;
        const truncatedSupp = suppText.length > 22 ? suppText.substring(0, 21) + '...' : suppText;
        doc.text(truncatedSupp.toUpperCase(), colX.bank + 1, currentY + 7.2);

        // Status Badge text column
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        if (t.status === 'PAID') {
          doc.setTextColor(16, 185, 129);
          doc.text('PAGO', colX.status + 10, currentY + 5.5, { align: 'center' });
        } else if (t.date < new Date().toISOString().split('T')[0]) {
          doc.setTextColor(239, 68, 68);
          doc.text('VENCIDO', colX.status + 10, currentY + 5.5, { align: 'center' });
        } else {
          doc.setTextColor(245, 158, 11);
          doc.text('PENDENTE', colX.status + 10, currentY + 5.5, { align: 'center' });
        }

        // Value column
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        const valStr = formatCurrency(t.amount);
        doc.text(valStr, colX.value + 21, currentY + 5.5, { align: 'right' });

        currentY += rowHeight;
      });

      // Write accurate footers on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addFooter(i, totalPages);
      }

      const fileSuffix = hasSelection ? 'selecionados' : 'filtrados';
      doc.save(`relatorio_lancamentos_${fileSuffix}_${new Date().toISOString().split('T')[0]}.pdf`);
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
    <div className="bg-white dark:bg-[#0b1021] rounded-2xl shadow-xl border border-slate-100 dark:border-white/5 overflow-hidden animate-in fade-in duration-500">
      <div className="p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex flex-wrap gap-4 items-center justify-between">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
          <input
            type="text"
            placeholder="Buscar lançamentos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-[#7184cf] transition-all text-sm font-medium text-[#0d1428] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-[#7184cf] font-bold text-[#0d1428] dark:text-white cursor-pointer"
              title="Data Inicial"
            />
            <span className="text-slate-400 dark:text-slate-500 font-bold text-[10px]">até</span>
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-[#7184cf] font-bold text-[#0d1428] dark:text-white cursor-pointer"
              title="Data Final"
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                title="Limpar Filtro de Data"
              >
                <X size={16} />
              </button>
            )}
          </div>

          <select 
            className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7184cf] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TransactionType | 'ALL')}
          >
            <option value="ALL" className="text-slate-900">Todos os Tipos</option>
            <option value={TransactionType.INCOME} className="text-slate-900">Apenas Receitas</option>
            <option value={TransactionType.EXPENSE} className="text-slate-900">Apenas Despesas</option>
          </select>

          <select 
            className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7184cf] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL" className="text-slate-900">Todos os Planos de Contas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="text-slate-900">
                {c.name.toUpperCase()}
              </option>
            ))}
          </select>

          <select 
            className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7184cf] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'PAID' | 'PENDING')}
          >
            <option value="ALL" className="text-slate-900">Todos os Status</option>
            <option value="PAID" className="text-slate-900">Apenas Pagos</option>
            <option value="PENDING" className="text-slate-900">Apenas Em Aberto</option>
          </select>

          <select 
            className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#7184cf] font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
            value={fixedFilter}
            onChange={(e) => setFixedFilter(e.target.value as 'ALL' | 'FIXED' | 'NOT_FIXED')}
          >
            <option value="ALL" className="text-slate-900">Recorrência (Todas)</option>
            <option value="FIXED" className="text-slate-900">Apenas Fixos</option>
            <option value="NOT_FIXED" className="text-slate-900">Apenas Eventuais</option>
          </select>
        </div>
      </div>
      
      {/* Resumo dos Filtros */}
      <div className="px-6 py-4 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 flex flex-wrap gap-8 items-center">
        {/* Lançamentos Pagos */}
        <div className="flex flex-col">
          <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1 bg-emerald-500/10 text-emerald-605 dark:text-emerald-400 px-2 py-0.5 rounded-md w-max">
            PAGOS
          </span>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Receitas</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(monthTotals.paid.income)}</span>
            </div>
            <div className="w-px h-5 bg-slate-200 dark:bg-white/10"></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Despesas</span>
              <span className="font-extrabold text-[#7184cf] dark:text-[#a5b4fc] text-sm">{formatCurrency(monthTotals.paid.expense)}</span>
            </div>
          </div>
        </div>

        <div className="w-px h-10 bg-slate-200 dark:bg-white/10 hidden md:block"></div>

        {/* Lançamentos Vencidos */}
        <div className="flex flex-col">
          <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1 bg-rose-500/10 text-rose-650 dark:text-rose-400 px-2 py-0.5 rounded-md w-max">
            VENCIDOS
          </span>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Receitas</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(monthTotals.overdue.income)}</span>
            </div>
            <div className="w-px h-5 bg-slate-200 dark:bg-white/10"></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Despesas</span>
              <span className="font-extrabold text-rose-650 dark:text-rose-455 text-sm">{formatCurrency(monthTotals.overdue.expense)}</span>
            </div>
          </div>
        </div>

        <div className="w-px h-10 bg-slate-200 dark:bg-white/10 hidden md:block"></div>

        {/* Lançamentos A Vencer */}
        <div className="flex flex-col">
          <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1 bg-amber-500/10 text-amber-650 dark:text-amber-400 px-2 py-0.5 rounded-md w-max">
            A VENCER
          </span>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Receitas</span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(monthTotals.upcoming.income)}</span>
            </div>
            <div className="w-px h-5 bg-slate-200 dark:bg-white/10"></div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">Despesas</span>
              <span className="font-extrabold text-amber-600 dark:text-amber-500 text-sm">{formatCurrency(monthTotals.upcoming.expense)}</span>
            </div>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-4">
          <div className="hidden lg:block text-right">
            <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-600 uppercase tracking-widest block">
              Exibindo {filtered.length} de {transactions.length} lançamentos
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#7184cf] hover:bg-[#5f71b8] text-white text-xs font-black rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer group"
              title={hasSelection ? "Exportar lançamentos selecionados em formato PDF" : "Exportar lançamentos filtrados em formato PDF"}
            >
              <FileText size={14} className="group-hover:scale-105 transition-transform" />
              <span>PDF{hasSelection ? " (Seleção)" : ""}</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer group"
              title={hasSelection ? "Exportar lançamentos selecionados em formato CSV" : "Exportar lançamentos filtrados em formato CSV"}
            >
              <FileSpreadsheet size={14} className="group-hover:scale-105 transition-transform" />
              <span>CSV{hasSelection ? " (Seleção)" : ""}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Selection Summary Banner */}
      {hasSelection && (
        <div className="px-6 py-4 bg-[#7184cf]/10 dark:bg-[#7184cf]/5 border-b border-[#7184cf]/20 flex flex-wrap gap-8 items-center animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <span className="bg-[#7184cf] text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-md shadow-[#7184cf]/20">
              {selectedTransactions.length}
            </span>
            <span className="text-[10px] font-black text-[#7184cf] dark:text-[#8e9ee2] uppercase tracking-widest">
              Soma dos Lançamentos Selecionados
            </span>
          </div>
          <div className="w-px h-8 bg-[#7184cf]/20 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Receitas Selecionadas</span>
            <span className="text-base font-black text-emerald-500 dark:text-emerald-400">{formatCurrency(selectedTotals.income)}</span>
          </div>
          <div className="w-px h-8 bg-[#7184cf]/20 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Despesas Selecionadas</span>
            <span className="text-base font-black text-rose-500 dark:text-rose-400">{formatCurrency(selectedTotals.expense)}</span>
          </div>
          <div className="w-px h-8 bg-[#7184cf]/20 hidden sm:block"></div>
          <div className="flex flex-col">
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Saldo da Seleção</span>
            <span className={`text-base font-black ${selectedBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
              {formatCurrency(selectedBalance)}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={handleClearSelection}
              className="px-3 py-1.5 bg-[#7184cf]/10 hover:bg-[#7184cf]/20 text-[#7184cf] dark:text-[#8e9ee2] text-xs font-black rounded-lg transition-all cursor-pointer"
            >
              Limpar Seleção
            </button>
          </div>
        </div>
      )}

      {/* Mobile Card List (optimized for touch screens & compact display) */}
      <div className="block md:hidden divide-y divide-slate-100 dark:divide-white/5">
        {filtered.map((t) => {
          const isSelected = selectedIds.has(t.id);
          return (
            <div 
              key={t.id}
              onClick={() => handleToggleSelect(t.id)}
              className={`p-4 transition-colors flex flex-col gap-3 relative select-none ${
                isSelected 
                  ? 'bg-indigo-50/40 dark:bg-indigo-950/20' 
                  : 'hover:bg-slate-50 dark:hover:bg-white/5 bg-white dark:bg-[#0c1122]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div onClick={(e) => e.stopPropagation()} className="shrink-0 flex items-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(t.id);
                      }}
                      className="rounded border-slate-300 dark:border-white/10 text-[#7184cf] focus:ring-[#7184cf] cursor-pointer w-4 h-4 bg-white dark:bg-[#0d1428]"
                    />
                  </div>
                  
                  {/* Icon Indicator */}
                  <div className={`p-2 rounded-xl shrink-0 ${
                    t.type === TransactionType.INCOME 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : 'bg-rose-500/10 text-rose-500'
                  }`}>
                    {t.type === TransactionType.INCOME ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-[#0d1428] dark:text-white truncate max-w-[150px]">
                        {t.description}
                      </span>
                      {t.isFixed && (
                        <div className="p-0.5 bg-[#7184cf]/20 text-[#7184cf] rounded" title="Lançamento Fixo">
                          <Repeat size={10} />
                        </div>
                      )}
                      {t.installmentsCount && t.installmentsCount > 1 && (
                        <div className="p-0.5 bg-[#a78bfa]/20 text-[#a78bfa] rounded" title={`Parcela ${t.installmentNumber}/${t.installmentsCount}`}>
                          <CreditCard size={10} />
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mt-1">
                      {getCategoryName(t.categoryId)}
                    </span>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end shrink-0">
                  <span className={`text-sm font-black flex items-center gap-0.5 ${
                    t.type === TransactionType.INCOME ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                  }`}>
                    {t.type === TransactionType.INCOME ? '+' : '-'} {formatCurrency(t.amount)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold block mt-0.5">
                    {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>

              {/* Sub Row: Bank-Supplier and Status */}
              <div className="flex items-center justify-between text-xs bg-slate-50 dark:bg-white/5 p-2 rounded-xl border border-slate-100 dark:border-white/5">
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">
                    {getBankName(t.bankId)}
                  </span>
                  <span className="text-[9px] text-[#7184cf] dark:text-slate-500 font-medium truncate">
                    {t.supplierId ? getSupplierName(t.supplierId) : t.paymentMethod}
                  </span>
                </div>

                <div className="flex items-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleStatus(t.id); }}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border ${
                      t.status === 'PAID' 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                      : (t.date < new Date().toISOString().split('T')[0] ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/40')
                    }`}
                  >
                    {t.status === 'PAID' ? 'Pago' : (t.date < new Date().toISOString().split('T')[0] ? 'Vencido' : 'Pendente')}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-1 pt-1 border-t border-slate-100 dark:border-white/5" onClick={(e) => e.stopPropagation()}>
                {t.status === 'PENDING' && (
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onPartialPay(t); }}
                    className="p-2 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
                    title="Baixa Parcial"
                  >
                    <Scissors size={16} />
                  </button>
                )}
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                  className="p-2 text-slate-400 hover:text-[#7184cf] hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
                  title="Editar Lançamento"
                >
                  <Pencil size={16} />
                </button>
                <button 
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDelete(t); }}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
                  title="Excluir Lançamento"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-6 py-16 text-center bg-white dark:bg-[#0c1122]">
            <div className="flex flex-col items-center gap-3 opacity-20">
              <Search size={40} className="text-[#0d1428] dark:text-white" />
              <p className="text-[#0d1428] dark:text-white font-bold uppercase text-[9px] tracking-[0.2em]">Nenhum lançamento encontrado</p>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto overflow-y-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5 select-none">
            <tr>
              <th className="px-4 py-4 w-12 text-center">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every(t => selectedIds.has(t.id))}
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 dark:border-white/10 text-[#7184cf] focus:ring-[#7184cf] cursor-pointer w-4 h-4 bg-white dark:bg-[#0d1428]"
                />
              </th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Data</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Descrição / Categoria</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Banco / Fornecedor</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Status</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Valor</th>
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {filtered.map((t) => {
              const isSelected = selectedIds.has(t.id);
              return (
                <tr 
                  key={t.id} 
                  onClick={() => handleToggleSelect(t.id)}
                  className={`transition-colors group cursor-pointer ${
                    isSelected 
                      ? 'bg-indigo-50/50 dark:bg-indigo-950/20' 
                      : 'hover:bg-slate-50 dark:hover:bg-white/5'
                  }`}
                >
                  <td className="px-4 py-4 w-12 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(t.id);
                      }}
                      className="rounded border-slate-300 dark:border-white/10 text-[#7184cf] focus:ring-[#7184cf] cursor-pointer w-4 h-4 bg-white dark:bg-[#0d1428]"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-400">
                    {new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-[#0d1428] dark:text-white">{t.description}</span>
                        {t.isFixed && (
                          <div className="p-1 bg-[#7184cf]/20 text-[#7184cf] rounded-md" title="Lançamento Fixo">
                            <Repeat size={10} />
                          </div>
                        )}
                        {t.installmentsCount && t.installmentsCount > 1 && (
                          <div className="p-1 bg-[#a78bfa]/20 text-[#a78bfa] rounded-md" title={`Parcela ${t.installmentNumber}/${t.installmentsCount}`}>
                            <CreditCard size={10} />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{getCategoryName(t.categoryId)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">{getBankName(t.bankId)}</span>
                      <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-tight">{t.supplierId ? getSupplierName(t.supplierId) : t.paymentMethod}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleStatus(t.id); }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 border ${
                        t.status === 'PAID' 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                        : (t.date < new Date().toISOString().split('T')[0] ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 animate-pulse' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20')
                      }`}
                    >
                      {t.status === 'PAID' ? (
                        <><CheckCircle2 size={12} /> Pago</>
                      ) : (
                        t.date < new Date().toISOString().split('T')[0] ? (
                          <><X size={12} /> Vencido</>
                        ) : (
                          <><Clock size={12} /> A Vencer</>
                        )
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className={`text-sm font-black flex items-center justify-end gap-1 ${
                      t.type === TransactionType.INCOME ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                    }`}>
                      {t.type === TransactionType.INCOME ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                      {formatCurrency(t.amount)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {t.status === 'PENDING' && (
                        <button 
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onPartialPay(t); }}
                          className="p-2 text-slate-300 hover:text-amber-500 dark:text-slate-600 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
                          title="Baixa Parcial"
                        >
                          <Scissors size={18} />
                        </button>
                      )}
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                        className="p-2 text-slate-300 hover:text-[#7184cf] dark:text-slate-600 dark:hover:text-[#7184cf] hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
                        title="Editar Lançamento"
                      >
                        <Pencil size={18} />
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDelete(t); }}
                        className="p-2 text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
                        title="Excluir Lançamento"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 opacity-20">
                    <Search size={48} className="text-[#0d1428] dark:text-white" />
                    <p className="text-[#0d1428] dark:text-white font-bold uppercase text-[10px] tracking-[0.2em]">Nenhum lançamento encontrado</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionList;
