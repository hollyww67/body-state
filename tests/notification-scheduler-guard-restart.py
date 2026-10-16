"""Run after stopping/starting the SAME isolated QA container."""
import pathlib,json,subprocess,sys,os
root=pathlib.Path('/root/qa')
state=max((p for p in root.iterdir() if p.is_dir()),key=lambda p:int(p.name))
env=dict(os.environ,QA_STATE=str(state),QA_NOW='1791763200')
p=subprocess.run([sys.executable,str(root/'driver.py'),'status'],env=env,capture_output=True)
assert p.returncode==0 and json.loads(p.stdout)['paused']
p=subprocess.run([sys.executable,str(root/'driver.py'),'dispatch','system','notifications-v1','29862720'],env=env)
assert p.returncode==75
print('PASS real container restart: durable pause, zero HTTP')
