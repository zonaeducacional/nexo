const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const modalContent = document.querySelector('#modal-content');
const storageKey = 'nexo-v1';
const defaults = {
  fonte: 'Georgia',
  tamanho: 12,
  entrelinha: 1.6,
  margem: 18,
  linhas: 3,
  espaco: 8,
  cabecalho: 'Nexo',
  rodape: '',
  figuras: true,
};
const initial = () => ({
  respostas: {},
  colecoes: {},
  fichas: {},
  modelos: {},
});
let state;
try {
  state = { ...initial(), ...JSON.parse(localStorage.getItem(storageKey)) };
} catch {
  state = initial();
}
const persist = () => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    report(
      'Não foi possível salvar neste navegador. Use a cópia de segurança.',
    );
  }
};
const esc = (value = '') =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const normalize = (value) =>
  String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
const query = { busca: '', genero: '', ano: '', campo: '', ordem: 'acervo' };
let activeCollection = '';
let lastList = [];
let currentReading;
let solutionVisible = false;
let evidenceVisible = true;
let zoom = 1;
let readings;
let catalogReadings;
let complete;
const all = (id) => readings.find((r) => r.id === id);
const answers = (r) => state.respostas[r.id]?.valores ?? [];
const answered = (r) =>
  r.questoes.filter((_, i) => answers(r)[i]?.trim()).length;
const unlocked = (r) =>
  Boolean(
    state.respostas[r.id]?.enviada && complete(answered(r), r.questoes.length),
  );
const record = (r) => (state.fichas[r.id] ??= {});
const config = (r) => ({ ...defaults, ...state.fichas[r.id]?.formato });
const collection = () => state.colecoes[activeCollection];
const report = (value) => {
  const status = document.querySelector('#feedback');
  if (status) status.textContent = value;
};
const buttons = (html) => `<div class="actions">${html}</div>`;
const button = (text, action, css = 'quiet', attrs = '') =>
  `<button type="button" class="${css}" data-action="${action}" ${attrs}>${text}</button>`;

function dialog(title, html) {
  modalContent.innerHTML = `<h2 id="modal-title">${title}</h2>${html}${buttons(button('Fechar', 'close'))}`;
  if (!modal.open) modal.showModal();
}

function download(body, name, type) {
  const href = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 30000);
}

function sets(items, key) {
  return [...new Set(items.map((r) => r[key]))].sort((a, b) =>
    String(a).localeCompare(String(b), 'pt-BR'),
  );
}
function options(values, selected) {
  return values
    .map(
      ([value, label]) =>
        `<option value="${esc(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${esc(label)}</option>`,
    )
    .join('');
}

function filtered() {
  const pool =
    activeCollection && collection()
      ? collection().ids.map(all).filter(Boolean)
      : catalogReadings;
  const results = pool.filter(
    (r) =>
      (!query.genero || r.genero === query.genero) &&
      (!query.ano || r.ano === Number(query.ano)) &&
      (!query.campo || r.campo === query.campo) &&
      normalize(
        [r.id, r.titulo, r.genero, r.fonte?.credito, ...r.texto].join(' '),
      ).includes(normalize(query.busca)),
  );
  if (query.ordem === 'titulo')
    results.sort((a, b) => a.titulo.localeCompare(b.titulo, 'pt-BR'));
  if (query.ordem === 'ano') results.sort((a, b) => a.ano - b.ano);
  return results;
}

function cards() {
  lastList = filtered();
  document.querySelector('#result').textContent =
    `${lastList.length} ${lastList.length === 1 ? 'ficha' : 'fichas'}`;
  document.querySelector('#batch').disabled = !lastList.length;
  document.querySelector('#cards').innerHTML =
    lastList
      .map(
        (r) => `<article class="card">
    <div class="card-body"><p class="card-genre">${esc(r.genero)}</p><h2><a href="#ficha/${r.id}">${esc(r.titulo)}</a></h2>
    <p>${esc(r.campo)} · ${r.questoes.length} questões</p><div class="card-meta">
    <span>${r.ano}º ano · ${unlocked(r) ? 'Concluída' : r.id}</span>
    ${button('Salvar', 'save', 'quiet', `data-id="${r.id}" aria-label="Salvar ${esc(r.titulo)} em coleção"`)}
    </div></div></article>`,
      )
      .join('') || '<p class="empty">Nenhuma ficha encontrada.</p>';
}

function catalog() {
  if (!collection()) activeCollection = '';
  app.innerHTML = `
    <div class="section-head catalog-heading"><div><h1>${activeCollection ? esc(collection().nome) : 'Acervo de leitura'}</h1><p id="result" role="status"></p></div>
    ${buttons(`${activeCollection ? button('Voltar ao acervo', 'leave') : ''}${button('Imprimir lote', 'batch', 'quiet', 'id="batch"')}`)}</div>
    <div class="catalog-layout">
    <aside class="filters" aria-label="Filtros do acervo">
    <label>Buscar<input id="busca" type="search" placeholder="Título ou código" value="${esc(query.busca)}"></label>
    <label>Gênero<select id="genero">${options([['', 'Todos'], ...sets(catalogReadings, 'genero').map((x) => [x, x])], query.genero)}</select></label>
    <label>Campo<select id="campo">${options([['', 'Todos'], ...sets(catalogReadings, 'campo').map((x) => [x, x])], query.campo)}</select></label>
    <label>Ano sugerido<select id="ano">${options([['', 'Todos'], ...sets(catalogReadings, 'ano').map((x) => [x, x + 'º ano'])], query.ano)}</select></label>
    <label>Ordenar <select id="ordem">${options(
      [
        ['acervo', 'Ordem do acervo'],
        ['titulo', 'Título'],
        ['ano', 'Ano'],
      ],
      query.ordem,
    )}</select></label>
    <button type="button" data-action="clear">Limpar filtros</button>
    </aside>
    <div id="cards" class="grid"></div>
    </div>`;
  for (const key of Object.keys(query))
    document
      .getElementById(key)
      .addEventListener(key === 'busca' ? 'input' : 'change', (e) => {
        query[key] = e.target.value;
        cards();
      });
  cards();
}

function visual(r, interactive) {
  const v = r.visual;
  if (!v) return '';
  let html;
  if (v.tipo === 'tabela') {
    html = `<table class="data-table"><thead><tr>${v.cabecalho.map((x) => `<th scope="col">${esc(x)}</th>`).join('')}</tr></thead><tbody>
      ${v.dados.map((row) => `<tr>${row.map((x) => `<td>${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  } else if (v.tipo === 'imagem') {
    const imagePath = './fontes/' + encodeURIComponent(v.arquivo);
    html = `<div class="source-image"><img src="${imagePath}" alt="${esc(v.alt)}"></div>
      ${interactive ? button('Ampliar imagem', 'image-size', 'quiet screen-only', 'aria-pressed="false"') : ''}`;
  } else if (v.tipo === 'series') {
    const percent = (n) =>
      n.toLocaleString('pt-BR', { minimumFractionDigits: 1 }) + '%';
    html = `<div class="series-graph">${v.dados
      .map(
        ([label, ...values]) => `
      <div class="series-group"><strong>${esc(label)}</strong>
      ${values
        .map(
          (
            n,
            i,
          ) => `<div class="series-bar series-bar-${i}"><span>${esc(v.series[i])}</span>
      <meter min="0" max="${v.maximo}" value="${n}" aria-label="${esc(label + ', ' + v.series[i])}"></meter>
      <span>${percent(n)}</span></div>`,
        )
        .join('')}</div>`,
      )
      .join('')}</div>`;
  } else if (v.tipo === 'ciclo') {
    html = `<ol class="cycle">${v.dados.map(([, label]) => `<li>${esc(label)}</li>`).join('')}</ol>
      <p class="cycle-return">O ciclo retorna à fase dos ovos.</p>`;
  } else if (v.tipo === 'grafico') {
    html = `<div class="bars">${v.dados.map(([label, n]) => `<div class="barline"><span>${esc(label)}</span><meter aria-label="${esc(label)}" min="0" max="50" value="${n}"></meter><b>${n}</b></div>`).join('')}</div>`;
  } else if (v.tipo === 'arquivos') {
    html = `<ul class="files">${v.dados.map(([icon, label]) => `<li><span aria-hidden="true">${icon}</span> ${esc(label)}</li>`).join('')}</ul>`;
  } else if (v.tipo === 'charge') {
    html = `<div class="charge" role="img" aria-label="${esc(v.dados.map(([, label]) => label).join('. '))}">
      <span class="charge-sun" aria-hidden="true">☀</span><span class="charge-sign" aria-hidden="true">${esc(v.dados[0][1])}</span>
      <span class="charge-shadow" aria-hidden="true"></span><span class="charge-people" aria-hidden="true">♟♟</span></div>`;
  } else {
    html = `<div class="frames">${v.dados.map(([icon, label], i) => `<div class="frame"><b aria-hidden="true">${icon}</b><span>${v.tipo === 'etapas' && i > 0 ? '→ ' : ''}${esc(label)}</span></div>`).join('')}</div>`;
  }
  return `<figure class="visual">${v.titulo ? `<figcaption>${esc(v.titulo)}</figcaption>` : ''}${html}</figure>`;
}

function marked(p, r, show) {
  if (!show || !evidenceVisible) return esc(p);
  let cursor = 0;
  let html = '';
  const locations = r.questoes
    .flatMap((q, i) => {
      const start = q.trecho ? p.indexOf(q.trecho) : -1;
      return start < 0 ? [] : [{ start, length: q.trecho.length, i }];
    })
    .sort((a, b) => a.start - b.start);
  for (const loc of locations) {
    if (loc.start < cursor) continue;
    html +=
      esc(p.slice(cursor, loc.start)) +
      `<mark id="trecho-${r.id}-${loc.i}">${esc(p.slice(loc.start, loc.start + loc.length))}</mark>`;
    cursor = loc.start + loc.length;
  }
  return html + esc(p.slice(cursor));
}

function sourceNote(r) {
  const source = r.fonte;
  if (!source) return '';
  const link = (url, label) =>
    `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  return `<aside class="source-note" aria-label="Fonte da leitura">
    <p><strong>${esc(source.credito)}</strong></p>
    <p>${esc(source.nota)}</p>
    <details class="source-reference"><summary>Referência</summary>
    <div class="source-links">${link(source.url, 'Publicação original')}
    ${source.permissao ? link(source.permissao.url, source.permissao.nome) : ''}
    ${source.complemento ? link(source.complemento.url, source.complemento.titulo) : ''}</div></details>
    <span class="only-print source-url">${esc(source.url)}</span>
  </aside>`;
}

function relatedReadings(ids) {
  if (!ids?.length) return '';
  return `<p class="related-readings">${ids
    .map(all)
    .map(
      (item) =>
        `<a href="#ficha/${item.id}">Consultar ficha de ${esc(item.genero.toLowerCase())}</a>`,
    )
    .join(' · ')}</p>`;
}

function sheet(r, show, interactive) {
  const f = config(r);
  const c = state.fichas[r.id] ?? {};
  const size = Number(f.tamanho);
  const leading = Number(f.entrelinha);
  const font = f.fonte === 'Arial' ? 'Arial' : 'Georgia';
  const printLines = Array.from(
    { length: Number(f.linhas) },
    () => '<div></div>',
  ).join('');
  return `<article class="sheet ${interactive ? '' : 'batch-sheet'}" style="--reading-font:${font};--print-font:${size}pt;--reading-size:${(size / 12) * (interactive ? zoom : 1) * 1.12}rem;--reading-leading:${leading};--question-gap:${Number(f.espaco)}mm">
  <div class="print-header">${esc(f.cabecalho)} ${c.codigo ? ' · ' + esc(c.codigo) : ''}<div>Nome: ________________________________________ Data: ____/____/____</div></div>
  <p class="eyebrow">${esc(r.genero)} · ${r.ano}º ano · ${r.id}</p><h1>${esc(r.titulo)}</h1>
  ${sourceNote(r)}
  <div class="text">${r.texto.map((p) => `<p>${marked(p, r, show)}</p>`).join('')}</div>
  ${f.figuras ? visual(r, interactive) : ''}
  <section class="activity"><h2>${!interactive && show ? 'Gabarito comentado' : 'Atividade'}</h2>
  <form id="${interactive ? 'activity-form' : 'print-' + r.id}">
  ${r.questoes
    .map(
      (q, i) => `<div class="question">
  <label class="control" ${interactive ? `for="q-${i}"` : ''}><strong>${i + 1}. ${esc(q.enunciado)}</strong>
  ${interactive ? `<textarea id="q-${i}" data-question="${i}" rows="3" maxlength="5000" required ${unlocked(r) ? 'readonly' : ''} placeholder="Escreva sua resposta">${esc(answers(r)[i])}</textarea>` : ''}</label>
  ${interactive ? relatedReadings(q.leituras) : q.leituras ? `<p class="status">Leitura complementar: ${q.leituras.map((id) => esc(all(id).titulo)).join(', ')}</p>` : ''}
  <div class="print-lines" aria-hidden="true">${printLines}</div>
  ${
    show
      ? `<div class="answer"><strong>Resposta possível</strong><br>${esc(q.resposta)}
    ${interactive && q.trecho && evidenceVisible ? '<br>' + button('Ver no texto', 'evidence', 'quiet', `data-index="${i}"`) : ''}</div>`
      : ''
  }
  </div>`,
    )
    .join('')}
  ${
    interactive
      ? `<p class="status" id="progress" role="status"></p>${buttons(
          unlocked(r)
            ? button(
                solutionVisible ? 'Ocultar gabarito' : 'Ver gabarito',
                'solution',
                'primary',
              ) + button('Refazer atividade', 'retry')
            : '<button class="primary" id="submit" type="submit">Enviar respostas</button>',
        )}</form>`
      : '</form>'
  }
  </section><div class="print-footer">${esc(f.rodape)}</div></article>`;
}

const ranges = {
  tamanho: [10, 20, 1],
  entrelinha: [1.2, 2.2, 0.1],
  margem: [10, 28, 1],
  linhas: [0, 8, 1],
  espaco: [0, 20, 1],
};
function numberControl(f, key, label) {
  const [min, max, step] = ranges[key];
  return `<label class="control">${label}<input data-setting="${key}" value="${Number(f[key])}" type="number" min="${min}" max="${max}" step="${step}"></label>`;
}
function reader(r, retain = false) {
  currentReading = r;
  const baseList = r.arquivo
    ? readings.filter((item) => item.arquivo)
    : catalogReadings;
  const list = lastList.some((x) => x.id === r.id) ? lastList : baseList;
  const i = list.indexOf(r);
  const f = config(r);
  const offset = window.scrollY;
  app.innerHTML = `<div class="reader-nav"><a href="#catalogo">Voltar ao acervo</a>
    <div class="actions">${button('Ir às questões', 'questions')}${i > 0 ? `<a class="button" href="#ficha/${list[i - 1].id}">Anterior</a>` : ''}
    ${i < list.length - 1 ? `<a class="button" href="#ficha/${list[i + 1].id}">Próxima</a>` : ''}</div></div>
  <div class="reader-grid">
    ${sheet(r, unlocked(r) && solutionVisible, true)}
    <aside class="panel screen-only" aria-label="Opções da ficha"><h2>Ficha de leitura</h2>
      <p class="status">${unlocked(r) ? 'Atividade concluída.' : 'Envie todas as respostas para liberar o gabarito.'}</p>
      ${buttons(button('Imprimir ficha', 'print', 'primary') + button('Salvar em coleção', 'save', 'quiet', `data-id="${r.id}"`))}
      <details ${retain ? 'open' : ''}><summary>Formato da folha</summary>
        <label class="control">Fonte<select data-setting="fonte">${options(
          [
            ['Georgia', 'Georgia'],
            ['Arial', 'Arial'],
          ],
          f.fonte,
        )}</select></label>
        ${numberControl(f, 'tamanho', 'Tamanho da fonte (pt)')}
        ${numberControl(f, 'entrelinha', 'Entrelinhas')}
        ${numberControl(f, 'margem', 'Margens (mm)')}
        ${numberControl(f, 'linhas', 'Linhas de resposta')}
        ${numberControl(f, 'espaco', 'Espaço antes das questões (mm)')}
        <label class="control">Cabeçalho<input data-setting="cabecalho" maxlength="80" value="${esc(f.cabecalho)}"></label>
        <label class="control">Rodapé<input data-setting="rodape" maxlength="100" value="${esc(f.rodape)}"></label>
        <label class="control">Código da turma<input id="codigo" maxlength="30" value="${esc(state.fichas[r.id]?.codigo)}"></label>
        ${r.visual ? `<label><input type="checkbox" data-setting="figuras" ${f.figuras ? 'checked' : ''}> Mostrar recurso visual</label>` : ''}
        ${buttons(button('Restaurar formato', 'reset-layout'))}
      </details>
      <details><summary>Modelos e exportação</summary>
        <label class="control">Aplicar modelo<select id="modelo">${options([['', 'Escolha um modelo'], ['padrao', 'Padrão Nexo'], ...Object.keys(state.modelos).map((k) => [k, state.modelos[k].nome])], '')}</select></label>
        ${buttons(button('Salvar como modelo', 'template') + button('Gerenciar modelos', 'manage-templates'))}
        ${buttons(button('Baixar Typst', 'typst') + (unlocked(r) ? button('Typst com gabarito', 'typst-answer') + button('Imprimir gabarito', 'print-answer') : ''))}
      </details>
      <details><summary>Visualização</summary>
        ${buttons(button('−', 'zoom-out', 'quiet', 'aria-label="Diminuir zoom"') + button(Math.round(zoom * 100) + '%', 'zoom-reset', 'quiet', 'aria-label="Restaurar zoom"') + button('+', 'zoom-in', 'quiet', 'aria-label="Ampliar zoom"'))}
        ${unlocked(r) ? `<label><input id="evidence-toggle" type="checkbox" ${evidenceVisible ? 'checked' : ''}> Destacar trechos no gabarito</label>` : ''}
      </details><p id="feedback" class="toast" role="status"></p>
    </aside></div>`;
  function progress() {
    const count = answered(r);
    document.querySelector('#progress').textContent = unlocked(r)
      ? 'Respostas enviadas'
      : `${count} de ${r.questoes.length} respondidas`;
    const submit = document.querySelector('#submit');
    if (submit) submit.disabled = !complete(count, r.questoes.length);
  }
  app.querySelectorAll('[data-question]').forEach((input) =>
    input.addEventListener('input', () => {
      const attempt = (state.respostas[r.id] ??= {
        valores: [],
        enviada: false,
      });
      attempt.valores[Number(input.dataset.question)] = input.value;
      persist();
      progress();
    }),
  );
  app.querySelector('#activity-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (unlocked(r) || !complete(answered(r), r.questoes.length)) return;
    state.respostas[r.id].enviada = true;
    solutionVisible = true;
    persist();
    reader(r, true);
    app.querySelector('[data-action="solution"]').focus();
  });
  app.querySelectorAll('[data-setting]').forEach((input) =>
    input.addEventListener('change', () => {
      if (!input.checkValidity()) {
        input.reportValidity();
        return;
      }
      const value =
        input.type === 'number'
          ? input.valueAsNumber
          : input.type === 'checkbox'
            ? input.checked
            : input.value;
      if (input.type === 'number' && !Number.isFinite(value)) return;
      record(r).formato = { ...config(r), [input.dataset.setting]: value };
      persist();
      reader(r, true);
      app
        .querySelector(`[data-setting="${input.dataset.setting}"]`)
        .focus({ preventScroll: true });
    }),
  );
  app.querySelector('#codigo').addEventListener('input', (e) => {
    record(r).codigo = e.target.value;
    persist();
  });
  app.querySelector('#modelo').addEventListener('change', (e) => {
    if (!e.target.value) return;
    record(r).formato = {
      ...(state.modelos[e.target.value]?.formato ?? defaults),
    };
    persist();
    reader(r, true);
    report('Modelo aplicado.');
  });
  app.querySelector('#evidence-toggle')?.addEventListener('change', (e) => {
    evidenceVisible = e.target.checked;
    reader(r, true);
  });
  progress();
  if (retain) window.scrollTo(0, offset);
}

function collections() {
  app.innerHTML = `<section class="section-head"><div><h1>Coleções</h1><p>Organize fichas para estudar ou imprimir em conjunto.</p></div>
    ${button('Nova coleção', 'new-collection', 'primary')}</section>
    <div class="empty"><div class="collection-list">${
      Object.entries(state.colecoes)
        .map(
          ([key, c]) => `<div class="collection-row">
    <strong>${esc(c.nome)}</strong><span>${c.ids.length} fichas</span>
    ${buttons(button('Abrir', 'open-collection', 'quiet', `data-key="${key}"`) + button('Organizar', 'edit-collection', 'quiet', `data-key="${key}"`))}
    </div>`,
        )
        .join('') || '<p>Você ainda não tem coleções.</p>'
    }</div></div>
    <section class="section-head"><h2>Cópia de segurança</h2></section>
    ${buttons(button('Exportar dados', 'backup') + button('Restaurar de arquivo', 'restore'))}
    <input id="restore-file" type="file" accept="application/json,.json" hidden><p id="feedback" class="toast" role="status"></p>`;
  app.querySelector('#restore-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error('Arquivo muito grande');
      const restored = restoreState(JSON.parse(await file.text()));
      dialog(
        'Restaurar dados',
        `<p>O arquivo substituirá as respostas, coleções, fichas e modelos deste dispositivo.</p>${buttons(button('Confirmar restauração', 'confirm-restore', 'primary'))}`,
      );
      modal.querySelector('[data-action="confirm-restore"]').addEventListener(
        'click',
        () => {
          state = restored;
          persist();
          modal.close();
          collections();
          report('Cópia restaurada.');
        },
        { once: true },
      );
    } catch {
      report('O arquivo não é uma cópia de segurança válida do Nexo.');
    }
  });
}

function restoreState(data) {
  if (data.versao !== 1) throw new Error('Versão incompatível');
  const next = initial();
  const limited = (value, max) =>
    typeof value === 'string' ? value.slice(0, max) : '';
  const format = (value) => {
    const f = { ...defaults };
    for (const [key, [min, max]] of Object.entries(ranges)) {
      if (
        typeof value?.[key] === 'number' &&
        value[key] >= min &&
        value[key] <= max
      )
        f[key] = value[key];
    }
    f.fonte = value?.fonte === 'Arial' ? 'Arial' : 'Georgia';
    f.figuras = value?.figuras !== false;
    if (typeof value?.cabecalho === 'string')
      f.cabecalho = limited(value.cabecalho, 80);
    f.rodape = limited(value?.rodape, 100);
    return f;
  };
  for (const r of readings) {
    const attempt = data.respostas?.[r.id];
    if (Array.isArray(attempt?.valores))
      next.respostas[r.id] = {
        valores: r.questoes.map((_, i) => limited(attempt.valores[i], 5000)),
        enviada: attempt.enviada === true,
      };
    const ficha = data.fichas?.[r.id];
    if (ficha)
      next.fichas[r.id] = {
        codigo: limited(ficha.codigo, 30),
        formato: format(ficha.formato),
      };
  }
  for (const [key, c] of Object.entries(data.colecoes ?? {})) {
    if (
      /^[a-z0-9-]+$/.test(key) &&
      !Object.hasOwn(Object.prototype, key) &&
      limited(c?.nome, 60) &&
      Array.isArray(c?.ids)
    ) {
      next.colecoes[key] = {
        nome: limited(c.nome, 60),
        ids: [...new Set(c.ids.filter(all))],
      };
    }
  }
  for (const [key, m] of Object.entries(data.modelos ?? {})) {
    if (
      /^[a-z0-9-]+$/.test(key) &&
      key !== 'padrao' &&
      !Object.hasOwn(Object.prototype, key) &&
      limited(m?.nome, 60)
    ) {
      next.modelos[key] = {
        nome: limited(m.nome, 60),
        formato: format(m.formato),
      };
    }
  }
  return next;
}

function namedDialog(title, label, fn) {
  dialog(
    title,
    `<form id="name-form"><label class="control">${label}<input name="nome" maxlength="60" required autofocus></label>
  ${buttons('<button class="primary" type="submit">Salvar</button>')}</form>`,
  );
  modal.querySelector('#name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const value = new FormData(e.target).get('nome').trim();
    if (!value) return;
    modal.close();
    fn(value);
  });
}

function newCollection(id) {
  namedDialog('Nova coleção', 'Nome da coleção', (name) => {
    const key = 'c-' + Date.now().toString(36);
    state.colecoes[key] = { nome: name, ids: id ? [id] : [] };
    persist();
    if (location.hash === '#colecoes') collections();
    else if (currentReading) report('Ficha adicionada à coleção.');
  });
}
function editCollection(key) {
  const c = state.colecoes[key];
  if (!c) return;
  dialog(
    esc(c.nome),
    `<div class="collection-list">${
      c.ids
        .map(
          (id, i) => `<div class="collection-row">
    <span>${esc(all(id).titulo)}</span>${buttons(
      button(
        'Subir',
        'move',
        'quiet',
        `data-key="${key}" data-id="${id}" data-delta="-1" ${i === 0 ? 'disabled' : ''}`,
      ) +
        button(
          'Descer',
          'move',
          'quiet',
          `data-key="${key}" data-id="${id}" data-delta="1" ${i === c.ids.length - 1 ? 'disabled' : ''}`,
        ) +
        button(
          'Remover',
          'remove',
          'quiet',
          `data-key="${key}" data-id="${id}"`,
        ),
    )}</div>`,
        )
        .join('') || '<p>Coleção vazia.</p>'
    }</div>
    ${buttons(button('Adicionar fichas', 'add-many', 'primary', `data-key="${key}"`))}`,
  );
}

function printSheet(items, show) {
  const printable = show ? items.filter(unlocked) : items;
  if (!printable.length) return;
  const style = document.createElement('style');
  style.media = 'print';
  style.textContent = `@page { size: A4; margin: ${items.length === 1 ? Number(config(items[0]).margem) : defaults.margem}mm; }`;
  const container = document.createElement('div');
  container.className =
    'only-print ' + (show ? 'answer-print' : 'student-print');
  container.innerHTML = printable.map((r) => sheet(r, show, false)).join('');
  const hide = document.createElement('style');
  hide.media = 'print';
  hide.textContent = '#app { display:none !important }';
  document.head.append(style, hide);
  document.body.append(container);
  const cleanup = () => {
    container.remove();
    style.remove();
    hide.remove();
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
}

function typst(r, show) {
  if (show && !unlocked(r)) return;
  const f = config(r);
  const str = (value) => JSON.stringify(String(value ?? ''));
  const segments = [
    '#set document(title: ' + str(r.titulo) + ', author: "Nexo")',
    '#set page(paper: "a4", margin: ' + f.margem + 'mm)',
    '#set text(lang: "pt", region: "BR", font: ' +
      str(f.fonte === 'Arial' ? 'Libertinus Sans' : 'Libertinus Serif') +
      ', size: ' +
      f.tamanho +
      'pt)',
    '#set par(leading: ' + Math.max(0.15, f.entrelinha - 1).toFixed(2) + 'em)',
    '#align(left)[#text(' +
      str(
        [f.cabecalho, state.fichas[r.id]?.codigo].filter(Boolean).join(' · '),
      ) +
      ')]',
    '#text("Nome: ________________________________________  Data: ____/____/____")',
    '#heading(level: 1, text(' + str(r.titulo) + '))',
    '#text(' + str(r.genero + ' · ' + r.ano + 'º ano · ' + r.id) + ')',
    ...(r.fonte
      ? [
          '#text(' + str(r.fonte.credito) + ')',
          '#emph(text(' + str(r.fonte.nota) + '))',
          '#link(' + str(r.fonte.url) + ')[Material original]',
          '#text(' + str(r.fonte.url) + ')',
        ]
      : []),
    ...r.texto.map((p) =>
      p
        .split('\n')
        .map((line) => '#text(' + str(line) + ')')
        .join(' #linebreak() '),
    ),
  ];
  if (f.figuras && r.visual) {
    const { tipo, titulo, cabecalho, dados, series, alt } = r.visual;
    if (titulo) segments.push('#strong(text(' + str(titulo) + '))');
    if (tipo === 'imagem') {
      segments.push('#text(' + str(alt) + ')');
    } else if (tipo === 'tabela' || tipo === 'series') {
      const headers = cabecalho ?? ['Faixa etária', ...series];
      const rows =
        tipo === 'series'
          ? dados.map(([label, ...values]) => [
              label,
              ...values.map((n) => n.toLocaleString('pt-BR') + '%'),
            ])
          : dados;
      const cells = [...headers, ...rows.flat()].map(
        (x) => 'text(' + str(x) + ')',
      );
      segments.push(
        '#table(columns: ' + headers.length + ', ' + cells.join(', ') + ')',
      );
    } else if (tipo === 'grafico') {
      for (const [label, n] of dados)
        segments.push(
          '#text(' +
            str(label) +
            ') #rect(width: ' +
            n * 2 +
            'mm, height: 3mm, fill: rgb("#45785c")) #text(' +
            str(n) +
            ')',
        );
    } else {
      for (const [i, [, label]] of dados.entries())
        segments.push('#text(' + str(i + 1 + '. ' + label) + ')');
    }
  }
  segments.push(
    '#v(' + f.espaco + 'mm)',
    '#heading(level: 2, text(' +
      str(show ? 'Gabarito comentado' : 'Atividade') +
      '))',
  );
  r.questoes.forEach((q, i) => {
    segments.push('#strong(text(' + str(i + 1 + '. ' + q.enunciado) + '))');
    for (const id of q.leituras ?? []) {
      const related = all(id);
      segments.push(
        '#link(' +
          str(related.fonte.url) +
          ', text(' +
          str('Leitura complementar: ' + related.titulo) +
          '))',
      );
    }
    if (show) {
      segments.push('#text(' + str('Resposta possível: ' + q.resposta) + ')');
      if (q.trecho)
        segments.push(
          '#emph(text(' + str('Trecho de apoio: ' + q.trecho) + '))',
        );
    } else {
      for (let n = 0; n < f.linhas; n++)
        segments.push('#v(3mm) #line(length: 100%, stroke: .4pt)');
    }
  });
  if (f.rodape) segments.push('#text(' + str(f.rodape) + ')');
  download(
    segments.join('\n\n') + '\n',
    `nexo-${r.id.toLowerCase()}${show ? '-gabarito' : ''}.typ`,
    'text/plain;charset=utf-8',
  );
}

function route() {
  if (!readings || !complete) return;
  const hash = location.hash || '#catalogo';
  document
    .querySelector('#nav-catalogo')
    .toggleAttribute('aria-current', hash !== '#colecoes');
  document
    .querySelector('#nav-colecoes')
    .toggleAttribute('aria-current', hash === '#colecoes');
  const id = hash.startsWith('#ficha/') ? hash.slice(7) : '';
  const r = all(id);
  solutionVisible = Boolean(r && unlocked(r));
  currentReading = undefined;
  if (r) reader(r);
  else if (hash === '#colecoes') collections();
  else catalog();
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

document.querySelector('#ajuda').addEventListener('click', () =>
  dialog(
    'Como usar o Nexo',
    `
  <p>Busque uma ficha por título, gênero ou código. Use os filtros para encontrar leituras por ano e campo de atuação.</p>
  <p>Leia o material na ficha. Os créditos ficam no início da leitura. Algumas questões pedem a comparação com outra ficha do acervo.</p>
  <p>Escreva todas as respostas e selecione <strong>Enviar respostas</strong> para abrir o gabarito comentado. Os trechos destacados ajudam a conferir algumas respostas.</p>
  <p>Imprima uma ficha ou um lote. No navegador, escolha <strong>Salvar como PDF</strong> no diálogo de impressão. No visor também é possível baixar a fonte Typst para editar e compilar.</p>
  <p>As respostas, coleções e preferências ficam neste dispositivo. Exporte uma cópia de segurança em Coleções.</p>
  <p><a target="_blank" rel="noopener" href="https://www.gov.br/mec/pt-br/escola-em-tempo-integral/BNCC_EI_EF_110518_versaofinal.pdf">Consultar a BNCC</a> · <a target="_blank" rel="noopener" href="https://github.com/zonaeducacional/nexo/blob/main/ALINHAMENTO.md">Alinhamento pedagógico para docentes</a></p>`,
  ),
);

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('button[data-action]');
  if (!trigger) return;
  const { action, id, key, index, delta } = trigger.dataset;
  const r = currentReading;
  switch (action) {
    case 'questions':
      app.querySelector('#q-0').focus();
      break;
    case 'image-size': {
      const image = trigger.closest('figure').querySelector('.source-image');
      const expanded = image.classList.toggle('source-image-expanded');
      trigger.textContent = expanded ? 'Reduzir imagem' : 'Ampliar imagem';
      trigger.setAttribute('aria-pressed', String(expanded));
      image.tabIndex = expanded ? 0 : -1;
      if (expanded) image.focus();
      break;
    }
    case 'close':
      modal.close();
      break;
    case 'clear':
      Object.assign(query, {
        busca: '',
        genero: '',
        ano: '',
        campo: '',
        ordem: 'acervo',
      });
      catalog();
      break;
    case 'leave':
      activeCollection = '';
      Object.assign(query, {
        busca: '',
        genero: '',
        ano: '',
        campo: '',
        ordem: 'acervo',
      });
      catalog();
      break;
    case 'new-collection':
      newCollection();
      break;
    case 'open-collection':
      activeCollection = key;
      Object.assign(query, {
        busca: '',
        genero: '',
        ano: '',
        campo: '',
        ordem: 'acervo',
      });
      location.hash = '#catalogo';
      break;
    case 'edit-collection':
      editCollection(key);
      break;
    case 'save':
      dialog(
        'Salvar em coleção',
        `<div class="dialog-list">${Object.entries(state.colecoes)
          .map(([k, c]) =>
            button(
              esc(c.nome),
              'add-one',
              'quiet',
              `data-key="${k}" data-id="${id}" ${c.ids.includes(id) ? 'disabled' : ''}`,
            ),
          )
          .join('')}</div>
      ${buttons(button('Nova coleção', 'new-with-reading', 'primary', `data-id="${id}"`))}`,
      );
      break;
    case 'new-with-reading':
      newCollection(id);
      break;
    case 'add-one':
      if (!state.colecoes[key].ids.includes(id))
        state.colecoes[key].ids.push(id);
      persist();
      modal.close();
      report('Ficha adicionada à coleção.');
      break;
    case 'add-many': {
      const c = state.colecoes[key];
      dialog(
        'Adicionar fichas',
        `<form id="add-many-form"><div class="dialog-list">${catalogReadings.map((item) => `<label><input type="checkbox" name="id" value="${item.id}" ${c.ids.includes(item.id) ? 'checked disabled' : ''}>${esc(item.titulo)}</label>`).join('')}</div>${buttons('<button class="primary" type="submit">Adicionar</button>')}</form>`,
      );
      modal.querySelector('form').addEventListener('submit', (evt) => {
        evt.preventDefault();
        c.ids.push(...new FormData(evt.target).getAll('id'));
        persist();
        collections();
        editCollection(key);
      });
      break;
    }
    case 'move': {
      const ids = state.colecoes[key].ids;
      const i = ids.indexOf(id);
      const to = i + Number(delta);
      if (i >= 0 && to >= 0 && to < ids.length)
        [ids[i], ids[to]] = [ids[to], ids[i]];
      persist();
      editCollection(key);
      break;
    }
    case 'remove': {
      const c = state.colecoes[key];
      c.ids = c.ids.filter((value) => value !== id);
      persist();
      collections();
      editCollection(key);
      break;
    }
    case 'backup':
      download(
        JSON.stringify({ versao: 1, ...state }, null, 2),
        'nexo-copia.json',
        'application/json',
      );
      break;
    case 'restore':
      app.querySelector('#restore-file').click();
      break;
    case 'solution':
      solutionVisible = unlocked(r) && !solutionVisible;
      reader(r, true);
      app
        .querySelector('[data-action="solution"]')
        .focus({ preventScroll: true });
      break;
    case 'evidence': {
      const mark = document.getElementById(`trecho-${r.id}-${index}`);
      document
        .querySelector('.active-evidence')
        ?.classList.remove('active-evidence');
      mark?.classList.add('active-evidence');
      mark?.scrollIntoView({ block: 'center' });
      break;
    }
    case 'retry':
      dialog(
        'Refazer atividade',
        '<p>As respostas desta ficha serão apagadas e o gabarito ficará bloqueado até o próximo envio.</p>' +
          buttons(button('Refazer', 'confirm-retry', 'primary')),
      );
      break;
    case 'confirm-retry':
      delete state.respostas[r.id];
      solutionVisible = false;
      persist();
      modal.close();
      reader(r, true);
      app.querySelector('#q-0').focus();
      break;
    case 'reset-layout':
      record(r).formato = { ...defaults };
      persist();
      reader(r, true);
      break;
    case 'template':
      namedDialog('Salvar modelo', 'Nome do modelo', (nome) => {
        state.modelos['m-' + Date.now().toString(36)] = {
          nome,
          formato: config(r),
        };
        persist();
        reader(r, true);
        report('Modelo salvo.');
      });
      break;
    case 'manage-templates':
      dialog(
        'Gerenciar modelos',
        Object.entries(state.modelos)
          .map(
            ([k, m]) =>
              `<div class="collection-row">${esc(m.nome)}${button('Excluir modelo', 'remove-template', 'quiet', `data-key="${k}"`)}</div>`,
          )
          .join('') || '<p>Nenhum modelo salvo.</p>',
      );
      break;
    case 'remove-template':
      delete state.modelos[key];
      persist();
      modal.close();
      reader(r, true);
      report('Modelo excluído.');
      break;
    case 'zoom-out':
      zoom = Math.max(0.7, zoom - 0.1);
      reader(r, true);
      break;
    case 'zoom-in':
      zoom = Math.min(2, zoom + 0.1);
      reader(r, true);
      break;
    case 'zoom-reset':
      zoom = 1;
      reader(r, true);
      break;
    case 'typst':
      typst(r, false);
      break;
    case 'typst-answer':
      typst(r, true);
      break;
    case 'print':
      printSheet([r], false);
      break;
    case 'print-answer':
      printSheet([r], true);
      break;
    case 'batch': {
      dialog(
        'Imprimir lote',
        `<form id="batch-form"><div class="dialog-list">${lastList.map((item) => `<label><input name="id" type="checkbox" value="${item.id}" checked>${esc(item.titulo)}${unlocked(item) ? ' · concluída' : ''}</label>`).join('')}</div>
      ${buttons('<button class="primary" type="submit" name="modo" value="fichas">Imprimir fichas</button><button type="submit" name="modo" value="gabaritos">Gabaritos concluídos</button>')}
      <p class="status" id="batch-feedback" role="status"></p></form>`,
      );
      modal.querySelector('form').addEventListener('submit', (evt) => {
        evt.preventDefault();
        const selected = new FormData(evt.target).getAll('id').map(all);
        const show = evt.submitter?.value === 'gabaritos';
        if (!selected.length || (show && !selected.some(unlocked))) {
          modal.querySelector('#batch-feedback').textContent = show
            ? 'Selecione uma ficha concluída.'
            : 'Selecione pelo menos uma ficha.';
          return;
        }
        modal.close();
        printSheet(selected, show);
      });
      break;
    }
    default:
      break;
  }
});

try {
  const [acervo, wasm] = await Promise.all([
    fetch('./acervo.json'),
    fetch('./nexo_engine.wasm'),
  ]);
  if (!acervo.ok || !wasm.ok)
    throw new Error('Recursos do acervo indisponíveis');
  readings = await acervo.json();
  catalogReadings = readings.filter((r) => !r.arquivo);
  const { instance } = await WebAssembly.instantiate(await wasm.arrayBuffer());
  complete = instance.exports.atividade_completa;
  route();
} catch (error) {
  app.innerHTML =
    '<p class="empty" role="alert">Não foi possível abrir o acervo. Recarregue a página para tentar novamente.</p>';
  console.error(error);
}
