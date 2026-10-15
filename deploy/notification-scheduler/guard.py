#!/usr/bin/python3
"""Project-only cron admission. No provider responses or credentials in logs."""
import os,sys,json,time,stat,hashlib,fcntl,subprocess,datetime,contextlib,uuid
STATE='/var/lib/doctor-site-notifications-v1'
CONFIG='/etc/doctor-site/notifications-v1.json'
TASKS=('notifications-v1',)
def secure(path,mode=None):
 if os.path.realpath(path)!=path:raise RuntimeError('noncanonical path')
 for p in [path]+list(__import__('pathlib').Path(path).parents):
  s=os.lstat(p)
  if s.st_uid!=0 or s.st_gid!=0 or stat.S_ISLNK(s.st_mode) or s.st_mode&0o022:raise RuntimeError('unsafe ownership/path')
  if any(x in os.listxattr(p) for x in ['system.posix_acl_access','system.posix_acl_default']):raise RuntimeError('extended ACL')
 if mode is not None and stat.S_IMODE(os.lstat(path).st_mode)!=mode:raise RuntimeError('unexpected mode')
def state():secure(STATE,0o700)
def filefd(name):
 state();p=STATE+'/'+name
 fd=os.open(p,os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
 s=os.fstat(fd)
 if s.st_uid!=0 or s.st_gid!=0 or not stat.S_ISREG(s.st_mode) or stat.S_IMODE(s.st_mode)!=0o600:os.close(fd);raise RuntimeError('unsafe state file')
 secure(p,0o600);return fd
@contextlib.contextmanager
def lock(name,wait=False):
 fd=filefd(name+'.lock')
 try:
  fcntl.flock(fd,fcntl.LOCK_EX|(0 if wait else fcntl.LOCK_NB));yield fd
 finally:os.close(fd)
def read(name):
 p=STATE+'/'+name
 if not os.path.lexists(p):return None
 secure(p,0o600)
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  if not stat.S_ISREG(os.fstat(fd).st_mode):raise RuntimeError('nonregular state')
  with os.fdopen(fd,'r',closefd=False) as f:return json.load(f)
 finally:os.close(fd)
def write(name,data):
 state();p=STATE+'/'+name
 if os.path.lexists(p):secure(p,0o600)
 temp=p+'.tmp-'+uuid.uuid4().hex
 fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  with os.fdopen(fd,'w',closefd=False) as f:json.dump(data,f);f.flush();os.fsync(fd)
  os.replace(temp,p)
  d=os.open(STATE,os.O_RDONLY|os.O_DIRECTORY);os.fsync(d);os.close(d)
 finally:os.close(fd)
def log(event,**values):
 # Fixed structured fields only; never exception/provider/stdout/stderr payloads.
 fd=filefd('audit.jsonl')
 try:
  fcntl.flock(fd,fcntl.LOCK_EX);os.lseek(fd,0,os.SEEK_END)
  os.write(fd,(json.dumps(dict(utc=datetime.datetime.now(datetime.timezone.utc).isoformat(),event=event,**values))+'\n').encode());os.fsync(fd)
 finally:os.close(fd)
def http_worker(deadline,key):
 import urllib.request,signal
 remaining=deadline-time.time()
 if remaining<=0:return 75
 # Hard process deadline also bounds DNS, headers and a stalled response.
 signal.setitimer(signal.ITIMER_REAL,remaining)
 secure(CONFIG,0o600)
 with open(CONFIG) as f:config=json.load(f)
 # Fixed local route, no proxy, redirect, retries or provider access.
 class NoRedirect(urllib.request.HTTPRedirectHandler):
  def redirect_request(self,*args,**kwargs):return None
 opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
 request=urllib.request.Request('http://127.0.0.1:3000/api/cron/notifications-v1',method='POST',data=b'',
  headers={'Authorization':'Bearer '+config['cron_secret'],'x-notification-source':'system','x-notification-minute':key})
 with opener.open(request,timeout=max(.001,deadline-time.time())) as response:
  body=response.read(4097)
  return 0 if response.status==200 and len(body)<=4096 and json.loads(body).get('state') in ['done','duplicate','disabled'] and time.time()<deadline else 75

def dispatch(source,task,requested):
 state()
 if source not in ['root','system'] or task not in TASKS:return 2
 if source=='root':log('disabled',source=source,task=task);return 75
 with lock('task-'+task) as taskfd:
  # Do not wait into a new minute on admission contention.
  with lock('admission'):
   now=time.time();key=str(int(now)//60)
   if requested!=key:log('expired',task=task);return 75
   deadline=min((int(key)+1)*60,now+50)
   if read('paused.json') is not None:log('paused',task=task);return 75
   prev=read('task-'+task+'.json')
   if prev and prev['state'] in ['running','uncertain']:log('needs_reconciliation',task=task);return 75
   if prev and int(key)<=int(prev['key']):log('duplicate_or_clock_rollback',task=task);return 75
   secure(CONFIG,0o600)
   ledger=dict(key=key,state='running',claimed_at=now,deadline=deadline,source=source)
   write('task-'+task+'.json',ledger);log('claimed',task=task,key=key)
   worker=subprocess.Popen([sys.executable,os.path.realpath(__file__),'worker',str(deadline),key],
    pass_fds=(taskfd,),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  started=time.monotonic();rc=worker.wait()
  ledger.update(state='done' if rc==0 else 'uncertain',exit_status=rc,finished_at=time.time())
  write('task-'+task+'.json',ledger)
  log('finished',task=task,key=key,exit_status=rc,duration_seconds=round(time.monotonic()-started,3))
  return 0 if rc==0 else 75

def control_inner(command,task=None):
 state()
 if command=='status':
  with lock('admission',True):print(json.dumps(dict(root_source='disabled',paused=read('paused.json') is not None,tasks={t:read('task-'+t+'.json') for t in TASKS})))
  return 0
 if command=='pause':
  with lock('admission',True):write('paused.json',{'paused_at':time.time()});log('pause_requested')
  deadline=time.monotonic()+55
  for t in TASKS:
   while True:
    try:
     with lock('task-'+t):break
    except BlockingIOError:
     if time.monotonic()>=deadline:log('pause_drain_timeout');return 75
     time.sleep(.1)
  log('wrapper_locks_drained');return 0
 if command in ['resume','acknowledge-uncertain']:
  with lock('admission',True):
   if command=='acknowledge-uncertain':
    if task not in TASKS or read('paused.json') is None:return 2
    with lock('task-'+task):
     ledger=read('task-'+task+'.json')
     if ledger and ledger['state'] in ['running','uncertain']:
      ledger['state']='acknowledged';write('task-'+task+'.json',ledger);log('operator_acknowledged',task=task)
    return 0
   for t in TASKS:
    with lock('task-'+t):
     ledger=read('task-'+t+'.json')
     if ledger and ledger['state'] in ['running','uncertain']:return 75
   if read('paused.json') is not None:
    os.unlink(STATE+'/paused.json');d=os.open(STATE,os.O_RDONLY|os.O_DIRECTORY);os.fsync(d);os.close(d)
   log('resumed_system_only');return 0
 return 2
def control(command,task=None):
 if command=='status':return control_inner(command,task)
 # Pause drainage and resume/reconciliation are one serialized lifecycle.
 with lock('control',True):return control_inner(command,task)
def main():
 try:
  if len(sys.argv)==4 and sys.argv[1]=='worker':return http_worker(float(sys.argv[2]),sys.argv[3])
  if len(sys.argv)==5 and sys.argv[1]=='dispatch':return dispatch(sys.argv[2],sys.argv[3],sys.argv[4])
  if len(sys.argv) in [2,3]:return control(sys.argv[1],sys.argv[2] if len(sys.argv)==3 else None)
  return 2
 except BlockingIOError:return 75
 except Exception:
  # Claim stays durable if crash/exception happened after admission. No retry.
  return 78
if __name__=='__main__':sys.exit(main())
