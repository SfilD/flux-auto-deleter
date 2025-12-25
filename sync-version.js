const fs = require('fs');
const path = require('path');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const version = packageJson.version;

const filesToUpdate = ['README.md', 'README.ru.md'];

filesToUpdate.forEach(fileName => {
    const filePath = path.join(__dirname, fileName);
    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace vX.X.X patterns
    // This regex looks for v followed by digits and dots, like v1.1.0
    const versionRegex = /v\d+\.\d+\.\d+/g;
    
    const newContent = content.replace(versionRegex, `v${version}`);
    
    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated version to v${version} in ${fileName}`);
    } else {
        console.log(`Version in ${fileName} is already up to date.`);
    }
});
