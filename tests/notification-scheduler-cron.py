"""Real Debian cron, installed actual artifacts, REAL clock; loopback fake only."""
import datetime,hashlib,http.server,importlib.util,json,os,pathlib,subprocess,sys,threading,time
GUARD='/usr/local/libexec/doctor-site-notifications-v1/guard.py'
FRONT='/usr/local/sbin/doctor-site-notifications-v1'
CRON='/etc/cron.d/notifications-v1'
STATE=pathlib.Path('/var/lib/doctor-site-notifications-v1')
EVIDENCE=pathlib.Path('/qa/evidence');EVIDENCE.mkdir(mode=0o700)
spec=importlib.util.spec_from_file_location('guard',GUARD)
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
# Operator publication gate: immutable reviewed bytes, safe root path and inode.
subprocess.run(['sha256sum','--check','/etc/notification-scheduler-qa.sha256'],check=True)
identities={}
for path,mode in [(GUARD,0o700),(FRONT,0o700),(CRON,0o644)]:
 g.secure(path,mode)
 p=pathlib.Path(path);assert b'\r' not in p.read_bytes()
 st=p.stat();identities[path]=(st.st_dev,st.st_ino,hashlib.sha256(p.read_bytes()).hexdigest())
assert pathlib.Path(CRON).read_text().splitlines()[-1]=='* * * * * root /usr/local/sbin/doctor-site-notifications-v1'
STATE.mkdir(mode=0o700)
config=pathlib.Path('/etc/doctor-site');config.mkdir(mode=0o700)
(config/'notifications-v1.json').write_text('{"cron_secret":"QA_FAKE_ONLY"}')
os.chmod(config/'notifications-v1.json',0o600)
def control(*args):
 p=subprocess.run(['/usr/bin/python3',GUARD,*args],capture_output=True,text=True,timeout=10)
 return p
assert control('pause').returncode==0
requests=[];errors=[];mutex=threading.Lock()
class Fake(http.server.BaseHTTPRequestHandler):
 def do_POST(self):
  now=time.time();minute=self.headers.get('x-notification-minute')
  valid=(self.path=='/api/cron/notifications-v1' and self.headers.get('Authorization')=='Bearer QA_FAKE_ONLY'
         and self.headers.get('x-notification-source')=='system' and minute==str(int(now)//60))
  with mutex:
   requests.append({'minute':minute,'at':now,'utc':datetime.datetime.fromtimestamp(now,datetime.timezone.utc).isoformat(),'path':self.path,'valid':valid})
   if not valid:errors.append('invalid POST contract')
  self.send_response(200 if valid else 409);self.end_headers();self.wfile.write(b'{"state":"done"}')
 def do_GET(self):
  errors.append('GET forbidden');self.send_response(405);self.end_headers()
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',3000),Fake)
threading.Thread(target=server.serve_forever,daemon=True).start()
# Seed a completed old occurrence: daemon must not replay the missing minutes.
old=str(int(time.time())//60-5)
g.write('task-notifications-v1.json',{'key':old,'state':'done'})
assert control('resume').returncode==0
started=time.time()
cronlog=open(EVIDENCE/'cron.log','wb')
daemon=subprocess.Popen(['/usr/sbin/cron','-f'],stdout=cronlog,stderr=subprocess.STDOUT)
print(json.dumps({'phase':'observing','daemon_pid':daemon.pid,'start':started,'old_minute':old,'clock':'REAL','network':'none'}),flush=True)
try:
 end=time.monotonic()+130
 while len(requests)<2:
  assert daemon.poll() is None,'cron exited'
  assert time.monotonic()<end,'two natural minutes not observed'
  time.sleep(.2)
 # Drain second guard and then freeze admissions without waiting another minute.
 assert control('pause').returncode==0
 time.sleep(.5)
 assert len(requests)==2 and not errors,(requests,errors)
 a,b=requests
 assert int(b['minute'])==int(a['minute'])+1,'not consecutive natural minutes'
 assert int(a['minute'])>=int(started)//60+1,'unexpected immediate/catchup invocation'
 assert all(r['valid'] and int(r['minute'])>int(old) for r in requests)
 assert all(0<=r['at']-int(r['minute'])*60<10 for r in requests),'late daemon cadence'
 # Supplemental real-clock stale admission probe; cadence above is daemon-only.
 before=len(requests)
 late=control('dispatch','system','notifications-v1',old)
 assert late.returncode==75 and len(requests)==before
 audit=[json.loads(x) for x in (STATE/'audit.jsonl').read_text().splitlines()]
 claims=[e for e in audit if e['event']=='claimed']
 finishes=[e for e in audit if e['event']=='finished']
 assert [e['key'] for e in claims]==[r['minute'] for r in requests]
 assert len(finishes)==2 and all(e['exit_status']==0 for e in finishes)
 for path,identity in identities.items():
  p=pathlib.Path(path);st=p.stat()
  assert (st.st_dev,st.st_ino,hashlib.sha256(p.read_bytes()).hexdigest())==identity
 report={'status':'PASS','daemon':'Debian cron -f','clock':'REAL','natural_invocations':requests,
         'distinct_consecutive_minutes':True,'daily_calls':0,'catchup_calls':0,'sends':0,
         'elapsed_seconds':round(time.time()-started,3),'root_code_hash_inode_gate':'PASS'}
 (EVIDENCE/'result.json').write_text(json.dumps(report,indent=2))
 print(json.dumps(report),flush=True)
finally:
 daemon.terminate()
 try:daemon.wait(timeout=5)
 except subprocess.TimeoutExpired:daemon.kill();daemon.wait()
 server.shutdown();cronlog.close()
