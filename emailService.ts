import nodemailer from 'nodemailer';

export async function sendWelcomeEmail(toEmail: string, userName: string): Promise<{ success: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || `"Equipe Gestor CNL" <${user}>`;

  if (!host || !user || !pass) {
    const msg = 'Configuração SMTP ausente (HOST, USER ou PASS). Verifique o menu Settings.';
    console.warn(`[Email] ${msg}`);
    return { success: false, error: msg };
  }

  if (host.includes('@')) {
    const msg = `O Host SMTP parece estar incorreto (${host}). Para Gmail, use: smtp.gmail.com`;
    console.warn(`[Email] ${msg}`);
    return { success: false, error: msg };
  }

  if (host.toLowerCase() === 'gmail') {
    const msg = 'O Host SMTP deve ser "smtp.gmail.com" e não apenas "gmail".';
    console.warn(`[Email] ${msg}`);
    return { success: false, error: msg };
  }

  console.log(`[Email] Tentando enviar e-mail para ${toEmail} via ${host}...`);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    // Useful for Gmail and other modern servers
    tls: {
      rejectUnauthorized: false
    }
  });

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background-color: #0f172a;
          color: #f8fafc;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 40px 20px;
          background-color: #1e293b;
          border-radius: 12px;
          margin-top: 50px;
          border: 1px solid #334155;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        .logo {
          font-size: 28px;
          font-weight: bold;
          color: #6366f1;
          letter-spacing: -1px;
        }
        .content {
          line-height: 1.6;
          color: #cbd5e1;
        }
        .welcome-text {
          font-size: 20px;
          color: #ffffff;
          margin-bottom: 20px;
        }
        .button-container {
          text-align: center;
          margin-top: 40px;
        }
        .button {
          background-color: #6366f1;
          color: #ffffff !important;
          padding: 14px 28px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          display: inline-block;
          transition: background-color 0.3s;
        }
        .footer {
          text-align: center;
          margin-top: 40px;
          font-size: 12px;
          color: #64748b;
        }
        .highlight {
          color: #38bdf8;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Gestor CNL</div>
        </div>
        <div class="content">
          <div class="welcome-text">Olá, ${userName}!</div>
          <p>É um prazer ter você conosco no <span class="highlight">Gestor CNL</span>. Seu cadastro foi aprovado com sucesso!</p>
          <p>A partir de agora, você tem acesso total à nossa inteligência financeira digital para transformar a gestão do seu negócio.</p>
          
          <div style="background-color: #0f172a; padding: 20px; border-radius: 8px; margin-top: 30px; border-left: 4px solid #6366f1;">
            <p style="margin: 0; font-weight: 600; color: #ffffff;">O que você pode fazer agora:</p>
            <ul style="margin-top: 10px; padding-left: 20px;">
              <li>Registrar seus lançamentos e fluxo de caixa</li>
              <li>Visualizar painéis de indicadores em tempo real</li>
              <li>Exportar relatórios financeiros detalhados</li>
              <li>Acessar nossa inteligência financeira exclusiva</li>
            </ul>
          </div>
        </div>
        
        <div class="button-container">
          <a href="${process.env.PUBLIC_URL || '#'}" class="button">Acessar Meu Painel</a>
        </div>
        
        <div class="footer">
          <p>© 2026 Gestor CNL - Tecnologia Financeira Digital<br>Este é um e-mail automático, por favor não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const info = await transporter.sendMail({
      from,
      to: toEmail,
      subject: 'Bem-vindo ao Gestor CNL - Acesso Liberado! 🚀',
      html: htmlContent,
    });
    console.log('[Email] Success: Welcome email sent to', toEmail, '-', info.messageId);
    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    console.error('[Email] Failed to send email to', toEmail, ':', err);
    
    let errorMsg = err.message || 'Erro desconhecido ao enviar e-mail.';
    
    if (host.includes('gmail.com') && errorMsg.includes('Invalid login')) {
      errorMsg = 'Erro no Gmail: O login foi recusado. Certifique-se de que você está usando uma "Senha de App" e não a sua senha normal do Gmail.';
    } else if (err.code === 'ECONNREFUSED') {
      errorMsg = `Conexão recusada pelo host ${host}:${port}. Verifique se as configurações estão corretas.`;
    } else if (err.code === 'EAI_AGAIN' || err.code === 'ENOTFOUND') {
      errorMsg = `Servidor não encontrado: "${host}". Verifique se o Host SMTP está digitado corretamente no menu Settings. Para Gmail use: smtp.gmail.com`;
    }

    return { success: false, error: errorMsg };
  }
}
