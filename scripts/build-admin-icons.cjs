// Mechanical size conversion of the existing brand asset; original is untouched.
const sharp = require('sharp');
const fs = require('node:fs');
fs.mkdirSync('public/admin-icons', { recursive: true });
Promise.all([[192,'192'],[512,'512'],[180,'apple']].map(([size,name]) =>
  sharp('public/logo.png').resize(size,size,{fit:'contain',background:'#ffffff'}).flatten({background:'#ffffff'}).png().toFile('public/admin-icons/'+name+'.png')
)).catch(error => { console.error(error); process.exitCode=1; });
