import React, { useState } from 'react';
import { X, Calendar, Tag, User, Landmark, CreditCard, FileText, CheckCircle2, Clock, ArrowUpRight, ArrowDownLeft, ChevronDown, Save, Repeat, Loader2 } from 'lucide-react';
import { Transaction, TransactionType, Category, Supplier, Bank } from '../types';
import TransactionTutorial from './TransactionTutorial';
import { AnimatePresence } from 'motion/react';

const formatBRLNumber = (num: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

const formatBRLString = (value: string): string => {
  const cleanValue = value.replace(/\D/g, '');
  if (!cleanValue) return '';
  const numValue = parseInt(cleanValue, 10) / 100;
  return formatBRLNumber(numValue);
};

interface CustomInstallmentItem {
  number: number;
  dueDate: string;
  amountFormatted: string;
  amountNumber: number;
}

const getNextMonthDateHelper = (dateStr: string, monthsToAdd: number): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const originalDay = d.getDate();
  d.setMonth(d.getMonth() + monthsToAdd);
  if (d.getDate() !== originalDay) {
    d.setDate(0);
  }
  return d.toISOString().split('T')[0];
};

const generateAutoInstallments = (countStr: string, amountStr: string, baseDate: string): CustomInstallmentItem[] => {
  const count = Math.max(1, parseInt(countStr, 10) || 1);
  const cleanValue = amountStr.replace(/\D/g, '');
  const total = cleanValue ? parseInt(cleanValue, 10) / 100 : 0;
  const valPerInst = count > 0 ? Math.round((total / count) * 100) / 100 : 0;

  const list: CustomInstallmentItem[] = [];
  let sum = 0;
  for (let i = 1; i <= count; i++) {
    const isLast = i === count;
    const amountNumber = isLast ? Number((total - sum).toFixed(2)) : valPerInst;
    if (!isLast) sum += amountNumber;
    list.push({
      number: i,
      dueDate: getNextMonthDateHelper(baseDate, i - 1),
      amountFormatted: formatBRLNumber(amountNumber),
      amountNumber
    });
  }
  return list;
};

interface TransactionFormProps {
  onClose: () => void;
  onSubmit: (t: Transaction) => void;
  categories: Category[];
  suppliers: Supplier[];
  banks: Bank[];
  initialData?: Transaction;
  isEdit?: boolean;
  tutorialEnabled?: boolean;
  onCompleteTutorial: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ 
  onClose, 
  onSubmit, 
  categories, 
  suppliers, 
  banks, 
  initialData,
  isEdit,
  tutorialEnabled,
  onCompleteTutorial
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditMode = isEdit !== undefined ? isEdit : !!initialData;
  const [showTutorial, setShowTutorial] = useState(() => !!tutorialEnabled && !initialData);

  const [hasCustomizedInstallments, setHasCustomizedInstallments] = useState(false);
  const [customInstallments, setCustomInstallments] = useState<CustomInstallmentItem[]>([]);

  const [formData, setFormData] = useState({
    description: initialData?.description || '',
    amount: initialData ? formatBRLNumber(initialData.amount) : '',
    type: initialData?.type || TransactionType.EXPENSE,
    categoryId: initialData?.categoryId || '',
    supplierId: initialData?.supplierId || '',
    bankId: initialData?.bankId || '',
    paymentMethod: initialData?.paymentMethod || 'Pix',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    status: initialData?.status || ('PAID' as 'PAID' | 'PENDING'),
    isFixed: initialData?.isFixed || false,
    isInstallment: (initialData?.installmentsCount || 0) > 1,
    installmentsCount: (initialData?.installmentsCount || 1).toString()
  });

  const activeInstallments = hasCustomizedInstallments 
    ? customInstallments 
    : generateAutoInstallments(formData.installmentsCount, formData.amount, formData.date);

  const handleInstallmentAmountChange = (index: number, valueStr: string) => {
    const currentList = [...activeInstallments];
    const formatted = formatBRLString(valueStr);
    const cleanVal = formatted.replace(/\D/g, '');
    const numVal = cleanVal ? parseInt(cleanVal, 10) / 100 : 0;

    currentList[index] = {
      ...currentList[index],
      amountFormatted: formatted,
      amountNumber: numVal
    };

    const newTotalSum = currentList.reduce((acc, item) => acc + item.amountNumber, 0);

    setCustomInstallments(currentList);
    setHasCustomizedInstallments(true);
    setFormData(prev => ({ ...prev, amount: formatBRLNumber(newTotalSum) }));
  };

  const handleInstallmentDateChange = (index: number, newDate: string) => {
    const currentList = [...activeInstallments];
    currentList[index] = {
      ...currentList[index],
      dueDate: newDate
    };
    setCustomInstallments(currentList);
    setHasCustomizedInstallments(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.description || !formData.amount || !formData.categoryId || !formData.bankId) {
      alert('Por favor, preencha todos os campos obrigatórios (Descrição, Valor, Categoria e Banco).');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanValue = formData.amount.replace(/\D/g, '');
      const parsedAmount = cleanValue ? parseInt(cleanValue, 10) / 100 : 0;

      const transaction: Transaction = {
        id: (isEditMode && initialData) ? initialData.id : crypto.randomUUID(),
        description: formData.description,
        amount: parsedAmount,
        type: formData.type,
        categoryId: formData.categoryId,
        supplierId: formData.type === TransactionType.EXPENSE ? (formData.supplierId || undefined) : undefined,
        bankId: formData.bankId,
        paymentMethod: formData.paymentMethod,
        date: formData.date,
        status: formData.status,
        isFixed: formData.isFixed,
        installmentsCount: formData.isInstallment ? parseInt(formData.installmentsCount) : undefined,
        customInstallments: formData.isInstallment ? activeInstallments.map(item => ({
          number: item.number,
          dueDate: item.dueDate,
          amount: item.amountNumber
        })) : undefined
      };

      await onSubmit(transaction);
    } catch (error) {
      console.error("Erro ao submeter formulário:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredCategories = categories.filter(c => c.type === formData.type);

  return (
    <div className="relative flex flex-col h-full bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white transition-colors duration-300">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between shrink-0 bg-white dark:bg-[#0d1428]">
        <div>
          <h2 className="text-2xl font-black text-[#0d1428] dark:text-white tracking-tight">
            {isEditMode ? 'Editar Lançamento' : 'Novo Lançamento'}
          </h2>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">Gestão de Fluxo de Caixa</p>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors text-slate-400 dark:text-slate-500"
        >
          <X size={24} />
        </button>
      </div>

      {/* Form Content */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#0d1428]">
        <form id="transaction-form" onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Transaction Type Selector */}
          <div className="grid grid-cols-2 gap-4 p-1.5 bg-slate-50 dark:bg-white/5 rounded-[1.25rem]">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: TransactionType.INCOME, categoryId: '' })}
              className={`flex items-center justify-center gap-3 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                formData.type === TransactionType.INCOME 
                ? 'bg-white text-emerald-600 shadow-xl scale-[1.02]' 
                : 'text-slate-400 dark:text-slate-500 hover:text-[#7184cf] dark:hover:text-slate-300'
              }`}
            >
              <ArrowUpRight size={18} /> Receita
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: TransactionType.EXPENSE, categoryId: '' })}
              className={`flex items-center justify-center gap-3 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                formData.type === TransactionType.EXPENSE 
                ? 'bg-white text-rose-600 shadow-xl scale-[1.02]' 
                : 'text-slate-400 dark:text-slate-500 hover:text-[#7184cf] dark:hover:text-slate-300'
              }`}
            >
              <ArrowDownLeft size={18} /> Despesa
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Amount */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">Valor do Lançamento</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7184cf] font-bold text-xl">R$</div>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-5 pl-12 pr-4 outline-none focus:ring-4 focus:ring-[#7184cf]/20 focus:border-[#7184cf] font-black text-2xl transition-all text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  value={formData.amount}
                  onChange={e => {
                    const formatted = formatBRLString(e.target.value);
                    setFormData({ ...formData, amount: formatted });
                    setHasCustomizedInstallments(false);
                  }}
                  required
                />
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">Data da Operação</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
                <input
                  type="date"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-5 pl-12 pr-4 outline-none focus:ring-4 focus:ring-[#7184cf]/20 focus:border-[#7184cf] font-bold text-lg transition-all text-slate-900 dark:text-white"
                  value={formData.date}
                  onChange={e => {
                    setFormData({ ...formData, date: e.target.value });
                    setHasCustomizedInstallments(false);
                  }}
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">Descrição</label>
              <div className="relative">
                <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
                <input
                  type="text"
                  placeholder="Ex: Pagamento AWS, Venda de Produto, etc."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-4 focus:ring-[#7184cf]/20 focus:border-[#7184cf] font-medium transition-all text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">Categoria (Plano de Contas)</label>
              <div className="relative">
                <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-4 focus:ring-[#7184cf]/20 focus:border-[#7184cf] font-medium appearance-none transition-all text-slate-900 dark:text-white cursor-pointer"
                  value={formData.categoryId}
                  onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                  required
                >
                  <option value="" className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">Selecionar Categoria...</option>
                  {filteredCategories.map(cat => (
                    <option key={cat.id} value={cat.id} className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">{cat.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={18} />
              </div>
            </div>

            {/* Bank / Account */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">Conta Bancária</label>
              <div className="relative">
                <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
                <select
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-4 focus:ring-[#7184cf]/20 focus:border-[#7184cf] font-medium appearance-none transition-all text-slate-900 dark:text-white cursor-pointer"
                  value={formData.bankId}
                  onChange={e => setFormData({ ...formData, bankId: e.target.value })}
                  required
                >
                  <option value="" className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">Selecionar Conta...</option>
                  {banks.map(bank => (
                    <option key={bank.id} value={bank.id} className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">{bank.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={18} />
              </div>
            </div>

            {/* Supplier (Only for Expenses) */}
            {formData.type === TransactionType.EXPENSE && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">Fornecedor</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
                  <select
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-4 focus:ring-[#7184cf]/20 focus:border-[#7184cf] font-medium appearance-none transition-all text-[#0d1428] dark:text-white"
                    value={formData.supplierId}
                    onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
                  >
                    <option value="" className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">Selecionar Fornecedor...</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.id} className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">{sup.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={18} />
                </div>
              </div>
            )}

            {/* Payment Method */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">Meio de Pagamento</label>
              <div className="relative">
                <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
                <select
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-4 focus:ring-[#7184cf]/20 focus:border-[#7184cf] font-medium appearance-none transition-all text-[#0d1428] dark:text-white"
                  value={formData.paymentMethod}
                  onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
                >
                  <option value="Pix" className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">Pix</option>
                  <option value="Cartão de Crédito" className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">Cartão de Crédito</option>
                  <option value="Boleto" className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">Boleto</option>
                  <option value="Transferência" className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">Transferência</option>
                  <option value="Dinheiro" className="bg-white dark:bg-[#0d1428] text-slate-900 dark:text-white">Dinheiro</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={18} />
              </div>
            </div>

            {/* Status */}
            <div className="md:col-span-2 space-y-4 pt-4">
              <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.15em] ml-1">Situação do Lançamento</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'PAID' })}
                  className={`flex items-center justify-center gap-3 py-4 rounded-2xl font-bold transition-all border-2 ${
                    formData.status === 'PAID' 
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-xl' 
                    : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-white/10'
                  }`}
                >
                  <CheckCircle2 size={20} /> Pago
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'PENDING' })}
                  className={`flex items-center justify-center gap-3 py-4 rounded-2xl font-bold transition-all border-2 ${
                    formData.status === 'PENDING' 
                    ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-xl' 
                    : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-white/10'
                  }`}
                >
                  <Clock size={20} /> A Vencer
                </button>
              </div>
            </div>

            {/* Fixed & Installment Toggles */}
            <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Fixed Transaction Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${formData.isFixed ? 'bg-[#7184cf] text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-600'}`}>
                      <Repeat size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0d1428] dark:text-white">Lançamento Fixo</h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Repetir todos os meses</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, isFixed: !formData.isFixed, isInstallment: false })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      formData.isFixed ? 'bg-[#7184cf]' : 'bg-slate-200 dark:bg-white/10'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isFixed ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Installment Toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${formData.isInstallment ? 'bg-[#a78bfa] text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-400 dark:text-slate-600'}`}>
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#0d1428] dark:text-white">Parcelado</h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Dividir em parcelas mensais</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, isInstallment: !formData.isInstallment, isFixed: false });
                      setHasCustomizedInstallments(false);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      formData.isInstallment ? 'bg-[#a78bfa]' : 'bg-slate-200 dark:bg-white/10'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.isInstallment ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Installments Count Input */}
              {formData.isInstallment && (
                <div className="animate-in slide-in-from-top-2 duration-300 space-y-4 p-4 bg-[#a78bfa]/5 rounded-2xl border border-[#a78bfa]/10">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-[#a78bfa] uppercase tracking-[0.15em] ml-1">Número de Parcelas</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="2"
                        max="48"
                        className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl py-4 pl-4 pr-12 outline-none focus:ring-4 focus:ring-[#a78bfa]/20 focus:border-[#a78bfa] font-bold text-lg transition-all text-[#0d1428] dark:text-white"
                        value={formData.installmentsCount}
                        onChange={e => {
                          setFormData({ ...formData, installmentsCount: e.target.value });
                          setHasCustomizedInstallments(false);
                        }}
                        required={formData.isInstallment}
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold">x</div>
                    </div>
                  </div>

                  {/* Detalhamento de Parcelas (Edição de Valor e Vencimento) */}
                  <div className="pt-2 border-t border-[#a78bfa]/15 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#0d1428] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <CreditCard size={14} className="text-[#a78bfa]" /> Detalhamento das Parcelas
                      </span>
                      <span className="text-[10px] font-bold text-[#a78bfa] bg-[#a78bfa]/10 px-2 py-0.5 rounded-md">
                        Edite valores e datas
                      </span>
                    </div>
                    <div className="max-h-56 overflow-y-auto pr-1 space-y-2">
                      {activeInstallments.map((inst, idx) => (
                        <div key={inst.number} className="flex items-center gap-2 sm:gap-3 bg-white dark:bg-[#0d1428] p-2.5 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm">
                          <span className="text-xs font-black text-[#a78bfa] w-12 shrink-0">
                            {inst.number}ª parc
                          </span>
                          
                          <div className="flex-1 relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">R$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-lg py-1.5 pl-8 pr-2 text-xs font-bold text-[#0d1428] dark:text-white outline-none focus:border-[#a78bfa] transition-colors"
                              value={inst.amountFormatted}
                              onChange={e => handleInstallmentAmountChange(idx, e.target.value)}
                              required
                            />
                          </div>

                          <div className="w-32 sm:w-36 shrink-0">
                            <input
                              type="date"
                              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-lg py-1.5 px-2 text-xs font-bold text-[#0d1428] dark:text-white outline-none focus:border-[#a78bfa] transition-colors"
                              value={inst.dueDate}
                              onChange={e => handleInstallmentDateChange(idx, e.target.value)}
                              required
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="px-8 py-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-4 bg-slate-50 dark:bg-white/5 shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-3 rounded-xl font-bold text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-all text-sm"
        >
          Cancelar
        </button>
        <button
          form="transaction-form"
          type="submit"
          disabled={isSubmitting}
          className="bg-[#7184cf] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:brightness-110 shadow-xl active:scale-95 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="animate-spin" size={18} /> Processando...
            </>
          ) : (
            <>
              <Save size={18} /> {isEditMode ? 'Atualizar Lançamento' : 'Salvar Lançamento'}
            </>
          )}
        </button>
      </div>

      <AnimatePresence>
        {showTutorial && (
          <TransactionTutorial 
            onClose={() => setShowTutorial(false)}
            onDonotShowAgain={() => {
              setShowTutorial(false);
              onCompleteTutorial();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default TransactionForm;