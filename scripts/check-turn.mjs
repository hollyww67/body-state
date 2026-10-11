// Run locally on the VPS. Secret is read without printing; credentials last five minutes.
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const secret=readFileSync('/opt/doctor-site/.env.production','utf8').match(/^TURN_SECRET=(.+)$/m)?.[1];
if(!secret)throw new Error('TURN secret missing');
for(const [name,transport,port] of [['UDP',[],3478],['TCP',['-t'],3478],['TLS',['-t','-S'],5349]]){
 const user=Math.floor(Date.now()/1000)+300+':turn-smoke-'+name+'-'+Date.now();
 const password=createHmac('sha1',secret).update(user).digest('base64');
 const result=spawnSync('turnutils_uclient',[...transport,'-c','-y','-u',user,'-w',password,'-p',String(port),'-n','10','-z','100','-m','1','body-state.ru'],{encoding:'utf8',timeout:30000});
 const output=(result.stdout||'')+(result.stderr||'');
 console.log(name+' exit='+result.status+' '+output.split('\n').filter(l=>/tot_send|tot_recv|tot_lost|Total transmit|Total receive|ERROR|error/.test(l)).join('\n'));
 const totals=[...output.matchAll(/tot_send_msgs=(\d+), tot_recv_msgs=(\d+)/g)].at(-1);
 if(result.status!==0||!totals||Number(totals[1])===0||totals[1]!==totals[2]){console.log(output.replaceAll(password,'[redacted]'));process.exitCode=1;}
}
