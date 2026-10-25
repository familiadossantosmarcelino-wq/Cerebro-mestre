# Cérebro Mestre

Um lugar neutro onde você digita sua dúvida e **Claude e GPT trabalham juntos**
para devolver **uma única resposta**. Você não entra em nenhuma das duas IAs.

É um app web instalável (PWA): funciona no celular e no computador, com ícone na
tela inicial.

## Como a equipe trabalha

```
 Você digita a demanda
        │
 1. ANÁLISE ─────── Claude e GPT, em paralelo: o que está sendo pedido,
        │           como dividir e em que parte cada uma é mais forte
 2. PLANO ───────── o coordenador junta as duas análises e divide 2 a 4 partes
        │           (cada parte vai para quem é mais forte nela)
 3. EXECUÇÃO ────── cada IA faz a sua parte em paralelo, pesquisando na web
        │
 4. COMPLEMENTO ─── cada IA lê a parte da outra e acrescenta o que falta,
        │           corrige erros e aponta conflitos (sem "aprovar/reprovar")
 5. SÍNTESE ─────── o coordenador funde tudo numa resposta única:
                    resposta direta → desenvolvimento → divergências e
                    posição adotada → pontos a verificar → fontes
```

- **Resiliência:** se uma IA falhar numa parte, a outra assume. A resposta não trava.
- **Bastidores visíveis:** abaixo da resposta você vê quem fez o quê.
- **Projetos:** cada projeto tem um contexto fixo (ex.: "planta com 12 bombas
  API 610") e as últimas 3 perguntas entram como memória nas próximas.
- **Histórico:** as últimas 30 respostas ficam salvas no aparelho; dá para copiar
  ou baixar em `.md`.

## O que você precisa

**Chaves de API** da Anthropic e da OpenAI. A assinatura do ChatGPT Plus e a do
Claude Pro **não dão acesso à API**. A API é cobrada à parte, por uso:

- Claude: https://console.anthropic.com → API Keys
- GPT: https://platform.openai.com → API keys

Defina um **limite de gasto mensal** nos dois painéis. Cada pergunta faz cerca de
8 chamadas (2 de análise, 1 de plano, 2 a 4 de execução, 2 de complemento, 1 de
síntese).

## Como colocar no ar

**Opção 1: GitHub Pages (recomendado, acessa do celular)**
1. Junte esta branch na `main`.
2. No GitHub: *Settings → Pages → Source: GitHub Actions*.
3. O workflow `Publicar app` publica a pasta `app/`. O endereço aparece na aba
   *Actions* (algo como `https://<usuario>.github.io/<repositorio>/`).
4. No celular, abra o endereço e use *"Adicionar à tela inicial"*.

> Em conta gratuita, o GitHub Pages só funciona se o repositório for público.
> Isso não expõe suas chaves: elas ficam só no seu aparelho, nunca no código.
> Se quiser manter o repositório privado, publique a pasta `app/` na Netlify ou
> na Cloudflare Pages (ambas têm plano gratuito).

**Opção 2: só no computador**
```bash
cd app && python3 -m http.server 8000
# abra http://localhost:8000
```

## Primeiro uso
1. Toque em ⚙️ e cole as duas chaves.
2. Para testar sem gastar, marque **Modo simulação**.
3. Digite a dúvida e toque em **Resolver** (ou Ctrl+Enter).

## Configurações (⚙️)

| Item | Padrão | Observação |
|---|---|---|
| Modelo Claude | `claude-opus-5-5` | |
| Modelo GPT | `gpt-5` | Troque pelo modelo mais recente da sua conta OpenAI. |
| Coordenador | Claude | Quem divide o trabalho e escreve a síntese. |
| Pesquisar na web | ligado | As duas IAs usam a busca nativa de cada API. |
| Complemento cruzado | ligado | Desligar economiza 2 chamadas por pergunta. |
| Seu perfil | eng. mecânico / inspetor | Ajusta o tom e a profundidade. |

## Segurança (leia)

- As chaves ficam salvas no navegador do aparelho (`localStorage`) e são enviadas
  direto para a Anthropic e a OpenAI. Não passam por nenhum servidor nosso.
- Qualquer pessoa com acesso ao seu navegador desbloqueado pode ler as chaves.
  Por isso o limite de gasto é importante. Se perder o aparelho, revogue as chaves
  nos painéis.
- O texto que vem das IAs é sempre exibido como texto, nunca executado como código.

## Arquivos

| Arquivo | Função |
|---|---|
| `app/cerebro.js` | Orquestração das 5 etapas e chamadas às duas APIs |
| `app/app.js` | Interface, configurações, projetos e histórico |
| `app/markdown.js` | Exibe a resposta formatada (tabelas, listas) de forma segura |
| `app/sw.js`, `manifest.webmanifest` | Instalação como app e abertura offline |
| `.github/workflows/pages.yml` | Publicação automática no GitHub Pages |
