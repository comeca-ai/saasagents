const $ = id => document.getElementById(id);
let state = { projects: [], agents: [], tasks: [], connectors: [] }, projectId = '', loggedIn = false, pendingRun = null, refreshBusy = false, editingProject = null;
const labels = { queued: 'na fila', running: 'trabalhando', done: 'entregou', failed: 'precisa de atenção' };
function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; }
function notice(message, error = false) { $('notice').hidden = !message; $('notice').textContent = message; $('notice').classList.toggle('error', error); }
function loginView() { loggedIn = false; $('dashboard').hidden = true; $('login-panel').hidden = false; $('logout').hidden = true; }
async function api(path, method = 'GET', data) {
  const response = await fetch('/api' + path, { method, headers: data === undefined ? {} : { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const result = await response.json();
  if (!response.ok) { if (response.status === 401) loginView(); throw new Error(result.error || 'Não foi possível concluir.'); }
  return result;
}
function active(list) { return list.filter(item => item.project_id === projectId); }
function formatDate(value) { return value ? new Date(value).toLocaleString('pt-BR') : 'nunca'; }
function ago(value) { if (!value) return '—'; const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000)); return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}min`; }
function empty(box, text) { box.replaceChildren(element('p', 'empty', text)); }
function button(label, handler) { const b = element('button', 'btn ghost', label); b.type = 'button'; b.onclick = handler; return b; }
async function refresh() {
  if (refreshBusy) return;
  refreshBusy = true;
  try { state = await api('/state'); loggedIn = true; $('dashboard').hidden = false; $('login-panel').hidden = true; $('logout').hidden = false; render(); }
  finally { refreshBusy = false; }
}
function render() {
  if (!state.projects.some(p => p.id === projectId)) projectId = state.projects.find(p => p.name === 'SaaS Agents')?.id || state.projects[0]?.id || '';
  try { localStorage.setItem('saasagents-project',projectId); } catch {}
  const project=state.projects.find(p=>p.id===projectId);
  $('project-overview').hidden=!project;
  $('overview-title').textContent=project?.name || '';
  $('overview-description').textContent=project?.description || 'Descreva o que este projeto faz e para quem ele existe.';
  $('overview-objective').textContent=project?.objective || 'Defina o resultado que você quer alcançar com este projeto.';
  const select = $('project-select'); select.replaceChildren();
  if (!state.projects.length) select.append(new Option('Crie seu primeiro projeto', ''));
  for (const p of state.projects) select.append(new Option(p.name, p.id)); select.value = projectId;
  const agents = active(state.agents), tasks = active(state.tasks), connectors = active(state.connectors);
  const running = tasks.filter(t => t.status === 'running'), queued = tasks.filter(t => t.status === 'queued'), failed = tasks.filter(t => t.status === 'failed');
  const online = connectors.filter(c => c.last_seen && Date.now() - Date.parse(c.last_seen) < 180000);
  $('stamp').textContent = 'Atualizado às ' + new Date(state.updated_at).toLocaleTimeString('pt-BR');
  $('summary').classList.toggle('clear', !failed.length);
  $('summary-title').textContent = failed.length ? `${failed.length} tarefa(s) precisam de atenção` : running.length ? 'Seu time está trabalhando' : online.length ? 'Projeto conectado à sua mesa' : projectId ? 'Conecte sua pasta para entender o projeto' : 'Crie seu primeiro projeto';
  $('summary-impact').textContent = projectId ? `${agents.length} agentes · ${queued.length} na fila` : '';
  $('summary-detail').textContent = failed.length ? 'Veja o motivo no histórico. Uma falha não é apresentada como entrega.' : online.length ? 'Peça um resumo executivo para transformar o contexto em próximos passos.' : 'O conector envia somente o contexto autorizado. Você controla os acessos.';
  $('agent-model').textContent = state.model;
  $('kpis').replaceChildren();
  for (const [label,value,note] of [['Agentes',agents.length,'no projeto'],['Trabalhando',running.length,'execuções em andamento'],['Entregas',tasks.filter(t=>t.status==='done').length,'tarefas concluídas'],['Conectores',`${online.length}/${connectors.length}`,'online · sinal nos últimos 3 min']]) {
    const k=element('div','kpi');k.append(element('div','lab',label),element('div','val',value),element('div','note',note));$('kpis').append(k);
  }
  $('floor').replaceChildren();
  if (!agents.length) empty($('floor'), 'Seu time começa com um agente. Crie o coordenador para analisar o projeto.');
  for (const a of agents) {
    const current = running.find(t => t.agent_id === a.id), desk = element('article','desk'+(current?' on':''));
    const top=element('div','desk-top');top.append(element('span','lamp'),element('span','agent',a.name));
    desk.append(top,element('p','role',a.role),element('p','doing',current ? current.title : 'Disponível para uma tarefa'),element('div','clock',current ? `trabalhando há ${ago(current.started_at)}` : 'pronto'));
    desk.append(button('Solicitar trabalho',()=>{$('task-agent').value=a.id;$('task-form').elements.title.focus();}));$('floor').append(desk);
  }
  const oldAgent=$('task-agent').value;$('task-agent').replaceChildren();
  for (const a of agents) $('task-agent').append(new Option(a.name,a.id));
  if(agents.some(a=>a.id===oldAgent)) $('task-agent').value=oldAgent;
  for (const control of $('task-form').elements) control.disabled=!agents.length;
  $('new-agent').disabled=!projectId;$('connect-server').disabled=!projectId;$('executive-summary').disabled=!agents.length || running.length>0;
  $('task-count').textContent=String(queued.length+running.length);$('task-list').replaceChildren();
  if(!queued.length&&!running.length) empty($('task-list'),'Nenhum pedido pendente. Solicite uma tarefa abaixo.');
  for (const t of [...running,...queued].sort((a,b)=>a.created_at.localeCompare(b.created_at))) {
    const card=element('article','task-card task-'+t.status);card.append(element('h3','',t.title),element('p','',agents.find(a=>a.id===t.agent_id)?.name||'Agente'),element('p','',labels[t.status]));
    if(t.status==='queued') card.append(button('Executar',()=>confirmRun(t.id)));$('task-list').append(card);
  }
  $('connectors').replaceChildren();
  if(!connectors.length) empty($('connectors'),'Nenhuma pasta conectada. Comece pelo servidor deste projeto.');
  for(const c of connectors){
    const row=element('div','connector'), isOnline=online.includes(c);row.append(element('strong','',c.name),element('p',isOnline?'status-online':'status-offline',isOnline?'● online':'○ sem sinal recente'),element('p','hint','Último envio: '+formatDate(c.last_seen)));
    if(c.snapshot){row.append(element('p','hint',`Branch: ${c.snapshot.branch || 'sem Git'} · ${c.snapshot.files_count} itens na raiz`));const details=element('details');details.append(element('summary','','Ver contexto enviado'),element('pre','',c.snapshot.overview),element('pre','',c.snapshot.changes||'Sem alterações locais registradas.'));row.append(details);}
    row.append(button('Revogar acesso',async()=>{if(!confirm('Revogar o token deste conector? Ele deixará de enviar contexto.'))return;try{await api('/connectors/'+c.id,'DELETE');await refresh();}catch(e){notice(e.message,true);}}));$('connectors').append(row);
  }
  $('history').replaceChildren();const finished=tasks.filter(t=>['done','failed'].includes(t.status));
  if(!finished.length) empty($('history'),'As entregas aparecerão aqui, com resultado e horário.');
  for(const t of finished){const detail=element('details','history-entry');detail.append(element('summary','',`${labels[t.status]} · ${t.title}`),element('p','meta',`${formatDate(t.finished_at)} · ${t.model || ''}`),element('div',t.error?'result-text history-error':'result-text',t.result||t.error));if(t.input_tokens!=null||t.output_tokens!=null)detail.append(element('p','meta',`Tokens: ${t.input_tokens??'—'} entrada / ${t.output_tokens??'—'} saída`));$('history').append(detail);}
  const executive=finished.find(t=>t.title==='Resumo executivo do projeto'&&t.status==='done');
  if(executive) $('executive-result').replaceChildren(element('p','hint','Gerado em '+formatDate(executive.finished_at)),element('div','result-text',executive.result));
  else empty($('executive-result'),'Peça uma leitura do projeto: situação, bloqueios e três próximos passos.');
}
function confirmRun(id){pendingRun=id;$('run-dialog').showModal();}
async function run(id){
  notice('Agente trabalhando. Você pode acompanhar o estado da tarefa no painel.');
  try {const promise=api('/tasks/'+id+'/run','POST',{});setTimeout(()=>refresh().catch(()=>{}),500);const result=await promise;await refresh();notice(result.status==='done'?'Entrega concluída. Confira o resultado no histórico.':result.error,result.status!=='done');}
  catch(e){notice(e.message,true);await refresh().catch(()=>{});}
}
$('confirm-run').onclick=()=>{const id=pendingRun;pendingRun=null;$('run-dialog').close();if(id)run(id);};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
$('connector-dialog').addEventListener('close',()=>{$('connector-token').value='';$('connector-instructions').hidden=true;$('connector-form').hidden=false;});
$('project-select').onchange=()=>{projectId=$('project-select').value;render();};
$('new-project').onclick=()=>{editingProject=null;$('project-form').reset();$('project-dialog-title').textContent='Novo projeto';$('project-form').querySelector('[type=submit]').textContent='Criar projeto';$('project-dialog').showModal();};
$('edit-project').onclick=()=>{const p=state.projects.find(p=>p.id===projectId);if(!p)return;editingProject=p.id;for(const field of ['name','description','objective'])$('project-form').elements[field].value=p[field]||'';$('project-dialog-title').textContent='Resumo e objetivo';$('project-form').querySelector('[type=submit]').textContent='Salvar projeto';$('project-dialog').showModal();};$('new-agent').onclick=()=>$('agent-dialog').showModal();$('connect-server').onclick=()=>$('connector-dialog').showModal();
function form(id,handler){$(id).addEventListener('submit',async event=>{event.preventDefault();const submit=event.submitter;submit.disabled=true;try{await handler(Object.fromEntries(new FormData(event.target)));notice('');}catch(e){notice(e.message,true);}finally{submit.disabled=false;}});}
form('login-form',async data=>{await api('/login','POST',data);$('login-form').reset();await refresh();});
form('project-form',async data=>{const created=await api(editingProject?'/projects/'+editingProject:'/projects',editingProject?'PATCH':'POST',data);projectId=created.id;$('project-dialog').close();$('project-form').reset();await refresh();});
form('agent-form',async data=>{await api('/agents','POST',{...data,project_id:projectId});$('agent-dialog').close();await refresh();});
form('task-form',async data=>{await api('/tasks','POST',{...data,project_id:projectId});$('task-form').reset();await refresh();});
form('connector-form',async data=>{const c=await api('/connectors','POST',{...data,project_id:projectId});$('connector-form').hidden=true;$('connector-instructions').hidden=false;$('connector-token').value=c.token;$('install-command').textContent='saasagents install --url '+location.origin;await refresh();});
$('executive-summary').onclick=async()=>{try{const agent=active(state.agents).find(a=>/coordenador/i.test(a.name))||active(state.agents)[0];const t=await api('/tasks','POST',{project_id:projectId,agent_id:agent.id,title:'Resumo executivo do projeto',prompt:'Com base no último snapshot, explique: 1. O que é o projeto e o que já existe; 2. O que está em andamento; 3. Bloqueios e decisões do empreendedor; 4. Três próximos passos priorizados. Cite os arquivos usados como evidência. Se faltar informação, peça o mínimo necessário. Não trate planos como funcionalidades implementadas.'});await refresh();confirmRun(t.id);}catch(e){notice(e.message,true);}};
$('logout').onclick=async()=>{try{await api('/logout','POST',{});loginView();}catch(e){notice(e.message,true);}};
$('theme').onclick=()=>{const current=document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=current==='dark'?'light':'dark';try{localStorage.setItem('saasagents-theme',document.documentElement.dataset.theme);}catch{}};
try{const theme=localStorage.getItem('saasagents-theme');if(['light','dark'].includes(theme))document.documentElement.dataset.theme=theme;}catch{}
try{projectId=localStorage.getItem('saasagents-project')||'';}catch{}
api('/session').then(()=>refresh()).catch(e=>{loginView();if(e.message!=='Entre para acessar sua mesa.')notice(e.message,true);});
setInterval(()=>{if(loggedIn)refresh().catch(e=>notice('Conexão interrompida. '+e.message,true));},5000);
