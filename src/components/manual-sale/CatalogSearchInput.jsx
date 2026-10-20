import React, { useRef } from 'react';
import { Search, X, Loader2, Camera } from 'lucide-react';

export default function CatalogSearchInput({
  searchQuery, setSearchQuery, searchResults = [], isSearching = false,
  showDropdown = false, setShowDropdown, searchInputRef, searchContainerRef,
  onSelectPoster, onClearSearch, hasSelectedPoster = false,
  isRecognizingPhoto = false, photoError = null, handlePhotoSearch, onPhotoSelected, eventId,
}) {
  const fileInputRef = useRef(null);
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (onPhotoSelected) onPhotoSelected(file);
    else if (handlePhotoSearch) handlePhotoSearch(file, eventId, onSelectPoster);
    e.target.value = '';
  };

  return (
    <div ref={searchContainerRef} className="relative space-y-1.5">
      <input ref={fileInputRef} data-testid="catalog-camera-input" type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
      <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
        <span>1. Buscar póster en catálogo</span>
        {(isSearching || isRecognizingPhoto) && (
          <span className="text-[10px] text-neutral-400 font-normal flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin text-white" /> {isRecognizingPhoto ? 'Escaneando foto IA...' : 'Buscando...'}
          </span>
        )}
      </label>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Escribe el nombre o personaje... (ej. Chainsaw, Spider-Man, Batman, Van Gogh)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults?.length > 0 && !hasSelectedPoster && setShowDropdown) setShowDropdown(true); }}
            className="w-full bg-black border border-neutral-700/90 rounded-2xl pl-11 pr-10 py-3 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={onClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-neutral-400 hover:text-white cursor-pointer"
              title="Limpiar"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <button
          type="button"
          data-testid="catalog-camera-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRecognizingPhoto}
          title="Buscar póster por foto"
          aria-label="Buscar póster por foto"
          className="min-h-[44px] min-w-[44px] px-3 flex items-center justify-center rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/80 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
        >
          {isRecognizingPhoto ? (
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
          ) : (
            <Camera className="w-4 h-4 text-cyan-400" />
          )}
        </button>
      </div>

      {photoError && (
        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">⚠️ {photoError}</div>
      )}

      {!hasSelectedPoster && showDropdown && searchResults?.length > 0 && (
        <div className="absolute z-30 left-0 right-0 mt-1.5 bg-black border border-neutral-800 rounded-2xl shadow-2xl max-h-64 overflow-y-auto no-scrollbar">
          {searchResults.map((poster) => (
            <div key={poster.id} onClick={() => onSelectPoster && onSelectPoster(poster)} className="p-2.5 hover:bg-neutral-900 flex items-center justify-between gap-3 cursor-pointer border-b border-neutral-800/60 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <img src={poster.thumbUrl || poster.imageUrl} alt="" className="w-9 h-12 object-cover rounded-lg border border-neutral-700 shrink-0 bg-neutral-900" />
                <div className="truncate">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">{poster.categoria || 'ARTE'}</span>
                  <span className="font-bold text-xs text-white block truncate">{poster.titulo}</span>
                  <span className="text-[10px] text-neutral-400 block truncate">{poster.subtitulo || ''}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-neutral-400 block">Desde</span>
                <span className="text-xs font-black text-emerald-400">Q{poster.precioMinimo || 25}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
