import EventGallery from '../models/eventGallery.model.js';
import Event from '../models/event.model.js';
import { ApiError } from '../utils/apiError.js';
import cloudinary, { configureCloudinary, CLOUDINARY_FOLDERS } from '../config/cloudinary.js';

const uploadToCloudinary = (buffer, originalname, folder) => {
  configureCloudinary();
  return new Promise((resolve, reject) => {
    const ext = originalname.split('.').pop();
    const publicId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
        format: ext,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    stream.end(buffer);
  });
};

const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  configureCloudinary();
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Failed to delete image from Cloudinary', publicId, err);
  }
};

const upsertBanner = async (eventId, file, baseUrl, userId) => {
  let bannerImage = { secure_url: null, public_id: null };
  if (file) {
    const existing = await EventGallery.findOne({ event: eventId }).lean();
    if (existing?.bannerImage?.public_id) {
      await deleteFromCloudinary(existing.bannerImage.public_id);
    }

    const folder = `${CLOUDINARY_FOLDERS.EVENTS}/${eventId}`;
    const result = await uploadToCloudinary(file.buffer, file.originalname, folder);
    bannerImage = { secure_url: result.secure_url, public_id: result.public_id };
  }

  const gallery = await EventGallery.findOneAndUpdate(
    { event: eventId },
    {
      $set: { bannerImage, uploadedBy: userId },
      $setOnInsert: { event: eventId, galleryImages: [] },
    },
    { upsert: true, returnDocument: 'after' },
  ).lean();

  return gallery;
};

const getGalleryByEvent = async (eventId) => {
  const gallery = await EventGallery.findOne({ event: eventId })
    .populate({ path: 'uploadedBy', select: 'fullName' })
    .lean();

  if (!gallery) {
    return { bannerImage: { secure_url: null, public_id: null }, galleryImages: [] };
  }

  return gallery;
};

const addGalleryImage = async (eventId, file, baseUrl, userId, caption) => {
  const eventExists = await Event.findById(eventId).select('_id').lean();
  if (!eventExists) {
    throw new ApiError(404, 'Event not found');
  }

  const folder = `${CLOUDINARY_FOLDERS.EVENTS}/${eventId}`;
  const result = await uploadToCloudinary(file.buffer, file.originalname, folder);

  const gallery = await EventGallery.findOneAndUpdate(
    { event: eventId },
    {
      $push: {
        galleryImages: {
          secure_url: result.secure_url,
          public_id: result.public_id,
          caption: caption || '',
          sortOrder: 0,
          uploadedBy: userId,
        },
      },
      $setOnInsert: { event: eventId, uploadedBy: userId, bannerImage: { secure_url: null, public_id: null } },
    },
    { upsert: true, returnDocument: 'after' },
  ).lean();

  const added = gallery.galleryImages[gallery.galleryImages.length - 1];
  return added;
};

const bulkAddGalleryImages = async (eventId, files, baseUrl, userId) => {
  const eventExists = await Event.findById(eventId).select('_id').lean();
  if (!eventExists) {
    throw new ApiError(404, 'Event not found');
  }

  const folder = `${CLOUDINARY_FOLDERS.EVENTS}/${eventId}`;
  const entries = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const result = await uploadToCloudinary(file.buffer, file.originalname, folder);
    entries.push({
      secure_url: result.secure_url,
      public_id: result.public_id,
      caption: '',
      sortOrder: i,
      uploadedBy: userId,
    });
  }

  const gallery = await EventGallery.findOneAndUpdate(
    { event: eventId },
    {
      $push: { galleryImages: { $each: entries } },
      $setOnInsert: { event: eventId, uploadedBy: userId, bannerImage: { secure_url: null, public_id: null } },
    },
    { upsert: true, returnDocument: 'after' },
  ).lean();

  return entries.map((e, i) => ({
    ...e,
    _id: gallery.galleryImages[gallery.galleryImages.length - entries.length + i]._id,
  }));
};

const updateGalleryImage = async (imageId, data) => {
  const setFields = {};
  if (data.caption !== undefined) setFields['galleryImages.$.caption'] = data.caption;
  if (data.sortOrder !== undefined) setFields['galleryImages.$.sortOrder'] = Number(data.sortOrder);

  if (Object.keys(setFields).length === 0) {
    throw new ApiError(400, 'No fields to update');
  }

  const gallery = await EventGallery.findOneAndUpdate(
    { 'galleryImages._id': imageId },
    { $set: setFields },
    { returnDocument: 'after' },
  ).lean();

  if (!gallery) {
    throw new ApiError(404, 'Gallery image not found');
  }

  const updated = gallery.galleryImages.find((img) => img._id.toString() === imageId);
  return updated || null;
};

const deleteGalleryImage = async (imageId) => {
  const gallery = await EventGallery.findOne({ 'galleryImages._id': imageId }).lean();
  if (!gallery) {
    throw new ApiError(404, 'Gallery image not found');
  }

  const image = gallery.galleryImages.find((img) => img._id.toString() === imageId);
  if (image?.public_id) {
    await deleteFromCloudinary(image.public_id);
  }

  await EventGallery.findOneAndUpdate(
    { 'galleryImages._id': imageId },
    { $pull: { galleryImages: { _id: imageId } } },
  );

  return { deleted: true };
};

const deleteGalleryByEvent = async (eventId) => {
  const gallery = await EventGallery.findOne({ event: eventId }).lean();
  if (!gallery) {
    return { deletedCount: 0 };
  }

  if (gallery.bannerImage?.public_id) {
    await deleteFromCloudinary(gallery.bannerImage.public_id);
  }

  if (gallery.galleryImages?.length > 0) {
    for (const img of gallery.galleryImages) {
      if (img.public_id) {
        await deleteFromCloudinary(img.public_id);
      }
    }
  }

  const result = await EventGallery.deleteOne({ event: eventId });
  return { deletedCount: result.deletedCount || 0 };
};

const attachGalleryToEvents = async (events) => {
  if (!events || events.length === 0) return events;

  const eventIds = events.map((e) => e._id);
  const galleries = await EventGallery.find({ event: { $in: eventIds } }).lean();
  const galleryMap = new Map(galleries.map((g) => [g.event.toString(), g]));

  return events.map((e) => {
    const g = galleryMap.get(e._id.toString());
    return {
      ...e,
      bannerImage: g?.bannerImage?.secure_url || null,
      galleryImages: g?.galleryImages || [],
    };
  });
};

export default {
  upsertBanner,
  getGalleryByEvent,
  addGalleryImage,
  bulkAddGalleryImages,
  updateGalleryImage,
  deleteGalleryImage,
  deleteGalleryByEvent,
  attachGalleryToEvents,
};
