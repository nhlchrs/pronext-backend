import SecureMedia from "../../models/secureMediaModel.js";
import { encryptFile, createDecryptStream } from "../../middleware/secureFileUpload.js";
import {
  successResponse,
  successResponseWithData,
  ErrorResponse,
  notFoundResponse,
} from "../../helpers/apiResponse.js";
import logger from "../../helpers/logger.js";
import path from "path";
import fs from "fs";
import eventBus from "../../services/eventBus.js";

const mediaLogger = logger.module("SECURE_MEDIA_CONTROLLER");

/**
 * Upload Secure Media (Video/PDF) with Encryption
 * POST /api/secure-media/upload
 * Admin only
 */
export const uploadSecureMedia = async (req, res) => {
  try {
    const { title, description, type, category, tags, accessLevel } = req.body;

    mediaLogger.start("Uploading secure media", { title, type, userId: req.user._id });

    if (!req.file) {
      mediaLogger.warn("No file provided in upload request");
      return ErrorResponse(res, "File is required", 400);
    }

    const uploadsDir = process.env.VERCEL ? "/tmp/uploads" : "uploads";
    const originalPath = req.file.path;
    const encryptedDir = path.join(uploadsDir, "encrypted");
    const encryptedFileName = `${path.parse(req.file.filename).name}.enc`;
    const encryptedPath = path.join(encryptedDir, encryptedFileName);

    // Encrypt the file
    mediaLogger.info("Encrypting file...", { originalPath });
    await encryptFile(originalPath, encryptedPath);
    mediaLogger.success("File encrypted successfully", { encryptedPath });

    // Parse tags if it's a string
    const parsedTags = typeof tags === 'string' ? tags.split(',').map(tag => tag.trim()) : tags || [];

    // Create secure media record
    const secureMedia = await SecureMedia.create({
      title,
      description,
      type,
      mimeType: req.file.mimetype,
      originalName: req.file.originalname,
      encryptedPath,
      fileSize: req.file.size,
      uploadedBy: req.user._id,
      category,
      tags: parsedTags,
      accessLevel: accessLevel || 'subscribers',
      isEncrypted: true,
    });

    mediaLogger.success("Secure media uploaded successfully", { 
      mediaId: secureMedia._id, 
      title, 
      size: req.file.size,
      type 
    });

    // Emit socket event for real-time update
    eventBus.emit("media.uploaded", { mediaData: secureMedia });

    return successResponseWithData(res, "Media uploaded and encrypted successfully", {
      id: secureMedia._id,
      title: secureMedia.title,
      type: secureMedia.type,
      fileSize: secureMedia.fileSize,
      isEncrypted: secureMedia.isEncrypted,
    });
  } catch (error) {
    mediaLogger.error("Error uploading secure media", error);
    return ErrorResponse(res, error.message || "Error uploading media", 500);
  }
};

/**
 * Get All Secure Media
 * GET /api/secure-media
 */
export const getAllSecureMedia = async (req, res) => {
  try {
    const { type, category, page = 1, limit = 20, isActive } = req.query;

    mediaLogger.start("Fetching secure media", { type, category, page, limit });

    const filter = {};
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const skip = (page - 1) * limit;

    const media = await SecureMedia.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("uploadedBy", "fname lname email")
      .select("-encryptedPath"); // Don't send encrypted path to frontend

    const total = await SecureMedia.countDocuments(filter);

    mediaLogger.success("Secure media fetched successfully", { count: media.length, total });

    return successResponseWithData(res, "Media fetched successfully", {
      media,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    mediaLogger.error("Error fetching secure media", error);
    return ErrorResponse(res, error.message || "Error fetching media", 500);
  }
};

/**
 * Get Secure Media By ID
 * GET /api/secure-media/:id
 */
export const getSecureMediaById = async (req, res) => {
  try {
    const { id } = req.params;

    mediaLogger.start("Fetching secure media by ID", { mediaId: id });

    const media = await SecureMedia.findById(id)
      .populate("uploadedBy", "fname lname email")
      .select("-encryptedPath"); // Don't send encrypted path

    if (!media) {
      mediaLogger.warn("Media not found", { mediaId: id });
      return notFoundResponse(res, "Media not found");
    }

    // Increment view count
    media.views += 1;
    await media.save();

    mediaLogger.success("Secure media fetched successfully", { mediaId: id, title: media.title });

    return successResponseWithData(res, "Media fetched successfully", media);
  } catch (error) {
    mediaLogger.error("Error fetching secure media", error);
    return ErrorResponse(res, error.message || "Error fetching media", 500);
  }
};

/**
 * Stream Secure Media (Encrypted Video/PDF)
 * GET /api/secure-media/:id/stream
 * Returns decrypted stream for playback
 */
export const streamSecureMedia = async (req, res) => {
  try {
    const { id } = req.params;

    mediaLogger.start("Streaming secure media", { 
      mediaId: id, 
      userId: req.user._id,
      subscriptionStatus: req.user.subscriptionStatus 
    });

    const media = await SecureMedia.findById(id);

    if (!media) {
      mediaLogger.warn("Media not found for streaming", { mediaId: id });
      return notFoundResponse(res, "Media not found");
    }

    if (!media.isActive) {
      mediaLogger.warn("Media is not active", { mediaId: id });
      return ErrorResponse(res, "Media is not available", 403);
    }

    // Check access level
    if (media.accessLevel === 'subscribers' && !req.user.subscriptionStatus) {
      mediaLogger.warn("User does not have subscription", { mediaId: id, userId: req.user._id });
      return ErrorResponse(res, "Subscription required to access this content", 403);
    }

    if (media.accessLevel === 'admin' && req.user.role !== 'Admin') {
      mediaLogger.warn("User is not admin", { mediaId: id, userId: req.user._id });
      return ErrorResponse(res, "Admin access required", 403);
    }

    const filePath = media.encryptedPath;

    if (!fs.existsSync(filePath)) {
      mediaLogger.error("Encrypted file not found on disk", { filePath });
      return ErrorResponse(res, "Media file not found", 404);
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size - 16; // Subtract IV size
    const range = req.headers.range;

    // Setup decryption stream
    const { decipher, readStream } = await createDecryptStream(filePath);

    if (range) {
      // Partial content streaming (for video seeking)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': media.mimeType,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });

      readStream.pipe(decipher).pipe(res);
    } else {
      // Full file streaming
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': media.mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': 'inline', // Force inline display, not download
      });

      readStream.pipe(decipher).pipe(res);
    }

    mediaLogger.success("Secure media streaming started", { mediaId: id, userId: req.user._id });
  } catch (error) {
    mediaLogger.error("Error streaming secure media", error);
    if (!res.headersSent) {
      return ErrorResponse(res, error.message || "Error streaming media", 500);
    }
  }
};

/**
 * Update Secure Media
 * PUT /api/secure-media/:id
 * Admin only
 */
export const updateSecureMedia = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, tags, accessLevel, isActive } = req.body;

    mediaLogger.start("Updating secure media", { mediaId: id });

    const media = await SecureMedia.findById(id);

    if (!media) {
      mediaLogger.warn("Media not found for update", { mediaId: id });
      return notFoundResponse(res, "Media not found");
    }

    // Update fields
    if (title) media.title = title;
    if (description !== undefined) media.description = description;
    if (category) media.category = category;
    if (tags) media.tags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
    if (accessLevel) media.accessLevel = accessLevel;
    if (isActive !== undefined) media.isActive = isActive;

    await media.save();

    mediaLogger.success("Secure media updated successfully", { mediaId: id });

    return successResponseWithData(res, "Media updated successfully", media);
  } catch (error) {
    mediaLogger.error("Error updating secure media", error);
    return ErrorResponse(res, error.message || "Error updating media", 500);
  }
};

/**
 * Delete Secure Media
 * DELETE /api/secure-media/:id
 * Admin only
 */
export const deleteSecureMedia = async (req, res) => {
  try {
    const { id } = req.params;

    mediaLogger.start("Deleting secure media", { mediaId: id });

    const media = await SecureMedia.findById(id);

    if (!media) {
      mediaLogger.warn("Media not found for deletion", { mediaId: id });
      return notFoundResponse(res, "Media not found");
    }

    // Delete encrypted file from disk
    if (fs.existsSync(media.encryptedPath)) {
      fs.unlinkSync(media.encryptedPath);
      mediaLogger.info("Encrypted file deleted from disk", { path: media.encryptedPath });
    }

    // Delete thumbnail if exists
    if (media.thumbnail && fs.existsSync(media.thumbnail)) {
      fs.unlinkSync(media.thumbnail);
    }

    await SecureMedia.findByIdAndDelete(id);

    mediaLogger.success("Secure media deleted successfully", { mediaId: id });

    return successResponse(res, "Media deleted successfully");
  } catch (error) {
    mediaLogger.error("Error deleting secure media", error);
    return ErrorResponse(res, error.message || "Error deleting media", 500);
  }
};

export default {
  uploadSecureMedia,
  getAllSecureMedia,
  getSecureMediaById,
  streamSecureMedia,
  updateSecureMedia,
  deleteSecureMedia,
};
