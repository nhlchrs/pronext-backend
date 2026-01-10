import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Create necessary directories
const uploadsDir = process.env.VERCEL ? "/tmp/uploads" : "uploads";
const videosDir = path.join(uploadsDir, "videos");
const pdfsDir = path.join(uploadsDir, "pdfs");
const encryptedDir = path.join(uploadsDir, "encrypted");

[uploadsDir, videosDir, pdfsDir, encryptedDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Encryption configuration
const getEncryptionKey = () => {
  if (!process.env.FILE_ENCRYPTION_KEY) {
    throw new Error('FILE_ENCRYPTION_KEY is not set in environment variables');
  }
  const key = process.env.FILE_ENCRYPTION_KEY;
  // Ensure key is exactly 32 bytes
  if (key.length !== 32) {
    throw new Error(`FILE_ENCRYPTION_KEY must be exactly 32 bytes, current length: ${key.length}`);
  }
  return Buffer.from(key, 'utf8');
};

const ENCRYPTION_KEY = getEncryptionKey();
const IV_LENGTH = 16; // For AES, this is always 16

/**
 * Encrypt file
 */
export const encryptFile = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    
    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);
    
    // Write IV to the beginning of the file
    output.write(iv);
    
    input.pipe(cipher).pipe(output);
    
    output.on('finish', () => {
      // Delete original unencrypted file
      fs.unlinkSync(inputPath);
      resolve(outputPath);
    });
    
    output.on('error', reject);
    input.on('error', reject);
  });
};

/**
 * Decrypt file stream (for streaming playback)
 */
export const createDecryptStream = (inputPath) => {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(inputPath);
    const iv = Buffer.alloc(IV_LENGTH);
    let ivRead = false;
    
    readStream.once('readable', () => {
      const chunk = readStream.read(IV_LENGTH);
      if (chunk) {
        chunk.copy(iv);
        ivRead = true;
        
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        resolve({ decipher, readStream });
      } else {
        reject(new Error('Could not read IV from file'));
      }
    });
    
    readStream.on('error', reject);
  });
};

// Storage for large files with encryption
const secureStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const fileType = file.mimetype.startsWith('video/') ? 'videos' : 'pdfs';
    const destDir = path.join(uploadsDir, fileType);
    cb(null, destDir);
  },
  filename: function (req, file, cb) {
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    // Store with encrypted name
    const filename = `${uniqueId}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

// File filter for videos and PDFs
const secureFileFilter = (req, file, cb) => {
  const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/mkv'];
  const allowedPdfTypes = ['application/pdf'];
  const allowedTypes = [...allowedVideoTypes, ...allowedPdfTypes];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only video files (MP4, WebM, OGG, AVI, MOV, MKV) and PDF files are allowed'));
  }
};

// Enhanced multer config for large files
export const secureUpload = multer({
  storage: secureStorage,
  fileFilter: secureFileFilter,
  limits: { 
    fileSize: 500 * 1024 * 1024, // max 500MB for videos
  },
});

// Original upload config (for backward compatibility)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = `${file.fieldname}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [".ppt", ".pptx", ".pdf"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only PPT and PDF files are allowed"));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // max 50MB
});
