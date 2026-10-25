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

> Em conta gratuita, o GitHub Pages exige que o repositório **do app** seja público.
> Seus projetos e chaves nunca ficam nele: ficam no repositório privado de dados. Para manter o repositório
> privado, publique a pasta `app/` na Netlify ou na Cloudflare Pages (gratuitos).

**Só no computador**
```bash
cd app && python3 -m http.server 8000   # abra http://localhost:8000
```

## Nuvem: celular, tablet e computador juntos

Tudo o que você faz num aparelho aparece nos outros. Os projetos ficam guardados
num **repositório privado do seu GitHub**, um separado só para dados (não é o
repositório do app).

O que isso te dá:
- **Sincroniza sozinho** ao abrir o app, ao voltar para ele, quando a internet
  volta e a cada 2 minutos. O indicador no topo mostra *Sincronizado*, *Offline* ou *Falha*.
- **Funciona sem internet em campo**: fica salvo no aparelho e sobe quando o sinal voltar.
- **Nada se perde**: se dois aparelhos mexerem no mesmo projeto, os registros são
  somados. Excluir um projeto num aparelho exclui em todos.
- **Cada projeto é uma pasta** (`projetos/padrinhos-de-maquinas/`) com o arquivo
  `projeto.md` legível. Dá para ler pelo app do GitHub e todo o histórico de
  alterações fica guardado.
- **Chaves de API**: se você definir uma *senha das chaves*, elas sobem cifradas
  (ninguém lê sem a senha) e os outros aparelhos recebem sozinhos.

### Configurar (uma vez)

**1. Criar o repositório de dados** (no GitHub, pelo navegador)
- *New repository* → nome `cerebro-dados` → marque **Private** → marque
  *Add a README file* → *Create repository*.

**2. Criar o token de acesso** (dá acesso só a esse repositório)
- Foto do perfil → *Settings* → *Developer settings* → *Personal access tokens* →
  *Fine-grained tokens* → *Generate new token*.
- *Token name*: `Cérebro Mestre`. *Expiration*: o maior prazo que preferir.
- *Repository access*: **Only select repositories** → `cerebro-dados`.
- *Permissions* → *Repository permissions* → **Contents: Read and write**.
- *Generate token* e copie (começa com `github_pat_`).

**3. Em cada aparelho** (celular, tablet, computador), no app → ⚙️ → *Nuvem*:
- Repositório de dados: `seu-usuario/cerebro-dados`
- Token do GitHub: o token copiado
- Senha das chaves: **a mesma em todos os aparelhos**

No primeiro aparelho, coloque também as chaves de API do Claude e do GPT. Nos
outros, basta repositório, token e senha: as chaves chegam sozinhas.

### Segurança
- O token só acessa o repositório `cerebro-dados`, e só o conteúdo dele.
- As chaves de API vão cifradas com a sua senha (AES-256). Sem a senha, o arquivo
  na nuvem é ilegível.
- Em cada aparelho, token e chaves ficam no navegador. Quem usar o aparelho
  desbloqueado consegue acessá-los. Se perder um aparelho, revogue o token no
  GitHub e as chaves nos painéis da Anthropic e da OpenAI.
- Mantenha um limite de gasto mensal nas APIs.

### Sem nuvem
Sem a nuvem configurada, tudo fica só no aparelho. Use *Fazer backup* e
*Restaurar backup* na tela de projetos para não perder nada.

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
| `app/nuvem.js` | Leitura/gravação no GitHub, mescla entre aparelhos e cifra das chaves |
| `app/markdown.js` | Exibe o texto formatado (tabelas, listas) de forma segura |
| `app/sw.js`, `manifest.webmanifest` | Instalação como app e abertura offline |
| `.github/workflows/pages.yml` | Publicação automática no GitHub Pages |
