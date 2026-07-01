import React from 'react';
import { motion } from 'motion/react';
import { Info, ArrowRight } from 'lucide-react';

interface TransactionTutorialProps {
  onClose: () => void;
  onDonotShowAgain: () => void;
}

const TransactionTutorial: React.FC<TransactionTutorialProps> = ({ onClose, onDonotShowAgain }) => {
  return (
    <div 
      onClick={onClose}
      className="absolute inset-0 z-[110] flex items-center justify-center p-6 bg-[#0d1428]/80 backdrop-blur-md rounded-[2.5rem] overflow-hidden cursor-pointer"
    >
      <motion.div 
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-[#1a2235] p-10 rounded-3xl shadow-2xl space-y-6 cursor-default"
      >
        <div className="flex items-center gap-4 text-indigo-500 mb-2">
          <div className="p-3 bg-indigo-500/10 rounded-2xl">
            <Info size={32} />
          </div>
          <h3 className="text-xl font-black text-[#0d1428] dark:text-white uppercase tracking-tight">Como fazer um Lançamento?</h3>
        </div>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</div>
            <div>
              <p className="text-sm font-bold text-[#0d1428] dark:text-white">Escolha o Tipo</p>
              <p className="text-xs text-slate-400 font-medium">Selecione se é uma Receita (entrada) ou Despesa (saída).</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</div>
            <div>
              <p className="text-sm font-bold text-[#0d1428] dark:text-white">Preencha o Valor e Data</p>
              <p className="text-xs text-slate-400 font-medium">Insira o valor bruto e a data em que a operação ocorreu ou ocorrerá.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</div>
            <div>
              <p className="text-sm font-bold text-[#0d1428] dark:text-white">Categorize</p>
              <p className="text-xs text-slate-400 font-medium">Essencial para seus relatórios! Escolha uma categoria, banco e fornecedor.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">4</div>
            <div>
              <p className="text-sm font-bold text-[#0d1428] dark:text-white">Status do Pagamento</p>
              <p className="text-xs text-slate-400 font-medium">Marque como "Pago" se o dinheiro já saiu/entrou, ou "A Vencer" para provisionar.</p>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col gap-3">
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-full py-4 bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer pointer-events-auto"
          >
            Entendi, vamos lá <ArrowRight size={16} />
          </button>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDonotShowAgain();
            }}
            className="w-full py-3 text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:text-[#7184cf] transition-colors cursor-pointer pointer-events-auto"
          >
            Não mostrar este guia novamente
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default TransactionTutorial;
