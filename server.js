// server.js
import express from 'express';
import path from 'node:path';
import multer from 'multer';
import { encryptRoute } from './encryptionHandler.js';
import { decryptRoute } from './decryptionHandler.js';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

const upload = multer({ dest: 'uploads/' });

app.get('/encrypt', (req, res) => {
  res.sendFile(path.join(__dirname, '/encrypt.html'));
});

app.get('/decrypt', (req, res) => {
  res.sendFile(path.join(__dirname, '/decrypt.html'));
});

app.post('/encrypt', upload.single('arquivo'), encryptRoute);

app.post('/decrypt', upload.single('arquivoLITE'), decryptRoute);

export default app;
