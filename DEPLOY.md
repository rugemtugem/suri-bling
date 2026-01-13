# Guia Rápido de Deploy - Integração Bling-Suri

## 🚀 Opções de Deploy

Você tem 3 opções para fazer o deploy no Netlify:

---

## Opção 1: Deploy via Interface Web do Netlify (MAIS FÁCIL)

### Passo a Passo:

1. **Acesse o Netlify:**
   - Vá para [https://app.netlify.com/](https://app.netlify.com/)
   - Faça login ou crie uma conta gratuita

2. **Deploy Manual:**
   - Clique em "Add new site" → "Deploy manually"
   - Arraste a pasta `c:\xampp\htdocs\suri-netlify` para a área de upload
   - Aguarde o deploy completar

3. **Configure Variáveis de Ambiente:**
   - No painel do site, vá para "Site settings" → "Environment variables"
   - Adicione:
     - `SURI_API_URL` = `https://api.suri.com.br`
     - `SURI_API_TOKEN` = `seu_token_da_suri`
     - `LOG_LEVEL` = `info`

4. **Copie a URL do site:**
   - Será algo como: `https://seu-site-123abc.netlify.app`
   - A URL do webhook será: `https://seu-site-123abc.netlify.app/.netlify/functions/webhook-bling-to-suri`

---

## Opção 2: Deploy via Netlify CLI

### Passo a Passo:

1. **Instalar Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Fazer login:**
   ```bash
   netlify login
   ```
   (Isso abrirá o navegador para autenticação)

3. **Inicializar o site:**
   ```bash
   cd c:\xampp\htdocs\suri-netlify
   netlify init
   ```
   - Escolha "Create & configure a new site"
   - Selecione seu time/conta
   - Dê um nome ao site

4. **Deploy:**
   ```bash
   netlify deploy --prod
   ```

5. **Configure variáveis de ambiente:**
   ```bash
   netlify env:set SURI_API_URL "https://api.suri.com.br"
   netlify env:set SURI_API_TOKEN "seu_token_da_suri"
   netlify env:set LOG_LEVEL "info"
   ```

---

## Opção 3: Deploy via Git (Requer Configuração)

### Passo a Passo:

1. **Configurar Git (se ainda não configurou):**
   ```bash
   git config user.email "seu-email@example.com"
   git config user.name "Seu Nome"
   ```

2. **Criar repositório no GitHub/GitLab:**
   - Vá para [github.com](https://github.com) e crie um novo repositório
   - Copie a URL do repositório

3. **Conectar repositório local:**
   ```bash
   cd c:\xampp\htdocs\suri-netlify
   git init
   git add .
   git commit -m "Implementa integração Bling-Suri"
   git remote add origin https://github.com/seu-usuario/seu-repositorio.git
   git push -u origin main
   ```

4. **Conectar ao Netlify:**
   - Acesse [app.netlify.com](https://app.netlify.com/)
   - Clique em "Add new site" → "Import an existing project"
   - Conecte seu GitHub/GitLab
   - Selecione o repositório
   - Configure variáveis de ambiente
   - Deploy automático!

---

## ⚙️ Após o Deploy

Independente da opção escolhida, após o deploy:

1. **Anote a URL do site** (ex: `https://seu-site.netlify.app`)

2. **Configure o webhook no Bling:**
   - URL: `https://seu-site.netlify.app/.netlify/functions/webhook-bling-to-suri`
   - Siga o guia: [docs/BLING_WEBHOOK_SETUP.md](docs/BLING_WEBHOOK_SETUP.md)

3. **Teste a integração:**
   - Crie um produto no Bling
   - Verifique os logs no Netlify
   - Confirme que o produto aparece na Suri

---

## 🎯 Recomendação

**Para começar rapidamente:** Use a **Opção 1** (Interface Web)
- Mais simples
- Não requer configuração de Git
- Deploy em minutos

**Para desenvolvimento contínuo:** Use a **Opção 3** (Git)
- Permite versionamento
- Deploy automático a cada commit
- Melhor para equipes

---

## 📝 Checklist Pré-Deploy

Antes de fazer o deploy, certifique-se de ter:

- [ ] Token da API Suri (`SURI_API_TOKEN`)
- [ ] URL da API Suri (`SURI_API_URL`)
- [ ] Conta no Netlify criada
- [ ] Arquivo `.env` configurado localmente (para testes)

---

## 🐛 Troubleshooting

### Erro: "Deploy directory 'dist' does not exist"

**Problema:** O Netlify está procurando uma pasta `dist` que não existe.

**Solução:** Este erro já foi corrigido! O arquivo `netlify.toml` foi atualizado para remover a configuração `publish = "dist"`.

**Se você já fez deploy e teve este erro:**
1. Faça um novo deploy (arraste a pasta novamente ou use `git push`)
2. O deploy agora deve funcionar corretamente

**Configuração correta do `netlify.toml`:**
```toml
[build]
  functions = "netlify/functions"

[[redirects]]
  from = "/.netlify/functions/*"
  to = "/.netlify/functions/:splat"
  status = 200
  force = true
```

---

## 🆘 Precisa de Ajuda?

Se tiver dúvidas:
1. Revise o [README.md](README.md)
2. Consulte [docs/BLING_WEBHOOK_SETUP.md](docs/BLING_WEBHOOK_SETUP.md)
3. Verifique os logs no painel do Netlify
