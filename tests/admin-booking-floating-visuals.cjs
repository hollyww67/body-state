// Reference / Before / After QA sheets; not runtime assets.
const sharp=require('sharp');
const path=require('node:path');
const dir=path.resolve('docs/design/booking-dialog-refinement');
const reference=process.argv[2];
if(!reference)throw Error('Provide the owner calendar reference PNG');
async function sheet(images,name,width,height) {
  const buffers=await Promise.all(images.map(image=>image.resize({width,height,fit:'contain',background:'#ffffff',position:'top'}).png().toBuffer()));
  await sharp({create:{width:width*3+32,height,channels:3,background:'#e5ece9'}}).composite(buffers.map((input,index)=>({input,left:index*(width+16),top:0}))).png().toFile(path.join(dir,name));
}
(async()=>{
  await sheet([sharp(reference),sharp(path.join(dir,'before-1440.png')),sharp(path.join(dir,'after-1440.png'))],'reference-before-after.png',960,680);
  await sheet([sharp(reference).extract({left:1088,top:400,width:432,height:602}),sharp(path.join(dir,'before-1440.png')).extract({left:920,top:0,width:520,height:900}),sharp(path.join(dir,'after-1440.png')).extract({left:957,top:80,width:440,height:740})],'reference-before-after-detail.png',440,900);
  console.log('Reference / Before / After: full view and readable dialog detail saved.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
