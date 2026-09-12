import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';

export function useCatalogSearch() {
  const { authFetch } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchInputRef = useRef(null);
  const searchContainerRef = useRef(null);
  const isSelectingRef = useRef(false);
  const debounceRef = useRef(null);

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
    if (!searchQuery.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSearchResults([]); setIsSearching(false); setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const url = `/api/catalog/web-posters?q=${encodeURIComponent(searchQuery.trim())}&limit=8`;
        const res = await authFetch(url);
        const json = await res.json();
        if (json.success && !isSelectingRef.current) {
          setSearchResults(json.data || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Error buscando pósters:', err);
      } finally {
        setIsSearching(false);
      }
    }, 120);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchQuery]);

  const clearSearch = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSearchQuery(''); setSearchResults([]); setIsSearching(false); setShowDropdown(false);
  };

  const selectPoster = (poster) => {
    isSelectingRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsSearching(false); setShowDropdown(false); setSearchResults([]);
    const title = poster.subtitulo ? `${poster.titulo} - ${poster.subtitulo}` : poster.titulo;
    setSearchQuery(title);
  };

  return {
    searchQuery, setSearchQuery, searchResults, setSearchResults,
    isSearching, setIsSearching, showDropdown, setShowDropdown,
    searchInputRef, searchContainerRef, isSelectingRef, clearSearch, selectPoster,
  };
}

export default useCatalogSearch;
