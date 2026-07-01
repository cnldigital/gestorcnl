import React, { useState } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2,
  LayoutDashboard,
  Receipt,
  PieChart,
  Users
} from 'lucide-react';

interface TutorialStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  id: string;
}

const steps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao Gestor CNL!',
    description: 'Vamos fazer um busca rápida pelas principais funcionalidades para você começar a organizar suas finanças agora mesmo.',
    icon: <LayoutDashboard className="text-indigo-500" size={32} />
  },
  {
    id: 'dashboard',
    title: 'Painel Geral',
    description: 'Aqui você tem uma visão clara do seu lucro líquido, receitas e despesas do mês em tempo real.',
    icon: <LayoutDashboard className="text-blue-500" size={32} />
  },
  {
    id: 'transactions',
    title: 'Financeiro',
    description: 'Registre todas as suas entradas e saídas. Você pode categorizar por fornecedores, bancos e até criar despesas fixas.',
    icon: <Receipt className="text-emerald-500" size={32} />
  },
  {
    id: 'reports',
    title: 'Relatórios Inteligentes',
    description: 'Analise seu fluxo de caixa e entenda para onde seu dinheiro está indo com gráficos detalhados.',
    icon: <PieChart className="text-amber-500" size={32} />
  },
  {
    id: 'sharing',
    title: 'Vínculo de Contas',
    description: 'O grande diferencial! Você pode vincular sua conta com outro usuário para que ambos visualizem e lancem dados reciprocamente.',
    icon: <Users className="text-purple-500" size={32} />
  },
  {
    id: 'settings',
    title: 'Tudo Pronto!',
    description: 'Em Ajustes você personaliza seu perfil, plano de contas e gerencia seus acessos. Se precisar ver este guia novamente, ative-o nos Ajustes.',
    icon: <CheckCircle2 className="text-emerald-500" size={32} />
  }
];

interface OnboardingTutorialProps {
  onClose: () => void;
  onComplete: () => void;
}

const OnboardingTutorial: React.FC<OnboardingTutorialProps> = ({ onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div 
        className="w-full max-w-md bg-white dark:bg-[#1a2235] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden relative"
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100 dark:bg-white/5">
          <div 
            className="h-full bg-indigo-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="p-10 pt-16 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-slate-50 dark:bg-white/5 rounded-3xl flex items-center justify-center mb-6 border border-slate-100 dark:border-white/5">
            {step.icon}
          </div>

          <h3 className="text-2xl font-black text-[#0d1428] dark:text-white mb-4">
            {step.title}
          </h3>
          
          <p className="text-slate-400 text-sm font-medium leading-relaxed mb-10">
            {step.description}
          </p>

          <div className="w-full flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 px-4 py-2 font-black text-xs uppercase tracking-widest transition-all ${
                currentStep === 0 
                ? 'opacity-0 cursor-default' 
                : 'text-slate-400 hover:text-indigo-500'
              }`}
            >
              <ChevronLeft size={16} /> Anterior
            </button>

            <div className="flex gap-1.5">
              {steps.map((_, idx) => (
                <div 
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    idx === currentStep ? 'w-4 bg-indigo-500' : 'bg-slate-200 dark:bg-white/10'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 shadow-lg shadow-indigo-500/25 transition-all"
            >
              {currentStep === steps.length - 1 ? 'Começar' : 'Próximo'}
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTutorial;
