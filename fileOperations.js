// fileOperations.js
import fs from 'fs';
import archiver from 'archiver';
import zlib from 'zlib'
import unzipper from 'unzipper';
import path from 'node:path';

export const compactFile = (inputPath, outputPath, originalFileName, fileExtension, callback) => {
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  output.on('close', function () {
    console.log('Arquivo compactado com sucesso:', outputPath);
    callback();
  });

  archive.pipe(output);

  // Include only essential metadata in the archive
  const metadata = {
    // Compress the base64Data using zlib
    base64Data: zlib.deflateSync(fs.readFileSync(inputPath).toString('base64')).toString('base64'),
    originalFileName: originalFileName,
    fileExtension: fileExtension
  };

  // Save metadata as binary
  archive.append(Buffer.from(JSON.stringify(metadata)), { name: 'metadata.bin' });

  output.path = outputPath;

  archive.finalize();
};

export const detectExtension = (buffer) => {
    try {
        const metadata = JSON.parse(buffer.toString());
        return metadata.extension || '.txt';
      } catch (error) {
        console.error('Error extracting extension from metadata:', error);
        return '.txt'; // Default to .txt if there's an error
      }
};

export const decompressFile = async (inputPath, outputPath) => {
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

      // Read the compressed metadata file
      const compressedMetadataBuffer = await fs.promises.readFile(metadataPath);

      // Decompress the base64Data using zlib
      const decompressedBase64Data = zlib.inflateSync(Buffer.from(compressedMetadataBuffer.toString(), 'base64')).toString();

      // Parse the decompressed metadata
      const parsedMetadata = JSON.parse(decompressedBase64Data);

      // Write the decompressed metadata to the metadata file
      await fs.promises.writeFile(metadataPath, JSON.stringify(parsedMetadata));

      // Return the path to the metadata file
      return metadataPath;
  })
  .catch((err) => {
      console.error('Error during decompression:', err);
      throw err;
  });
};

export const recoverOriginalContent = async (metadataFilePath, originalFilePath) => {
        try {
          const metadataBuffer = await fs.promises.readFile(metadataFilePath);
      const parsedMetadata = JSON.parse(metadataBuffer.toString('utf8'));
      const originalFileContent = Buffer.from(parsedMetadata.base64Data, 'base64');
          await fs.promises.writeFile(originalFilePath, originalFileContent);
          const detectedExt = detectExtension(originalFileContent);
          return detectedExt;
        } catch (error) {
          console.error('Error reading or parsing metadata:', error);
          throw new Error('Error reading or parsing metadata');
        }
};
