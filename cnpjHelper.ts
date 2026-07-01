export interface CNPJQueryResult {
  razao_social: string;
  nome_fantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
}

export const fetchCNPJData = async (cnpj: string): Promise<CNPJQueryResult | null> => {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return null;

  // 1st attempt: BrasilAPI v1
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${clean}`);
    if (res.ok) {
      const data = await res.json();
      if (data) {
        return {
          razao_social: data.razao_social || '',
          nome_fantasia: data.nome_fantasia || '',
          logradouro: data.logradouro || '',
          numero: data.numero || '',
          complemento: data.complemento || '',
          bairro: data.bairro || '',
          municipio: data.municipio || '',
          uf: data.uf || '',
          cep: data.cep || '',
          telefone: data.ddd_telefone_1 || '',
          email: data.email || ''
        };
      }
    }
  } catch (e) {
    console.warn("BrasilAPI CNPJ lookup failed, trying fallback...", e);
  }

  // 2nd attempt: publica.cnpj.ws
  try {
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${clean}`);
    if (res.ok) {
      const data = await res.json();
      if (data) {
        const est = data.estabelecimento || {};
        return {
          razao_social: data.razao_social || est.nome_fantasia || '',
          nome_fantasia: est.nome_fantasia || data.razao_social || '',
          logradouro: est.logradouro || '',
          numero: est.numero || '',
          complemento: est.complemento || '',
          bairro: est.bairro || '',
          municipio: est.cidade?.nome || '',
          uf: est.estado?.sigla || '',
          cep: est.cep || '',
          telefone: est.telefone1 ? `(${est.ddd1 || ''}) ${est.telefone1}` : '',
          email: est.email || ''
        };
      }
    }
  } catch (e) {
    console.warn("Publica CNPJ WS lookup failed, trying next fallback...", e);
  }

  // 3rd attempt: Speedio
  try {
    const res = await fetch(`https://api-publica.speedio.com.br/buscarcnpj?cnpj=${clean}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.STATUS !== 'ERRO' && !data.error) {
        return {
          razao_social: data["RAZAO SOCIAL"] || '',
          nome_fantasia: data["NOME FANTASIA"] || '',
          logradouro: data["LOGRADOURO"] || '',
          numero: data["NUMERO"] || '',
          complemento: data["COMPLEMENTO"] || '',
          bairro: data["BAIRRO"] || '',
          municipio: data["MUNICIPIO"] || '',
          uf: data["UF"] || '',
          cep: data["CEP"] || '',
          telefone: data["DDD"] ? `(${data["DDD"]}) ${data["TELEFONE"]}` : '',
          email: data["EMAIL"] || ''
        };
      }
    }
  } catch (e) {
    console.warn("Speedio CNPJ lookup failed.", e);
  }

  return null;
};
