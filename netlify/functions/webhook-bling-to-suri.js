const { parseStringPromise } = require('xml2js');

const SURI_API_URL = process.env.SURI_API_URL;
const SURI_API_TOKEN = process.env.SURI_API_TOKEN;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

function log(level, ...args) {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  if (levels[level] >= levels[LOG_LEVEL]) {
    console[level](...args);
  }
}

function getHeader(headers, name) {
  if (!headers) return undefined;
  const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : undefined;
}

async function parseBody(event) {
  const raw = event.body || '';
  const contentType = getHeader(event.headers, 'content-type') || '';
  const bodyText = event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;

  // Bling V1 costuma enviar XML. Vamos garantir o parse correto.
  if (contentType.includes('xml') || bodyText.trim().startsWith('<?xml') || bodyText.trim().startsWith('<')) {
    try {
      const parsed = await parseStringPromise(bodyText, { explicitArray: false, mergeAttrs: true });
      return { format: 'xml', parsed, raw: bodyText };
    } catch (err) {
      throw new Error('Erro ao parsear XML: ' + err.message);
    }
  } else {
    try {
      const parsed = JSON.parse(bodyText);
      return { format: 'json', parsed, raw: bodyText };
    } catch (err) {
      return { format: 'text', parsed: bodyText, raw: bodyText };
    }
  }
}

function extractProductFromBling(parsedWrapper) {
  const p = parsedWrapper;
  if (!p) return null;

  // Estrutura Clássica Bling V1 (XML ou JSON)
  // O Bling V1 envia dentro de retorno -> produtos -> produto
  if (p.retorno && p.retorno.produtos) {
    const prod = p.retorno.produtos.produto || p.retorno.produtos;
    return Array.isArray(prod) ? prod[0] : prod;
  }

  // Caso o Bling envie apenas o objeto produto (comum em alguns webhooks V1)
  if (p.produto) {
    return Array.isArray(p.produto) ? p.produto[0] : p.produto;
  }

  // Fallback para outros formatos que possam vir no payload
  if (p.codigo || p.descricao || p.sku || p.id) return p;

  return null;
}

function mapBlingToSuri(blingProduct) {
  // Mapeamento rigoroso para os campos da V1 do Bling
  const sku = blingProduct.codigo || blingProduct.sku || blingProduct.id || null;
  const name = blingProduct.descricao || blingProduct.nome || blingProduct.name || '';
  
  const description = blingProduct.descricaoDetalhada ||
    blingProduct.descricao ||
    blingProduct.descricaoCurta ||
    blingProduct.informacoesAdicionais ||
    name;

  // Tratamento de preço (Bling V1 pode enviar com vírgula em XML)
  const priceRaw = blingProduct.preco ||
    blingProduct.precoVenda ||
    blingProduct.valor ||
    '0';
  const price = typeof priceRaw === 'string' ? Number(priceRaw.replace(',', '.')) : Number(priceRaw) || 0;

  const stockRaw = blingProduct.estoque ||
    blingProduct.quantidade ||
    blingProduct.qtd ||
    0;
  const stock = Number(stockRaw) || 0;

  const images = [];

  // Tratamento de imagens no Bling V1
  if (blingProduct.imagens) {
    if (blingProduct.imagens.imagem) {
      const imgs = Array.isArray(blingProduct.imagens.imagem)
        ? blingProduct.imagens.imagem
        : [blingProduct.imagens.imagem];
      imgs.forEach(i => {
        if (i.url) images.push(i.url);
        else if (i.link) images.push(i.link);
        else if (typeof i === 'string') images.push(i);
      });
    } else if (typeof blingProduct.imagens === 'string') {
      images.push(blingProduct.imagens);
    }
  }

  // Campos alternativos de imagem comuns no Bling
  if (blingProduct.urlImagem) images.push(blingProduct.urlImagem);
  if (blingProduct.imagemURL) images.push(blingProduct.imagemURL);

  const filteredImages = [...new Set(images.filter(Boolean))];

  // Formato da API Suri que funcionou no seu teste de CURL
  const mapped = {
    sku: sku,
    title: name,
    description: description,
    price: price,
    stock_quantity: stock,
    images: filteredImages
  };

  log('debug', 'Produto mapeado (V1) para Suri:', mapped);
  return mapped;
}

async function upsertProductToSuri(suriProduct) {
  if (!SURI_API_URL || !SURI_API_TOKEN) {
    throw new Error('SURI_API_URL e SURI_API_TOKEN não configurados.');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SURI_API_TOKEN}`
  };

  // Endpoint de produtos na Suri
  const productUrl = `${SURI_API_URL.replace(/\/$/, '')}/products`;
  
  try {
    log('info', `Sincronizando SKU=${suriProduct.sku} na Suri`);
    
    // Tenta POST (Criação)
    let response = await fetch(productUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(suriProduct)
    });

    // Se o produto já existir (400 ou 409), tenta PUT (Atualização)
    if (!response.ok && (response.status === 400 || response.status === 409)) {
      log('info', `Produto já existe, tentando atualizar via PUT para SKU=${suriProduct.sku}`);
      const updateUrl = `${productUrl}/${suriProduct.sku}`;
      response = await fetch(updateUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify(suriProduct)
      });
    }

    if (response.ok) {
      const result = await response.json();
      log('info', `Sucesso na Suri para SKU=${suriProduct.sku}`);
      return { ok: true, status: response.status, data: result };
    } else {
      const text = await response.text();
      log('error', `Erro na API Suri: ${response.status} - ${text}`);
      return { ok: false, status: response.status, body: text };
    }
  } catch (err) {
    log('error', `Erro de rede: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

exports.handler = async function (event) {
  // O Bling V1 exige resposta rápida (timeout de 5s)
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    log('info', '=== Webhook Bling V1 Recebido ===');
    const { format, parsed } = await parseBody(event);
    
    const blingProduct = extractProductFromBling(parsed);
    if (!blingProduct) {
      log('warn', 'Produto não encontrado no payload V1');
      return { statusCode: 200, body: JSON.stringify({ ok: false, message: 'Payload ignorado' }) };
    }

    const mapped = mapBlingToSuri(blingProduct);
    
    if (!mapped.sku) {
      log('warn', 'SKU não identificado no produto');
      return { statusCode: 200, body: JSON.stringify({ ok: false, message: 'SKU ausente' }) };
    }

    // Executa a integração
    const res = await upsertProductToSuri(mapped);

    // Retornamos 200 para o Bling confirmar o recebimento
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: res.ok,
        sku: mapped.sku,
        suri_status: res.status
      })
    };
  } catch (err) {
    log('error', 'Erro no processamento do webhook:', err);
    return {
      statusCode: 200, 
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
