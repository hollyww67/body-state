// Loopback-only, read-only synthetic previews. No DB, SMTP or production imports.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),htmlDir=path.join(root,'artifacts/notification-email-design'),assets=path.join(root,'public/email-assets');
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(req.method!=='GET'){res.writeHead(405);res.end();return;}
 const asset=u.pathname.startsWith('/email-assets/'),name=asset?u.pathname.slice(14):u.pathname==='/'?'index.html':u.pathname.slice(1);
 if(!/^[a-z0-9-]+\.(?:html|txt|png)$/.test(name)){res.writeHead(404);res.end();return;}
 const file=path.join(asset?assets:htmlDir,name);
 if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 const type=name.endsWith('.png')?'image/png':name.endsWith('.txt')?'text/plain; charset=utf-8':'text/html; charset=utf-8';
 let body=fs.readFileSync(file);
 if(name.endsWith('.html'))body=Buffer.from(body.toString('utf8').replaceAll('https://body-state.ru/email-assets/','http://localhost:3934/email-assets/'));
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);
}).listen(3934,'127.0.0.1',()=>console.log('Synthetic email previews: http://localhost:3934; SMTP disabled by construction'));
