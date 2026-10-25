# Cérebro Mestre

Um lugar neutro para **desenvolver projetos**: você descreve o projeto, e **Claude
e GPT trabalham juntos** nele e devolvem um único texto, direto e escrito como de
um engenheiro experiente. Você não entra em nenhuma das duas IAs.

É um app web instalável (PWA): funciona no celular e no computador, com ícone na
tela inicial.

## Projetos separados

Cada projeto é uma "pasta" própria:

- **Objetivo e contexto** do projeto (você edita quando quiser);
- **Linha do tempo**: cada pedido seu e a resposta, em ordem;
- **Memória própria**: as IAs leem o objetivo e os últimos registros **só daquele
  projeto**. Um projeto não mistura com o outro;
- **Arquivo do projeto**: o botão *Baixar arquivo* gera um `.md` com objetivo e todo
  o histórico, pronto para guardar ou enviar.

Ao criar um projeto, as duas IAs já analisam e devolvem a **estrutura inicial**
(escopo, etapas, entregáveis, riscos, próximos passos e o que falta você informar).

Já vêm criados, para você completar o objetivo:
- **Padrinhos de Máquinas**
- **Preenchimento de OMs em Campo**

## Como as duas trabalham em cada pedido

```
 Seu pedido (dentro de um projeto)
        │
 1. ANÁLISE ─────── Claude e GPT, em paralelo: o que está sendo pedido,
        │           como dividir e em que parte cada uma é mais forte
 2. DIVISÃO ─────── o coordenador junta as duas análises e divide 2 a 4 partes
        │
 3. EXECUÇÃO ────── cada IA faz a sua parte em paralelo, pesquisando na web
        │
 4. COMPLEMENTO ─── cada IA lê a parte da outra e acrescenta o que falta,
        │           corrige erros e aponta conflitos
 5. TEXTO FINAL ─── um texto só, sem marca de IA, começando pela resposta
```

Se uma IA falhar numa parte, a outra assume. Em *Como foi feito* você vê quem fez o quê.

## Escrita sem "cara de IA"

O texto final segue regras fixas:
- a primeira frase já é a resposta, sem introdução nem fechamento;
- frases curtas, linguagem de chão de fábrica, tamanho proporcional ao pedido;
- lista, tabela e negrito só quando ajudam de verdade; nenhum emoji;
- proibidas as expressões típicas ("Claro!", "Ótima pergunta", "É importante
  ressaltar", "Em resumo", "Espero ter ajudado"…) e qualquer menção a IA, Claude ou GPT.

Além disso, o app apaga automaticamente aberturas e fechamentos desse tipo, se
escaparem. Isso reduz muito o tom de IA, mas **não garante 100%**: revise antes
de enviar algo oficial.

## O que você precisa

**Chaves de API** da Anthropic e da OpenAI. A assinatura do ChatGPT Plus e a do
Claude Pro **não dão acesso à API**. A API é cobrada à parte, por uso:

- Claude: https://console.anthropic.com → API Keys
- GPT: https://platform.openai.com → API keys

Defina um **limite de gasto mensal** nos dois painéis. Cada pedido faz cerca de
8 chamadas.

## Como colocar no ar

**GitHub Pages (recomendado, acessa do celular)**
1. Junte esta branch na `main`.
2. No GitHub: *Settings → Pages → Source: GitHub Actions*.
3. O workflow `Publicar app` publica a pasta `app/`. O endereço aparece na aba *Actions*.
4. No celular, abra o endereço e use *"Adicionar à tela inicial"*.

> Em conta gratuita, o GitHub Pages exige que o repositório do app seja público.
> Seus projetos e chaves nunca ficam nele: ficam na sua conta do Firebase. Para manter o repositório
> privado, publique a pasta `app/` na Netlify ou na Cloudflare Pages (gratuitos).

**Só no computador**
```bash
cd app && python3 -m http.server 8000   # abra http://localhost:8000
```

## Nuvem: celular, tablet e computador juntos (Firebase)

Você entra com sua conta (Google ou e-mail) e os mesmos projetos aparecem em
todos os aparelhos.

- **Tempo real**: o que você faz no computador aparece no celular na hora, sem atualizar.
- **Funciona sem sinal em campo**: fica salvo no aparelho e sobe sozinho quando o
  sinal volta. O indicador no topo mostra *Sincronizado*, *Enviando…* ou *Offline*.
- **Nada se perde**: cada registro é guardado separado, então dois aparelhos
  usando o mesmo projeto ao mesmo tempo não se atrapalham.
- **Chaves de API**: você coloca uma vez; os outros aparelhos recebem sozinhos.
- **Sem login** o app continua funcionando, só que os projetos ficam no aparelho.
  Ao entrar pela primeira vez, o que já existia no aparelho sobe para a conta.

### Configurar o Firebase (uma vez, uns 10 minutos, plano gratuito)

1. Acesse https://console.firebase.google.com com sua conta Google →
   **Adicionar projeto** → nome `cerebro-mestre` → pode desativar o Google
   Analytics → **Criar projeto**.
2. **Authentication** → *Começar* → *Método de login*: ative **Google** e
   **E-mail/senha**.
3. **Authentication** → *Configurações* → *Domínios autorizados* → adicione o
   endereço do app (ex.: `seu-usuario.github.io`).
4. **Firestore Database** → *Criar banco de dados* → local
   `southamerica-east1 (São Paulo)` → *modo de produção*. Depois, na aba
   **Regras**, apague tudo, cole o conteúdo do arquivo `firestore.rules` deste
   repositório e clique em **Publicar**.
5. ⚙️ *Configurações do projeto* → *Seus apps* → ícone **Web** (`</>`) → apelido
   `Cérebro` (não precisa de Hosting) → copie o bloco `firebaseConfig`.
6. Cole esse bloco em `app/firebase-config.js` (ou mande para o Claude colocar).
   Esses dados **não são secretos**: quem protege seus projetos é o login e as regras.

Pronto: em cada aparelho, abra o app e toque em **Entrar**.

### Segurança
- As regras do Firestore só deixam cada conta ler e gravar a própria pasta.
  Outra pessoa que entrar no app não vê nada seu.
- As chaves de API ficam na sua pasta da nuvem, protegidas pelo login. Quem tiver
  acesso à sua conta Google tem acesso a elas: use verificação em duas etapas
  na conta Google e mantenha um limite de gasto nas APIs.
- Se perder um aparelho: troque a senha da conta e gere chaves de API novas.

### Backup
*Fazer backup* e *Restaurar backup* (tela de projetos) continuam disponíveis:
geram e leem um arquivo `.json` com todos os projetos.

## Configurações (⚙️)

| Item | Padrão | Observação |
|---|---|---|
| Modelo Claude | `claude-opus-5-5` | |
| Modelo GPT | `gpt-5` | Troque pelo modelo mais recente da sua conta OpenAI. |
| Quem escreve o texto final | Claude | Também divide o trabalho. |
| Pesquisar na web | ligado | Busca nativa de cada API, com fontes. |
| Uma IA completa a outra | ligado | Desligar economiza 2 chamadas por pedido. |
| Seu perfil | eng. mecânico / inspetor | Ajusta tom e profundidade. |

## Arquivos

| Arquivo | Função |
|---|---|
| `app/cerebro.js` | Trabalho em dupla (5 etapas), regras de escrita e chamadas às APIs |
| `app/app.js` | Projetos, linha do tempo, arquivo do projeto, sincronização, backup e configurações |
| `app/nuvem.js` | Login e sincronização com o Firebase (tempo real e offline) |
| `app/firebase-config.js` | Configuração do seu projeto Firebase |
| `app/vendor/firebase.js` | Biblioteca do Firebase empacotada (gerada por `ferramentas/firebase-entrada.js`) |
| `firestore.rules` | Regras de segurança: cada conta só acessa a própria pasta |
| `app/markdown.js` | Exibe o texto formatado (tabelas, listas) de forma segura |
| `app/sw.js`, `manifest.webmanifest` | Instalação como app e abertura offline |
| `.github/workflows/pages.yml` | Publicação automática no GitHub Pages |
