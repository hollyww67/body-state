"""Linux process QA; docker --network none, fake HTTP and SQLite only."""
import os,sys,pathlib,subprocess,time,json,threading,http.server,sqlite3,fcntl
ROOT=pathlib.Path('/root/qa');ROOT.mkdir(mode=0o700,exist_ok=True)
CODE='/input/deploy/notification-scheduler/guard.py'
config=pathlib.Path('/etc/doctor-site');config.mkdir(exist_ok=True)
(config/'notifications-v1.json').write_text('{"cron_secret":"QA_SYNTHETIC"}')
os.chmod(config/'notifications-v1.json',0o600)
db=sqlite3.connect(ROOT/'fake.db',check_same_thread=False)
db.execute('create table if not exists requests(minute text, source text, method text)')
mode={'status':200,'state':'done','delay':0}
class Handler(http.server.BaseHTTPRequestHandler):
 def do_POST(self):
  assert self.path=='/api/cron/notifications-v1'
  assert self.headers['Authorization']=='Bearer QA_SYNTHETIC'
  db.execute('insert into requests values(?,?,?)',(self.headers['x-notification-minute'],self.headers['x-notification-source'],'POST'));db.commit()
  time.sleep(mode['delay'])
  self.send_response(mode['status']);self.end_headers()
  try:self.wfile.write(json.dumps({'state':mode['state']}).encode())
  except BrokenPipeError:pass
 def log_message(self,*args):pass
server=http.server.ThreadingHTTPServer(('127.0.0.1',3000),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
driver=ROOT/'driver.py'
driver.write_text("import importlib.util,os,sys,time\ns=importlib.util.spec_from_file_location('g',"+repr(CODE)+");g=importlib.util.module_from_spec(s);s.loader.exec_module(g);g.STATE=os.environ['QA_STATE'];g.time.time=lambda:float(os.environ['QA_NOW']);sys.exit(g.main())")
passed=[]
counter=0
def count():return db.execute('select count(*) from requests').fetchone()[0]
def fresh():
 global counter,state,now,key
 counter+=1;state=ROOT/str(counter);state.mkdir(mode=0o700)
 now=time.time();key=str(int(now)//60)
def spawn(*args):
 return subprocess.Popen([sys.executable,str(driver),*args],env=dict(os.environ,QA_STATE=str(state),QA_NOW=str(now)),stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True)
def call(*args):return spawn(*args).communicate(timeout=58)
def rc(*args):
 p=spawn(*args);p.communicate(timeout=58);return p.returncode
def run(source='system',minute=None):return rc('dispatch',source,'notifications-v1',minute or key)
def check(name,value):assert value,name;passed.append(name);print('PASS '+name,flush=True)
def started(n):
 end=time.monotonic()+5
 while count()<n and time.monotonic()<end:time.sleep(.01)
 assert count()>=n
fresh();n=count()
check('ordinary POST/header/JSON contract',run()==0 and count()==n+1)
check('same-minute duplicate',run()==75 and count()==n+1)
check('root permanently disabled',run('root')==75 and count()==n+1)
check('late and future minute no catchup',run(minute=str(int(key)-1))==75 and run(minute=str(int(key)+1))==75)
fresh();mode['delay']=1;n=count()
ps=[spawn('dispatch','system','notifications-v1',key) for _ in range(8)]
codes=[p.wait(timeout=5) for p in ps]
check('parallel overlap one winner',codes.count(0)==1 and count()==n+1)
fresh();n=count();p=spawn('dispatch','system','notifications-v1',key);started(n+1);p.kill();p.wait()
lockfd=os.open(state/'task-notifications-v1.lock',os.O_RDWR)
try:
 fcntl.flock(lockfd,fcntl.LOCK_EX|fcntl.LOCK_NB);held=False
except BlockingIOError:held=True
os.close(lockfd)
check('guard SIGKILL orphan retains task FD',held and run()==75)
check('pause drains orphan and stays durable',rc('pause')==0 and (state/'paused.json').exists())
check('fresh process blocks uncertain resume',rc('resume')==75)
check('explicit paused acknowledgement preserves dedupe',rc('acknowledge-uncertain','notifications-v1')==0 and rc('resume')==0 and run()==75)
fresh();n=count();p=spawn('dispatch','system','notifications-v1',key);started(n+1)
pause=spawn('pause')
end=time.monotonic()+4
while not (state/'paused.json').exists() and time.monotonic()<end:time.sleep(.01)
pause.kill();pause.wait()
check('operator disconnect retains pause',run()==75 and json.loads(call('status')[0])['paused'])
p.wait(timeout=5);check('resume after disconnected drain',rc('resume')==0)
mode['delay']=0
for status,body in [(503,'paused'),(409,'invalid'),(200,'unexpected'),(200,'uncertain')]:
 fresh();mode.update(status=status,state=body)
 check('failed HTTP/body '+str(status)+' '+body,run()==75 and json.loads((state/'task-notifications-v1.json').read_text())['state']=='uncertain')
 now+=60;key=str(int(now)//60);n=count()
 check('failure blocks later minute '+body,run()==75 and count()==n)
for body in ['disabled','duplicate','done']:
 fresh();mode.update(status=200,state=body)
 check('allowed result '+body,run()==0)
fresh();mode['delay']=2
p=subprocess.Popen([sys.executable,CODE,'worker',str(time.time()+.3),key],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
start=time.monotonic();p.wait(timeout=3)
check('hard worker deadline terminates stalled HTTP',p.returncode!=0 and time.monotonic()-start<1.5)
n=count();p=subprocess.run([sys.executable,CODE,'worker',str(time.time()-1),key],capture_output=True)
check('expired worker never opens HTTP',p.returncode==75 and count()==n)
fresh();check('durable pause prepared',rc('pause')==0)
# A real container stop/start is exercised by restart probe, not called a reboot.
print(json.dumps({'status':'PASS','checks':len(passed),'network':'none','provider':'fake HTTP','DB':'isolated SQLite','sends':0}),flush=True)
