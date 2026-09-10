import multer from 'multer';

const storage = multer.memoryStorage();

export const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
];

export const ALLOWED_AUDIO_MIMES = [
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',
  'audio/m4a',
  'audio/x-m4a',
];

export const ALLOWED_VIDEO_MIMES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/mpeg',
];

export const ALLOWED_MIME_TYPES = new Set([
  ...ALLOWED_IMAGE_MIMES,
  ...ALLOWED_AUDIO_MIMES,
  ...ALLOWED_VIDEO_MIMES,
]);

export const fileFilter = (req, file, cb) => {
  const mimetype = (file.mimetype || '').toLowerCase();

  // Validación granular por nombre de campo en formulario multipart
  if (file.fieldname === 'audio') {
    if (!ALLOWED_AUDIO_MIMES.includes(mimetype)) {
      const err = new Error(
        `Tipo de archivo de audio no permitido (${mimetype || 'desconocido'}). Se aceptan: webm, mp4, mpeg, wav, ogg, aac, m4a.`
      );
      err.code = 'UNSUPPORTED_MEDIA_TYPE';
      return cb(err, false);
    }
    return cb(null, true);
  }

  if (file.fieldname === 'image') {
    if (!ALLOWED_IMAGE_MIMES.includes(mimetype)) {
      const err = new Error(
        `Tipo de archivo de imagen no permitido (${mimetype || 'desconocido'}). Se aceptan: jpeg, png, webp, gif, heic.`
      );
      err.code = 'UNSUPPORTED_MEDIA_TYPE';
      return cb(err, false);
    }
    return cb(null, true);
  }

  if (file.fieldname === 'video') {
    if (!ALLOWED_VIDEO_MIMES.includes(mimetype)) {
      const err = new Error(
        `Tipo de archivo de video no permitido (${mimetype || 'desconocido'}). Se aceptan: mp4, webm, quicktime.`
      );
      err.code = 'UNSUPPORTED_MEDIA_TYPE';
      return cb(err, false);
    }
    return cb(null, true);
  }

  // Validación general si el nombre del campo es genérico
  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    const err = new Error(
      `Tipo de archivo no permitido (${mimetype || 'desconocido'}). Solo se autorizan imágenes, audios y videos compatibles.`
    );
    err.code = 'UNSUPPORTED_MEDIA_TYPE';
    return cb(err, false);
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
  },
});
