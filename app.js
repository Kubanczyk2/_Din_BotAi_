const $ = (s) => document.querySelector(s);
let mode = null;
let engine = null;
let cpuGenerator = null;
let offlineBackend = null;
let loadingOffline = false;
let current = [];
let chats = JSON.parse(localStorage.getItem('furia_chats') || '[]');
const messages = $('#messages');
const promptBox = $('#prompt');
const MODEL = 'Qwen2-1.5B-Instruct-q4f16_1-MLC';
const SYSTEM_PROMPT = 'Jesteś FURIA, polskim asystentem DIN_BOT AI. Odpowiadaj po polsku, jasno, konkretnie i pomocnie.';

function render() {
  messages.innerHTML = '';
  if (!current.length) {
    messages.innerHTML = '<div class="welcome"><div class="big-logo">F</div><h1>Witaj. Jestem <span>FURIA</span>.</h1><p>Twój asystent DIN_BOT AI. Napisz, w czym mogę pomóc.</p><div class="hint">Wybierz ONLINE albo uruchom model OFFLINE.</div></div>';
    return;
  }
  for (const m of current) {
    const d = document.createElement('div'); d.className = 'msg ' + (m.role === 'user' ? 'user' : 'bot');
    const who = document.createElement('div'); who.className = 'who'; who.textContent = m.role === 'user' ? 'TY' : 'FURIA';
    const body = document.createElement('div'); body.textContent = m.content;
    d.append(who, body); messages.append(d);
  }
  messages.scrollTop = messages.scrollHeight;
}
function save() {
  if (!current.length) return;
  chats.unshift({ id: Date.now(), title: current.find(x => x.role === 'user')?.content.slice(0, 38) || 'Nowa rozmowa', messages: current });
  chats = chats.slice(0, 30); localStorage.setItem('furia_chats', JSON.stringify(chats)); historyRender();
}
function historyRender() {
  $('#history').innerHTML = '';
  chats.forEach(c => { const b = document.createElement('button'); b.textContent = c.title; b.onclick = () => { current = c.messages; render(); }; $('#history').append(b); });
}
function setMode(m) {
  mode = m;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  $('#modeInfo').textContent = m === 'online' ? 'AI w chmurze — wymaga internetu.' : 'Lokalny model AI na tym urządzeniu.';
  $('#status').textContent = m === 'online' ? 'TRYB ONLINE' : (engine ? 'OFFLINE — MODEL GOTOWY' : 'TRYB OFFLINE');
  $('#modeChooser').classList.add('hidden');
  $('#send').disabled = m === 'offline' && !engine && !cpuGenerator;
}

async function loadCpuOffline() {
  $('#progress').textContent = 'Uruchamiam tryb zgodności OFFLINE na procesorze (WASM). Pierwsze pobranie wymaga internetu.';
  const { pipeline, env } = await import('https://esm.run/@huggingface/transformers');
  // Transformers.js stores downloaded model files in the browser cache.
  if (env) {
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = true;
  }
  cpuGenerator = await pipeline('text-generation', 'onnx-community/Qwen3-0.6B-ONNX', {
    device: 'wasm',
    dtype: 'q4',
    progress_callback: p => {
      const detail = p.file ? ` — ${p.file}` : '';
      const pct = Number.isFinite(p.progress) ? ` ${Math.round(p.progress)}%` : '';
      $('#progress').textContent = (p.status || 'Pobieranie modelu CPU') + pct + detail;
    }
  });
  offlineBackend = 'wasm';
  $('#progress').textContent = 'Gotowe. FURIA działa OFFLINE na procesorze (WASM). Odpowiedzi mogą być wolniejsze niż na GPU.';
  $('#status').textContent = 'OFFLINE — CPU/WASM GOTOWE';
  $('#send').disabled = false;
  return true;
}

async function loadOffline() {
  setMode('offline');
  if (engine || cpuGenerator) { $('#progress').textContent = offlineBackend === 'wasm' ? 'Model CPU/WASM jest gotowy. Możesz rozmawiać bez internetu.' : 'Model GPU jest gotowy. Możesz rozmawiać bez internetu.'; return true; }
  if (loadingOffline) return false;
  loadingOffline = true;
  $('#loadModel').disabled = true; $('#chooseOffline').disabled = true; $('#send').disabled = true;
  try {
    if ('serviceWorker' in navigator) {
      try { await navigator.serviceWorker.ready; } catch (_) {}
    }

    // WebLLM needs 32 KB of workgroup storage. If this browser exposes less,
    // skip WebLLM and use the CPU/WASM backend instead of throwing the GPU error.
    let adapter = null;
    try { if (navigator.gpu) adapter = await navigator.gpu.requestAdapter(); } catch (_) {}
    const gpuLimit = adapter?.limits?.maxComputeWorkgroupStorageSize || 0;
    if (gpuLimit >= 32768) {
      try {
        $('#progress').textContent = 'Uruchamiam model GPU…';
        const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm');
        engine = await CreateMLCEngine(MODEL, {
          initProgressCallback: p => { $('#progress').textContent = p.text || 'Przygotowywanie modelu GPU…'; }
        });
        offlineBackend = 'webllm';
        $('#progress').textContent = 'Gotowe. Model GPU jest zapisany w pamięci przeglądarki i może działać bez internetu.';
        $('#status').textContent = 'OFFLINE — GPU GOTOWE';
        $('#send').disabled = false;
        return true;
      } catch (gpuError) {
        $('#progress').textContent = 'GPU nie wystartowało. Przechodzę na zgodny tryb CPU/WASM…';
        engine = null;
      }
    } else {
      $('#progress').textContent = `Przeglądarka udostępnia ${gpuLimit ? Math.round(gpuLimit / 1024) + ' KB' : 'brak WebGPU'}, a WebLLM wymaga 32 KB. Przechodzę na tryb CPU/WASM…`;
    }

    return await loadCpuOffline();
  } catch (e) {
    $('#progress').textContent = 'Nie udało się uruchomić OFFLINE: ' + (e?.message || e) + (navigator.onLine ? ' Sprawdź połączenie i wolne miejsce, a następnie spróbuj ponownie.' : ' Połącz się z internetem, aby pobrać silnik i model po raz pierwszy.');
    $('#status').textContent = 'OFFLINE — BŁĄD URUCHOMIENIA';
    engine = null; cpuGenerator = null; offlineBackend = null;
    return false;
  } finally {
    loadingOffline = false;
    $('#loadModel').disabled = false; $('#chooseOffline').disabled = false;
    $('#send').disabled = mode === 'offline' && !engine && !cpuGenerator;
  }
}

document.querySelectorAll('.mode-btn').forEach(b => b.onclick = () => b.dataset.mode === 'offline' ? loadOffline() : (navigator.onLine ? setMode('online') : ($('#progress').textContent = 'Brak internetu. Wybierz OFFLINE.')));
$('#newChat').onclick = () => { save(); current = []; render(); };
$('#clear').onclick = () => { current = []; render(); };
$('#loadModel').onclick = loadOffline;
$('#chooseOnline').onclick = () => { if (!navigator.onLine) { $('#progress').textContent = 'Brak internetu. Połącz się z siecią albo wybierz OFFLINE.'; return; } setMode('online'); $('#progress').textContent = 'ONLINE gotowe. Przy pierwszym pytaniu usługa może poprosić o zalogowanie i zgodę na korzystanie z AI.'; };
$('#chooseOffline').onclick = loadOffline;

async function send(text) {
  if (!text.trim()) return;
  if (!mode) { $('#modeChooser').classList.remove('hidden'); return; }
  current.push({ role: 'user', content: text }); render(); $('#send').disabled = true;
  try {
    let answer;
    if (mode === 'offline') {
      if (engine) {
        const result = await engine.chat.completions.create({
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...current],
          temperature: 0.7, max_tokens: 700
        });
        answer = result.choices?.[0]?.message?.content || 'Model nie zwrócił odpowiedzi.';
      } else if (cpuGenerator) {
        const result = await cpuGenerator([
          { role: 'system', content: SYSTEM_PROMPT + ' Nie pokazuj wewnętrznego toku rozumowania.' },
          ...current.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
        ], { max_new_tokens: 256, temperature: 0.7, do_sample: true });
        const generated = result?.[0]?.generated_text;
        const last = Array.isArray(generated) ? generated[generated.length - 1] : null;
        answer = (typeof last?.content === 'string' ? last.content : (typeof generated === 'string' ? generated : 'Model CPU nie zwrócił odpowiedzi.'))
          .replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      } else {
        throw new Error('Model OFFLINE nie jest gotowy. Kliknij „Pobierz model offline” i poczekaj na zakończenie ładowania.');
      }
    } else {
      if (!navigator.onLine) throw new Error('Brak internetu. Przełącz na OFFLINE; lokalny model musi być wcześniej pobrany.');
      if (!window.puter?.ai?.chat) throw new Error('Biblioteka ONLINE nie załadowała się. Sprawdź internet i odśwież stronę.');
      const result = await window.puter.ai.chat([
        { role: 'system', content: SYSTEM_PROMPT },
        ...current.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
      ]);
      const content = result?.message?.content ?? result?.content ?? result?.text ?? result;
      answer = typeof content === 'string' ? content : (Array.isArray(content) ? content.map(x => x.text || '').join('\n') : JSON.stringify(content));
      if (!answer || answer === '{}') answer = 'Usługa ONLINE nie zwróciła tekstowej odpowiedzi.';
    }
    current.push({ role: 'assistant', content: answer }); render();
  } catch (e) {
    current.push({ role: 'assistant', content: 'Błąd: ' + (e?.message || e) }); render();
  } finally { $('#send').disabled = mode === 'offline' && !engine && !cpuGenerator; }
}
$('#chatForm').onsubmit = e => { e.preventDefault(); const t = promptBox.value; promptBox.value = ''; send(t); };
historyRender(); render(); $('#modeChooser').classList.remove('hidden');
window.addEventListener('online', () => { if (mode === 'online') $('#status').textContent = 'TRYB ONLINE'; });
window.addEventListener('offline', () => { if (mode === 'online') $('#status').textContent = 'BRAK INTERNETU — WYBIERZ OFFLINE'; });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
