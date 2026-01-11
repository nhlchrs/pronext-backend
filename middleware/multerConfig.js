import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = process.env.VERCEL ? "/tmp/uploads" : "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true }); 
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir); 
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const filename = `${file.fieldname}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

// File filter for images (profile pictures)
const imageFilter = (req, file, cb) => {
  const allowedTypes = [".jpg", ".jpeg", ".png", ".gif"];
  const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG, and GIF image files are allowed"));
  }
};

// File filter for documents (PPT and PDF only)
const documentFilter = (req, file, cb) => {
  const allowedTypes = [".ppt", ".pptx", ".pdf"];
  const allowedMimeTypes = [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PPT, PPTX, and PDF files are allowed"));
  }
};

// Upload for profile pictures (images only)
export const uploadImage = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5MB
});

// Upload for documents (PPT and PDF only)
export const uploadDocument = multer({
  storage,
  fileFilter: documentFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // max 50MB
});

// Default upload (for backward compatibility)
export const upload = uploadImage;
