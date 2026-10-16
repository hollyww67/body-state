// Local immutable artifact only. No registry push, VPS access or provider calls.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const [settingsFile,expectedHash,outputDirectory]=process.argv.slice(2);
assert(settingsFile&&/^[a-f0-9]{64}$/.test(expectedHash||'')&&outputDirectory,'settings file, approved public settings SHA256 and output directory required');
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
assert.equal(git('diff','HEAD','--name-only'),'','Tracked source changes must be committed');
const sha=git('rev-parse','HEAD'),tree=git('rev-parse','HEAD^{tree}');
const input=fs.readFileSync(path.resolve(settingsFile));
assert.equal(crypto.createHash('sha256').update(input).digest('hex'),expectedHash);
const settings=JSON.parse(input);
const allowed=['NEXT_PUBLIC_SITE_URL','NEXT_PUBLIC_TELEGRAM_URL','NEXT_PUBLIC_VK_URL','NEXT_PUBLIC_UMAMI_ID','NEXT_PUBLIC_UMAMI_SRC','NEXT_PUBLIC_TINKOFF_TERMINAL_KEY','NEXT_PUBLIC_OPERATOR_OGRNIP','NEXT_PUBLIC_OPERATOR_ADDRESS'];
assert.deepEqual(Object.keys(settings).sort(),allowed.sort());
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'notification-release-')),archive=path.join(temp,'source.tar'),context=path.join(temp,'source');
fs.mkdirSync(context);execFileSync('git',['archive','--format=tar','--output',archive,sha],{cwd:root});
execFileSync('tar',['-xf',archive,'-C',context]);
const output=path.resolve(outputDirectory);fs.mkdirSync(output,{recursive:true});
const tag=`body-state-postbox-scheduler:${sha.slice(0,12)}`;
const args=['--context','default','build','--progress=plain','--label',`org.opencontainers.image.revision=${sha}`,'--label',`org.opencontainers.image.source-tree=${tree}`,'--label',`qa.public-build.sha256=${expectedHash}`,'-t',tag,...Object.entries(settings).flatMap(([key,value])=>['--build-arg',`${key}=${value}`]),context];
const log=fs.openSync(path.join(output,'build.log'),'w');
const child=spawn('docker',args,{windowsHide:true,stdio:['ignore',log,log]});
child.on('error',()=>{fs.closeSync(log);process.exitCode=1;});
child.on('exit',code=>{
  fs.closeSync(log);if(code!==0){console.error('Docker build failed; inspect private local build.log');process.exitCode=1;return;}
  const image=JSON.parse(execFileSync('docker',['--context','default','image','inspect',tag],{encoding:'utf8'}))[0];
  assert.equal(image.Config.Labels['org.opencontainers.image.revision'],sha);
  assert.equal(image.Config.Labels['org.opencontainers.image.source-tree'],tree);
  assert.equal(image.Config.Labels['qa.public-build.sha256'],expectedHash);
  const result={sourceSHA:sha,sourceTree:tree,tag,imageId:image.Id,sizeBytes:image.Size,user:image.Config.User,publicBuildSHA256:expectedHash,buildContext:'git archive exact committed HEAD',productionChanged:false};
  fs.writeFileSync(path.join(output,'image.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
});
