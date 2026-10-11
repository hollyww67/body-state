// Run as root on the website VPS after reviewing the fixed paths below.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, chmodSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root='/opt/doctor-site';
const backup=root+'/backups/video-20261007';
mkdirSync(backup,{recursive:true,mode:0o700});
for(const [source,name] of [[root+'/.env.production','env.production'],['/etc/turnserver.conf','turnserver.conf']]){
  if(!existsSync(backup+'/'+name)){copyFileSync(source,backup+'/'+name);chmodSync(backup+'/'+name,0o600);}
}
let env=readFileSync(root+'/.env.production','utf8');
const secret=env.match(/^TURN_SECRET=([a-f0-9]{64})$/m)?.[1]||randomBytes(32).toString('hex');
env=env.split(/\r?\n/).filter(line=>! /^(TURN_SECRET|TURN_URLS|JITSI_HOST|NEXT_PUBLIC_STUN_URL|NEXT_PUBLIC_TURN_URL|NEXT_PUBLIC_TURN_USERNAME|NEXT_PUBLIC_TURN_CREDENTIAL)=/.test(line)).join('\n');
env+='\nTURN_SECRET='+secret+'\nTURN_URLS=turn:body-state.ru:3478?transport=udp,turn:body-state.ru:3478?transport=tcp,turns:body-state.ru:5349?transport=tcp\n';
writeFileSync(root+'/.env.production',env,{mode:0o600});
chmodSync(root+'/.env.production',0o600);
const conf=readFileSync(root+'/deploy/coturn-body-state.conf','utf8')+'\nstatic-auth-secret='+secret+'\n';
writeFileSync('/etc/turnserver.conf',conf,{mode:0o640});
chmodSync('/etc/turnserver.conf',0o640);
execFileSync('chown',['root:turnserver','/etc/turnserver.conf']);
mkdirSync('/etc/coturn/certs',{recursive:true,mode:0o750});
execFileSync('chown',['root:turnserver','/etc/coturn']);
execFileSync('chown',['root:turnserver','/etc/coturn/certs']);
for(const name of ['fullchain.pem','privkey.pem']){
  copyFileSync('/etc/letsencrypt/live/body-state.ru/'+name,'/etc/coturn/certs/'+name);
  chmodSync('/etc/coturn/certs/'+name,0o640);
  execFileSync('chown',['root:turnserver','/etc/coturn/certs/'+name]);
}
const hook='/etc/letsencrypt/renewal-hooks/deploy/doctor-video-turn';
writeFileSync(hook, '#!/bin/sh\nset -eu\n[ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/body-state.ru ] || exit 0\ninstall -o root -g turnserver -m 640 "$RENEWED_LINEAGE/fullchain.pem" /etc/coturn/certs/fullchain.pem\ninstall -o root -g turnserver -m 640 "$RENEWED_LINEAGE/privkey.pem" /etc/coturn/certs/privkey.pem\nsystemctl restart coturn\n',{mode:0o750});
mkdirSync('/etc/systemd/system/coturn.service.d',{recursive:true});
writeFileSync('/etc/systemd/system/coturn.service.d/limits.conf','[Service]\nMemoryMax=256M\nCPUQuota=50%\n');
execFileSync('systemctl',['daemon-reload']);
execFileSync('systemctl',['restart','coturn']);
console.log('TURN configured; secrets retained only on server. Backups: '+backup);
