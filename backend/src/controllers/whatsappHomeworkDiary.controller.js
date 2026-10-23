import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/apiError.js';
import whatsappHomeworkDiaryService from '../services/whatsapp/whatsappHomeworkDiary.service.js';
import {
  TEMP_IMAGE_TTL_MS,
  buildPublicTempImageUrl,
  tempImageStore,
} from '../services/whatsapp/whatsappTempImage.service.js';

const listWhatsAppHomeworkDiaryRecipients = asyncHandler(async (req, res) => {
  const data = await whatsappHomeworkDiaryService.getRecipients(req.query);
  return res.status(200).json({
    success: true,
    message: 'WhatsApp homework diary recipients fetched successfully.',
    data,
  });
});

// Admin-only. The image lives in memory only until the send finishes or its
// short TTL expires; it is never written to MongoDB or Cloudinary. The response
// contains the temporary public URL so the admin can see that the backend is
// reachable before confirming the send.
const uploadWhatsAppHomeworkDiaryImage = asyncHandler(async (req, res) => {
  if (!req.file?.buffer) {
    throw new ApiError(400, 'Select a JPG, PNG, or WebP image to upload.');
  }

  const stored = tempImageStore.store({ buffer: req.file.buffer });

  let imageUrl;
  try {
    imageUrl = buildPublicTempImageUrl(req, stored.id);
  } catch (error) {
    // A URL built from localhost cannot be fetched by the provider. Do not keep
    // an image that can never be sent.
    tempImageStore.remove(stored.id);
    throw error;
  }

  return res.status(201).json({
    success: true,
    message: 'Homework diary image uploaded temporarily.',
    data: {
      imageId: stored.id,
      imageUrl,
      expiresAt: new Date(stored.expiresAt).toISOString(),
    },
  });
});

// Public by design: the WhatsApp provider fetches this URL server-to-server and
// cannot present a portal bearer token. The 256-bit random id is unguessable and
// the image expires after a short TTL, so it is effectively a signed URL.
const getWhatsAppHomeworkDiaryImage = asyncHandler(async (req, res) => {
  const entry = tempImageStore.get(req.params.imageId);
  if (!entry) {
    throw new ApiError(404, 'Image not found or expired.');
  }

  res.set({
    'Content-Type': entry.contentType,
    'Content-Length': String(entry.buffer.length),
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Content-Disposition': 'inline; filename="homework-diary-image"',
  });

  return res.status(200).send(entry.buffer);
});

const sendWhatsAppHomeworkDiary = asyncHandler(async (req, res) => {
  const imageId =
    typeof req.body?.imageId === 'string' ? req.body.imageId.trim() : '';
  const image = tempImageStore.get(imageId);

  if (!image) {
    throw new ApiError(
      400,
      'The selected image is missing or has expired. Select it again.',
    );
  }

  // Resolve the public URL before any provider call. This is where a localhost
  // backend is rejected with an explicit, actionable blocker.
  const imageUrl = buildPublicTempImageUrl(req, imageId);

  // Keep the entry alive while the sequential provider calls run, then let the
  // normal TTL remove it. The image is never made permanent.
  tempImageStore.touch(imageId, TEMP_IMAGE_TTL_MS);

  const data = await whatsappHomeworkDiaryService.sendHomeworkDiary({
    ...req.body,
    imageUrl,
    onBeforeSend: () => tempImageStore.touch(imageId, TEMP_IMAGE_TTL_MS),
  });

  return res.status(200).json({
    success: true,
    message: 'WhatsApp homework diary processed.',
    data: {
      ...data,
      providerAcceptanceOnly: true,
    },
  });
});

export {
  listWhatsAppHomeworkDiaryRecipients,
  uploadWhatsAppHomeworkDiaryImage,
  getWhatsAppHomeworkDiaryImage,
  sendWhatsAppHomeworkDiary,
};
export default {
  listWhatsAppHomeworkDiaryRecipients,
  uploadWhatsAppHomeworkDiaryImage,
  getWhatsAppHomeworkDiaryImage,
  sendWhatsAppHomeworkDiary,
};
