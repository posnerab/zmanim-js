
const fs = require('fs');
const zmanimFile = '/home/pi/.homebridge/zmanim-js/zmanim/plagHaMincha.json';

try {
    const data = fs.readFileSync(zmanimFile, 'utf8');
    const zmanim = JSON.parse(data);
    console.log(zmanim.label);
} catch (err) {
    console.error(`Error reading file ${zmanimFile}:`, err);
    process.exit(1);
}
