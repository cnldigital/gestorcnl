import React from 'react';
import { 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  Zap, 
  Users, 
  PieChart as PieChartIcon, 
  Receipt,
  CreditCard,
  LayoutDashboard,
  FileText,
  Calendar,
  Building2,
  Sparkles,
  Lock,
  Smartphone,
  Award,
  Clock,
  Check
} from 'lucide-react';
import { DashboardMockup } from './DashboardMockup';

interface LandingPageProps {
  onLoginClick: () => void;
  onBuyClick: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onBuyClick }) => {
  return (
    <div className="min-h-screen bg-[#0d1428] text-white selection:bg-[#7184cf]/30">
      {/* Top Banner Oferta Especial */}
      <div className="bg-gradient-to-r from-[#7184cf] via-indigo-600 to-purple-600 px-4 py-2 text-center text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">
        <Sparkles size={14} className="animate-pulse text-amber-300 shrink-0" />
        <span>OFERTA VITALÍCIA EXCLUSIVA: TENHA O SISTEMA COMPLETO POR APENAS R$ 39,90 ÚNICOS! SEM MENSALIDADES.</span>
        <button onClick={onBuyClick} className="ml-2 underline hover:text-amber-200">Garanta Agora</button>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 left-0 right-0 z-50 bg-[#0d1428]/80 backdrop-blur-3xl border-b border-white/5 shadow-2xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-2xl shadow-indigo-500/30 border border-white/10 group-hover:scale-105 transition-transform duration-300">
              <img 
                src="/logo-192.png" 
                alt="Logo Gestor CNL" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
              />
            </div>
            <div className="flex flex-col">
              <span className="font-black text-lg tracking-tight leading-none">GESTOR CNL</span>
              <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.25em] mt-0.5">Gestão Financeira</span>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="hidden md:flex items-center gap-8 text-xs font-black uppercase tracking-widest text-slate-300">
              <a href="#funcionalidades" className="hover:text-[#7184cf] transition-colors">Funcionalidades</a>
              <a href="#diferenciais" className="hover:text-[#7184cf] transition-colors">Diferenciais</a>
              <a href="#depoimentos" className="hover:text-[#7184cf] transition-colors">Clientes</a>
              <a href="#pricing" className="text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1">Licença Vitalícia</a>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={onLoginClick}
                className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
              >
                Entrar
              </button>
              <button 
                onClick={onBuyClick}
                className="px-6 py-2.5 bg-gradient-to-r from-[#7184cf] to-indigo-600 hover:from-[#8295e0] hover:to-indigo-500 rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex items-center gap-2"
              >
                <Zap size={14} fill="currentColor" /> Comprar Licença
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16 pb-20 px-6 overflow-hidden">
        <div className="absolute top-10 right-1/4 w-[500px] h-[500px] bg-indigo-500/15 blur-[140px] -z-10 rounded-full pointer-events-none" />
        <div className="absolute bottom-10 left-1/4 w-[500px] h-[500px] bg-purple-500/15 blur-[140px] -z-10 rounded-full pointer-events-none" />
        
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 border border-indigo-500/30 rounded-full text-[#8295e0] text-xs font-black uppercase tracking-widest shadow-inner">
            <Award size={14} className="text-amber-400" /> Plataforma Definitiva para Autônomos e Empresas
          </div>
          
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.08]">
            Abandone as planilhas. <br />
            Tenha <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7184cf] via-indigo-400 to-purple-400">Controle Financeiro</span> <br className="hidden sm:inline" />
            e gere Orçamentos em Segundos.
          </h1>
          
          <p className="text-slate-300 text-base sm:text-xl max-w-3xl mx-auto font-medium leading-relaxed">
            O <strong className="text-white">Gestor CNL</strong> reúne gestão de fluxo de caixa, edição de parcelas sob medida, orçamentos em PDF com busca de CNPJ, agenda de clientes e compartilhamento societário recíproco em um único sistema intuitivo.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 max-w-md mx-auto">
            <button 
              onClick={onBuyClick}
              className="w-full sm:w-auto flex-1 px-8 py-5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-sm uppercase tracking-wider rounded-2xl shadow-2xl shadow-emerald-500/30 transition-all flex items-center justify-center gap-3 active:scale-95 group"
            >
              Comprar Licença Vitalícia <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={onLoginClick}
              className="w-full sm:w-auto px-8 py-5 bg-white/5 hover:bg-white/10 border border-white/15 text-white font-black text-sm uppercase tracking-wider rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              Acessar Sistema
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-4 text-xs font-bold text-slate-400">
            <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-400" /> Pagamento único R$ 39,90</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-400" /> Sem mensalidades</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-400" /> Acesso vitalício e instantáneo</span>
          </div>
        </div>

        {/* Mockup Preview */}
        <div className="max-w-6xl mx-auto mt-16 relative px-2 sm:px-4">
          <div className="absolute inset-0 bg-gradient-to-t from-indigo-600/30 to-purple-600/20 blur-[90px] -z-10 rounded-[3rem]" />
          <div className="bg-[#141d33] border border-white/15 rounded-[2rem] sm:rounded-[2.5rem] p-2 sm:p-4 shadow-2xl overflow-hidden aspect-video relative group">
             <div className="w-full h-full rounded-xl overflow-hidden bg-[#0d1428]">
                <DashboardMockup />
             </div>
             
             <div onClick={onLoginClick} className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-[#0d1428]/40 backdrop-blur-[3px] cursor-pointer">
                <div className="px-8 py-4 bg-white text-indigo-950 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl flex items-center gap-3 transform translate-y-2 group-hover:translate-y-0 transition-all">
                  Testar Demonstração do Sistema <LayoutDashboard size={18} className="text-[#7184cf]" />
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Social Proof Stats */}
      <section className="py-16 border-y border-white/10 bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { label: 'Empresas e Autônomos', val: '+3.800', desc: 'Gerenciando finanças diariamente' },
            { label: 'Movimentados no Sistema', val: 'R$ 4.5M+', desc: 'Em fluxo de caixa e propostas' },
            { label: 'Garantia de Uptime', val: '99.9%', desc: 'Servidores rápidos e seguros em nuvem' },
            { label: 'Economia com Mensalidade', val: 'R$ 1.200/ano', desc: 'Em comparação com concorrentes' },
          ].map((s, i) => (
            <div key={i} className="text-center space-y-1 p-4 rounded-2xl hover:bg-white/5 transition-colors">
              <p className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">{s.val}</p>
              <p className="text-xs uppercase font-black tracking-wider text-white">{s.label}</p>
              <p className="text-[11px] text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Seção Funcionalidades Principais */}
      <section id="funcionalidades" className="py-28 px-6 max-w-7xl mx-auto space-y-20">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-[#7184cf]">Poder Digital Completo</h2>
          <h3 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Uma suíte financeira projetada para fazer seu negócio lucrar mais.
          </h3>
          <p className="text-slate-400 text-base sm:text-lg">
            Cada módulo do Gestor CNL foi desenvolvido com foco em produtividade, precisão nos cálculos e organização impecável.
          </p>
        </div>

        {/* Bento Grid de Funcionalidades */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Financeiro & Parcelas Customizadas */}
          <div className="md:col-span-2 bg-gradient-to-br from-indigo-950/60 via-[#141d33] to-[#0d1428] border border-indigo-500/20 hover:border-indigo-500/40 p-8 rounded-[2.5rem] space-y-6 shadow-xl flex flex-col justify-between group transition-all">
            <div className="space-y-4">
              <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                <Receipt size={28} />
              </div>
              <span className="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-md text-[10px] font-black uppercase tracking-wider">Exclusivo</span>
              <h4 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Financeiro Inteligente com Edição de Parcelas</h4>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Lance receitas e despesas com categorização avançada. Ao efetuar vendas ou compras parceladas, <strong className="text-indigo-300">você edita o valor exato e a data de vencimento de cada parcela individualmente</strong> no ato do lançamento. Crie também despesas fixas recorrentes com um clique.
              </p>
            </div>
            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs font-bold text-slate-400">
              <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-400" /> Baixa automática de status</span>
              <span className="flex items-center gap-1.5"><Check size={14} className="text-emerald-400" /> Múltiplas contas bancárias</span>
            </div>
          </div>

          {/* Card 2: Orçamentos em PDF */}
          <div className="bg-gradient-to-br from-purple-950/40 via-[#141d33] to-[#0d1428] border border-purple-500/20 hover:border-purple-500/40 p-8 rounded-[2.5rem] space-y-6 shadow-xl flex flex-col justify-between group transition-all">
            <div className="space-y-4">
              <div className="w-14 h-14 bg-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <FileText size={28} />
              </div>
              <h4 className="text-2xl font-black text-white tracking-tight">Orçamentos e PDFs Prontos</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                Gere propostas comerciais profissionais. Calcule subtotal, descontos, frete e parcelas automaticamente. Exporte em PDF instantaneamente para enviar pelo WhatsApp ao seu cliente.
              </p>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-xs text-purple-200 font-medium">
              📄 Layout limpo que transmite autoridade ao cliente.
            </div>
          </div>

          {/* Card 3: Busca CNPJ */}
          <div className="bg-gradient-to-br from-amber-950/30 via-[#141d33] to-[#0d1428] border border-amber-500/20 hover:border-amber-500/40 p-8 rounded-[2.5rem] space-y-6 shadow-xl flex flex-col justify-between group transition-all">
            <div className="space-y-4">
              <div className="w-14 h-14 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Building2 size={28} />
              </div>
              <h4 className="text-2xl font-black text-white tracking-tight">Autopreenchimento por CNPJ</h4>
              <p className="text-slate-300 text-sm leading-relaxed">
                Não perca tempo digitando dados cadastrais. Digite o CNPJ e o Gestor CNL consulta a Receita Federal e preenche Razão Social, Telefone e Endereço em 1 segundo.
              </p>
            </div>
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">⚡ Agilidade extrema nas vendas</span>
          </div>

          {/* Card 4: Vínculo Recíproco (Sócios) */}
          <div className="md:col-span-2 bg-gradient-to-br from-teal-950/40 via-[#141d33] to-[#0d1428] border border-teal-500/20 hover:border-teal-500/40 p-8 rounded-[2.5rem] space-y-6 shadow-xl flex flex-col justify-between group transition-all">
            <div className="space-y-4">
              <div className="w-14 h-14 bg-teal-500/20 rounded-2xl flex items-center justify-center text-teal-400 group-hover:scale-110 transition-transform">
                <Users size={28} />
              </div>
              <span className="inline-block px-3 py-1 bg-teal-500/20 text-teal-300 rounded-md text-[10px] font-black uppercase tracking-wider">Inovação</span>
              <h4 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Vínculo Societário Recíproco em Tempo Real</h4>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Tem um sócio no negócio ou divide as finanças com o cônjuge? Conecte as duas contas através do nosso sistema de Vínculo Recíproco. Tudo o que for lançado como receita ou despesa conjunta reflete no dashboard de ambos simultaneamente.
              </p>
            </div>
            <div className="pt-4 border-t border-white/10 flex flex-wrap gap-4 text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-teal-400" /> Sincronização em nuvem segura</span>
              <span className="flex items-center gap-1.5"><Lock size={16} className="text-teal-400" /> Sigilo e transparência entre sócios</span>
            </div>
          </div>
        </div>

        {/* Módulos Complementares Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
          {[
            { title: 'Dashboard Gráfico', desc: 'Acompanhe evolução do saldo e categorias de gastos em gráficos visuais.', icon: <PieChartIcon className="text-blue-400" size={24} /> },
            { title: 'Agenda de Clientes', desc: 'Módulo de compromissos integrado para organizar entregas e reuniões.', icon: <Calendar className="text-rose-400" size={24} /> },
            { title: 'Gestão de Bancos', desc: 'Cadastre caixas e contas bancárias ilimitadas para rastrear cada centavo.', icon: <CreditCard className="text-emerald-400" size={24} /> },
            { title: 'PWA Smartphone', desc: 'Acesse como um aplicativo nativo no iPhone ou Android em qualquer lugar.', icon: <Smartphone className="text-purple-400" size={24} /> },
          ].map((item, idx) => (
            <div key={idx} className="bg-white/[0.03] border border-white/10 hover:border-white/20 p-6 rounded-3xl space-y-3 transition-colors">
              <div className="p-3 bg-white/5 rounded-2xl w-fit">{item.icon}</div>
              <h5 className="font-bold text-lg text-white">{item.title}</h5>
              <p className="text-xs text-slate-400 leading-normal">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparativo Diferenciais */}
      <section id="diferenciais" className="py-24 px-6 bg-gradient-to-b from-[#0d1428] via-[#111a33] to-[#0d1428] border-y border-white/10">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-4">
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-emerald-400">Por que somos a melhor escolha?</h2>
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight">Comparativo: Gestor CNL vs. Outros Sistemas</h3>
          </div>

          <div className="bg-[#141d33] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            <div className="grid grid-cols-3 bg-white/5 p-4 sm:p-6 border-b border-white/10 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-300">
              <span>Recurso / Vantagem</span>
              <span className="text-center text-emerald-400 font-black">GESTOR CNL</span>
              <span className="text-center text-slate-500">Concorrentes Padrão</span>
            </div>
            
            {[
              { name: 'Modelo de cobrança', us: 'R$ 39,90 Únicos (Vitalício)', others: 'R$ 89,00 a R$ 199,00/mês' },
              { name: 'Edição de valor nas parcelas', us: 'Sim, parcela por parcela', others: 'Não (apenas valor fixo dividido)' },
              { name: 'Orçamentos em PDF profissionais', us: 'Incluso e Ilimitado', others: 'Cobrado à parte ou limitado' },
              { name: 'Consulta automática de CNPJ', us: 'Sim (Instantâneo)', others: 'Não disponível' },
              { name: 'Vínculo recíproco de sócios', us: 'Incluso no sistema', others: 'Requer plano empresarial caro' },
              { name: 'Backup automático em nuvem', us: '100% Sincronizado', others: 'Muitas vezes local ou pago' },
            ].map((row, index) => (
              <div key={index} className={`grid grid-cols-3 p-4 sm:p-5 items-center text-xs sm:text-sm border-b border-white/5 ${index % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'}`}>
                <span className="font-bold text-white">{row.name}</span>
                <span className="text-center font-black text-emerald-400 flex items-center justify-center gap-1.5 bg-emerald-500/10 py-1.5 rounded-xl border border-emerald-500/20">
                  <CheckCircle2 size={16} className="shrink-0" /> {row.us}
                </span>
                <span className="text-center font-medium text-slate-400">{row.others}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Depoimentos de Clientes */}
      <section id="depoimentos" className="py-28 px-6 max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-[#7184cf]">Quem usa recomenda</h2>
          <h3 className="text-3xl sm:text-4xl font-black tracking-tight">O que nossos clientes dizem</h3>
          <p className="text-slate-400 text-sm">Autônomos e pequenos empresários que transformaram sua gestão.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              name: 'Lucas Ferreira',
              role: 'Prestador de Serviços de TI',
              text: 'Antes eu pagava quase 120 reais por mês num sistema de emissão de propostas. Comprei a licença vitalícia do Gestor CNL por 39,90 e resolvi minha vida. A busca de CNPJ e o cálculo automático das parcelas são fantásticos.',
              stars: 5
            },
            {
              name: 'Camila & Ricardo',
              role: 'Sócios de Estúdio de Design',
              text: 'O recurso de vínculo recíproco foi o divisor de águas para nós. Cada sócio lança suas despesas na sua conta e o saldo geral se atualiza para os dois. Nunca mais tivemos divergência no fechamento do mês.',
              stars: 5
            },
            {
              name: 'Marcos Silveira',
              role: 'Comerciante',
              text: 'A opção de conseguir editar o valor e a data exata de cada parcela no lançamento parcelado salvou meu controle de boletos. Nenhum outro sistema simples fazia isso. Recomendo de olhos fechados!',
              stars: 5
            }
          ].map((t, i) => (
            <div key={i} className="bg-[#141d33] border border-white/10 p-8 rounded-3xl space-y-4 relative flex flex-col justify-between shadow-xl">
              <div className="space-y-4">
                <div className="flex text-amber-400 gap-1">
                  {'★'.repeat(t.stars)}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed italic">"{t.text}"</p>
              </div>
              <div className="pt-4 border-t border-white/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#7184cf] to-purple-500 flex items-center justify-center font-black text-white text-sm">
                  {t.name[0]}
                </div>
                <div>
                  <h6 className="font-bold text-white text-sm">{t.name}</h6>
                  <p className="text-[10px] text-slate-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section (Oferta Irresistível) */}
      <section id="pricing" className="py-28 px-6 relative overflow-hidden bg-gradient-to-t from-indigo-950/40 via-[#0d1428] to-[#0d1428]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-[#7184cf]/15 blur-[160px] -z-10 rounded-full pointer-events-none" />
        
        <div className="max-w-4xl mx-auto text-center space-y-4 mb-16">
          <span className="px-4 py-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-black uppercase tracking-widest">
            Oportunidade por Tempo Limitado
          </span>
          <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-white">Investimento Único. <br /> Retorno Diário.</h2>
          <p className="text-slate-300 text-base sm:text-lg max-w-xl mx-auto">Adquira agora a licença completa do sistema sem cobranças recorrentes.</p>
        </div>

        <div className="max-w-xl mx-auto">
          <div className="p-8 sm:p-12 bg-gradient-to-br from-[#1a264a] via-[#141e38] to-[#0d1428] border-2 border-[#7184cf] hover:border-indigo-400 rounded-[3rem] space-y-8 relative overflow-hidden shadow-2xl shadow-indigo-600/30 transition-all">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-500 to-teal-500 text-slate-950 px-6 py-2 rounded-bl-3xl font-black text-[10px] uppercase tracking-widest shadow-lg flex items-center gap-1.5">
              <Sparkles size={14} /> Licença Vitalícia
            </div>
            
            <div className="space-y-3 pt-2">
              <h4 className="text-2xl font-black uppercase tracking-wider text-white">Gestor CNL PRO</h4>
              <p className="text-slate-300 text-xs">Acesso total e ilimitado a todos os módulos financeiros.</p>
              
              <div className="flex items-baseline gap-2 pt-4">
                <span className="text-sm font-bold text-slate-400 line-through">R$ 199,90</span>
                <span className="text-2xl font-bold text-emerald-400">R$</span>
                <span className="text-6xl font-black text-white tracking-tight">39,90</span>
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">Único</span>
              </div>
              <p className="text-xs text-indigo-300 font-bold">💳 Pagamento via Mercado Pago PIX ou Cartão • Sem mensalidades</p>
            </div>
            
            <ul className="space-y-3.5 pt-4 border-t border-white/10">
              {[
                'Acesso Vitalício sem limite de tempo',
                'Módulo Financeiro Completo com Parcelas Customizáveis',
                'Emissor de Orçamentos ilimitados com PDF profissional',
                'Busca automática de dados por CNPJ integrada',
                'Vínculo Recíproco societário para sócio ou cônjuge',
                'Cadastros ilimitados de Bancos, Categorias e Clientes',
                'Agenda de Compromissos e Entregas',
                'Suporte técnico e todas as futuras atualizações inclusas'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3 text-sm font-bold text-slate-200">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" /> <span>{item}</span>
                </li>
              ))}
            </ul>
            
            <div className="pt-4">
              <button 
                onClick={onBuyClick}
                className="w-full py-5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 rounded-2xl font-black text-base uppercase tracking-widest transition-all shadow-2xl shadow-emerald-500/40 active:scale-95 flex items-center justify-center gap-3"
              >
                Comprar Agora por R$ 39,90 <ArrowRight size={20} />
              </button>
            </div>
            
            <div className="flex items-center justify-center gap-6 text-[11px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><Lock size={12} className="text-indigo-400" /> Ambiente 100% Seguro</span>
              <span className="flex items-center gap-1"><Clock size={12} className="text-indigo-400" /> Liberação Imediata</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Rápido */}
      <section className="py-20 px-6 max-w-4xl mx-auto space-y-12">
        <h3 className="text-2xl sm:text-3xl font-black text-center tracking-tight">Perguntas Frequentes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#141d33] p-6 rounded-2xl border border-white/5 space-y-2">
            <h6 className="font-black text-white text-sm">Vou ter que pagar alguma mensalidade depois?</h6>
            <p className="text-xs text-slate-400 leading-relaxed">Não! O valor de R$ 39,90 é pago uma única vez. Você adquire a licença de uso vitalício com todas as funções liberadas.</p>
          </div>
          <div className="bg-[#141d33] p-6 rounded-2xl border border-white/5 space-y-2">
            <h6 className="font-black text-white text-sm">Como funciona o vínculo entre sócios?</h6>
            <p className="text-xs text-slate-400 leading-relaxed">Nas configurações da sua conta, você digita o ID do seu parceiro comercial ou cônjuge. O sistema conecta os dois bancos de dados para compartilharem o financeiro.</p>
          </div>
          <div className="bg-[#141d33] p-6 rounded-2xl border border-white/5 space-y-2">
            <h6 className="font-black text-white text-sm">Posso usar no celular e no computador?</h6>
            <p className="text-xs text-slate-400 leading-relaxed">Sim! O Gestor CNL funciona perfeitamente no navegador de qualquer computador, tablet ou smartphone iPhone/Android.</p>
          </div>
          <div className="bg-[#141d33] p-6 rounded-2xl border border-white/5 space-y-2">
            <h6 className="font-black text-white text-sm">Como recebo acesso após comprar?</h6>
            <p className="text-xs text-slate-400 leading-relaxed">Ao clicar em comprar, você será direcionado ao checkout seguro do Mercado Pago. O acesso à sua licença PRO é liberado na hora!</p>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <footer className="py-24 px-6 text-center space-y-10 border-t border-white/10 bg-[#090e1c]">
        <div className="space-y-4">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">
            Não deixe a desorganização <br /> custar dinheiro ao seu negócio.
          </h2>
          <p className="text-slate-400 font-medium max-w-xl mx-auto text-sm sm:text-base">
            Dê o passo definitivo hoje. Adquira o Gestor CNL pelo preço promocional único.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-4">
          <button 
            onClick={onBuyClick}
            className="px-10 py-5 bg-[#7184cf] hover:bg-[#8295e0] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-indigo-500/30 transition-all active:scale-95 flex items-center gap-2"
          >
            Quero Minha Licença Vitalícia <ArrowRight size={18} />
          </button>
          <button 
            onClick={onLoginClick}
            className="px-8 py-5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-black text-sm uppercase tracking-widest transition-all"
          >
            Já tenho conta
          </button>
        </div>

        <div className="pt-16 flex flex-col items-center gap-4 border-t border-white/5 max-w-xl mx-auto">
          <div className="flex items-center gap-3 opacity-70">
            <div className="w-7 h-7 rounded-lg overflow-hidden border border-white/10">
              <img 
                src="/logo-192.png" 
                alt="Logo" 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
              />
            </div>
            <span className="font-black text-sm tracking-tight">GESTOR CNL SOFTWARE</span>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">© 2026 Gestor CNL Software • Todos os direitos reservados</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;


