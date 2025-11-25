// Main app script: transcription, history, UI, PWA registration
let MODEL_PIPELINE = null;
let currentOutput = '';
const MODEL_NAME = 'lucio/wav2vec2-large-xlsr-53-yoruba';

function $(sel){return document.querySelector(sel)}
function $all(sel){return document.querySelectorAll(sel)}

// Theme handling
const themeToggle = $('#themeToggle');
function applyThemeFromStorage(){
  const t = localStorage.getItem('theme') || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.body.classList.toggle('dark', t === 'dark');
}
applyThemeFromStorage();
themeToggle.addEventListener('click', ()=> {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// History functions
function getHistory(){ try { return JSON.parse(localStorage.getItem('transcriptions')||'[]') } catch(e){return []}}
function saveHistory(arr){ localStorage.setItem('transcriptions', JSON.stringify(arr)) }
function addToHistory(item){
  const arr = getHistory();
  arr.unshift(item);
  saveHistory(arr);
  renderHistory();
}
function renderHistory(){
  const list = $('#historyList');
  list.innerHTML = '';
  const arr = getHistory();
  if(!arr.length){ list.innerHTML = '<div class="history-meta">Aucun élément</div>'; return; }
  arr.forEach((it, idx) => {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.innerHTML = `<div style="flex:1">
      <div class="history-text" title="${escapeHtml(it.text)}">${escapeHtml(it.text)}</div>
      <div class="history-meta">${new Date(it.t).toLocaleString()} • ${it.name}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      <button class="btn" data-idx="${idx}" data-action="view">Voir</button>
      <button class="btn ghost" data-idx="${idx}" data-action="download">Télécharger</button>
      <button class="btn ghost" data-idx="${idx}" data-action="delete">Supprimer</button>
    </div>`;
    list.appendChild(el);
  });
}

function escapeHtml(s){ return (s+'').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]) }

// Wire history actions
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if(!btn) return;
  const action = btn.dataset.action;
  const idx = Number(btn.dataset.idx);
  if(action){
    const arr = getHistory();
    const item = arr[idx];
    if(action === 'view'){ $('#result').hidden=false; $('#result').textContent = item.text; currentOutput = item.text; }
    if(action === 'download'){ downloadText(item.text, item.name || 'transcription.txt'); }
    if(action === 'delete'){ arr.splice(idx,1); saveHistory(arr); renderHistory(); }
  }
});

// Clear history
$('#clearHistory').addEventListener('click', ()=>{ if(confirm('Effacer tout l\'historique ?')){ localStorage.removeItem('transcriptions'); renderHistory(); }});

// Utility: download text
function downloadText(text, filename='transcription.txt'){
  const blob = new Blob([text], {type:'text/plain'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Copy to clipboard
$('#copyBtn').addEventListener('click', async ()=> {
  if(!currentOutput) return alert('Aucune transcription à copier.');
  try { await navigator.clipboard.writeText(currentOutput); alert('Texte copié'); } catch(e){ alert('Impossible de copier'); }
});

// Save button
$('#saveBtn').addEventListener('click', ()=> {
  if(!currentOutput) return alert('Aucune transcription à sauvegarder.');
  const name = prompt('Nom pour cette transcription (optionnel)', 'capture-' + new Date().toISOString().slice(0,19));
  addToHistory({ name: name || 'transcription', text: currentOutput, t: Date.now() });
  alert('Enregistré dans l\'historique');
});

// Download button
$('#downloadBtn').addEventListener('click', ()=> {
  if(!currentOutput) return alert('Aucune transcription disponible.');
  downloadText(currentOutput, 'transcription.txt');
});

// Transcription process
const transcribeBtn = $('#transcribeBtn');
const stopBtn = $('#stopBtn');
const loadingEl = $('#loading');

transcribeBtn.addEventListener('click', async () => {
  const file = $('#audioFile').files[0];
  if(!file) return alert('Veuillez sélectionner un fichier audio.');
  loadingEl.style.display='block';
  loadingEl.textContent = 'Chargement du modèle... (1/2)';
  try{
    if(!MODEL_PIPELINE) {
      MODEL_PIPELINE = await window.transformers.pipeline('automatic-speech-recognition', MODEL_NAME);
    }
    loadingEl.textContent = 'Transcription en cours... (2/2)';
    const arrayBuffer = await file.arrayBuffer();
    const output = await MODEL_PIPELINE(arrayBuffer);
    currentOutput = output.text || '';
    $('#result').hidden = false;
    $('#result').textContent = currentOutput;
    $('#downloadBtn').style.display = 'inline-block';
    $('#saveBtn').style.display = 'inline-block';
    loadingEl.style.display='none';
  }catch(err){
    console.error(err);
    loadingEl.textContent = 'Erreur : ' + (err.message || err);
    setTimeout(()=> loadingEl.style.display='none', 4000);
  }
});

// On load
renderHistory();

// PWA registration
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=> {
    navigator.serviceWorker.register('sw.js').then(()=> console.log('SW registered')).catch(e=>console.warn('SW failed', e));
  });
}
