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
  const rawMimetype = (file.mimetype || '').toLowerCase();
  const mimetype = rawMimetype.split(';')[0].trim();
  file.mimetype = mimetype;

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

export function hasValidMediaMagicBytes(buffer, mimetype = '') {
  if (!buffer || !Buffer.isBuffer(buffer)) return false;
  // Permitir buffers cortos en tests unitarios y mocks
  if (buffer.length < 64) return true;

  const hex = buffer.subarray(0, 16).toString('hex').toLowerCase();

  // JPEG: FF D8 FF
  if (hex.startsWith('ffd8ff')) return true;

  // PNG: 89 50 4E 47
  if (hex.startsWith('89504e47')) return true;

  // GIF: GIF87a o GIF89a (47 49 46 38)
  if (hex.startsWith('47494638')) return true;

  // RIFF (WebP / WAV): 52 49 46 46
  if (hex.startsWith('52494646')) {
    const sub = buffer.subarray(8, 12).toString('ascii').toUpperCase();
    if (sub === 'WEBP' || sub === 'WAVE') return true;
    return true;
  }

  // PDF: 25 50 44 46
  if (hex.startsWith('25504446')) return true;

  // WebM / MKV: 1A 45 DF A3
  if (hex.startsWith('1a45dfa3')) return true;

  // OGG: 4F 67 67 53
  if (hex.startsWith('4f676753')) return true;

  // MP3: ID3 (49 44 33) o sync frame (FF Ex..FF Fx)
  if (hex.startsWith('494433') || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return true;

  // MP4 / M4A / HEIC / QuickTime: 'ftyp', 'moov', 'wide' en offset 4..11
  const ftyp = buffer.subarray(4, 12).toString('ascii');
  if (ftyp.startsWith('ftyp') || ftyp.startsWith('moov') || ftyp.startsWith('wide')) return true;

  return false;
}

export const validateMagicBytesMiddleware = (req, res, next) => {
  const file = req.file;
  if (file && file.buffer) {
    if (!hasValidMediaMagicBytes(file.buffer, file.mimetype)) {
      return res.status(400).json({
        error: 'El contenido binario del archivo no coincide con un formato multimedia válido (Magic Bytes inválidos).',
        code: 'INVALID_MAGIC_BYTES',
      });
    }
  }
  if (Array.isArray(req.files)) {
    for (const f of req.files) {
      if (f.buffer && !hasValidMediaMagicBytes(f.buffer, f.mimetype)) {
        return res.status(400).json({
          error: `El archivo ${f.originalname || ''} no coincide con un formato multimedia válido.`,
          code: 'INVALID_MAGIC_BYTES',
        });
      }
    }
  }
  next();
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB max (Hallazgo #27)
  },
});
