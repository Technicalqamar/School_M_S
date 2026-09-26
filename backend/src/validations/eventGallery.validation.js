import { ApiError } from '../utils/apiError.js';

const IMAGE_TYPES = ['Banner', 'Gallery'];

const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 20;

const validateCreateGalleryImage = (req, res, next) => {
  const { event, caption, imageType, sortOrder } = req.body;

  if (!event || !event.trim()) {
    throw new ApiError(400, 'Event reference is required');
  }
  if (!/^[0-9a-fA-F]{24}$/.test(event.trim())) {
    throw new ApiError(400, 'Invalid event ID format');
  }

  if (!req.file) {
    throw new ApiError(400, 'Image file is required');
  }

  const ext = req.file.originalname
    ? req.file.originalname.substring(req.file.originalname.lastIndexOf('.')).toLowerCase()
    : '';
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    throw new ApiError(
      400,
      `Only ${ALLOWED_IMAGE_EXTENSIONS.join(', ')} files are allowed`,
    );
  }
  if (req.file.size > MAX_IMAGE_SIZE) {
    throw new ApiError(400, `Image cannot exceed ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
  }

  if (caption !== undefined && caption !== null) {
    if (typeof caption !== 'string') {
      throw new ApiError(400, 'Caption must be a string');
    }
    if (caption.trim().length > 500) {
      throw new ApiError(400, 'Caption cannot exceed 500 characters');
    }
  }

  if (imageType !== undefined && imageType !== null && imageType !== '') {
    if (!IMAGE_TYPES.includes(imageType)) {
      throw new ApiError(400, `Invalid image type. Allowed: ${IMAGE_TYPES.join(', ')}`);
    }
  }

  if (sortOrder !== undefined && sortOrder !== null) {
    const order = Number(sortOrder);
    if (isNaN(order) || order < 0) {
      throw new ApiError(400, 'Sort order must be a non-negative number');
    }
  }

  req.body.event = event.trim();
  if (caption) req.body.caption = caption.trim();
  if (imageType) req.body.imageType = imageType;

  next();
};

const validateUpdateGalleryImage = (req, res, next) => {
  const { id } = req.params;
  if (!id || !id.trim()) {
    throw new ApiError(400, 'Gallery image ID is required');
  }

  const { caption, imageType, sortOrder } = req.body;

  if (caption !== undefined) {
    if (caption !== null && typeof caption === 'string') {
      if (caption.trim().length > 500) {
        throw new ApiError(400, 'Caption cannot exceed 500 characters');
      }
      req.body.caption = caption.trim();
    }
  }

  if (imageType !== undefined) {
    if (imageType !== null && imageType !== '') {
      if (!IMAGE_TYPES.includes(imageType)) {
        throw new ApiError(400, `Invalid image type. Allowed: ${IMAGE_TYPES.join(', ')}`);
      }
    }
  }

  if (sortOrder !== undefined && sortOrder !== null) {
    const order = Number(sortOrder);
    if (isNaN(order) || order < 0) {
      throw new ApiError(400, 'Sort order must be a non-negative number');
    }
  }

  if (req.file) {
    const ext = req.file.originalname
      ? req.file.originalname.substring(req.file.originalname.lastIndexOf('.')).toLowerCase()
      : '';
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      throw new ApiError(
        400,
        `Only ${ALLOWED_IMAGE_EXTENSIONS.join(', ')} files are allowed`,
      );
    }
    if (req.file.size > MAX_IMAGE_SIZE) {
      throw new ApiError(400, `Image cannot exceed ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`);
    }
  }

  next();
};

const validateBulkUploadGallery = (req, res, next) => {
  const { event } = req.body;

  if (!event || !event.trim()) {
    throw new ApiError(400, 'Event reference is required');
  }
  if (!/^[0-9a-fA-F]{24}$/.test(event.trim())) {
    throw new ApiError(400, 'Invalid event ID format');
  }

  if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
    throw new ApiError(400, 'At least one image file is required');
  }
  if (req.files.length > MAX_GALLERY_IMAGES) {
    throw new ApiError(400, `Cannot upload more than ${MAX_GALLERY_IMAGES} images at once`);
  }

  for (const file of req.files) {
    const ext = file.originalname
      ? file.originalname.substring(file.originalname.lastIndexOf('.')).toLowerCase()
      : '';
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      throw new ApiError(
        400,
        `Only ${ALLOWED_IMAGE_EXTENSIONS.join(', ')} files are allowed. Found: ${file.originalname}`,
      );
    }
    if (file.size > MAX_IMAGE_SIZE) {
      throw new ApiError(
        400,
        `Image ${file.originalname} cannot exceed ${MAX_IMAGE_SIZE / (1024 * 1024)}MB`,
      );
    }
  }

  req.body.event = event.trim();

  next();
};

const validateGalleryImageId = (req, res, next) => {
  const { id } = req.params;
  if (!id || !id.trim()) {
    throw new ApiError(400, 'Gallery image ID is required');
  }
  next();
};

const validateGalleryEventQuery = (req, res, next) => {
  const { event } = req.query;
  if (event) {
    if (!/^[0-9a-fA-F]{24}$/.test(event.trim())) {
      throw new ApiError(400, 'Invalid event ID format');
    }
  }
  next();
};

export {
  validateCreateGalleryImage,
  validateUpdateGalleryImage,
  validateBulkUploadGallery,
  validateGalleryImageId,
  validateGalleryEventQuery,
};
