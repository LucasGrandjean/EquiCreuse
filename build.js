const fs = require('fs');
const path = require('path');

const files = [
    'namespace.js',
    'constants.js',
    'storage-keys.js',
    'app.js',
    'ui.js',
    'settings.js',
    'quests.js',
    'training.js',
    'proxy.js',
    'embed.js',
    'bootstrap.js'
];

const header = `// ==UserScript==
// @name         EquiCreuse
// @namespace    https://github.com/LucasGrandjean/EquiCreuse
// @version      0.1
// @description  La Creuse gagne toujours.
// @author       Lucas Grandjean
// @license      AGPL3.0
// @match        https://*.herozerogame.com
// @require      https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/numeral.js/2.0.6/numeral.min.js
// @resource     BS5_CSS https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css
// @grant        GM_getResourceText
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

`;

let output = header;

for (const file of files) {
    const filePath = path.join(__dirname, 'src', file);
    const content = fs.readFileSync(filePath, 'utf-8');

    output += `\n// ===== ${file} =====\n\n`;
    output += content + '\n';
}

fs.mkdirSync(path.join(__dirname, 'dist'), {recursive: true});
fs.writeFileSync(path.join(__dirname, 'dist', 'EquiCreuse.user.js'), output);

console.log('✅ Build complete: dist/EquiCreuse.user.js');