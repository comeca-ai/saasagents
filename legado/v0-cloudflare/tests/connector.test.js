import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, symlink, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { collect, redact } from '../connector/cli.mjs';
test('redação remove padrões de credenciais',()=>{assert.equal(redact('token=abc123'),'token=[OMITIDO]');assert.ok(!redact('-----BEGIN PRIVATE KEY-----\nsensitive\n-----END PRIVATE KEY-----').includes('sensitive'));});
test('coletor lê somente lista permitida e não segue symlinks para fora',async()=>{await mkdir('.secrets',{recursive:true});const base=await mkdtemp(resolve('.secrets/connector-test-'));const root=resolve(base,'repo');try{await mkdir(root);execFileSync('git',['init','--quiet',root]);await writeFile(resolve(root,'README.md'),'Meu projeto');await writeFile(resolve(root,'.env'),'PRIVATE_ENV_VALUE');await writeFile(resolve(root,'ACESSOS.md'),'PRIVATE_ACCESS_VALUE');await writeFile(resolve(base,'outside.md'),'OUTSIDE_VALUE');await symlink(resolve(base,'outside.md'),resolve(root,'STATUS.md'));const result=JSON.stringify(await collect(root));assert.match(result,/Meu projeto/);for(const value of ['PRIVATE_ENV_VALUE','PRIVATE_ACCESS_VALUE','OUTSIDE_VALUE'])assert.ok(!result.includes(value));}finally{await rm(base,{recursive:true,force:true});}});
