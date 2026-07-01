import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock,
  LayoutDashboard
} from 'lucide-react';

export const DashboardMockup: React.FC = () => {
  return (
    <div className="w-full h-full bg-[#0d1428] text-white font-sans overflow-hidden p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
      {/* Top Header Mockup */}
      <div className="flex items-center justify-between opacity-50 mb-2">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={14} className="text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
        </div>
        <div className="flex gap-2">
          <div className="w-16 h-2 bg-white/5 rounded-full" />
          <div className="w-8 h-2 bg-white/5 rounded-full" />
        </div>
      </div>

      {/* Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#151c33] p-3 sm:p-4 rounded-xl border border-white/5 shadow-lg">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center mb-2">
            <TrendingUp size={16} className="text-indigo-400" />
          </div>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Resultado Líquido</p>
          <p className="text-sm sm:text-base font-black text-white leading-none">R$ 22.000</p>
        </div>

        <div className="bg-[#151c33] p-3 sm:p-4 rounded-xl border border-white/5 shadow-lg">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-2">
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Receita Mensal</p>
          <p className="text-sm sm:text-base font-black text-white leading-none">R$ 25.000</p>
        </div>

        <div className="bg-[#151c33] p-3 sm:p-4 rounded-xl border border-white/5 shadow-lg">
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center mb-2">
            <TrendingDown size={16} className="text-rose-400" />
          </div>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Despesa Mensal</p>
          <p className="text-sm sm:text-base font-black text-white leading-none">R$ 3.000</p>
        </div>

        <div className="bg-[#151c33] p-3 sm:p-4 rounded-xl border border-white/5 shadow-lg">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center mb-2">
            <Clock size={16} className="text-amber-400" />
          </div>
          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Pendente</p>
          <p className="text-sm sm:text-base font-black text-white leading-none">R$ 0,00</p>
        </div>
      </div>

      {/* Main Content Row */}
      <div className="flex gap-4 sm:gap-6 flex-1 min-h-0">
        {/* Chart Column */}
        <div className="flex-[2] bg-[#151c33] rounded-xl border border-white/5 p-4 sm:p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black flex items-center gap-2">
              <TrendingUp size={12} className="text-indigo-400" />
              FLUXO DE CAIXA (7 DIAS)
            </h3>
            <div className="hidden sm:flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span className="text-[8px] text-slate-400 font-bold">RECEITAS</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                <span className="text-[8px] text-slate-400 font-bold">DESPESAS</span>
              </div>
            </div>
          </div>
          
          <div className="flex-1 relative flex items-end gap-1 sm:gap-2 px-2 pb-2 overflow-hidden">
            {[15, 20, 25, 20, 30, 50, 80, 45, 60, 85].map((h, i) => (
              <div key={i} className="flex-1 flex items-end h-full">
                <div className="w-full bg-indigo-500/20 rounded-t-sm relative group cursor-default" style={{ height: `${h}%` }}>
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-400 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expenses Column - Hidden on very small screens to fit layout */}
        <div className="hidden md:flex flex-1 bg-[#151c33] rounded-xl border border-white/5 p-4 sm:p-5 flex-col">
          <h3 className="text-[10px] font-black flex items-center gap-2 mb-4">
            <Clock size={12} className="text-rose-400" />
            DESPESAS
          </h3>
          
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-[6px] border-[#7184cf]/10 border-t-indigo-400 flex items-center justify-center relative">
              <div className="text-center">
                <p className="text-[7px] text-slate-500 font-bold uppercase">Total</p>
                <p className="text-[10px] font-black">R$ 3.000</p>
              </div>
            </div>
            
            <div className="mt-4 w-full space-y-1.5">
              <div className="flex items-center justify-between p-1.5 rounded bg-white/5">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span className="text-[8px] font-bold">Aluguel</span>
                </div>
                <span className="text-[8px] font-black text-slate-400">R$ 3.000</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
