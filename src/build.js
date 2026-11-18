/* Une las piezas de src/app en app.js y src/css en app.css.  node src/build.js */
const fs = require('fs'), path = require('path');
const R = path.resolve(__dirname, '..');
const partes = fs.readdirSync(R + '/src/app').filter(f => f.endsWith('.js')).sort().map(f => `/* ---- ${f} ---- */\n` + fs.readFileSync(R + '/src/app/' + f, 'utf8'));
const todo = partes.join('\n');
const ver = /VERSION = '([^']+)'/.exec(todo)[1];
const out = `/* ORBEO · app · versión ${ver} · se genera con src/build.js a partir de src/app */\n(function () {\n'use strict';\n${todo}\n})();\n`;
new Function(out);
fs.writeFileSync(R + '/app.js', out);
const css = fs.readdirSync(R + '/src/css').filter(f => f.endsWith('.css')).sort().map(f => fs.readFileSync(R + '/src/css/' + f, 'utf8')).join('\n');
fs.writeFileSync(R + '/app.css', `/* ORBEO · estilos · versión ${ver} */\n` + css);
let sw = fs.readFileSync(R + '/src/sw.js', 'utf8').replace(/__VERSION__/g, ver);
fs.writeFileSync(R + '/sw.js', sw);
console.log('Orbeo ' + ver + ' · app.js ' + Math.round(out.length / 1024) + ' KB · app.css ' + Math.round(css.length / 1024) + ' KB');
