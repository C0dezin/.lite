// encryptionHandler.js
import path from 'node:path';
import { compactFile, detectExtension } from './fileOperations.js';
import { fileURLToPath } from 'node:url';
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const encryptRoute = (req, res) => {
  const inputPath = req.file.path;
  const originalFileName = req.file.originalname;
  const fileExtension = path.extname(originalFileName);
  const outputPath = path.join(__dirname, '/compactados/', originalFileName + '.b3d');

  compactFile(inputPath, outputPath, originalFileName, fileExtension, () => {
    const b3dFileName = originalFileName + '.b3d';
    res.download(outputPath, b3dFileName, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).send('Error sending file');
      } else {
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      }
    });
  });
};
