// generateZmanimScripts.js
const fs = require('fs');
const path = require('path');

const zmanimKeys = [
    'chatzotNight', 'misheyakir', 'dawn', 'sunrise', 'sofZmanShma',
    'sofZmanTfilla', 'chatzot', 'minchaGedola', 'minchaKetana',
    'plagHaMincha', 'sunset', 'beinHaShmashos', 'tzeit85deg', 'tzeit72min'
];

const template = `
const fs = require('fs');
const zmanimFile = '/var/lib/homebridge/zmanim-js/{{zmanimKey}}.json';

try {
    const data = fs.readFileSync(zmanimFile, 'utf8');
    const zmanim = JSON.parse(data);
    console.log(zmanim.label);
} catch (err) {
    console.error(\`Error reading file \${zmanimFile}:\`, err);
    process.exit(1);
}
`;

zmanimKeys.forEach(key => {
    const scriptContent = template.replace(/{{zmanimKey}}/g, key);
    const scriptPath = path.join('/var/lib/homebridge/zmanim-js', `get${key.charAt(0).toUpperCase() + key.slice(1)}Value.js`);
    fs.writeFileSync(scriptPath, scriptContent, 'utf8');
    console.log(`Generated script: ${scriptPath}`);
});