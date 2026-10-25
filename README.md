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

> Em conta gratuita, o GitHub Pages exige repositório público. Suas chaves e
> projetos não ficam no código, só no seu aparelho. Para manter o repositório
> privado, publique a pasta `app/` na Netlify ou na Cloudflare Pages (gratuitos).

**Só no computador**
```bash
cd app && python3 -m http.server 8000   # abra http://localhost:8000
```

## Onde ficam os dados (importante)

Projetos e chaves ficam **no navegador do aparelho**. Não sincronizam entre
celular e computador, e somem se você limpar os dados do navegador. Use
**Fazer backup** (tela de projetos) com frequência; **Restaurar backup** traz os
projetos de volta em qualquer aparelho.

Quem tiver acesso ao seu navegador desbloqueado consegue ler as chaves. Mantenha o
limite de gasto e, se perder o aparelho, revogue as chaves nos painéis.

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
| `app/app.js` | Projetos, linha do tempo, arquivo do projeto, backup e configurações |
| `app/markdown.js` | Exibe o texto formatado (tabelas, listas) de forma segura |
| `app/sw.js`, `manifest.webmanifest` | Instalação como app e abertura offline |
| `.github/workflows/pages.yml` | Publicação automática no GitHub Pages |
