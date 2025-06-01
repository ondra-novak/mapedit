const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 8830;

// 🔒 Povolené složky
const DATA_DIR = path.join(__dirname, 'data');
const FOLDER_MAP = {
    maps: './files/maps'
  };

app.use(express.json());
app.use(express.static('public')); // frontend na rootu (/)

// 🗂️ GET seznam souborů ve složce
app.get('/files/:folder', (req, res) => {
    const folderKey = req.params.folder;
    const folderPath = FOLDER_MAP[folderKey];
    if (!folderPath) return res.status(403).send('Forbidden');

  fs.readdir(folderPath, (err, files) => {
    if (err) return res.status(500).send('Error reading folder');

    const result = files.map(file => {
      const fullPath = path.join(folderPath, file);
      const stats = fs.statSync(fullPath);
      return {
        name: file,
        size: stats.size,
        modified: stats.mtime
      };
    });

    res.json(result);
  });
});

// 📄 GET konkrétní soubor
app.get('/files/:folder/:filename', (req, res) => {
    const folderKey = req.params.folder;
    const folderPath = FOLDER_MAP[folderKey];
    if (!folderPath) return res.status(403).send('Forbidden');
    const filePath = path.join( folderPath, req.params.filename);
  fs.readFile(filePath, (err, data) => {
    if (err) return res.status(404).send('File not found');
    res.send(data);
  });
});

// ✏️ PUT – zápis/nahrazení souboru
app.put('/files/:folder/:filename', (req, res) => {
    const folderKey = req.params.folder;
    const folderPath = FOLDER_MAP[folderKey];
    if (!folderPath) return res.status(403).send('Forbidden');
    const filePath = path.join(folderPath, req.params.filename);
    fsfs.writeFile(filePath, req.body.content || '', err => {
    if (err) return res.status(500).send('Error writing file');
    res.send('File saved');
  });
});

// ❌ DELETE souboru
app.delete('/files/:folder/:filename', (req, res) => {
    const folderKey = req.params.folder;
    const folderPath = FOLDER_MAP[folderKey];
    if (!folderPath) return res.status(403).send('Forbidden');
    const filePath = path.join( folderPath, req.params.filename);
    fsfs.unlink(filePath, err => {
    if (err) return res.status(404).send('File not found');
    res.send('File deleted');
  });
});

// 🚀 Start
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

