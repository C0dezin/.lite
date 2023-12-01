// decryptionHandler.js
import path from 'node:path';
import { decompressFile, recoverOriginalContent, detectExtension } from './fileOperations.js';
import { fileURLToPath } from 'node:url';
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const decryptRoute = async (req, res) => {
  let inputPath;
  let outputPath;
  let originalFileName;
  try {
    inputPath = req.file.path;
    originalFileName = req.file.originalname.replace('.lite', '');
    outputPath = path.join(__dirname, '/descompactados/', originalFileName);
  } catch (error) {
    res.send('Send your file again, please ^^');
  }

  try {
    await decompressFile(inputPath, outputPath);
    const metadataFilePath = path.join(outputPath, 'metadata.bin');

    const originalFilePath = path.join(outputPath, 'original');
    const originalFileContent = await recoverOriginalContent(metadataFilePath, originalFilePath);
    const detectedExt = detectExtension(originalFileContent);

    const updatedOriginalFilePath = path.join(outputPath, `${originalFileName}${await detectedExt}`.replace('.txt', ''));
    await fs.promises.rename(originalFilePath, updatedOriginalFilePath);

    const originalFileNameWithExt = originalFileName + (await detectedExt).replace('.txt', '');

    res.download(updatedOriginalFilePath, originalFileNameWithExt, async (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).send('Error sending file');
      } else {
        await fs.promises.unlink(inputPath);
        await fs.promises.unlink(metadataFilePath);
        await fs.promises.unlink(updatedOriginalFilePath);
        await fs.rmSync(outputPath, { recursive: true, force: true });
      }
    });
  } catch (error) {
    console.error('Error during decryption:', error);
    try {
      res.status(500).send('Error during decryption');
    } catch (error) {
      console.log(error);
    }
  }
};
