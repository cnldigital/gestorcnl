import React, { useState } from 'react';
import { Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { signUserIn } from '../services/firebase';

interface LoginViewProps {
  onBack: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onBack }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signUserIn();
    } catch (e) {
      setError('Falha ao autenticar com o Google. Tente novamente.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#0d1428] flex flex-col items-center justify-center p-6 relative font-sans text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-[#7184cf]/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-[#a78bfa]/10 blur-[100px] rounded-full"></div>
      </div>

      <div className="w-full max-w-[400px] relative z-10 flex flex-col items-center px-4">
        <div className="text-center mb-10 w-full flex flex-col items-center">
          <div className="p-4 bg-white/5 backdrop-blur-xl rounded-[2.5rem] shadow-2xl mb-6 border border-white/10 inline-block">
            <div className="w-[96px] h-[96px] rounded-3xl overflow-hidden shadow-xl flex items-center justify-center bg-white/5 border border-white/10 relative">
              <img 
                src="/logo-512.png" 
                alt="Logo" 
                className="w-full h-full object-cover rounded-3xl"
                referrerPolicy="no-referrer" 
              />
            </div>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
            Gestor CNL
          </h1>
          <p className="text-[#7184cf] text-[10px] font-black uppercase tracking-[0.3em] opacity-80">
            Inteligência Financeira Digital
          </p>
        </div>

        <div className="p-8 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-2xl w-full">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-white mb-2">Bem-vindo de volta</h2>
              <p className="text-slate-400 text-[11px]">Sincronize seus dados em todos os seus dispositivos com segurança.</p>
            </div>

            {error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-[11px] font-bold text-center flex items-center justify-center gap-2">
                <AlertCircle size={14} className="shrink-0" /> {error}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-[#7184cf] hover:bg-[#5c6eb1] text-white h-[56px] px-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin text-white" size={20} />
              ) : (
                <div className="flex items-center justify-center gap-3 w-full">
                  <svg className="w-5 h-5 flex-shrink-0" width="20" height="20" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="font-bold">Entrar com Google</span>
                  <ArrowRight size={16} className="ml-auto" />
                </div>
              )}
            </button>

            <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest font-bold">
              Seguro • Rápido • Sincronizado
            </p>
          </div>
        </div>

        <button 
          onClick={onBack}
          className="mt-6 flex items-center justify-center gap-2 py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-[#7184cf] hover:text-white hover:bg-white/5 rounded-2xl transition-all"
        >
          &larr; Voltar para o Início
        </button>

        <p className="mt-12 text-center text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">
          &copy; {new Date().getFullYear()} CNL Digital • Tecnologia de Ponta
        </p>
      </div>
    </div>
  );
};

export default LoginView;
