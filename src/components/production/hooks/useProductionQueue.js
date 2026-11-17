import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';

export function resolveDefaultStatusForBucket(bucket, { isOp1Only, isOp2Only }) {
  if (bucket === 'ARCHIVE') {
    return isOp2Only ? 'IMPRESO' : 'ARCHIVO_OP1';
  }
  if (isOp2Only) return 'A_PRODUCCION';
  if (isOp1Only) return 'PENDIENTE';
  return 'COLA_ACTIVA';
}

const ACTION_FEEDBACK_LABELS = {
  SEPARADO: 'Diseño separado de stock y movido al Archivo de Resueltos.',
  A_PRODUCCION: 'Diseño enviado a impresión y registrado en el Archivo de Resueltos.',
  IMPRESO: 'Diseño marcado como IMPRESO y movido al Archivo de Impresos.',
  PENDIENTE: 'Diseño devuelto a Cola Pendiente.',
};

export default function useProductionQueue() {
  const { authFetch, isSuperAdmin, isOperario1, isOperario2, isVendedorRedes, isVendedor } = useAuth();
  const isVendedorRedesOnly = Boolean(isVendedorRedes && !isSuperAdmin && !isVendedor && !isOperario1 && !isOperario2);
  const isOp1Only = Boolean(isOperario1 && !isOperario2 && !isSuperAdmin);
  const isOp2Only = Boolean(isOperario2 && !isOperario1 && !isSuperAdmin);

  const [sourceTab, setSourceTabState] = useState(() => (isVendedorRedesOnly ? 'PEDIDOS' : 'REPOSICIONES'));
  const [queueBucket, setQueueBucket] = useState('ACTIVE'); // 'ACTIVE' | 'ARCHIVE'
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 500,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [page, setPage] = useState(1);
  const [metrics, setMetrics] = useState({ pending: 0, separated: 0, inProduction: 0, printed: 0, resolved: 0, total: 0 });
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventIdState] = useState('');
  const [statusFilter, setStatusFilterState] = useState(() =>
    resolveDefaultStatusForBucket('ACTIVE', { isOp1Only, isOp2Only })
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);
  const [actionErrorMsg, setActionErrorMsg] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const setSourceTab = useCallback((nextSource) => {
    setSourceTabState(nextSource);
    setPage(1);
  }, []);

  const setSelectedEventId = useCallback((nextEventId) => {
    setSelectedEventIdState(nextEventId);
    setPage(1);
  }, []);

  const setStatusFilter = useCallback((nextStatus) => {
    setStatusFilterState(nextStatus);
    setPage(1);
  }, []);

  const handleBucketChange = useCallback((nextBucket) => {
    setQueueBucket(nextBucket);
    setPage(1);
    setStatusFilterState(resolveDefaultStatusForBucket(nextBucket, { isOp1Only, isOp2Only }));
  }, [isOp1Only, isOp2Only]);

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
      const params = new URLSearchParams();
      if (selectedEventId) params.append('eventId', selectedEventId);
      params.append('source', sourceTab);
      const res = await authFetch(`/api/production/metrics?${params.toString()}`);
      const data = await res.json();
      if (data.success && data.data) setMetrics(data.data);
    } catch (err) {
      console.error('Error cargando métricas de producción:', err);
    }
  }, [authFetch, selectedEventId, sourceTab]);

  const fetchItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedEventId) params.append('eventId', selectedEventId);
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (debouncedSearchQuery.trim()) params.append('search', debouncedSearchQuery.trim());
      params.append('source', sourceTab);
      params.append('page', String(page));
      params.append('limit', '500');
      const res = await authFetch(`/api/production/items?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setItems(data.data);
        if (data.pagination) {
          setPagination(data.pagination);
        } else {
          setPagination({
            total: data.data.length,
            page,
            limit: 500,
            totalPages: 1,
            hasNext: false,
            hasPrev: page > 1,
          });
        }
      }
    } catch (err) {
      console.error('Error cargando obras de producción:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, selectedEventId, statusFilter, debouncedSearchQuery, sourceTab, page]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => { fetchItems(); fetchMetrics(); }, [fetchItems, fetchMetrics]);

  const handleStatusChange = async (itemId, newStatus) => {
    try {
      setUpdatingItemId(itemId);
      setActionErrorMsg(null);
      const res = await authFetch(`/api/production/items/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        const shouldLeaveActiveList =
          queueBucket === 'ACTIVE' &&
          (isOp1Only ||
            isOp2Only ||
            (statusFilter === 'PENDIENTE' && newStatus !== 'PENDIENTE') ||
            (statusFilter === 'A_PRODUCCION' && newStatus !== 'A_PRODUCCION') ||
            (statusFilter === 'COLA_ACTIVA' && !['PENDIENTE', 'A_PRODUCCION'].includes(newStatus)));

        if (shouldLeaveActiveList) {
          setItems((prev) => prev.filter((it) => it.id !== itemId));
        }

        setActionSuccessMsg(ACTION_FEEDBACK_LABELS[newStatus] || `Obra actualizada a ${newStatus}`);
        setTimeout(() => setActionSuccessMsg(null), 3500);
        fetchItems();
        fetchMetrics();
      } else {
        const msg = data.error || 'Error al actualizar estado.';
        setActionErrorMsg(msg);
        setTimeout(() => setActionErrorMsg(null), 4500);
        fetchItems();
        fetchMetrics();
      }
    } catch (err) {
      console.error('Error cambiando estado:', err);
      setActionErrorMsg('Error de conexión al actualizar estado.');
      setTimeout(() => setActionErrorMsg(null), 4500);
    } finally {
      setUpdatingItemId(null);
    }
  };

  const sectionBadge = isSuperAdmin
    ? 'SUPER ADMIN'
    : (isOperario1 && isOperario2
        ? 'PRODUCCIÓN TOTAL'
        : (isOp2Only
            ? 'TALLER DE IMPRESIÓN'
            : (isOp1Only ? 'STOCK & ALISTAMIENTO' : 'OPERADOR')));

  const refresh = useCallback(() => {
    fetchItems();
    fetchMetrics();
  }, [fetchItems, fetchMetrics]);

  return {
    items,
    pagination,
    page,
    setPage,
    metrics,
    events,
    selectedEventId,
    setSelectedEventId,
    queueBucket,
    handleBucketChange,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    sourceTab,
    setSourceTab,
    isLoading,
    updatingItemId,
    actionSuccessMsg,
    actionErrorMsg,
    isSuperAdmin,
    isOperario1,
    isOperario2,
    isOp1Only,
    isOp2Only,
    isVendedorRedesOnly,
    sectionBadge,
    handleStatusChange,
    refresh,
  };
}
