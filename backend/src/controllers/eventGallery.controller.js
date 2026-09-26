import { asyncHandler } from '../utils/asyncHandler.js';
import eventGalleryService from '../services/eventGallery.service.js';

const uploadGalleryImage = asyncHandler(async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const eventId = req.body.eventId || req.body.event;
  const caption = req.body.caption || '';
  const image = await eventGalleryService.addGalleryImage(eventId, req.file, baseUrl, req.user?._id, caption);

  return res.status(201).json({
    success: true,
    message: 'Gallery image uploaded successfully',
    data: { image },
  });
});

const bulkUploadGalleryImages = asyncHandler(async (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const eventId = req.body.eventId || req.body.event;
  const images = await eventGalleryService.bulkAddGalleryImages(eventId, req.files, baseUrl, req.user?._id);

  return res.status(201).json({
    success: true,
    message: 'Gallery images uploaded successfully',
    data: { images, count: images.length },
  });
});

const updateGalleryImage = asyncHandler(async (req, res) => {
  const image = await eventGalleryService.updateGalleryImage(req.params.id, req.body);

  return res.status(200).json({
    success: true,
    message: 'Gallery image updated successfully',
    data: { image },
  });
});

const deleteGalleryImage = asyncHandler(async (req, res) => {
  await eventGalleryService.deleteGalleryImage(req.params.id);

  return res.status(200).json({
    success: true,
    message: 'Gallery image deleted successfully',
  });
});

const deleteGalleryImagesByEvent = asyncHandler(async (req, res) => {
  const result = await eventGalleryService.deleteGalleryByEvent(req.params.eventId);

  return res.status(200).json({
    success: true,
    message: 'Gallery images deleted successfully',
    data: result,
  });
});

const getGalleryByEvent = asyncHandler(async (req, res) => {
  const gallery = await eventGalleryService.getGalleryByEvent(req.params.eventId);
  const images = gallery?.galleryImages || [];

  return res.status(200).json({
    success: true,
    message: 'Gallery images fetched successfully',
    data: { images },
  });
});

const getGalleryImageById = asyncHandler(async (req, res) => {
  const gallery = await eventGalleryService.getGalleryByEvent(req.params.id);
  const image = gallery?.galleryImages?.id(req.params.id) || null;

  if (!image) {
    return res.status(404).json({
      success: false,
      message: 'Gallery image not found',
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Gallery image fetched successfully',
    data: { image },
  });
});

export {
  uploadGalleryImage,
  bulkUploadGalleryImages,
  updateGalleryImage,
  deleteGalleryImage,
  deleteGalleryImagesByEvent,
  getGalleryByEvent,
  getGalleryImageById,
};
