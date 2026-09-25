import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'));delete config.ai;
await writeFile('wrangler.local.json',JSON.stringify(config,null,2));
const processChild=spawn('node_modules/.bin/wrangler',['dev','--config','wrangler.local.json','--ip','127.0.0.1','--port','8791'],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false',XDG_CONFIG_HOME:process.cwd()+'/.config',WRANGLER_LOG_PATH:process.cwd()+'/.secrets/wrangler.log'}});
processChild.on('exit',code=>{process.exitCode=code;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>processChild.kill(signal));
