import React, { useRef } from 'react';
import { Upload, Plus, CheckCircle2, Loader2, Trash2, Link2 } from 'lucide-react';
import { compressImage } from '../../utils/imageCompression';

export const ALLOWED_ART_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const ALLOWED_ART_EXT_RE = /\.(jpe?g|png|webp|heic|heif)$/i;
export const MAX_ART_FILE_BYTES = 15 * 1024 * 1024;

let artUploadSeq = 0;

export function validateArtFile(file) {
  if (!file) return { valid: false, error: 'Archivo no válido.' };
  const mime = String(file.type || '').toLowerCase().trim();
  const name = String(file.name || '').trim();
  const hasValidMime = ALLOWED_ART_MIME_TYPES.includes(mime) || (!mime && ALLOWED_ART_EXT_RE.test(name));
  if (!hasValidMime) {
    return { valid: false, error: `Formato inválido (${name || 'archivo'}). Usa imágenes JPEG, PNG, WebP o HEIC.` };
  }
  if (Number(file.size) > MAX_ART_FILE_BYTES) {
    return { valid: false, error: `La imagen "${name || 'seleccionada'}" supera el límite máximo de 15MB.` };
  }
  return { valid: true, error: null };
}

export function revokeArtPreviewUrls(arts = []) {
  if (!Array.isArray(arts)) return;
  for (const art of arts) {
    const preview = art?.previewUrl;
    if (typeof preview === 'string' && preview.startsWith('blob:') && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      try { URL.revokeObjectURL(preview); } catch (_) {}
    }
  }
}

export async function uploadArtFilesBatch({
  files = [],
  authFetch,
  compressFn = compressImage,
  createPreviewUrl = (f) => (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(f) : ''),
}) {
  const fileList = Array.from(files || []).filter(Boolean);
  const uploaded = [];
  const errors = [];

  for (const file of fileList) {
    const check = validateArtFile(file);
    if (!check.valid) { errors.push(check.error); continue; }

    let previewUrl = '';
    try { previewUrl = createPreviewUrl(file) || ''; } catch (_) { previewUrl = ''; }

    try {
      let fileToUpload = file;
      if (String(file.type || '').startsWith('image/') && typeof compressFn === 'function') {
        try { fileToUpload = await compressFn(file, 1920, 0.85); } catch (_) { fileToUpload = file; }
      }
      const formData = new FormData();
      formData.append('image', fileToUpload);
      const res = await authFetch('/api/sales/upload-art', { method: 'POST', body: formData });
      const json = await res.json();
      if (res.ok && json.success && json.url) {
        uploaded.push({
          id: `art-${Date.now()}-${++artUploadSeq}-${Math.random().toString(36).slice(2, 6)}`,
          url: json.url,
          previewUrl: previewUrl || json.url,
          name: file.name || `diseno-${artUploadSeq}.jpg`,
        });
      } else {
        if (previewUrl) revokeArtPreviewUrls([{ previewUrl }]);
        errors.push(json.error || `Fallo al subir "${file.name || 'imagen'}" a Cloud Storage.`);
      }
    } catch (_) {
      if (previewUrl) revokeArtPreviewUrls([{ previewUrl }]);
      errors.push(`Error de conexión al subir "${file.name || 'imagen'}" a Cloud Storage.`);
    }
  }

  return { uploaded, errors };
}

export default function CustomArtUploader({
  authFetch, uploadedArts = [], setUploadedArts,
  customImageUrl = '', setCustomImageUrl,
  showUrlInput = false, setShowUrlInput,
  isUploading = false, setIsUploading,
  uploadError = '', setUploadError,
}) {
  const fileInputRef = useRef(null);

  const handleFilesSelected = async (rawFiles) => {
    const files = Array.from(rawFiles || []).filter(Boolean);
    if (files.length === 0 || isUploading) return;
    setUploadError('');
    setIsUploading(true);
    try {
      const { uploaded, errors } = await uploadArtFilesBatch({ files, authFetch });
      if (uploaded.length > 0) setUploadedArts((prev) => [...prev, ...uploaded]);
      if (errors.length > 0) setUploadError(errors.join(' '));
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    handleFilesSelected(selected);
  };

  const handleRemoveArt = (artId) => {
    setUploadedArts((prev) => {
      const target = prev.find((a) => a.id === artId);
      if (target) revokeArtPreviewUrls([target]);
      return prev.filter((a) => a.id !== artId);
    });
    setUploadError('');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-neutral-400 font-semibold">Arte o Fotos para Producción</label>
        {uploadedArts.length > 0 && (
          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>{uploadedArts.length} diseño{uploadedArts.length === 1 ? '' : 's'} listo{uploadedArts.length === 1 ? '' : 's'}</span>
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={handleInputChange}
        disabled={isUploading}
        data-testid="custom-art-file-input"
        className="hidden min-h-[44px]"
      />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFilesSelected(Array.from(e.dataTransfer?.files || [])); }}
        className={`p-2.5 rounded-2xl border-2 border-dashed transition-colors ${
          uploadedArts.length > 0 ? 'border-emerald-500/60 bg-emerald-500/5' : 'border-neutral-800 hover:border-neutral-600 bg-black/40'
        }`}
      >
        <button
          type="button"
          data-testid="custom-art-upload-trigger"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 hover:text-white font-semibold flex items-center justify-center gap-2 text-center transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <><Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" /><span className="text-[11px] text-white">Subiendo imagen(es) a Cloud Storage...</span></>
          ) : uploadedArts.length > 0 ? (
            <><Plus className="w-4 h-4 text-emerald-400 shrink-0" /><span className="text-[11px] text-white">+ Agregar más imágenes a este lote</span></>
          ) : (
            <><Upload className="w-4 h-4 text-white shrink-0" /><span className="text-[11px]">Subir 1 o varias imágenes (JPEG, PNG, WebP máx 15MB)</span></>
          )}
        </button>

        {uploadedArts.length > 0 && (
          <div data-testid="uploaded-arts-list" className="mt-2.5 space-y-1.5 max-h-40 overflow-y-auto pr-0.5">
            {uploadedArts.map((art, idx) => (
              <div key={art.id} className="flex items-center justify-between gap-2 p-2 rounded-xl bg-black/80 border border-neutral-800">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <img src={art.previewUrl || art.url} alt={`Diseño ${idx + 1}`} className="w-10 h-10 object-cover rounded-lg border border-neutral-700 shrink-0 bg-neutral-900" />
                  <div className="min-w-0 flex-1 text-left">
                    <span className="text-[11px] font-bold text-white block">Diseño #{idx + 1}</span>
                    <span className="text-[10px] text-neutral-400 block truncate">{art.name || art.url}</span>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid={`remove-art-btn-${idx}`}
                  aria-label={`Quitar imagen ${idx + 1}`}
                  title="Quitar esta imagen"
                  onClick={() => handleRemoveArt(art.id)}
                  className="min-h-[44px] min-w-[44px] rounded-xl bg-neutral-900 hover:bg-red-950/40 border border-neutral-800 text-neutral-400 hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {uploadedArts.length > 1 && (
          <p className="text-[10px] text-emerald-300 font-medium mt-2 text-center">
            Se agregarán {uploadedArts.length} cuadros individuales al pedido (1 por cada imagen).
          </p>
        )}
      </div>

      {uploadError && <p role="alert" className="text-[11px] text-red-400 font-medium">{uploadError}</p>}

      <div>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="min-h-[44px] px-2 text-[11px] text-neutral-400 hover:text-white underline inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Link2 className="w-3.5 h-3.5 shrink-0" />
          <span>{showUrlInput ? 'Ocultar enlace manual' : '+ Ingresar enlace URL externo (Drive, Dropbox...)'}</span>
        </button>

        {showUrlInput && (
          <input
            type="url"
            value={customImageUrl}
            onChange={(e) => setCustomImageUrl(e.target.value)}
            placeholder="https://storage.googleapis.com/... o enlace de foto"
            className="w-full min-h-[44px] px-3.5 bg-black border border-neutral-800 rounded-xl text-white font-mono text-[11px] focus:border-white focus:outline-none"
          />
        )}
      </div>
    </div>
  );
}
