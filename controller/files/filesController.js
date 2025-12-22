import FileResource from "../../models/fileModel.js";
import {
  successResponse,
  successResponseWithData,
  ErrorResponse,
  notFoundResponse,
} from "../../helpers/apiResponse.js";
import logger from "../../helpers/logger.js";

const fileLogger = logger.module("FILE_CONTROLLER");

/* =========================
   UPLOAD FILE
========================= */
export const uploadFile = async (req, res) => {
  try {
    const { title, type, description } = req.body;

    fileLogger.start("Uploading file", { title, type, userId: req.user._id });

    if (!req.file) {
      fileLogger.warn("No file provided in upload request");
      return ErrorResponse(res, "File is required");
    }

    const fileResource = await FileResource.create({
      title,
      type,
      description,
      fileUrl: req.file.path, // saved path from multer
      uploadedBy: req.user._id,
    });

    fileLogger.success("File uploaded successfully", { fileId: fileResource._id, title, size: req.file.size });
    return successResponseWithData(res, "File uploaded successfully", fileResource);
  } catch (error) {
    fileLogger.error("Error uploading file", error);
    return ErrorResponse(res, error.message || "Error uploading file");
  }
};

/* =========================
   GET ALL FILES
========================= */
export const getAllFiles = async (req, res) => {
  try {
    const { type, isActive } = req.query;

    fileLogger.start("Fetching all files", { type, isActive });

    const filter = { isActive: true };
    if (type) filter.type = type;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const files = await FileResource.find(filter)
      .sort({ createdAt: -1 })
      .populate("uploadedBy", "fname lname email");

    fileLogger.success("Files fetched successfully", { count: files.length, type });
    return successResponseWithData(res, "Files fetched successfully", files);
  } catch (error) {
    fileLogger.error("Error fetching files", error);
    return ErrorResponse(res, "Error fetching files");
  }
};

/* =========================
   GET FILE BY ID
========================= */
export const getFileById = async (req, res) => {
  try {
    const { id } = req.params;

    fileLogger.start("Fetching file by ID", { fileId: id });

    const file = await FileResource.findById(id).populate("uploadedBy", "fname lname email");
    if (!file) {
      fileLogger.warn("File not found", { fileId: id });
      return notFoundResponse(res, "File not found");
    }

    fileLogger.success("File fetched successfully", { fileId: id, title: file.title });
    return successResponseWithData(res, "File fetched successfully", file);
  } catch (error) {
    fileLogger.error("Error fetching file by ID", error);
    return ErrorResponse(res, "Error fetching file");
  }
};

/* =========================
   UPDATE FILE METADATA
========================= */
export const updateFile = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await FileResource.findByIdAndUpdate(id, req.body, { new: true });
    if (!file) return notFoundResponse(res, "File not found");

    return successResponseWithData(res, "File updated successfully", file);
  } catch (error) {
    console.error("Update file error:", error);
    return ErrorResponse(res, "Error updating file");
  }
};

/* =========================
   DELETE FILE (SOFT DELETE)
========================= */
export const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;

    const file = await FileResource.findByIdAndUpdate(id, { isActive: false }, { new: true });
    if (!file) return notFoundResponse(res, "File not found");

    return successResponse(res, "File deleted successfully");
  } catch (error) {
    console.error("Delete file error:", error);
    return ErrorResponse(res, "Error deleting file");
  }
};
