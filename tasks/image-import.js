const path = require('path');
const fs = require('fs');
const camelCase = require('camelcase');

let fileContent = 'var TEXTURES = {\n';
let validFileName = '';
let exportFiles = [];

let srcPath = path.resolve(__dirname, '../src');
let imagePath = srcPath + '/images';

fs.readdir(imagePath, function(err, files) {
    console.log(files);

    files.forEach((item, index, arr) => {

        if (/.gif|.jpg|.jpeg|.tiff|.png/gi.test(item)) {
            validFileName = item.replace(/-|~|\s|\(|\)/gm, '_');
            // // validFileName = validFileName.replace(/(gif|jpg|jpeg|tiff|png)$/gm, '.$1');
            // validFileName = validFileName.replace(/([[:upper:]])/gm, '_$1');
            // validFileName = validFileName.replace(/(^\d)/gm, '_$1');
            // validFileName = validFileName.toLowerCase();

            fs.rename(`${imagePath}/${item}`, `${imagePath}/${validFileName}`, (err) => {
                if (err) throw err;
                // console.log('Rename complete!');
            });

            // let fileExportName = camelCase(validFileName.replace(/.gif|.jpg|.jpeg|.tiff|.png/gm, ''));
            // fileExportName = fileExportName[0].toUpperCase() + fileExportName.slice(1, fileExportName[-1]);
            // console.log('fileExportName', fileExportName);

            // exportFiles.push(fileExportName);

            fileContent += `\t'images/${validFileName}': 'images/${validFileName}',\n`;
        }
    });

    fileContent += `}`;

    fs.writeFile(srcPath + '/js/textures.js', fileContent, 'utf8', (err) => {
        if (err)
            throw err;
        else
            console.log('Ghi file thanh cong!');
    });

});