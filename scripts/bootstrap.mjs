import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const base = new URL(process.argv[2] || 'http://127.0.0.1:8791').origin;
if (!base.startsWith('https://') && base !== 'http://127.0.0.1:8791') throw new Error('Destino inválido.');
const key=(await readFile('.secrets/admin-key.txt','utf8')).trim();
const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});
if(!login.ok)throw new Error('Login recusado: HTTP '+login.status);
const cookie=login.headers.get('set-cookie').split(';')[0];
async function api(path,method='GET',body){const r=await fetch(base+'/api'+path,{method,headers:{Cookie:cookie,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw new Error('Operação recusada: '+path+' HTTP '+r.status);return r.json();}
const state=await api('/state');
let project=state.projects.find(p=>p.name==='SaaS Agents');
if(!project)project=await api('/projects','POST',{name:'SaaS Agents',description:'Uma central para empreendedores acompanharem projetos e times de agentes de IA em vários servidores. Reúne contexto, backlog, entregas e decisões em uma única mesa.',objective:'Entender rapidamente o estado de cada projeto, saber o que precisa de uma decisão e orientar o time com o mínimo de acesso necessário.'});
let agent=state.agents.find(a=>a.project_id===project.id&&a.name==='Coordenador');
if(!agent)agent=await api('/agents','POST',{project_id:project.id,name:'Coordenador',role:'Transforma o contexto do projeto em decisões para o empreendedor',instructions:'Use o snapshot como evidência. Explique o que já existe, o que está em andamento, bloqueios e três próximos passos. Cite os arquivos. Separe fatos e hipóteses. Se faltar acesso, peça somente o dado mínimo e explique para que precisa. Nunca afirme que executou comandos ou alterou arquivos.'});
let config;
try{config=JSON.parse(await readFile('.secrets/connector.json','utf8'));}catch{}
if(!config||config.url!==base){
 const connector=await api('/connectors','POST',{project_id:project.id,name:'Servidor · /root/saasagents'});
 execFileSync(process.execPath,['connector/cli.mjs','connect','--url',base,'--approve-read'],{cwd:process.cwd(),env:{...process.env,SAASAGENTS_CONNECTOR_TOKEN:connector.token},stdio:['ignore','pipe','pipe']});
}else execFileSync(process.execPath,['connector/cli.mjs','sync'],{cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
console.log('Projeto SaaS Agents, coordenador e conector preparados em '+base);
await writeFile('.secrets/installation.json',JSON.stringify({url:base,project_id:project.id,agent_id:agent.id},null,2),{mode:0o600});
if(process.argv.includes('--run-summary')){
 const task=await api('/tasks','POST',{project_id:project.id,agent_id:agent.id,title:'Resumo executivo do projeto',prompt:'Leia o snapshot real desta pasta. Explique o que já existe, o que está em andamento, bloqueios e três próximos passos. Cite os arquivos. Peça somente o dado mínimo quando faltar informação.'});
 const result=await api('/tasks/'+task.id+'/run','POST',{});
 console.log('Primeira execução: '+result.status);
 if(result.status!=='done')throw new Error('Modelo não concluiu a primeira análise: '+result.error);
 await writeFile('.secrets/first-summary.txt',result.result,{mode:0o600});
 console.log('Resumo real concluído e disponível no painel.');
}
