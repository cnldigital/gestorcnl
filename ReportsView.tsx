import React, { useState, useMemo, useCallback } from 'react';
import { 
  Calendar, 
  Wallet,
  PieChart as PieChartIcon,
  BarChart3,
  Filter,
  RefreshCw,
  ChevronRight,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from 'recharts';
import { Transaction, TransactionType, Category } from '../types';

interface ReportsViewProps {
  transactions: Transaction[];
  categories: Category[];
}

const COLORS_EXPENSE = ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#fecdd3', '#fff1f2'];

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const ReportsView: React.FC<ReportsViewProps> = ({ transactions, categories }) => {
  // Utility for date formatting
  const formatDateToISO = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getCurrentMonthRange = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    return {
      start: formatDateToISO(firstDay),
      end: formatDateToISO(lastDay)
    };
  };

  const monthRange = getCurrentMonthRange();
  
  // Advanced Filter state variables matching image layout
  const [startDate, setStartDate] = useState(monthRange.start);
  const [endDate, setEndDate] = useState(monthRange.end);
  
  // Month/Year Dropdown selectors
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Visual layout mode ('Simplificado'/Screenshot based vs 'Gráficos')
  const [viewMode, setViewMode] = useState<'Simplificado' | 'Gráficos'>('Simplificado');

  // Currently applied period tracker for styling the pills
  const [activePeriod, setActivePeriod] = useState<string>('mes');

  // Month list in Portuguese
  const meses = [
    { value: 0, label: 'Janeiro' },
    { value: 1, label: 'Fevereiro' },
    { value: 2, label: 'Março' },
    { value: 3, label: 'Abril' },
    { value: 4, label: 'Maio' },
    { value: 5, label: 'Junho' },
    { value: 6, label: 'Julho' },
    { value: 7, label: 'Agosto' },
    { value: 8, label: 'Setembro' },
    { value: 9, label: 'Outubro' },
    { value: 10, label: 'Novembro' },
    { value: 11, label: 'Dezembro' }
  ];

  // Year choices
  const anos = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  // Quick filters handler
  const handleQuickFilter = (period: string) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    setActivePeriod(period);

    switch (period) {
      case 'hoje':
        start = today;
        end = today;
        break;
      case 'ontem': {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        start = yesterday;
        end = yesterday;
        break;
      }
      case 'semana': {
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(today.setDate(diff));
        end = new Date();
        break;
      }
      case '7dias': {
        const past7 = new Date();
        past7.setDate(today.getDate() - 7);
        start = past7;
        end = new Date();
        break;
      }
      case 'mes':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'mes_passado':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
    }

    setStartDate(formatDateToISO(start));
    setEndDate(formatDateToISO(end));
  };

  // Safe manual application of custom start/end date range input
  const handleApplyCustomRange = () => {
    setActivePeriod('personalizado');
  };

  // Safe Month/Year filter application
  const handleApplyMonthYear = () => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    
    setStartDate(formatDateToISO(firstDay));
    setEndDate(formatDateToISO(lastDay));
    setActivePeriod('mes-ano');
  };

  // Reset/Clear filter inputs
  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setActivePeriod('');
  };

  // Core filter logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      let matches = true;
      if (startDate) {
        matches = matches && t.date >= startDate;
      }
      if (endDate) {
        matches = matches && t.date <= endDate;
      }
      return matches;
    });
  }, [transactions, startDate, endDate]);

  // Primary operational stats computed reactively
  const stats = useMemo(() => {
    const income = filteredTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((acc, curr) => acc + curr.amount, 0);
      
    const expense = filteredTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    const operationalResult = income - expense;
    // Percentage calculated over total income
    const operationalPercent = income > 0 ? (operationalResult / income) * 100 : 0;

    // Default global paid balance metric
    const totalPaidIncome = transactions
      .filter(t => t.type === TransactionType.INCOME && t.status === 'PAID')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const totalPaidExpenses = transactions
      .filter(t => t.type === TransactionType.EXPENSE && t.status === 'PAID')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const totalPaidBalance = totalPaidIncome - totalPaidExpenses;

    return { 
      income, 
      expense, 
      operationalResult,
      operationalPercent,
      totalPaidBalance
    };
  }, [filteredTransactions, transactions]);

  // Accounts Plan / Categories grouping logic for Table 1: "Receitas por Plano de Contas"
  const incomePlanBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    const localIncomes = filteredTransactions.filter(t => t.type === TransactionType.INCOME);

    localIncomes.forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      const name = cat ? cat.name : 'Receitas Gerais';
      breakdown[name] = (breakdown[name] || 0) + t.amount;
    });

    const parsed = Object.entries(breakdown).map(([name, val]) => {
      return {
        name,
        value: val,
        percentageOfIncome: stats.income > 0 ? (val / stats.income) * 100 : 0,
        percentageOfExpense: stats.expense > 0 ? (val / stats.expense) * 100 : 0
      };
    }).sort((a, b) => b.value - a.value);

    // Apply dynamic structural Account codes to resemble professional Plano e Subplano
    return parsed.map((item, index) => {
      const planCode = `01.${String(index + 1).padStart(2, '0')}.`;
      return {
        ...item,
        planCode,
        fullName: `${planCode} ${item.name.toUpperCase()}`
      };
    });
  }, [filteredTransactions, categories, stats]);

  // Accounts Plan / Categories grouping logic for Table 2: "Despesas por Plano e Subplano"
  const expensePlanBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    const localExpenses = filteredTransactions.filter(t => t.type === TransactionType.EXPENSE);

    localExpenses.forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      const name = cat ? cat.name : 'Despesas Gerais';
      breakdown[name] = (breakdown[name] || 0) + t.amount;
    });

    const parsed = Object.entries(breakdown).map(([name, val]) => {
      return {
        name,
        value: val,
        percentageOfExpense: stats.expense > 0 ? (val / stats.expense) * 100 : 0,
        percentageOfIncome: stats.income > 0 ? (val / stats.income) * 100 : 0
      };
    }).sort((a, b) => b.value - a.value);

    // Apply dynamic structural Account codes to resemble professional Plano e Subplano
    return parsed.map((item, index) => {
      const planCode = `03.${String(index + 1).padStart(2, '0')}.`;
      return {
        ...item,
        planCode,
        fullName: `${planCode} ${item.name.toUpperCase()}`
      };
    });
  }, [filteredTransactions, categories, stats]);

  // Recharts graphics parsing helpers
  const categoryBreakdownRecharts = useMemo(() => {
    const breakdown: Record<string, { amount: number, count: number, type: TransactionType }> = {};
    
    filteredTransactions.forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId);
      const name = cat ? cat.name : 'Outros';
      if (!breakdown[name]) {
        breakdown[name] = { amount: 0, count: 0, type: t.type };
      }
      breakdown[name].amount += t.amount;
      breakdown[name].count += 1;
    });

    return Object.entries(breakdown)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions, categories]);

  const chartExpenseCategories = categoryBreakdownRecharts.filter(c => c.type === TransactionType.EXPENSE);

  const barChartData = [
    { name: 'Fluxo', Receitas: stats.income, Despesas: stats.expense }
  ];

  // Export to PDF programmatically
  const handleExportPDF = useCallback(() => {
    const generatePdf = (logoBase64?: string) => {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const formatPeriodDate = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return dateStr;
      };

      const periodStr = (startDate && endDate) 
        ? `${formatPeriodDate(startDate)} a ${formatPeriodDate(endDate)}` 
        : 'Período Completo';

      const addHeader = () => {
        // Top accent banner
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

        // Document title and subtitle
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(14);
        doc.setTextColor(13, 20, 40);
        doc.text('GESTOR CNL', textStartX, 18);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(113, 132, 207); // #7184cf
        doc.text('Relatório Consolidado do Balanço Financeiro', textStartX, 23);

        // Metadata details
        doc.setFontSize(8);
        doc.setTextColor(100, 110, 130);
        const rightX = 195;
        doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, rightX, 16, { align: 'right' });
        const filterText = `Filtro: ${periodStr}`;
        doc.text(filterText, rightX, 21, { align: 'right' });

        // Divider line
        doc.setDrawColor(220, 225, 235);
        doc.setLineWidth(0.4);
        doc.line(15, 26, 195, 26);
      };

      addHeader();

      let currentY = 32;

      // Summary Card Panel on Y:32
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, currentY, 180, 20, 1.5, 1.5, 'F');

      // Column 1: Receitas
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(115, 125, 140);
      doc.text('TOTAL RECEITAS', 20, currentY + 6);
      doc.setFontSize(10);
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.text(formatCurrency(stats.income), 20, currentY + 14);

      // Column 2: Despesas
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(115, 125, 140);
      doc.text('TOTAL DESPESAS', 65, currentY + 6);
      doc.setFontSize(10);
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text(formatCurrency(stats.expense), 65, currentY + 14);

      // Column 3: Resultado Operacional
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(115, 125, 140);
      doc.text('RESULTADO OPERACIONAL', 110, currentY + 6);
      doc.setFontSize(10);
      const isPositive = stats.operationalResult >= 0;
      doc.setTextColor(isPositive ? 16 : 225, isPositive ? 185 : 29, isPositive ? 129 : 72);
      doc.text(formatCurrency(stats.operationalResult), 110, currentY + 14);

      // Column 4: Margem
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(115, 125, 140);
      doc.text('MARGEM / EFICIÊNCIA', 155, currentY + 6);
      doc.setFontSize(10);
      doc.setTextColor(13, 20, 40);
      doc.text(`${stats.operationalPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`, 155, currentY + 14);

      currentY += 28;

      const pageHeight = 297;
      const checkPageBreak = (neededHeight: number) => {
        if (currentY + neededHeight > pageHeight - 20) {
          doc.addPage();
          currentY = 15;
          // Draw miniature top-header
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(100, 110, 130);
          doc.text('GESTOR CNL • RELATÓRIO DO BALANÇO FINANCEIRO', 15, 11);
          doc.setDrawColor(220, 225, 235);
          doc.setLineWidth(0.3);
          doc.line(15, 12, 195, 12);
          currentY = 18;
        }
      };

      // Table 1: Receitas por Plano de Contas
      doc.setFillColor(16, 185, 129); // emerald-500
      doc.rect(15, currentY, 3, 5, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(13, 20, 40);
      doc.text('RECEITAS POR PLANO DE CONTAS', 21, currentY + 4);
      currentY += 8;

      // Header Table Row
      doc.setFillColor(241, 245, 249);
      doc.rect(15, currentY, 180, 7, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('PLANO DE CONTAS', 18, currentY + 4.8);
      doc.text('VALOR', 140, currentY + 4.8, { align: 'right' });
      doc.text('% PARTICIPAÇÃO', 190, currentY + 4.8, { align: 'right' });
      currentY += 7;

      if (incomePlanBreakdown.length === 0) {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('Nenhuma receita neste período.', 18, currentY + 4.8);
        currentY += 8;
      } else {
        incomePlanBreakdown.forEach((row) => {
          checkPageBreak(8);
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85);
          doc.text(row.name.toUpperCase(), 18, currentY + 4.8);

          doc.setFont('Helvetica', 'bold');
          doc.setTextColor(16, 120, 80); // dark emerald
          doc.text(formatCurrency(row.value), 140, currentY + 4.8, { align: 'right' });

          doc.setFont('Helvetica', 'normal');
          doc.setTextColor(100, 110, 125);
          doc.text(`${row.percentageOfIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`, 190, currentY + 4.8, { align: 'right' });

          // divider line
          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.2);
          doc.line(15, currentY + 7.5, 195, currentY + 7.5);
          currentY += 7.5;
        });
      }

      currentY += 8;
      checkPageBreak(25);

      // Table 2: Despesas por Plano de Contas
      doc.setFillColor(225, 29, 72); // rose-600
      doc.rect(15, currentY, 3, 5, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(13, 20, 40);
      doc.text('DESPESAS POR PLANO DE CONTAS', 21, currentY + 4);
      currentY += 8;

      // Header Table Row
      doc.setFillColor(241, 245, 249);
      doc.rect(15, currentY, 180, 7, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('PLANO DE CONTAS', 18, currentY + 4.8);
      doc.text('VALOR', 140, currentY + 4.8, { align: 'right' });
      doc.text('% PARTICIPAÇÃO', 190, currentY + 4.8, { align: 'right' });
      currentY += 7;

      if (expensePlanBreakdown.length === 0) {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('Nenhuma despesa neste período.', 18, currentY + 4.8);
        currentY += 8;
      } else {
        expensePlanBreakdown.forEach((row) => {
          checkPageBreak(8);
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(51, 65, 85);
          doc.text(row.name.toUpperCase(), 18, currentY + 4.8);

          doc.setFont('Helvetica', 'bold');
          doc.setTextColor(190, 24, 74); // dark rose
          doc.text(formatCurrency(row.value), 140, currentY + 4.8, { align: 'right' });

          doc.setFont('Helvetica', 'normal');
          doc.setTextColor(100, 110, 125);
          doc.text(`${row.percentageOfExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`, 190, currentY + 4.8, { align: 'right' });

          // divider line
          doc.setDrawColor(241, 245, 249);
          doc.setLineWidth(0.2);
          doc.line(15, currentY + 7.5, 195, currentY + 7.5);
          currentY += 7.5;
        });
      }

      // Add footer to all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(220, 225, 235);
        doc.setLineWidth(0.3);
        doc.line(15, 282, 195, 282);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(120, 130, 145);
        doc.text('Gestor CNL Software • Relatório de Balanço Financeiro', 15, 287);
        doc.text(`Página ${i} de ${totalPages}`, 195, 287, { align: 'right' });
      }

      doc.save(`Relatorio_Balanco_${startDate || 'inicial'}_a_${endDate || 'final'}.pdf`);
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
  }, [startDate, endDate, stats, incomePlanBreakdown, expensePlanBreakdown]);

  // Export to CSV
  const handleExportCSV = useCallback(() => {
    const formatPeriodDate = (dateStr: string) => {
      if (!dateStr) return '';
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    };

    let csvContent = "";
    
    csvContent += "GESTOR CNL - RELATORIO DE BALANCO FINANCEIRO\r\n";
    csvContent += `Periodo:;${formatPeriodDate(startDate)} ate ${formatPeriodDate(endDate)}\r\n`;
    csvContent += `Gerado em:;${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}\r\n\r\n`;
    
    csvContent += "RESUMO DO PERIODO\r\n";
    csvContent += `Total Receitas:;${formatCurrency(stats.income).replace(/\s/g, ' ')}\r\n`;
    csvContent += `Total Despesas:;${formatCurrency(stats.expense).replace(/\s/g, ' ')}\r\n`;
    csvContent += `Resultado Operacional:;${formatCurrency(stats.operationalResult).replace(/\s/g, ' ')}\r\n`;
    csvContent += `Margem Operacional:;${stats.operationalPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%\r\n\r\n`;
    
    csvContent += "RECEITAS POR PLANO DE CONTAS\r\n";
    csvContent += "Plano;Valor;% Receita\r\n";
    if (incomePlanBreakdown.length === 0) {
      csvContent += "Nenhuma receita neste período;;;\r\n";
    } else {
      incomePlanBreakdown.forEach(row => {
        const rowName = row.name.toUpperCase().replace(/;/g, ',');
        const rowVal = formatCurrency(row.value).replace(/\s/g, ' ');
        const rowPerc = `${row.percentageOfIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
        csvContent += `"${rowName}";"${rowVal}";"${rowPerc}"\r\n`;
      });
    }
    csvContent += "\r\n";
    
    csvContent += "DESPESAS POR PLANO DE CONTAS\r\n";
    csvContent += "Plano;Valor;% Despesa\r\n";
    if (expensePlanBreakdown.length === 0) {
      csvContent += "Nenhuma despesa neste período;;;\r\n";
    } else {
      expensePlanBreakdown.forEach(row => {
        const rowName = row.name.toUpperCase().replace(/;/g, ',');
        const rowVal = formatCurrency(row.value).replace(/\s/g, ' ');
        const rowPerc = `${row.percentageOfExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
        csvContent += `"${rowName}";"${rowVal}";"${rowPerc}"\r\n`;
      });
    }

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatorio_Balanco_${startDate || 'inicial'}_a_${endDate || 'final'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [startDate, endDate, stats, incomePlanBreakdown, expensePlanBreakdown]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12 text-[#0d1428] dark:text-slate-100">
      
      {/* HEADER CONTROL PANEL WITH TIMEFRAME FILTERS */}
      <div className="bg-white dark:bg-[#0e162e] border border-slate-200/80 dark:border-white/5 rounded-2xl shadow-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4 flex-1">
            
            {/* DATA INICIAL */}
            <div>
              <label className="block text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Calendar size={12} /> Data Inicial
              </label>
              <div className="relative">
                <input 
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActivePeriod('custom');
                  }}
                  className="w-full bg-slate-50 dark:bg-[#090d1e] border border-slate-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-[#0d1428] dark:text-white outline-none focus:ring-2 focus:ring-[#7184cf]/40"
                />
              </div>
            </div>

            {/* DATA FINAL */}
            <div>
              <label className="block text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                <Calendar size={12} /> Data Final
              </label>
              <div className="relative">
                <input 
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActivePeriod('custom');
                  }}
                  className="w-full bg-slate-50 dark:bg-[#090d1e] border border-slate-200 dark:border-white/5 rounded-xl px-3 py-2 text-xs font-bold text-[#0d1428] dark:text-white outline-none focus:ring-2 focus:ring-[#7184cf]/40"
                />
              </div>
            </div>

            {/* BTN FILTRAR CUSTOM RANGE */}
            <div className="flex items-end">
              <button 
                onClick={handleApplyCustomRange}
                className="w-full h-[38px] bg-sky-600 hover:bg-sky-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Filter size={14} />
                Filtrar Período
              </button>
            </div>

            {/* MES / ANO PANEL */}
            <div className="md:col-span-3 xl:col-span-1 grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                  Mês / Ano
                </label>
                <div className="flex gap-1.5">
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-[#090d1e] border border-slate-200 dark:border-white/5 rounded-xl p-2 text-xs font-bold focus:ring-2 focus:ring-[#7184cf]/40 cursor-pointer"
                  >
                    {meses.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select 
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full bg-slate-50 dark:bg-[#090d1e] border border-slate-200 dark:border-white/5 rounded-xl p-2 text-xs font-bold focus:ring-2 focus:ring-[#7184cf]/40 cursor-pointer"
                  >
                    {anos.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-end col-span-1">
                <button 
                  onClick={handleApplyMonthYear}
                  className="w-full h-[38px] bg-slate-700 hover:bg-slate-800 text-white text-xs font-black rounded-xl transition-all cursor-pointer"
                >
                  Filtro
                </button>
              </div>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row items-stretch lg:items-end gap-3 lg:border-l lg:border-slate-100 lg:dark:border-white/5 lg:pl-4">
            
            {/* CLEAN BTN */}
            <div className="flex items-end">
              <button 
                onClick={handleClearFilters}
                className="w-full h-[38px] border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-xl px-4 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                title="Limpar todos os filtros"
              >
                <RefreshCw size={14} />
                Limpar
              </button>
            </div>

            {/* VIEW MODE LAYOUT DROP-DOWN */}
            <div>
              <label className="block text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                Visualização
              </label>
              <select 
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value as 'Simplificado' | 'Gráficos')}
                className="h-[38px] bg-slate-50 dark:bg-[#090d1e] border border-slate-200 dark:border-white/5 rounded-xl px-4 text-xs font-black text-[#7184cf] dark:text-[#a7b9fc] hover:bg-slate-100 dark:hover:bg-white/10 transition-all cursor-pointer outline-none min-w-[130px]"
              >
                <option value="Simplificado">Simplificado</option>
                <option value="Gráficos">Aulas / Gráficos</option>
              </select>
            </div>

            {/* EXPORTS CONTROL */}
            <div>
              <label className="block text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                Exportar Relatório
              </label>
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleExportPDF}
                  className="h-[38px] bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl px-4 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  title="Exportar como PDF"
                >
                  <Download size={14} />
                  PDF
                </button>
                <button 
                  onClick={handleExportCSV}
                  className="h-[38px] bg-slate-700 hover:bg-slate-800 text-white text-xs font-black rounded-xl px-4 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                  title="Exportar como CSV"
                >
                  <FileSpreadsheet size={14} />
                  CSV
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* TIME RANGE SELECTION PILLS (Hoje, Ontem, etc.) */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex flex-wrap items-center gap-2">
          {[
            { id: 'hoje', name: 'Hoje' },
            { id: 'ontem', name: 'Ontem' },
            { id: 'semana', name: 'Esta Semana' },
            { id: '7dias', name: 'Últimos 7 Dias' },
            { id: 'mes', name: 'Este Mês' },
            { id: 'mes_passado', name: 'Mês Passado' }
          ].map((pill) => {
            const isSelected = activePeriod === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => handleQuickFilter(pill.id)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer border ${
                  isSelected 
                    ? 'bg-sky-600 border-sky-600 text-white font-heavy shadow-md' 
                    : 'bg-white dark:bg-[#0f1833] text-slate-500 dark:text-slate-400 hover:text-[#0d1428] dark:hover:text-white border-slate-200 dark:border-white/5'
                }`}
              >
                {pill.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* RENDER DYNAMIC LAYOUT BASED ON VIEW MODE */}
      {viewMode === 'Simplificado' ? (
        
        /* -----------------------------------------------------
           SIMPLIFIED SPREADSHEET LAYOUT MATCHING USER IMAGE 
           ----------------------------------------------------- */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* PANEL 1: RECEITAS POR PLANO DE CONTAS */}
          <div className="lg:col-span-12 xl:col-span-6 bg-white dark:bg-[#0e162e] border border-slate-200/80 dark:border-white/5 rounded-xl shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-wide text-[#0d1428] dark:text-slate-100 flex items-center gap-2 uppercase">
                <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                RECEITAS POR PLANO DE CONTAS
              </h3>
              <p className="text-xs font-black text-emerald-600 dark:text-emerald-400 text-right">
                Total: <span className="text-sm font-extrabold">{formatCurrency(stats.income)}</span>
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/50 dark:bg-white/5 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider">
                    <th className="px-6 py-3 w-1/2">PLANO</th>
                    <th className="px-6 py-3 text-right">VALOR</th>
                    <th className="px-6 py-3 text-right">% RECEITA</th>
                  </tr>
                </thead>
                <tbody>
                  {incomePlanBreakdown.map((row) => (
                    <tr 
                      key={row.name} 
                      className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <ChevronRight size={12} className="text-slate-400" />
                        <span>{row.name.toUpperCase()}</span>
                      </td>
                      <td className="px-6 py-3.5 text-xs font-black text-right text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(row.value)}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-extrabold text-right text-slate-500 dark:text-slate-400">
                        {row.percentageOfIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                      </td>
                    </tr>
                  ))}
                  {incomePlanBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-xs text-slate-400 italic">
                        Nenhuma receita neste período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PANEL 2: DESPESAS POR PLANO DE CONTAS */}
          <div className="lg:col-span-12 xl:col-span-6 bg-white dark:bg-[#0e162e] border border-slate-200/80 dark:border-white/5 rounded-xl shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 flex items-center justify-between">
              <h3 className="font-bold text-sm tracking-wide text-[#0d1428] dark:text-slate-100 flex items-center gap-2 uppercase">
                <span className="w-1.5 h-4 bg-rose-500 rounded-full"></span>
                DESPESAS POR PLANO DE CONTAS
              </h3>
              <p className="text-xs font-black text-rose-600 dark:text-rose-400 text-right">
                Total: <span className="text-sm font-extrabold">{formatCurrency(stats.expense)}</span>
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/50 dark:bg-white/5 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 tracking-wider">
                    <th className="px-6 py-3 w-1/2">PLANO</th>
                    <th className="px-6 py-3 text-right">VALOR</th>
                    <th className="px-6 py-3 text-right">% DESPESA</th>
                  </tr>
                </thead>
                <tbody>
                  {expensePlanBreakdown.map((row) => (
                    <tr 
                      key={row.name} 
                      className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-3.5 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                        <ChevronRight size={12} className="text-slate-400" />
                        <span>{row.name.toUpperCase()}</span>
                      </td>
                      <td className="px-6 py-3.5 text-xs font-black text-right text-rose-600 dark:text-rose-400">
                        {formatCurrency(row.value)}
                      </td>
                      <td className="px-6 py-3.5 text-xs font-extrabold text-right text-slate-500 dark:text-slate-400">
                        {row.percentageOfExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                      </td>
                    </tr>
                  ))}
                  {expensePlanBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-xs text-slate-400 italic">
                        Nenhuma despesa neste período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      ) : (
        
        /* -----------------------------------------------------
           GRAPHICS / CHARTS COMPLEMENTARY VIEW
           ----------------------------------------------------- */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* CATEGORY DONUT */}
          <div className="bg-white dark:bg-[#0e162e] border border-slate-200/80 dark:border-white/5 p-8 rounded-2xl shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-[#0d1428] dark:text-white flex items-center gap-2 text-lg uppercase">
                <PieChartIcon size={22} className="text-[#7184cf]" /> 
                Despesas por Categoria
              </h3>
            </div>

            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartExpenseCategories}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
                    paddingAngle={6}
                    dataKey="amount"
                    stroke="none"
                  >
                    {chartExpenseCategories.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS_EXPENSE[index % COLORS_EXPENSE.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: '12px', color: '#0f172a' }}
                    itemStyle={{ color: '#0f172a' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-6 space-y-2">
              {chartExpenseCategories.slice(0, 5).map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS_EXPENSE[index % COLORS_EXPENSE.length] }}
                    ></div>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 capitalize">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-[#0d1428] dark:text-white">{formatCurrency(item.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* BAR CHART COMPARISON */}
          <div className="bg-white dark:bg-[#0e162e] border border-slate-200/80 dark:border-white/5 p-8 rounded-2xl shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-bold text-[#0d1428] dark:text-white flex items-center gap-2 text-lg uppercase">
                <BarChart3 size={22} className="text-[#a78bfa]" /> 
                Comparativo de Balanço
              </h3>
            </div>

            <div className="h-[250px] w-full mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.1)" />
                  <XAxis dataKey="name" hide />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #f1f5f9', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', color: '#0f172a' }}
                    itemStyle={{ color: '#0f172a' }}
                  />
                  <Legend iconType="circle" />
                  <Bar dataKey="Receitas" fill="#10b981" radius={[8, 8, 0, 0]} barSize={50} />
                  <Bar dataKey="Despesas" fill="#f43f5e" radius={[8, 8, 0, 0]} barSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* MARGIN PROGRESS LOOPS */}
            <div className="bg-slate-50 dark:bg-[#0b1021] p-5 rounded-2xl border border-slate-100 dark:border-white/5 mt-auto">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Margem Operacional de Lucratividade</p>
              <div className="flex items-end gap-2">
                <h5 className="text-2xl font-black text-[#0d1428] dark:text-white">
                  {stats.operationalPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                </h5>
                <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-1">Eficiência</span>
              </div>
              <div className="mt-3 w-full bg-slate-200 dark:bg-white/10 h-2.5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#7184cf] to-[#10b981] transition-all duration-1000"
                  style={{ width: `${Math.max(0, Math.min(100, stats.operationalPercent))}%` }}
                ></div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* -----------------------------------------------------
         HUGE PROFESSIONAL FOOTER GREEN OR CRIMSON SOLID BANNER 
         ----------------------------------------------------- */}
      <div 
        className={`w-full rounded-2xl shadow-xl px-8 py-5 flex flex-col md:flex-row items-center justify-between text-white transition-all duration-500 overflow-hidden relative ${
          stats.operationalResult >= 0 
            ? 'bg-gradient-to-r from-[#0d614a] to-[#0a4635]' 
            : 'bg-gradient-to-r from-rose-800 to-rose-950'
        }`}
      >
        {/* Subtle background decoration */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 transform origin-top-right transition-transform pointer-events-none"></div>

        <div className="text-center md:text-left z-10">
          <p className="text-[10px] font-black text-slate-200/80 tracking-widest uppercase mb-1 flex items-center justify-center md:justify-start gap-1">
            <Wallet size={12} /> Resultado Operacional
          </p>
          <h2 className="text-3xl font-black tracking-tight select-all">
            {formatCurrency(stats.operationalResult)}
          </h2>
        </div>

        <div className="text-center md:text-right mt-4 md:mt-0 z-10">
          <p className="text-[10px] font-black text-slate-200/80 tracking-widest uppercase mb-1">
            Percentual
          </p>
          <h3 className="text-3xl font-black tracking-tight select-all">
            {stats.operationalPercent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
          </h3>
        </div>
      </div>

    </div>
  );
};

export default ReportsView;
