
import React, { useMemo } from 'react';
import { 
  PieChart as PieChartIcon, 
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart,
  Area
} from 'recharts';
import { Transaction, TransactionType, Category } from '../types';

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
}

const COLORS = ['#0d1428', '#7184cf', '#a78bfa', '#5c6eb1', '#8b5cf6', '#475569', '#334155'];

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const Card = ({ title, value, icon, color, subtitle, trend }: { title: string, value: number, icon: React.ReactNode, color: string, subtitle?: string, trend?: number }) => {
  const iconColor = color.includes('-') ? `text-${color.split('-')[1]}-400` : 'text-[#7184cf]';
  
  return (
    <div className="bg-white dark:bg-white/5 p-6 rounded-2xl shadow-xl border border-slate-100 dark:border-white/5 flex flex-col justify-between" id={`card-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex justify-between items-start">
        <div className={`p-3 rounded-xl ${color} bg-opacity-20 ${iconColor}`}>
          {icon}
        </div>
        {trend && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-slate-400 dark:text-slate-500">{title}</p>
        <h3 className="text-2xl font-bold text-[#0d1428] dark:text-white mt-1">{formatCurrency(value)}</h3>
        {subtitle && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 font-bold uppercase tracking-wider">{subtitle}</p>}
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ transactions: allTransactions, categories }) => {
  const currentMonth = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }, []);

  const transactions = useMemo(() => {
    return allTransactions.filter(t => t.date.startsWith(currentMonth));
  }, [allTransactions, currentMonth]);

  const stats = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === TransactionType.INCOME && t.status === 'PAID')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpenses = transactions
      .filter(t => t.type === TransactionType.EXPENSE && t.status === 'PAID')
      .reduce((acc, curr) => acc + curr.amount, 0);
    const totalPaidBalance = totalIncome - totalExpenses;
    
    const monthIncome = transactions
      .filter(t => t.type === TransactionType.INCOME && t.date.startsWith(currentMonth))
      .reduce((acc, curr) => acc + curr.amount, 0);
    const monthExpenses = transactions
      .filter(t => t.type === TransactionType.EXPENSE && t.date.startsWith(currentMonth))
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    const pendingIncome = transactions
      .filter(t => 
        t.type === TransactionType.INCOME && 
        t.status === 'PENDING' && 
        t.date.startsWith(currentMonth)
      )
      .reduce((acc, curr) => acc + curr.amount, 0);
    const pendingExpenses = transactions
      .filter(t => 
        t.type === TransactionType.EXPENSE && 
        t.status === 'PENDING' && 
        t.date.startsWith(currentMonth)
      )
      .reduce((acc, curr) => acc + curr.amount, 0);

    return { 
      income: totalIncome, 
      expenses: totalExpenses, 
      totalPaidBalance, 
      monthResult: monthIncome - monthExpenses,
      monthIncome,
      monthExpenses,
      pendingIncome, 
      pendingExpenses 
    };
  }, [transactions, currentMonth]);

  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    transactions
      .filter(t => t.type === TransactionType.EXPENSE && t.date.startsWith(currentMonth))
      .forEach(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        const name = cat ? cat.name : 'Outros';
        data[name] = (data[name] || 0) + t.amount;
      });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [transactions, categories, currentMonth]);

  const timelineData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().split('T')[0];
    });

    return last7Days.map(date => {
      const dayIncome = transactions
        .filter(t => t.date === date && t.type === TransactionType.INCOME)
        .reduce((acc, curr) => acc + curr.amount, 0);
      const dayExpense = transactions
        .filter(t => t.date === date && t.type === TransactionType.EXPENSE)
        .reduce((acc, curr) => acc + curr.amount, 0);
      return {
        date: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        Receitas: dayIncome,
        Despesas: dayExpense
      };
    });
  }, [transactions]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-[#0d1428] p-6 rounded-2xl shadow-xl flex flex-col justify-between border border-slate-100 dark:border-white/5">
          <div className="flex justify-between items-start">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/10 text-[#7184cf]">
              <TrendingUp size={24} />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-400 dark:text-white/50">Resultado Líquido</p>
            <h3 className={`text-2xl font-bold mt-1 ${stats.monthResult >= 0 ? 'text-[#0d1428] dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatCurrency(stats.monthResult)}
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-white/30 mt-2 font-bold uppercase tracking-wider">Lucro do Mês Atual</p>
          </div>
        </div>
        <Card 
          title="Receita Mensal" 
          value={stats.monthIncome} 
          icon={<TrendingUp size={24} />} 
          color="bg-emerald-500" 
          subtitle="Receitas do Mês"
        />
        <Card 
          title="Despesa Mensal" 
          value={stats.monthExpenses} 
          icon={<TrendingDown size={24} />} 
          color="bg-rose-500" 
          subtitle="Despesas do Mês"
        />
        <Card 
          title="Total Pendente" 
          value={stats.pendingIncome - stats.pendingExpenses} 
          icon={<Clock size={24} />} 
          color="bg-[#a78bfa]" 
          subtitle={`Previsto este mês: ${formatCurrency(stats.pendingIncome - stats.pendingExpenses)}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gráfico de Fluxo de Caixa */}
        <div className="lg:col-span-2 bg-white dark:bg-white/5 p-6 rounded-2xl shadow-xl border border-slate-100 dark:border-white/5">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-[#0d1428] dark:text-white flex items-center gap-2">
              <BarChart3 size={20} className="text-[#7184cf]" /> Fluxo de Caixa (7 dias)
            </h3>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#7184cf]"></div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Receitas</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-white"></div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Despesas</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7184cf" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#7184cf" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(113, 132, 207, 0.05)" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', color: '#0f172a' }}
                  itemStyle={{ color: '#0f172a' }}
                  formatter={(value: number) => [formatCurrency(value), '']}
                />
                <Area type="monotone" dataKey="Receitas" stroke="#7184cf" strokeWidth={3} fillOpacity={1} fill="url(#colorRec)" />
                <Area type="monotone" dataKey="Despesas" stroke="#94a3b8" strokeWidth={3} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Despesas por Categoria */}
        <div className="bg-white dark:bg-white/5 p-6 rounded-2xl shadow-xl border border-slate-100 dark:border-white/5">
          <h3 className="font-bold text-[#0d1428] dark:text-white flex items-center gap-2 mb-6">
            <PieChartIcon size={20} className="text-[#a78bfa]" /> Maiores Despesas
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #f1f5f9', color: '#0f172a' }}
                  itemStyle={{ color: '#0f172a' }}
                  formatter={(value: number) => formatCurrency(value)} 
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-3">
            {categoryData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[(index + 1) % COLORS.length] }}></div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">{item.name}</span>
                </div>
                <span className="text-xs font-bold text-[#0d1428] dark:text-white">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
