// Contact sheets are QA evidence, not application image assets.
const sharp = require('sharp');
const path = require('node:path');
const dir = path.resolve('docs/design/screenshots-stage3-1');
const [dashboard, calendar, mobile] = process.argv.slice(2);
if (!mobile) throw Error('Provide dashboard, calendar and mobile reference paths');
async function pair(left, right, name, width, height) {
  const fit = input => input.resize({width, height, fit:'cover', position:'top'}).png().toBuffer();
  const [a,b] = await Promise.all([fit(left),fit(right)]);
  await sharp({create:{width:width*2+16,height,channels:3,background:'#fff'}}).composite([{input:a,left:0,top:0},{input:b,left:width+16,top:0}]).png().toFile(path.join(dir,name));
}
(async()=>{
  for(const [name,ref,file] of [['dashboard',dashboard,'dashboard-1440.png'],['calendar',calendar,'calendar-1440.png'],['calendar-form',calendar,'calendar-form-1440.png']]) await pair(sharp(ref),sharp(path.join(dir,file)),`compare-${name}.png`,1440,900);
  for(const [name,left,file] of [['dashboard',49,'dashboard-390.png'],['calendar',553,'calendar-390.png'],['booking',1058,'booking-details-390.png']]) await pair(sharp(mobile).extract({left,top:78,width:432,height:900}),sharp(path.join(dir,file)),`compare-mobile-${name}.png`,390,812);
  console.log('Six reference-left / implementation-right sheets saved.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
