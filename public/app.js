// Front-end do site. Conversa somente com as rotas /api/* do Worker,
// entao nenhuma chave de Nvidia ou Supabase chega ao navegador.

const $ = (id) => document.getElementById(id);

async function api(path, options) {
  const response = await fetch(path, options);
  let data = null;
  try {
    data = await response.json();
  } catch {
    // resposta sem JSON: tratada abaixo pelo status
  }
  if (!response.ok) {
    throw new Error(data?.error ?? `Falha na requisição (HTTP ${response.status}).`);
  }
  return data;
}

function setOutput(element, text, state) {
  element.textContent = text;
  if (state) element.dataset.state = state;
  else delete element.dataset.state;
}

async function submitting(button, run) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Aguarde...';
  try {
    await run();
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

// --- Nome 10 vezes: a lista ja esta no HTML; aqui so confirmamos pelo Worker ---
async function confirmarNomes() {
  const lista = $('lista-nomes');
  const origem = $('nomes-origem');
  try {
    const data = await api('/api/name');
    lista.replaceChildren(
      ...data.list.map((nome) => {
        const li = document.createElement('li');
        li.textContent = nome;
        return li;
      }),
    );
    origem.textContent = `${data.repetitions} vezes, servidas pelo Worker em /api/name.`;
  } catch {
    origem.textContent = 'Lista fixa no HTML (o Worker nao respondeu em /api/name).';
  }
}

// --- Assistente: Nvidia LLM API ---
function montarChat() {
  const form = $('chat-form');
  const campo = $('chat-prompt');
  const saida = $('chat-resposta');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const prompt = campo.value.trim();
    if (!prompt) return;

    submitting(form.querySelector('button'), async () => {
      setOutput(saida, 'Consultando o modelo...', null);
      try {
        const data = await api('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        setOutput(saida, `${data.content}\n\n— ${data.model}`, 'ok');
      } catch (error) {
        setOutput(saida, error.message, 'error');
      }
    });
  });
}

// --- Mural: Supabase ---
function formatarData(valor) {
  if (!valor) return '';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleString('pt-BR');
}

async function carregarMural() {
  const lista = $('mural-lista');
  const aviso = $('mural-aviso');
  try {
    const data = await api('/api/messages');
    lista.replaceChildren(
      ...data.messages.map((msg) => {
        const li = document.createElement('li');
        const meta = document.createElement('span');
        meta.className = 'meta';
        meta.textContent = [msg.author || 'anônimo', formatarData(msg.created_at)]
          .filter(Boolean)
          .join(' · ');
        const corpo = document.createElement('span');
        corpo.textContent = msg.content ?? '';
        li.append(meta, corpo);
        return li;
      }),
    );
    if (data.messages.length === 0) setOutput(aviso, 'Nenhuma mensagem ainda.', null);
    else setOutput(aviso, '', null);
  } catch (error) {
    lista.replaceChildren();
    setOutput(aviso, error.message, 'error');
  }
}

function montarMural() {
  const form = $('mural-form');
  const autor = $('mural-autor');
  const conteudo = $('mural-conteudo');
  const aviso = $('mural-aviso');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const content = conteudo.value.trim();
    if (!content) return;

    submitting(form.querySelector('button'), async () => {
      setOutput(aviso, 'Enviando...', null);
      try {
        await api('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ author: autor.value.trim(), content }),
        });
        conteudo.value = '';
        await carregarMural();
      } catch (error) {
        setOutput(aviso, error.message, 'error');
      }
    });
  });
}

// --- Estado das integracoes ---
async function carregarStatus() {
  const alvos = {
    nvidia: { dot: $('status-nvidia-dot'), text: $('status-nvidia') },
    supabase: { dot: $('status-supabase-dot'), text: $('status-supabase') },
  };

  try {
    const data = await api('/api/health');
    for (const [chave, alvo] of Object.entries(alvos)) {
      const info = data.integrations[chave];
      alvo.dot.dataset.state = info.configured ? 'on' : 'off';
      alvo.text.textContent = info.configured
        ? `pronto${info.model ? ` · ${info.model}` : ''}`
        : 'sem credenciais';
    }
  } catch {
    for (const alvo of Object.values(alvos)) {
      alvo.dot.dataset.state = 'error';
      alvo.text.textContent = 'Worker indisponível';
    }
  }
}

confirmarNomes();
montarChat();
montarMural();
carregarMural();
carregarStatus();
