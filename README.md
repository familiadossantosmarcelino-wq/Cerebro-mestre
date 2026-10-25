# Cérebro Mestre

Claude e GPT desenvolvendo **o mesmo projeto juntos**: um propõe, o outro critica,
o primeiro revisa — até a proposta ser aprovada. As decisões ficam numa memória
compartilhada que as duas IAs leem no início de toda sessão.

```
 Objetivo ──► LÍDER propõe ──► CRÍTICO revisa ──┐
                  ▲                              │ VEREDITO: REVISAR
                  └──────── LÍDER revisa ◄───────┘
                                                 │ VEREDITO: APROVADO (ou fim das rodadas)
                                                 ▼
                         Versão final + DECISÕES ──► memoria/<projeto>.md
```

Por que funciona: os dois modelos têm treinamentos e pontos cegos diferentes.
Colocar um para auditar o outro reduz erro e "alucinação" — mas **não elimina**.
Dado técnico crítico (norma, valor de projeto, limite de material) continua
exigindo conferência na fonte.

## Pré-requisitos (importante)

- Python 3.10+
- **Chaves de API** da Anthropic e da OpenAI. Atenção: a assinatura do ChatGPT
  Plus e a do Claude Pro **não dão acesso à API** — é cobrança separada, por uso:
  - Claude: https://console.anthropic.com
  - GPT: https://platform.openai.com

## Instalação

```bash
pip install -r requirements.txt
cp .env.example .env      # e cole suas chaves no .env
```

## Uso

```bash
# Testar o fluxo sem gastar nada
python cerebro.py "Plano de manutenção preditiva para bombas" -p bombas --simular

# Sessão real: Claude lidera, GPT critica
python cerebro.py "Plano de manutenção preditiva para bombas centrífugas" -p bombas

# Inverter os papéis e permitir mais rodadas
python cerebro.py "Revisar o plano com foco em custo" -p bombas -l gpt -r 3
```

| Opção | Função |
|---|---|
| `-p / --projeto` | Nome do projeto. Sessões com o mesmo nome compartilham a memória. |
| `-l / --lider` | `claude` (padrão) ou `gpt`. O outro vira o crítico. |
| `-r / --rodadas` | Máximo de ciclos crítica → revisão (padrão 2). |
| `--simular` | Roda o fluxo com respostas falsas, sem chamar APIs. |

Saídas:
- `sessoes/AAAAMMDD-HHMMSS-<projeto>.md` — o debate completo (fora do git).
- `memoria/<projeto>.md` — decisões acumuladas (versione no git: é o "cérebro").

Modelos são configuráveis em `.env` (`CLAUDE_MODEL`, `OPENAI_MODEL`).

## Boas práticas

1. **Objetivo específico** rende mais que pedido genérico. Ex.: "Definir rotas de
   inspeção por vibração para 12 bombas API 610, com critérios de alarme" é
   melhor que "manutenção de bombas".
2. **Alterne o líder** entre sessões (`-l gpt`) para não viciar o projeto no
   estilo de um modelo só.
3. **Edite a memória à mão** quando você decidir algo — ela é texto simples e
   manda nas próximas sessões.
4. **Custo:** cada sessão faz de 3 a `2 × rodadas + 2` chamadas de API.
