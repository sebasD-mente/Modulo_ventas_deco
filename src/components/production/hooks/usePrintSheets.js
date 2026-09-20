import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';

export default function usePrintSheets() {
  const { authFetch } = useAuth();
  const [sheets, setSheets] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 50, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [materialFilter, setMaterialFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Selected sheet detail state
  const [selectedSheetDetail, setSelectedSheetDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [assignModalSheet, setAssignModalSheet] = useState(null);
  const [detailModalSheetId, setDetailModalSheetId] = useState(null);

  // Candidate unassigned items for workshop loteo
  const [unassignedItems, setUnassignedItems] = useState([]);
  const [isLoadingUnassigned, setIsLoadingUnassigned] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-clear success message after 4s
  useEffect(() => {
    if (!successMsg) return;
    const timer = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [successMsg]);

  // Fetch list of print sheets
  const fetchPrintSheets = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'ALL') params.append('status', statusFilter);
      if (materialFilter && materialFilter !== 'ALL') params.append('material', materialFilter);
      if (debouncedSearchQuery.trim()) params.append('search', debouncedSearchQuery.trim());
      params.append('page', String(page));
      params.append('limit', '50');

      const res = await authFetch(`/api/production/print-sheets?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setSheets(json.data || []);
        if (json.pagination) setPagination(json.pagination);
      } else {
        setErrorMsg(json.error || 'Error al cargar los pliegos de taller.');
      }
    } catch (err) {
      console.error('Error cargando pliegos:', err);
      setErrorMsg(err.message || 'Error de conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, statusFilter, materialFilter, debouncedSearchQuery, page]);

  useEffect(() => {
    fetchPrintSheets();
  }, [fetchPrintSheets]);

  // Fetch candidate unassigned items
  const fetchUnassignedItems = useCallback(async () => {
    try {
      setIsLoadingUnassigned(true);
      const [resPending, resProd] = await Promise.all([
        authFetch('/api/production/items?status=PENDIENTE&limit=100'),
        authFetch('/api/production/items?status=A_PRODUCCION&limit=100'),
      ]);
      const jsonPending = await resPending.json();
      const jsonProd = await resProd.json();

      const combined = [
        ...(jsonPending.success && Array.isArray(jsonPending.data) ? jsonPending.data : []),
        ...(jsonProd.success && Array.isArray(jsonProd.data) ? jsonProd.data : []),
      ];

      const unassigned = combined.filter((it) => !it.printSheetId);
      const unique = Array.from(new Map(unassigned.map((it) => [it.id, it])).values());
      setUnassignedItems(unique);
    } catch (err) {
      console.error('Error cargando obras no asignadas:', err);
    } finally {
      setIsLoadingUnassigned(false);
    }
  }, [authFetch]);

  // Create new print sheet
  const createPrintSheet = useCallback(async ({ material, notes }) => {
    setActionLoadingId('create');
    setErrorMsg(null);
    try {
      const res = await authFetch('/api/production/print-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material, notes: notes?.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al crear el pliego.');
      }
      setSuccessMsg(json.message || `Pliego ${json.data.sheetCode} creado exitosamente.`);
      await fetchPrintSheets();
      return json.data;
    } catch (err) {
      console.error('Error creando pliego:', err);
      setErrorMsg(err.message);
      throw err;
    } finally {
      setActionLoadingId(null);
    }
  }, [authFetch, fetchPrintSheets]);

  // Fetch 360 detail of a print sheet
  const getPrintSheetDetail = useCallback(async (sheetId) => {
    if (!sheetId) return null;
    setDetailLoading(true);
    try {
      const res = await authFetch(`/api/production/print-sheets/${sheetId}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al cargar el detalle del pliego.');
      }
      setSelectedSheetDetail(json.data);
      return json.data;
    } catch (err) {
      console.error('Error obteniendo detalle de pliego:', err);
      setErrorMsg(err.message);
      throw err;
    } finally {
      setDetailLoading(false);
    }
  }, [authFetch]);

  // Assign items to sheet
  const assignItemsToSheet = useCallback(async (sheetId, saleItemIds) => {
    setActionLoadingId(sheetId);
    setErrorMsg(null);
    try {
      const res = await authFetch(`/api/production/print-sheets/${sheetId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleItemIds }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al asignar obras al pliego.');
      }
      setSuccessMsg(json.message || `${saleItemIds.length} obra(s) asignadas exitosamente al pliego.`);
      await fetchPrintSheets();
      if (detailModalSheetId === sheetId) {
        await getPrintSheetDetail(sheetId);
      }
      return json.data;
    } catch (err) {
      console.error('Error asignando obras a pliego:', err);
      setErrorMsg(err.message);
      throw err;
    } finally {
      setActionLoadingId(null);
    }
  }, [authFetch, fetchPrintSheets, detailModalSheetId, getPrintSheetDetail]);

  // Update sheet status
  const updateSheetStatus = useCallback(async (sheetId, status, notes) => {
    setActionLoadingId(sheetId);
    setErrorMsg(null);
    try {
      const res = await authFetch(`/api/production/print-sheets/${sheetId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, notes }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al actualizar estado del pliego.');
      }
      setSuccessMsg(json.message || `Pliego actualizado a estado ${status}.`);
      await fetchPrintSheets();
      if (detailModalSheetId === sheetId) {
        await getPrintSheetDetail(sheetId);
      }
      return json.data;
    } catch (err) {
      console.error('Error actualizando estado del pliego:', err);
      setErrorMsg(err.message);
      throw err;
    } finally {
      setActionLoadingId(null);
    }
  }, [authFetch, fetchPrintSheets, detailModalSheetId, getPrintSheetDetail]);

  // KPI Metrics computed from current sheets
  const stats = useMemo(() => {
    let abiertos = 0;
    let enProduccion = 0;
    let impresos = 0;
    let totalItems = 0;

    for (const s of sheets) {
      if (s.status === 'ABIERTO') abiertos += 1;
      else if (s.status === 'EN_PRODUCCION') enProduccion += 1;
      else if (s.status === 'IMPRESO') impresos += 1;
      totalItems += s._count?.items || (Array.isArray(s.items) ? s.items.length : 0);
    }

    return {
      total: pagination.total || sheets.length,
      abiertos,
      enProduccion,
      impresos,
      totalItems,
    };
  }, [sheets, pagination.total]);

  return {
    sheets,
    pagination,
    page,
    setPage,
    statusFilter,
    setStatusFilter,
    materialFilter,
    setMaterialFilter,
    searchQuery,
    setSearchQuery,
    isLoading,
    actionLoadingId,
    errorMsg,
    setErrorMsg,
    successMsg,
    setSuccessMsg,
    stats,
    selectedSheetDetail,
    detailLoading,
    isCreateOpen,
    setIsCreateOpen,
    assignModalSheet,
    setAssignModalSheet,
    detailModalSheetId,
    setDetailModalSheetId,
    unassignedItems,
    isLoadingUnassigned,
    fetchUnassignedItems,
    fetchPrintSheets,
    createPrintSheet,
    getPrintSheetDetail,
    assignItemsToSheet,
    updateSheetStatus,
    refresh: fetchPrintSheets,
  };
}
