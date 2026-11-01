// Renderizador de Markdown mínimo e seguro: todo HTML vindo das IAs é escapado
// antes da formatação, então nada do texto delas vira código na página.
// Cobre o que as respostas usam: títulos, listas, tabelas, código, citações, links.

const escapar = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(t) {
  const codigos = [];
  t = t.replace(/`([^`]+)`/g, (_, c) => `\u0000${codigos.push(c) - 1}\u0000`);
  t = escapar(t)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/ {2}$/g, "<br>");
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapar(codigos[i])}</code>`);
}

const celulas = (linha) => linha.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function markdown(texto) {
  const linhas = String(texto || "").replace(/\r/g, "").split("\n");
  const html = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];

    if (/^```/.test(l)) {
      const bloco = [];
      for (i++; i < linhas.length && !/^```/.test(linhas[i]); i++) bloco.push(linhas[i]);
      html.push(`<pre><code>${escapar(bloco.join("\n"))}</code></pre>`);
      i++;
      continue;
    }
    const titulo = l.match(/^(#{1,4})\s+(.*)/);
    if (titulo) {
      const n = Math.min(titulo[1].length + 1, 5);
      html.push(`<h${n}>${inline(titulo[2])}</h${n}>`);
      i++;
      continue;
    }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) {
      html.push("<hr>");
      i++;
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(l) && /^\s*\|?\s*:?-{2,}/.test(linhas[i + 1] || "")) {
      const cab = celulas(l);
      const corpo = [];
      for (i += 2; i < linhas.length && /^\s*\|.*\|\s*$/.test(linhas[i]); i++) corpo.push(celulas(linhas[i]));
      html.push(
        "<div class=\"tabela\"><table><thead><tr>" + cab.map((c) => `<th>${inline(c)}</th>`).join("") +
          "</tr></thead><tbody>" + corpo.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") +
          "</tbody></table></div>",
      );
      continue;
    }
    if (/^>\s?/.test(l)) {
      const bloco = [];
      for (; i < linhas.length && /^>\s?/.test(linhas[i]); i++) bloco.push(linhas[i].replace(/^>\s?/, ""));
      html.push(`<blockquote>${markdown(bloco.join("\n"))}</blockquote>`);
      continue;
    }
    const item = l.match(/^\s*([-*+]|\d+[.)])\s+(.*)/);
    if (item) {
      const ordenada = /\d/.test(item[1]);
      const itens = [];
      for (; i < linhas.length; i++) {
        const m = linhas[i].match(/^\s*([-*+]|\d+[.)])\s+(.*)/);
        if (m) itens.push(inline(m[2]));
        else if (/^\s{2,}\S/.test(linhas[i]) && itens.length) itens[itens.length - 1] += "<br>" + inline(linhas[i].trim());
        else break;
      }
      const tag = ordenada ? "ol" : "ul";
      html.push(`<${tag}>${itens.map((x) => `<li>${x}</li>`).join("")}</${tag}>`);
      continue;
    }
    if (!l.trim()) {
      i++;
      continue;
    }
    const par = [];
    for (; i < linhas.length && linhas[i].trim() && !/^(#{1,4}\s|```|>|\s*([-*+]|\d+[.)])\s|\s*\|)/.test(linhas[i]); i++) {
      par.push(inline(linhas[i]));
    }
    if (!par.length) par.push(inline(linhas[i++]));
    html.push(`<p>${par.join("\n")}</p>`);
  }
  return html.join("\n");
}
