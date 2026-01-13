# Teste da Função Webhook - Bling para Suri

## ✅ Status: Deploy Bem-Sucedido!

Sua URL: `https://suri-bling.netlify.app/.netlify/functions/webhook-bling-to-suri`

### Por que "Method Not Allowed"?

Isso é **NORMAL**! A mensagem aparece porque:
- Você acessou a URL pelo navegador (método GET)
- A função só aceita requisições POST (webhooks do Bling)

**Isso significa que a função está funcionando corretamente!** ✅

---

## 🧪 Como Testar a Função

### Teste 1: Via PowerShell (Recomendado)

Abra o PowerShell e execute:

```powershell
$body = @{
    produto = @{
        codigo = "TEST001"
        descricao = "Produto de Teste"
        preco = "99.90"
        estoque = "10"
        urlImagem = "https://example.com/image.jpg"
    }
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://suri-bling.netlify.app/.netlify/functions/webhook-bling-to-suri" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body
```

### Teste 2: Via curl (se tiver instalado)

```bash
curl -X POST "https://suri-bling.netlify.app/.netlify/functions/webhook-bling-to-suri" \
  -H "Content-Type: application/json" \
  -d '{
    "produto": {
      "codigo": "TEST001",
      "descricao": "Produto de Teste",
      "preco": "99.90",
      "estoque": "10",
      "urlImagem": "https://example.com/image.jpg"
    }
  }'
```

### Teste 3: Via Postman ou Insomnia

1. Crie uma nova requisição POST
2. URL: `https://suri-bling.netlify.app/.netlify/functions/webhook-bling-to-suri`
3. Headers: `Content-Type: application/json`
4. Body (JSON):
```json
{
  "produto": {
    "codigo": "TEST001",
    "descricao": "Produto de Teste",
    "preco": "99.90",
    "estoque": "10",
    "urlImagem": "https://example.com/image.jpg"
  }
}
```

---

## 📊 Verificar Logs no Netlify

1. Acesse: [https://app.netlify.com/sites/suri-bling/logs](https://app.netlify.com/sites/suri-bling/logs)
2. Vá para "Functions" → "webhook-bling-to-suri"
3. Você verá os logs de cada requisição recebida

---

## ✅ Configuração no Bling

Sua URL está correta para o webhook do Bling:
```
https://suri-bling.netlify.app/.netlify/functions/webhook-bling-to-suri
```

### Checklist de Configuração no Bling:

- [ ] Aplicação criada no [Bling Developer Portal](https://developer.bling.com.br)
- [ ] Scope "produto" adicionado
- [ ] Webhook configurado com a URL acima
- [ ] Eventos selecionados: criação, atualização de produtos
- [ ] Fluxo de autorização OAuth completado

---

## 🔍 Próximos Passos

### 1. Testar a Função

Execute um dos testes acima para verificar se a função está processando corretamente.

**Resposta esperada:**
```json
{
  "ok": true,
  "action": "created" ou "updated",
  "status": 200 ou 201
}
```

### 2. Verificar Variáveis de Ambiente

Confirme que você configurou no Netlify:
- `SURI_API_URL` = URL da API Suri
- `SURI_API_TOKEN` = Token de autenticação
- `LOG_LEVEL` = `info` ou `debug`

**Como verificar:**
1. Acesse [app.netlify.com/sites/suri-bling/settings](https://app.netlify.com/sites/suri-bling/settings)
2. Vá para "Environment variables"
3. Confirme que as 3 variáveis estão configuradas

### 3. Testar com Produto Real do Bling

1. Crie ou edite um produto no Bling
2. Verifique os logs da função no Netlify
3. Confirme que o produto foi criado/atualizado na Suri

---

## 🐛 Possíveis Erros e Soluções

### Erro 500 nos logs

**Causa:** Variáveis de ambiente não configuradas ou incorretas

**Solução:**
1. Verifique `SURI_API_URL` e `SURI_API_TOKEN` no Netlify
2. Teste manualmente a API Suri com o token

### Erro 401/403 da Suri

**Causa:** Token inválido ou sem permissões

**Solução:**
1. Verifique se o token da Suri está correto
2. Confirme que o token tem permissões para criar/atualizar produtos

### Webhook não é recebido do Bling

**Causa:** Configuração incorreta no Bling

**Solução:**
1. Verifique se o scope "produto" está adicionado
2. Confirme que você completou o OAuth
3. Teste criar um produto no Bling e verifique os logs

---

## 📞 Suporte

Se precisar de ajuda:
1. Verifique os logs no Netlify
2. Execute um teste manual (PowerShell/curl)
3. Revise a documentação em [docs/BLING_WEBHOOK_SETUP.md](docs/BLING_WEBHOOK_SETUP.md)
