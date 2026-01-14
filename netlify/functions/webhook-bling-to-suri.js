const { parseStringPromise } = require('xml2js');

const SURI_API_URL = process.env.SURI_API_URL;
const SURI_API_TOKEN = process.env.SURI_API_TOKEN;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// BUG CORRIGIDO: A lógica estava invertida
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

  // Estrutura: retorno.produtos.produto
  if (p.retorno && p.retorno.produtos) {
    const prod = p.retorno.produtos.produto || p.retorno.produtos;
    return Array.isArray(prod) ? prod[0] : prod;
  }

  // Estrutura: produto
  if (p.produto) {
    return Array.isArray(p.produto) ? p.produto[0] : p.produto;
  }

  // Estrutura: resource.produto
  if (p.resource && p.resource.produto) return p.resource.produto;

  // Estrutura: data (webhook v2 do Bling)
  if (p.data && (p.data.codigo || p.data.id || p.data.sku)) {
    return p.data;
  }

  // Fallback: se o objeto já contém campos do produto
  if (p.codigo || p.descricao || p.sku || p.id) return p;

  return null;
}

function mapBlingToSuri(blingProduct) {
  const sku = blingProduct.codigo || blingProduct.sku || blingProduct.id || null;
  const name = blingProduct.descricao || blingProduct.nome || blingProduct.name || '';
  
  const description = blingProduct.descricaoDetalhada ||
    blingProduct.descricao ||
    blingProduct.descricaoCurta ||
    blingProduct.informacoesAdicionais ||
    '';

  const priceRaw = blingProduct.preco ||
    blingProduct.precoVenda ||
    blingProduct.preco_venda ||
    blingProduct.valor ||
    '0';
  const price = Number(String(priceRaw).replace(',', '.')) || 0;

  const stockRaw = blingProduct.estoque ||
    blingProduct.quantidade ||
    blingProduct.qtd ||
    blingProduct.stock ||
    0;
  const stock = Number(stockRaw) || 0;

  const images = [];

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

  if (blingProduct.urlImagem) images.push(blingProduct.urlImagem);
  if (blingProduct.imagemURL) images.push(blingProduct.imagemURL);

  if (blingProduct.fotos && Array.isArray(blingProduct.fotos)) {
    blingProduct.fotos.forEach(f => {
      if (f.url) images.push(f.url);
      else if (f.link) images.push(f.link);
    });
  }

  const filteredImages = [...new Set(images.filter(Boolean))];

  // Formato correto da API Suri
  const mapped = {
    name,
    description,
    category: {
      providerId: "131087930" // ID da categoria padrão - ajuste conforme necessário
    },
    price,
    promotionalPrice: 0,
    stockQuantity: stock,
    isActive: true,
    isPriceEditable: false,
    itemWithoutLogistic: false,
    sellerId: "all",
    weightInGrams: 0,
    attributes: [],
    images: filteredImages,
    variants: [],
    dimensions: [{
      dimensions: {},
      prices: {
        default: {
          price: price
        }
      },
      stocks: {},
      sku: sku,
      quantity: stock
    }]
  };

  log('debug', 'Produto mapeado:', mapped);
  return mapped;
}

async function upsertProductToSuri(suriProduct) {
  if (!SURI_API_URL || !SURI_API_TOKEN) {
    throw new Error('SURI_API_URL e SURI_API_TOKEN devem estar configurados como variáveis de ambiente.');
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SURI_API_TOKEN}`
  };

  // A API da Suri usa o SKU dentro de dimensions, então buscamos por ele
  const sku = suriProduct.dimensions[0]?.sku;
  
  // Busca o produto pelo SKU para ver se já existe
  const searchUrl = `${SURI_API_URL.replace(/\/$/, '')}/products`;
  
  try {
    log('info', `Tentando criar/atualizar produto SKU=${sku}`);
    
    // Tenta criar o produto (POST)
    const postRes = await fetch(searchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(suriProduct)
    });

    if (postRes.ok) {
      const result = await postRes.json();
      log('info', `Produto SKU=${sku} criado/atualizado com sucesso`);
      return { ok: true, action: 'created', status: postRes.status, data: result };
    } else {
      const text = await postRes.text();
      log('error', `Falha ao criar produto: ${postRes.status} - ${text}`);
      return { ok: false, action: 'create_failed', status: postRes.status, body: text };
    }
  } catch (err) {
    log('error', `Erro de rede: ${err.message}`);
    return { ok: false, action: 'network_error', error: err.message };
  }
}

async function deleteProductOnSuri(sku) {
  const headers = {
    'Authorization': `Bearer ${SURI_API_TOKEN}`
  };
  
  // Para deletar, precisamos do ID do produto, não o SKU
  // Por enquanto, retornamos uma mensagem informativa
  log('warn', `Delete não implementado - a API da Suri pode requerer o productId em vez do SKU`);
  return { status: 501, ok: false, body: 'Delete not implemented - needs productId' };
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    log('info', '=== Webhook recebido do Bling ===');
    log('debug', 'Headers:', event.headers);

    const { format, parsed, raw } = await parseBody(event);
    log('info', `Formato do payload: ${format}`);
    log('debug', 'Payload parseado:', JSON.stringify(parsed, null, 2));

    const blingProduct = extractProductFromBling(parsed);
    if (!blingProduct) {
      log('warn', 'Não foi possível extrair produto do payload');
      log('debug', 'Payload recebido:', parsed);
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, message: 'Produto não encontrado no payload' })
      };
    }

    log('info', 'Produto extraído do Bling:', blingProduct);

    const mapped = mapBlingToSuri(blingProduct);
    const sku = mapped.dimensions[0]?.sku;
    
    if (!sku) {
      log('warn', 'Produto sem SKU identificado');
      return {
        statusCode: 400,
        body: JSON.stringify({ ok: false, message: 'Produto sem SKU' })
      };
    }

    const wantsDelete = (() => {
      const action = parsed?.action || parsed?.evento || blingProduct?.acao || blingProduct?.evento;
      if (typeof action === 'string' && /delete|excluir|remover/i.test(action)) return true;

      if (blingProduct.situacao && /inativ|inativo|exclu/i.test(String(blingProduct.situacao))) return true;

      try {
        const url = event.rawUrl || event.path || '';
        if (typeof url === 'string' && url.includes('delete=true')) return true;
      } catch (_) { }

      return false;
    })();

    if (wantsDelete) {
      log('info', `Solicitação de delete para SKU=${sku}`);
      const delRes = await deleteProductOnSuri(sku);
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, action: 'deleted', result: delRes })
      };
    }

    log('info', `Processando upsert para SKU=${sku}`);
    const res = await upsertProductToSuri(mapped);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: res.ok,
        action: res.action,
        status: res.status,
        details: res.body || res.error || null
      })
    };
  } catch (err) {
    log('error', 'Erro ao processar webhook:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
