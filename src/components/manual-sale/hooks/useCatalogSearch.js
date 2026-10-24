import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { searchPostersWithFallback } from '../../../services/catalogCacheService.js';
import { useAiVoiceRecorder } from '../../ai-chat/hooks/useAiVoiceRecorder.js';

export function useCatalogSearch(options = {}) {
  const { authFetch } = useAuth();
  const eventIdFromOptions = typeof options === 'string' ? options : options?.eventId;
  const onSelectFromOptions = typeof options === 'object' ? options?.onSelectPoster : undefined;
  const onClearSelectionFromOptions = typeof options === 'object' ? options?.onClearSelection : undefined;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isRecognizingPhoto, setIsRecognizingPhoto] = useState(false);
  const [isTranscribingVoice, setIsTranscribingVoice] = useState(false);
  const [photoError, setPhotoError] = useState(null);

  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const isSelectingRef = useRef(false);
  const debounceRef = useRef(null);
  const activeAbortRef = useRef(null);
  const photoErrorTimerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isSelectingRef.current) { isSelectingRef.current = false; return; }

    activeAbortRef.current?.abort();

    if (!searchQuery.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSearchResults([]); setIsSearching(false); setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      activeAbortRef.current = controller;

      try {
        const queryText = searchQuery.trim();
        const results = await searchPostersWithFallback(
          async (signal) => {
            const res = await authFetch(`/api/catalog/web-posters?q=${encodeURIComponent(queryText)}&limit=30`, { signal });
            const json = await res.json();
            return json.success ? (json.data || []) : [];
          },
          queryText,
          30,
          { signal: controller?.signal, timeoutMs: 12000 }
        );

        if (!isSelectingRef.current && activeAbortRef.current === controller) {
          setSearchResults(results);
          setShowDropdown(true);
        }
      } catch (err) {
        if (err?.name === 'AbortError' || controller?.signal?.aborted) {
          return;
        }
        console.error('Error buscando pósters:', err);
      } finally {
        if (activeAbortRef.current === controller) {
          setIsSearching(false);
        }
      }
    }, 120);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      activeAbortRef.current?.abort();
    };
  }, [searchQuery]);

  const clearSearch = () => {
    activeAbortRef.current?.abort();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (typeof onClearSelectionFromOptions === 'function') {
      onClearSelectionFromOptions();
    }
    setSearchQuery(''); setSearchResults([]); setIsSearching(false); setShowDropdown(false);
  };

  const selectPoster = (poster) => {
    activeAbortRef.current?.abort();
    isSelectingRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsSearching(false); setShowDropdown(false); setSearchResults([]);
    const title = poster.subtitulo ? `${poster.titulo} - ${poster.subtitulo}` : poster.titulo;
    setSearchQuery(title);
  };

  useEffect(() => {
    return () => {
      if (photoErrorTimerRef.current) clearTimeout(photoErrorTimerRef.current);
    };
  }, []);

  const handlePhotoSearch = async (file, eventIdOverride, onPosterMatched) => {
    const targetEventId = eventIdOverride || eventIdFromOptions || 'evt-ventas-redes-online';
    const targetOnMatched = onPosterMatched || onSelectFromOptions;

    if (!file) return;
    if (!targetEventId) {
      setPhotoError('Selecciona o activa un evento antes de buscar por foto.');
      if (photoErrorTimerRef.current) clearTimeout(photoErrorTimerRef.current);
      photoErrorTimerRef.current = setTimeout(() => setPhotoError(null), 5000);
      return;
    }

    setIsRecognizingPhoto(true);
    setPhotoError(null);
    if (photoErrorTimerRef.current) clearTimeout(photoErrorTimerRef.current);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('eventId', targetEventId);

      const res = await authFetch('/api/ai/recognize-artwork', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json().catch(() => ({}));

      if (json.success && json.isArtworkDetected && json.draftSale?.items?.length > 0) {
        const item = json.draftSale.items[0];
        const matchedPoster = {
          id: item.webPosterId || item.productId,
          titulo: item.baseTitle || json.primaryTitle || item.description,
          subtitulo: item.description !== item.baseTitle ? item.description : '',
          categoria: item.category || json.matchedPoster?.category || 'ARTE',
          thumbUrl: item.thumbUrl || json.imageUrl,
          imageUrl: item.imageUrl || item.thumbUrl || json.imageUrl,
          precioMinimo: item.availableSizes?.[0]?.price || 25,
          sizes: Array.isArray(item.availableSizes) && item.availableSizes.length > 0 ? item.availableSizes : undefined,
        };

        if (targetOnMatched) {
          targetOnMatched(matchedPoster);
        } else {
          selectPoster(matchedPoster);
        }
      } else {
        const msg = json.message || json.error || 'No se identificó la obra en el catálogo oficial.';
        setPhotoError(msg);
        photoErrorTimerRef.current = setTimeout(() => setPhotoError(null), 5000);
      }
    } catch (err) {
      console.error('Error reconociendo póster por foto:', err);
      setPhotoError('Error de conexión al escanear la fotografía.');
      photoErrorTimerRef.current = setTimeout(() => setPhotoError(null), 5000);
    } finally {
      setIsRecognizingPhoto(false);
    }
  };

  const handleVoiceSearch = async (audioBlob, meta = {}) => {
    if (!audioBlob || meta?.empty) return;
    setIsTranscribingVoice(true);
    setPhotoError(null);
    if (photoErrorTimerRef.current) clearTimeout(photoErrorTimerRef.current);

    try {
      const ext = (audioBlob.type || '').includes('mp4') ? 'mp4' : 'webm';
      const formData = new FormData();
      formData.append('audio', audioBlob, `voice-search.${ext}`);

      const res = await authFetch('/api/ai/voice-search', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json().catch(() => ({}));

      if (json.success && json.query && json.query.trim()) {
        const cleanQ = json.query.trim();
        isSelectingRef.current = false;
        if (typeof onClearSelectionFromOptions === 'function') {
          onClearSelectionFromOptions();
        }
        setSearchQuery(cleanQ);
        setShowDropdown(true);
      } else {
        setPhotoError('No se escuchó un nombre de póster claro. Intenta de nuevo.');
        photoErrorTimerRef.current = setTimeout(() => setPhotoError(null), 4500);
      }
    } catch (err) {
      console.error('Error en búsqueda por voz:', err);
      setPhotoError('Error de conexión al procesar la voz.');
      photoErrorTimerRef.current = setTimeout(() => setPhotoError(null), 4500);
    } finally {
      setIsTranscribingVoice(false);
    }
  };

  const voiceRecorder = useAiVoiceRecorder({
    onRecordingComplete: handleVoiceSearch,
    silenceThresholdMs: 1100,
    maxDurationMs: 8000,
  });

  return {
    searchQuery, setSearchQuery, searchResults, setSearchResults,
    isSearching, setIsSearching, showDropdown, setShowDropdown,
    searchInputRef, searchContainerRef, isSelectingRef, clearSearch, selectPoster,
    isRecognizingPhoto, photoError, setPhotoError, handlePhotoSearch,
    recognizeByPhoto: handlePhotoSearch,
    isRecordingVoice: voiceRecorder.isRecording,
    isTranscribingVoice,
    startVoiceSearch: voiceRecorder.startRecording,
    stopVoiceSearch: voiceRecorder.stopRecording,
    handleVoiceSearch,
  };
}

export default useCatalogSearch;
