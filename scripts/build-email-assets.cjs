// Local deterministic optimization only; never connects to SMTP or production.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const icons=require('lucide-react');
const {PiFlowerLotusThin}=require('react-icons/pi');
const root=path.resolve(__dirname,'..'),out=path.join(root,'public/email-assets');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 // Preserve the original RGBA pixels and aspect ratio. Trim only transparent
 // margins: no palette quantization, enlargement, redraw or invented brand mark.
 await sharp(path.join(root,'public/logo.png')).trim().png({compressionLevel:9,palette:false}).toFile(path.join(out,'brand-illustration.png'));
 const generated=process.argv[2];
 if(generated){
  const meta=await sharp(generated).metadata();if(!meta.hasAlpha)throw Error('Botanical alpha required');
  await sharp(generated).resize({width:240}).png({compressionLevel:9,palette:true}).toFile(path.join(out,'botanical.png'));
 }
 for(const [name,Icon] of Object.entries({service:PiFlowerLotusThin,calendar:icons.CalendarDays,clock:icons.Clock3,location:icons.MapPin,phone:icons.Phone,mail:icons.Mail,arrow:icons.ArrowRight})){
  const svg=renderToStaticMarkup(React.createElement(Icon,{size:48,color:name==='arrow'?'#FFFFFF':'#2F6B5B',strokeWidth:1.5}));
  await sharp(Buffer.from(svg)).png().toFile(path.join(out,name+'.png'));
 }
 console.log('PASS local email PNG assets: lossless original brand, existing/optional supplied botanical, Lucide icon fallbacks');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
