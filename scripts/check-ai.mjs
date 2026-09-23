// Diagnóstico restrito a uma chamada curta do modelo deste projeto.
const token=process.env.CLOUDFLARE_API_TOKEN?.trim(),account=process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
if(!token||!account)throw new Error('Credenciais ausentes.');
const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/meta/llama-3.1-8b-instruct`,{
 method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
 body:JSON.stringify({messages:[{role:'user',content:'Responda apenas: conexão funcionando.'}],max_tokens:30})
});
const data=await response.json();
const clean=value=>String(value||'').replaceAll(token,'[omitido]').replaceAll(account,'[conta]').slice(0,500);
console.log(JSON.stringify({http:response.status,success:data.success,errors:(data.errors||[]).map(e=>({code:e.code,message:clean(e.message)})),result_keys:Object.keys(data.result||{})}));
if(!response.ok||data.success===false)process.exitCode=1;
