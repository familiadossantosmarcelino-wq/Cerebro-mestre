#!/usr/bin/env python3
"""Cérebro Mestre: Claude e GPT trabalhando juntos num mesmo projeto.

Fluxo de cada sessão (debate estruturado):
  1. LÍDER propõe uma solução para o objetivo.
  2. CRÍTICO revisa: aponta falhas, riscos e lacunas.
  3. LÍDER revisa a proposta respondendo a cada crítica.
  4. Repete 2-3 até o crítico aprovar ou acabar o número de rodadas.
  5. LÍDER escreve a versão final consolidada e registra as decisões
     na memória compartilhada do projeto.

A memória (memoria/<projeto>.md) é lida no início de toda sessão, então
as duas IAs sempre partem do mesmo histórico de decisões.
"""

import argparse
import datetime as dt
import os
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
PASTA_MEMORIA = RAIZ / "memoria"
PASTA_SESSOES = RAIZ / "sessoes"

# Carrega o .env (formato CHAVE=valor) sem sobrescrever variáveis já exportadas.
if (RAIZ / ".env").exists():
    for linha in (RAIZ / ".env").read_text(encoding="utf-8").splitlines():
        if "=" in linha and not linha.lstrip().startswith("#"):
            chave, valor = linha.split("=", 1)
            os.environ.setdefault(chave.strip(), valor.strip())

MODELO_CLAUDE = os.getenv("CLAUDE_MODEL", "claude-opus-5-5")
MODELO_GPT = os.getenv("OPENAI_MODEL", "gpt-4o")
MAX_TOKENS = int(os.getenv("CEREBRO_MAX_TOKENS", "4000"))

REGRAS_COMUNS = """Você faz parte do "Cérebro Mestre": duas IAs (Claude e GPT) que desenvolvem
o mesmo projeto em conjunto para o usuário, um engenheiro mecânico.
Regras:
- Responda em português do Brasil, de forma técnica, direta e prática.
- Não invente fatos, dados, normas ou fontes. Se não souber, diga.
- Diferencie claramente FATO de SUPOSIÇÃO.
- Não concorde só para agradar: se houver falha, aponte.
- Respeite as decisões já registradas na memória do projeto, a menos que
  haja motivo técnico forte para revê-las (e, nesse caso, explique)."""

PAPEL_LIDER = REGRAS_COMUNS + """
Seu papel agora: LÍDER. Você propõe e revisa a solução. Ao receber críticas,
responda item a item (aceito / rejeito + motivo) e entregue a versão revisada."""

PAPEL_CRITICO = REGRAS_COMUNS + """
Seu papel agora: CRÍTICO / REVISOR. Analise a proposta com rigor:
- erros técnicos, premissas fracas, riscos, itens faltando, alternativas melhores;
- numere cada ponto e classifique: [CRÍTICO], [IMPORTANTE] ou [MELHORIA].
Se a proposta estiver boa o suficiente para executar, escreva na última linha
exatamente: VEREDITO: APROVADO
Caso contrário, escreva na última linha: VEREDITO: REVISAR"""


# ---------------------------------------------------------------- provedores

def chamar_claude(sistema: str, mensagem: str) -> str:
    import anthropic

    cliente = anthropic.Anthropic()  # usa ANTHROPIC_API_KEY
    resp = cliente.messages.create(
        model=MODELO_CLAUDE,
        max_tokens=MAX_TOKENS,
        system=sistema,
        messages=[{"role": "user", "content": mensagem}],
    )
    return "".join(b.text for b in resp.content if b.type == "text")


def chamar_gpt(sistema: str, mensagem: str) -> str:
    import openai

    cliente = openai.OpenAI()  # usa OPENAI_API_KEY
    resp = cliente.chat.completions.create(
        model=MODELO_GPT,
        messages=[
            {"role": "system", "content": sistema},
            {"role": "user", "content": mensagem},
        ],
    )
    return resp.choices[0].message.content or ""


def chamar_simulado(nome: str):
    """Provedor falso para testar o fluxo sem gastar API."""
    contador = {"n": 0}

    def _chamar(sistema: str, mensagem: str) -> str:
        contador["n"] += 1
        if "CRÍTICO" in sistema:
            veredito = "APROVADO" if contador["n"] >= 2 else "REVISAR"
            return f"[{nome} simulado] 1. [IMPORTANTE] Exemplo de crítica.\nVEREDITO: {veredito}"
        return f"[{nome} simulado] Proposta/revisão nº {contador['n']}.\nDECISÕES:\n- Decisão de exemplo"

    return _chamar


PROVEDORES = {"claude": chamar_claude, "gpt": chamar_gpt}


# ---------------------------------------------------------------- memória

def slug(texto: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", texto.lower()).strip("-") or "projeto"


def ler_memoria(projeto: str) -> str:
    arq = PASTA_MEMORIA / f"{slug(projeto)}.md"
    return arq.read_text(encoding="utf-8") if arq.exists() else ""


def gravar_memoria(projeto: str, objetivo: str, decisoes: str) -> Path:
    PASTA_MEMORIA.mkdir(exist_ok=True)
    arq = PASTA_MEMORIA / f"{slug(projeto)}.md"
    if not arq.exists():
        arq.write_text(f"# Memória do projeto: {projeto}\n", encoding="utf-8")
    agora = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    with arq.open("a", encoding="utf-8") as f:
        f.write(f"\n## {agora} — {objetivo}\n\n{decisoes.strip()}\n")
    return arq


def extrair_decisoes(texto: str) -> str:
    m = re.search(r"DECIS[ÕO]ES:?\s*(.+)", texto, re.S | re.I)
    return m.group(1) if m else texto[-1500:]


# ---------------------------------------------------------------- sessão

def executar(args) -> Path:
    nomes = {"claude": "Claude", "gpt": "GPT"}
    lider_id = args.lider
    critico_id = "gpt" if lider_id == "claude" else "claude"

    if args.simular:
        lider = chamar_simulado(nomes[lider_id])
        critico = chamar_simulado(nomes[critico_id])
    else:
        lider, critico = PROVEDORES[lider_id], PROVEDORES[critico_id]

    memoria = ler_memoria(args.projeto)
    contexto = f"PROJETO: {args.projeto}\n\n"
    contexto += f"MEMÓRIA DO PROJETO (decisões anteriores):\n{memoria}\n\n" if memoria else ""
    contexto += f"OBJETIVO DESTA SESSÃO:\n{args.objetivo}\n"

    log = [f"# Sessão — {args.projeto}\n", f"**Objetivo:** {args.objetivo}\n",
           f"**Líder:** {nomes[lider_id]} | **Crítico:** {nomes[critico_id]}\n"]

    def registrar(titulo: str, texto: str):
        print(f"\n{'=' * 70}\n{titulo}\n{'=' * 70}\n{texto}", flush=True)
        log.append(f"\n## {titulo}\n\n{texto}\n")

    proposta = lider(PAPEL_LIDER, contexto + "\nFaça a proposta inicial completa.")
    registrar(f"Proposta inicial ({nomes[lider_id]})", proposta)

    for rodada in range(1, args.rodadas + 1):
        critica = critico(PAPEL_CRITICO, f"{contexto}\nPROPOSTA ATUAL:\n{proposta}")
        registrar(f"Rodada {rodada} — crítica ({nomes[critico_id]})", critica)
        if "VEREDITO: APROVADO" in critica.upper():
            break
        proposta = lider(
            PAPEL_LIDER,
            f"{contexto}\nSUA PROPOSTA ATUAL:\n{proposta}\n\nCRÍTICAS DO REVISOR:\n{critica}\n\n"
            "Responda item a item e entregue a proposta revisada completa.",
        )
        registrar(f"Rodada {rodada} — revisão ({nomes[lider_id]})", proposta)

    final = lider(
        PAPEL_LIDER,
        f"{contexto}\nPROPOSTA APÓS O DEBATE:\n{proposta}\n\nÚLTIMA CRÍTICA:\n{critica}\n\n"
        "Escreva a VERSÃO FINAL consolidada e pronta para executar. Termine com uma seção\n"
        "'DECISÕES:' listando, em tópicos curtos, as decisões tomadas e pendências abertas.",
    )
    registrar("Versão final consolidada", final)

    PASTA_SESSOES.mkdir(exist_ok=True)
    carimbo = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    arq_sessao = PASTA_SESSOES / f"{carimbo}-{slug(args.projeto)}.md"
    arq_sessao.write_text("".join(log), encoding="utf-8")
    arq_mem = gravar_memoria(args.projeto, args.objetivo, extrair_decisoes(final))
    print(f"\nSessão salva em: {arq_sessao}\nMemória atualizada: {arq_mem}")
    return arq_sessao


def main():
    p = argparse.ArgumentParser(description="Claude + GPT desenvolvendo juntos um projeto.")
    p.add_argument("objetivo", help="O que as IAs devem resolver nesta sessão.")
    p.add_argument("-p", "--projeto", default="geral", help="Nome do projeto (define a memória usada).")
    p.add_argument("-l", "--lider", choices=["claude", "gpt"], default="claude",
                   help="Quem propõe; o outro critica (padrão: claude).")
    p.add_argument("-r", "--rodadas", type=int, default=2, help="Máximo de rodadas crítica/revisão.")
    p.add_argument("--simular", action="store_true", help="Testa o fluxo sem chamar as APIs.")
    args = p.parse_args()

    if not args.simular:
        faltando = [k for k in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY") if not os.getenv(k)]
        if faltando:
            sys.exit(f"Faltam variáveis de ambiente: {', '.join(faltando)} (veja .env.example)")
    executar(args)


if __name__ == "__main__":
    main()
