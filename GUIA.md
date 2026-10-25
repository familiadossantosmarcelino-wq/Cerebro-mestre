# Guia de instalação do Cérebro Mestre (passo a passo)

Faça no **computador de casa**: no celular as telas ficam apertadas.
As telas do Firebase e das outras empresas mudam de tempos em tempos. Se algum botão
estiver com um nome um pouco diferente, procure o mais parecido.

Ordem: **Parte 1** (Firebase) → mande o código para o Claude → **Parte 2** (chaves das IAs)
→ **Parte 3** (colocar no ar) → **Parte 4** (instalar nos aparelhos).

---

## PARTE 1 — Firebase (a nuvem) · uns 15 minutos

### 1.1 Criar o projeto
1. Abra o navegador e digite: **console.firebase.google.com**
2. Entre com a sua conta Google (o mesmo Gmail de sempre).
3. Clique no botão grande **"Criar um projeto"** (ou **"Adicionar projeto"**).
4. No nome do projeto, escreva: **cerebro-mestre**
5. Marque a caixinha que aceita os termos e clique em **Continuar**.
6. Se perguntar sobre **Gemini** ou **Google Analytics**, desligue a chavinha e clique em **Continuar**.
7. Clique em **Criar projeto** e espere uns 30 segundos.
8. Quando aparecer "Seu projeto está pronto", clique em **Continuar**.

### 1.2 Ligar o login
1. No menu do lado esquerdo, clique em **Criação** (ou **Build**) e depois em **Authentication**.
2. Clique em **Vamos começar**.
3. Na lista que aparece, clique em **Google**:
   - ligue a chave **Ativar**;
   - em "E-mail de suporte", escolha o seu e-mail;
   - clique em **Salvar**.
4. Clique em **Adicionar novo provedor** e depois em **E-mail/senha**:
   - ligue **só a primeira chave** (E-mail/senha);
   - clique em **Salvar**.

### 1.3 Autorizar o endereço do app
1. Ainda em Authentication, clique na aba **Configurações**, no alto.
2. No menu dessa página, clique em **Domínios autorizados**.
3. Clique em **Adicionar domínio**.
4. Digite exatamente isto e clique em **Adicionar**:
   ```
   familiadossantosmarcelino-wq.github.io
   ```

### 1.4 Criar o banco de dados
1. No menu do lado esquerdo, clique em **Criação** e depois em **Firestore Database**.
2. Clique em **Criar banco de dados**.
3. Se perguntar a "edição", deixe a **Standard**.
4. Em "Local", escolha **southamerica-east1 (São Paulo)** e clique em **Avançar**.
   O local não pode ser trocado depois.
5. Escolha **Iniciar no modo de produção** e clique em **Criar**.
6. Quando o banco abrir, clique na aba **Regras**, no alto.
7. Apague todo o texto que está lá: clique dentro do texto, aperte **Ctrl+A** e depois **Delete**.
8. Cole este texto no lugar:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /usuarios/{uid}/{documento=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
9. Clique em **Publicar**.

Essas regras garantem que só você vê os seus projetos.

### 1.5 Pegar o código de configuração
1. No alto do menu esquerdo, clique na **engrenagem ⚙️** ao lado de "Visão geral do projeto".
2. Clique em **Configurações do projeto**.
3. Role a página até o fim, até a parte **"Seus apps"**.
4. Clique no ícone **`</>`** (é o de Web).
5. Em "Apelido do app", escreva **Cérebro**.
6. **Não** marque a caixa do Firebase Hosting.
7. Clique em **Registrar app**.
8. Vai aparecer um código. Procure a parte que começa com `const firebaseConfig = {` e termina com `};`.
9. Selecione esse pedaço inteiro com o mouse, copie e mande para o Claude (ou cole em `app/firebase-config.js`).

Pode mandar sem medo: esse código não é senha. Quem protege os seus dados é o login e as
regras do passo 1.4.

---

## PARTE 2 — Chaves das IAs (Claude e GPT) · uns 15 minutos

São as "senhas" que deixam o app conversar com as duas IAs. A cobrança é separada das
assinaturas que você já paga: você coloca crédito e vai gastando conforme usa. O crédito
mínimo costuma ser de uns 5 dólares, mas confira o valor na hora.

### 2.1 Claude
1. Abra **console.anthropic.com** e crie uma conta (ou entre com o Google).
2. No menu, procure **Billing** (cobrança) → **Add credits** (adicionar crédito).
   Cadastre o cartão e coloque o valor.
3. Ainda em Billing, procure **Limits** (limites) e defina um **limite mensal**
   (exemplo: 20 dólares). Assim nunca passa disso.
4. No menu, clique em **API Keys** → **Create Key** (criar chave) → dê o nome **Cerebro** → **Create**.
5. A chave começa com `sk-ant-`. **Copie e guarde num bloco de notas**, porque ela só aparece uma vez.

### 2.2 GPT
1. Abra **platform.openai.com** e entre com a sua conta.
2. Clique na **engrenagem ⚙️** (Settings) → **Billing** → **Add payment details**
   (adicionar pagamento). Coloque o crédito.
3. Em **Limits**, defina um **limite mensal**.
4. No menu, clique em **API keys** → **Create new secret key** → nome **Cerebro** → **Create**.
5. A chave começa com `sk-`. **Copie e guarde**, porque ela também só aparece uma vez.

**Nunca mande essas duas chaves para ninguém.** Você vai colar elas direto no app, na Parte 4.

---

## PARTE 3 — Colocar o app no ar · uns 10 minutos

### 3.1 Juntar a versão nova
1. Abra **github.com/familiadossantosmarcelino-wq/Cerebro-mestre**
2. Se aparecer uma faixa amarela escrita **"Compare & pull request"**, clique nela.
   Se não aparecer: clique na aba **Pull requests** → **New pull request**.
   Em "compare", escolha **claude/unified-ai-integration-cow2xn**.
3. Clique em **Create pull request**.
4. Clique em **Merge pull request** e depois em **Confirm merge**.

### 3.2 Deixar o repositório público
É obrigatório para publicar de graça no GitHub. Não tem risco: suas chaves e seus projetos
não ficam nele, ficam no Firebase.
1. No repositório, clique em **Settings** (engrenagem, no alto).
2. Role até o fim, até a parte vermelha **Danger Zone**.
3. Clique em **Change visibility** → **Make public** e confirme.

### 3.3 Ligar a publicação
1. Ainda em **Settings**, clique em **Pages** no menu esquerdo.
2. Em **Source**, escolha **GitHub Actions**.
3. Clique na aba **Actions**, no alto.
4. Se o item **"Publicar app"** estiver com **✓ verde**, está pronto.
   Se estiver com **✗ vermelho**, clique nele e depois em **Re-run all jobs**.
5. O endereço do seu app é:
   ```
   https://familiadossantosmarcelino-wq.github.io/Cerebro-mestre/
   ```

---

## PARTE 4 — Instalar e usar · 2 minutos por aparelho

### 4.1 No celular Android
1. Abra o endereço acima no **Chrome**.
2. Toque nos **3 pontinhos ⋮**, no canto de cima.
3. Toque em **Instalar app** (ou **Adicionar à tela inicial**).

### 4.2 No iPhone ou iPad
1. Abra o endereço no **Safari**.
2. Toque no botão **Compartilhar** (o quadrado com uma seta para cima).
3. Toque em **Adicionar à Tela de Início**.

### 4.3 No computador
1. Abra o endereço no **Chrome** ou no **Edge**.
2. Na barra de endereço, clique no ícone de **instalar** (um monitor com uma setinha).

### 4.4 Primeiro uso, só no primeiro aparelho
1. Abra o app e toque em **Entrar** → **Entrar com Google**.
2. Toque na **engrenagem ⚙️**.
3. Cole a chave do Claude e a chave do GPT da Parte 2.
4. Toque em **Salvar**.

### 4.5 Nos outros aparelhos
1. Toque em **Entrar** → **Entrar com Google**.
2. Pronto. As chaves e os projetos chegam sozinhos.

---

## Se der problema

| O que aparece | O que fazer |
|---|---|
| "endereço não autorizado" | Refaça o passo 1.3 |
| O login com Google não abre | Use o login com e-mail e senha, na mesma tela |
| "Falha" no topo do app | Confira se o passo 1.4 (Regras) foi publicado |
| As IAs não respondem | Confira se as chaves estão certas na ⚙️ e se tem crédito |

**Segurança:** ative a **verificação em duas etapas** na sua conta Google, em
myaccount.google.com → Segurança. É ela que protege tudo.
