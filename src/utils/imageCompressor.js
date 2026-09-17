export async function compressImage(file, maxDimension = 1024, quality = 0.75) {
  const maxDim = typeof maxDimension === 'object' ? (maxDimension?.maxDimension || 1024) : (maxDimension || 1024);
  const q = typeof maxDimension === 'object' ? (maxDimension?.quality || 0.75) : (quality || 0.75);
  if (!file || !file.type?.startsWith('image/') || file.type === 'image/svg+xml') return file;
  if (file.size && file.size <= 150 * 1024) return file;
  if (typeof window === 'undefined' && typeof OffscreenCanvas === 'undefined' && typeof createImageBitmap === 'undefined') return file;

  try {
    let width, height, source;
    if (typeof createImageBitmap === 'function') {
      source = await createImageBitmap(file);
      width = source.width; height = source.height;
    } else if (typeof Image !== 'undefined') {
      source = await new Promise((res, rej) => {
        const img = new Image(), url = URL.createObjectURL(file);
        img.onload = () => { URL.revokeObjectURL(url); res(img); };
        img.onerror = (e) => { URL.revokeObjectURL(url); rej(e); };
        img.src = url;
      });
      width = source.naturalWidth || source.width; height = source.naturalHeight || source.height;
    } else return file;

    if (width <= maxDim && height <= maxDim && file.size <= 150 * 1024) { source.close?.(); return file; }

    const ratio = Math.min(maxDim / width, maxDim / height, 1);
    const targetW = Math.max(1, Math.round(width * ratio)), targetH = Math.max(1, Math.round(height * ratio));

    let blob;
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(targetW, targetH), ctx = canvas.getContext('2d');
      ctx.drawImage(source, 0, 0, targetW, targetH);
      blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: q });
    } else if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = targetW; canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(source, 0, 0, targetW, targetH);
      blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));
    }
    source.close?.();
    if (!blob) return file;

    const name = (file.name || 'artwork.jpg').replace(/\.[^.]+$/, '') + '.jpg';
    return typeof File !== 'undefined' ? new File([blob], name, { type: 'image/jpeg' }) : blob;
  } catch {
    return file;
  }
}
export default compressImage;
