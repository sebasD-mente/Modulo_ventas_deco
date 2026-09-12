import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';

export default function useProductionQueue() {
  const { authFetch, isSuperAdmin, isOperario1, isOperario2 } = useAuth();
  const [items, setItems] = useState([]);
  const [metrics, setMetrics] = useState({ pending: 0, separated: 0, inProduction: 0, printed: 0, total: 0 });
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await authFetch('/api/events');
      const data = await res.json();
      if (data.success && data.data) setEvents(data.data);
    } catch (err) {
      console.error('Error cargando eventos:', err);
    }
  }, [authFetch]);

  const fetchMetrics = useCallback(async () => {
    try {
      const url = selectedEventId ? `/api/production/metrics?eventId=${selectedEventId}` : '/api/production/metrics';
      const res = await authFetch(url);
      const data = await res.json();
      if (data.success && data.data) setMetrics(data.data);
    } catch (err) {
      console.error('Error cargando métricas de producción:', err);
    }
  }, [authFetch, selectedEventId]);

  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedEventId) params.append('eventId', selectedEventId);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (debouncedSearchQuery.trim()) params.append('search', debouncedSearchQuery.trim());
      const res = await authFetch(`/api/production/items?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.data) setItems(data.data);
    } catch (err) {
      console.error('Error cargando obras de producción:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, selectedEventId, statusFilter, debouncedSearchQuery]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchItems(); fetchMetrics(); }, [fetchItems, fetchMetrics]);

  const handleStatusChange = async (itemId, newStatus) => {
    try {
      setUpdatingItemId(itemId);
      const res = await authFetch(`/api/production/items/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccessMsg(`Obra actualizada a ${newStatus}`);
        setTimeout(() => setActionSuccessMsg(null), 3000);
        fetchItems();
        fetchMetrics();
      } else {
        alert(data.error || 'Error al actualizar estado.');
      }
    } catch (err) {
      console.error('Error cambiando estado:', err);
      alert('Error de conexión al actualizar estado.');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const isOp2Only = Boolean(isOperario2 && !isOperario1 && !isSuperAdmin);
  const sectionBadge = isSuperAdmin
    ? 'SUPER ADMIN'
    : (isOperario1 && isOperario2
        ? 'PRODUCCIÓN TOTAL'
        : (isOperario2 ? 'TALLER' : (isOperario1 ? 'STOCK & PRODUCCIÓN' : 'OPERADOR')));

  const refresh = useCallback(() => {
    fetchItems();
    fetchMetrics();
  }, [fetchItems, fetchMetrics]);

  return {
    items, metrics, events,
    selectedEventId, setSelectedEventId,
    statusFilter, setStatusFilter,
    searchQuery, setSearchQuery, debouncedSearchQuery,
    isLoading, updatingItemId, actionSuccessMsg,
    isSuperAdmin, isOperario1, isOperario2, isOp2Only, sectionBadge,
    handleStatusChange, refresh,
  };
}
