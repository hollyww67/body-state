// QA contact sheets only: normalize reference density/crop; no creative assets.
const sharp = require('sharp');
const path = require('node:path');
const dir = path.resolve('docs/design/screenshots-stage3');
const [dashboard, calendar, mobile] = process.argv.slice(2);
if (!dashboard || !calendar || !mobile) throw Error('Pass the three owner reference PNG paths');
async function pair(left, right, name, width, height) {
  const a = await left.resize({ width }).extract({ left: 0, top: 0, width, height }).png().toBuffer();
  const b = await right.resize({ width }).extract({ left: 0, top: 0, width, height }).png().toBuffer();
  await sharp({ create: { width: width * 2 + 16, height, channels: 3, background: '#ffffff' } }).composite([{ input: a, left: 0, top: 0 }, { input: b, left: width + 16, top: 0 }]).png().toFile(path.join(dir, name));
}
(async () => {
  await pair(sharp(dashboard), sharp(path.join(dir, 'dashboard-1440.png')), 'compare-dashboard.png', 1440, 900);
  await pair(sharp(calendar), sharp(path.join(dir, 'calendar-1440.png')), 'compare-calendar.png', 1440, 900);
  await pair(sharp(calendar), sharp(path.join(dir, 'calendar-form-1440.png')), 'compare-calendar-form.png', 1440, 900);
  // Crop app-owned content from supplied device mockup; exclude hardware/status bar.
  for (const [name, x, impl] of [['dashboard', 49, 'dashboard-390.png'], ['calendar', 553, 'calendar-390.png'], ['booking', 1058, 'booking-details-390.png']]) {
    await pair(sharp(mobile).extract({ left: x, top: 78, width: 432, height: 900 }), sharp(path.join(dir, impl)), `compare-mobile-${name}.png`, 390, 780);
  }
  // Focused, readable top-region evidence; each sheet has reference left, app right.
  await pair(sharp(dashboard).extract({ left: 225, top: 78, width: 980, height: 235 }), sharp(path.join(dir, 'dashboard-1440.png')).extract({ left: 240, top: 78, width: 860, height: 235 }), 'compare-dashboard-focus.png', 860, 205);
  console.log('Seven reference-left / implementation-right comparison sheets saved.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
