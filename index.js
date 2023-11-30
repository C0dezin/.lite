import express from 'express';
import multer from 'multer';
import fs from 'fs';
import archiver from 'archiver';
import unzipper from 'unzipper';
import { fileTypeFromFile } from 'file-type';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

const upload = multer({ dest: 'uploads/' });

// Rota para exibir a página de upload (encrypt)
app.get('/encrypt', (req, res) => {
  res.sendFile(path.join(__dirname, '/encrypt.html'));
});

// Rota para exibir a página de download (decrypt)
app.get('/decrypt', (req, res) => {
  res.sendFile(path.join(__dirname, '/decrypt.html'));
});

// Rota para lidar com o upload de arquivos e geração do .b3d
app.post('/encrypt', upload.single('arquivo'), (req, res) => {
  const inputPath = req.file.path;
  const originalFileName = req.file.originalname;
  const fileExtension = path.extname(originalFileName);
  const outputPath = path.join(__dirname, '/compactados/', originalFileName + '.b3d');

  compactarArquivo(inputPath, outputPath, originalFileName, fileExtension, () => {
    const b3dFileName = originalFileName + '.b3d';
    res.download(outputPath, b3dFileName, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).send('Error sending file');
      } else {
        // Optionally, you can clean up temporary files after the download
        fs.unlinkSync(inputPath);
        fs.unlinkSync(outputPath);
      }
    });
  });
});


// Rota para lidar com o download e descompactação do arquivo .b3d (decrypt)
app.post('/decrypt', upload.single('arquivoB3D'), async (req, res) => {
  let inputPath
  let outputPath
  let originalFileName
  try {
  inputPath = req.file.path;
  originalFileName = req.file.originalname.replace('.b3d', '');
  outputPath = path.join(__dirname, '/descompactados/', originalFileName);
  } catch (error) {
    res.send("Send your file again please ^^")
  }

  try {
    await descompactarArquivo(inputPath, outputPath);
    const metadataFilePath = path.join(outputPath, 'metadata.bin');
    
    // Resolve the original file path
    const originalFilePath = path.join(outputPath, `original`);

    const originalFileContent = await recuperarConteudoOriginal(metadataFilePath, originalFilePath);
    const detectedExt = detectarExtensao(originalFileContent);

// Update the original file path with the correct extension
const updatedOriginalFilePath = path.join(outputPath, `${originalFileName}${await detectedExt}`.replace('.txt', ''));
await fs.promises.rename(originalFilePath, updatedOriginalFilePath);

const originalFileNameWithExt = originalFileName + (await detectedExt).replace('.txt', '');

res.download(updatedOriginalFilePath, originalFileNameWithExt, async (err) => {
  if (err) {
    console.error('Error sending file:', err);
    res.status(500).send('Error sending file');
  } else {
    // Optionally, you can clean up temporary files after the download
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
    } catch(error) {
      console.log(error)
    }
  }
});



async function recuperarConteudoOriginal(metadataFilePath, originalFilePath) {
  try {
    const metadataBuffer = await fs.promises.readFile(metadataFilePath);
const parsedMetadata = JSON.parse(metadataBuffer.toString('utf8'));
const originalFileContent = Buffer.from(parsedMetadata.base64Data, 'base64');
    await fs.promises.writeFile(originalFilePath, originalFileContent);
    const detectedExt = detectarExtensao(originalFileContent);
    return detectedExt;
  } catch (error) {
    console.error('Error reading or parsing metadata:', error);
    throw new Error('Error reading or parsing metadata');
  }
}




async function compactarArquivo(inputPath, outputPath, originalFileName, fileExtension, callback) {
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip');

  output.on('close', function () {
    console.log('Arquivo compactado com sucesso:', outputPath);
    callback();
  });

  archive.pipe(output);

  // Include only the metadata in the archive
  const metadata = {
    base64Data: fs.readFileSync(inputPath).toString('base64'),
    originalFileName: originalFileName,
    fileExtension: fileExtension
  };

  // Save metadata as binary
  archive.append(Buffer.from(JSON.stringify(metadata)), { name: 'metadata.bin' });

  output.path = outputPath;

  archive.finalize();
}






async function detectarExtensao(buffer) {
  try {
    const metadata = JSON.parse(buffer.toString());
    return metadata.extension || '.txt';
  } catch (error) {
    console.error('Error extracting extension from metadata:', error);
    return '.txt'; // Default to .txt if there's an error
  }
}




async function descompactarArquivo(inputPath, outputPath) {
  const metadataPath = path.join(outputPath, 'metadata.bin');

  const unzipStream = unzipper.Parse();

  unzipStream.on('entry', (entry) => {
    const entryPath = path.join(outputPath, entry.path);

    // Ensure the directory for the entry exists
    return fs.promises.mkdir(path.dirname(entryPath), { recursive: true })
      .then(() => {
        if (entry.path === 'metadata.bin') {
          return new Promise((resolve, reject) => {
            entry.pipe(fs.createWriteStream(metadataPath))
              .on('finish', resolve)
              .on('error', reject);
          });
        } else {
          // Drain the entry if it's not the metadata file
          entry.autodrain();
        }
      });
  });

  return new Promise((resolve, reject) => {
    unzipStream.on('finish', () => resolve(metadataPath));
    unzipStream.on('error', reject);

    // Start streaming from the input file
    fs.createReadStream(inputPath).pipe(unzipStream);
  })
  .then(async (metadataPath) => {
    // Introduce a slight delay to ensure the directory creation is completed
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Return the path to the metadata file
    return metadataPath;
  })
  .catch((err) => {
    console.error('Error during decompression:', err);
    throw err;
  });
}









// Function to ensure the directory exists
function ensureDirectoryExists(filePath, callback) {
  const directory = path.dirname(filePath);

  // Check if the directory exists
  fs.promises.mkdir(directory, { recursive: true })
    .then(() => {
      callback();
    })
    .catch((error) => {
      console.error('Error creating directory:', error);
    });
}


app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
