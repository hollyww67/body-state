// Bounded offline loader: only presentation + legal config, never transport/DB/real ENV.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
module.exports=function loadEmailTemplates(){
 const cache=new Map(),root=path.resolve(__dirname,'../..');
 function load(name){
  if(!['notification-templates','email-components','legal'].includes(name))throw Error('Unexpected email import');
  if(cache.has(name))return cache.get(name);
  const exports={};cache.set(name,exports);
  const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(code,{exports,URL,Date,Intl,process:{env:{}},require:key=>{
   if(!key.startsWith('@/lib/'))throw Error('External email import forbidden');
   return load(key.slice(6));
  }},{filename:name+'.ts'});
  return exports;
 }
 return load('notification-templates');
};
