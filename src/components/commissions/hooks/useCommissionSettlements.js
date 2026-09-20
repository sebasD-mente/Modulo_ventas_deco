import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';

export default function useCommissionSettlements(arg1, arg2, arg3) {
  const auth = useAuth();

  // Soporta llamada sin argumentos, con argumentos posicionales o con objeto
  let user = auth?.user;
  let isSuperAdmin = auth?.isSuperAdmin;
  let authFetch = auth?.authFetch;

  if (typeof arg1 === 'object' && arg1 !== null && !arg1.id && !arg1.fullName && (arg1.user || arg1.authFetch)) {
    if (arg1.user !== undefined) user = arg1.user;
    if (arg1.isSuperAdmin !== undefined) isSuperAdmin = arg1.isSuperAdmin;
    if (arg1.authFetch !== undefined) authFetch = arg1.authFetch;
  } else {
    if (arg1 !== undefined) user = arg1;
    if (arg2 !== undefined) isSuperAdmin = arg2;
    if (arg3 !== undefined) authFetch = arg3;
  }

  // Estados de datos
  const [pendingData, setPendingData] = useState({
    totalProductsAmount: 0,
    totalShippingExcluded: 0,
    totalCommission: 0,
    salesCount: 0,
    commissionRate: 0.20,
    sales: [],
  });
  const [salesWaitingBalance, setSalesWaitingBalance] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1, hasNext: false, hasPrev: false });
  const [page, setPage] = useState(1);
  const [sellers, setSellers] = useState([]);

  // Filtros y selección
  const [selectedSellerId, setSelectedSellerId] = useState(isSuperAdmin ? '' : (user?.id || ''));
  const [selectedSaleIds, setSelectedSaleIds] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Estados de carga y feedback
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [isLoadingSettlements, setIsLoadingSettlements] = useState(false);
  const [isLoadingSellers, setIsLoadingSellers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Auto-limpieza de mensaje de éxito
  useEffect(() => {
    if (!successMsg) return;
    const timer = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(timer);
  }, [successMsg]);

  // Si no es super admin, forzar selectedSellerId a su propio ID
  useEffect(() => {
    if (!isSuperAdmin && user?.id) {
      setSelectedSellerId(user.id);
    }
  }, [isSuperAdmin, user?.id]);

  // Cargar lista de vendedores para Super Admin
  const fetchSellers = useCallback(async () => {
    if (!isSuperAdmin || !authFetch) return;
    try {
      setIsLoadingSellers(true);
      const res = await authFetch('/api/users');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const eligibleSellers = json.data.filter((u) => {
          const roles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role];
          return u.status === 'ACTIVO' && (roles.includes('VENDEDOR_REDES') || roles.includes('VENDEDOR'));
        });
        setSellers(eligibleSellers);
        if (!selectedSellerId && eligibleSellers.length > 0) {
          setSelectedSellerId(eligibleSellers[0].id);
        }
      }
    } catch (err) {
      console.error('Error cargando vendedores:', err);
    } finally {
      setIsLoadingSellers(false);
    }
  }, [isSuperAdmin, authFetch, selectedSellerId]);

  // Cargar comisiones pendientes de liquidación y órdenes en espera de saldo
  const fetchPendingCommissions = useCallback(async (sellerIdOverride) => {
    if (!authFetch) return;
    const targetSellerId = sellerIdOverride !== undefined ? sellerIdOverride : selectedSellerId;
    if (isSuperAdmin && !targetSellerId) {
      setPendingData({ totalProductsAmount: 0, totalShippingExcluded: 0, totalCommission: 0, salesCount: 0, commissionRate: 0.20, sales: [] });
      setSalesWaitingBalance([]);
      return;
    }

    try {
      setIsLoadingPending(true);
      setErrorMsg(null);
      const params = new URLSearchParams();
      if (targetSellerId) params.append('sellerId', targetSellerId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const [resPending, resWaiting] = await Promise.all([
        authFetch(`/api/commissions/pending?${params.toString()}`),
        authFetch('/api/sales/events/evt-ventas-redes-online?limit=100').catch(() => null),
      ]);

      const jsonPending = await resPending.json();
      if (jsonPending.success) {
        setPendingData(jsonPending.data || { totalProductsAmount: 0, totalShippingExcluded: 0, totalCommission: 0, salesCount: 0, commissionRate: 0.20, sales: [] });
      } else {
        setErrorMsg(jsonPending.error || 'Error al obtener comisiones pendientes.');
      }

      if (resWaiting && resWaiting.ok) {
        const jsonWaiting = await resWaiting.json();
        if (jsonWaiting.success && Array.isArray(jsonWaiting.data)) {
          const waiting = jsonWaiting.data.filter((s) => {
            const matchesSeller = isSuperAdmin ? (!targetSellerId || s.sellerId === targetSellerId) : s.sellerId === user?.id;
            return matchesSeller && Number(s.balanceDue || 0) > 0;
          });
          setSalesWaitingBalance(waiting);
        }
      }
    } catch (err) {
      console.error('Error consultando comisiones pendientes:', err);
      setErrorMsg(err.message || 'Error de comunicación con el servidor.');
    } finally {
      setIsLoadingPending(false);
    }
  }, [authFetch, isSuperAdmin, selectedSellerId, startDate, endDate, user?.id]);

  // Cargar historial de liquidaciones
  const fetchSettlements = useCallback(async (pageOverride, statusOverride, sellerIdOverride) => {
    if (!authFetch) return;
    const targetPage = pageOverride !== undefined ? pageOverride : page;
    const targetStatus = statusOverride !== undefined ? statusOverride : statusFilter;
    const targetSellerId = sellerIdOverride !== undefined ? sellerIdOverride : selectedSellerId;

    try {
      setIsLoadingSettlements(true);
      setErrorMsg(null);
      const params = new URLSearchParams();
      if (targetSellerId) params.append('sellerId', targetSellerId);
      if (targetStatus && targetStatus !== 'ALL') params.append('status', targetStatus);
      params.append('page', String(targetPage));
      params.append('limit', '20');

      const res = await authFetch(`/api/commissions/settlements?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setSettlements(json.data || []);
        if (json.pagination) setPagination(json.pagination);
      } else {
        setErrorMsg(json.error || 'Error al cargar el historial de liquidaciones.');
      }
    } catch (err) {
      console.error('Error consultando historial de liquidaciones:', err);
      setErrorMsg(err.message || 'Error al consultar historial.');
    } finally {
      setIsLoadingSettlements(false);
    }
  }, [authFetch, page, statusFilter, selectedSellerId]);

  // Carga inicial
  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  useEffect(() => {
    fetchPendingCommissions();
    fetchSettlements();
  }, [fetchPendingCommissions, fetchSettlements]);

  // Gestión de selección reactiva de ventas
  const toggleSaleSelection = useCallback((saleId) => {
    setSelectedSaleIds((prev) => (prev.includes(saleId) ? prev.filter((id) => id !== saleId) : [...prev, saleId]));
  }, []);

  const selectAllSales = useCallback(() => {
    if (!pendingData?.sales) return;
    setSelectedSaleIds(pendingData.sales.map((s) => s.id));
  }, [pendingData?.sales]);

  const clearSaleSelection = useCallback(() => {
    setSelectedSaleIds([]);
  }, []);

  const isAllSelected = useMemo(() => {
    return pendingData.sales.length > 0 && selectedSaleIds.length === pendingData.sales.length;
  }, [pendingData.sales, selectedSaleIds]);

  // Cálculo reactivo en vivo de la selección
  const calculatedSelection = useMemo(() => {
    const selected = (pendingData.sales || []).filter((s) => selectedSaleIds.includes(s.id));
    const count = selected.length;
    const baseAmount = Number(selected.reduce((sum, s) => sum + Number(s.baseProductos || 0), 0).toFixed(2));
    const commissionAmount = Number((baseAmount * 0.20).toFixed(2));
    return { count, baseAmount, commissionAmount };
  }, [pendingData.sales, selectedSaleIds]);

  // Resumen informativo de ventas en espera de saldo
  const waitingSummary = useMemo(() => {
    const count = salesWaitingBalance.length;
    const totalBalance = Number(salesWaitingBalance.reduce((sum, s) => sum + Number(s.balanceDue || 0), 0).toFixed(2));
    return { count, totalBalance };
  }, [salesWaitingBalance]);

  // Emitir liquidación oficial (Super Admin)
  const emitSettlement = useCallback(async ({ sellerId, saleIds, notes } = {}) => {
    if (!authFetch) return { success: false, error: 'No autenticado' };
    const targetSeller = sellerId || selectedSellerId;
    const targetSales = saleIds && saleIds.length > 0 ? saleIds : selectedSaleIds;

    if (!targetSeller) {
      setErrorMsg('Debe seleccionar un vendedor para emitir la liquidación.');
      return { success: false, error: 'Vendedor no seleccionado' };
    }
    if (targetSales.length === 0) {
      setErrorMsg('Debe seleccionar al menos una venta elegible para liquidar.');
      return { success: false, error: 'No hay ventas seleccionadas' };
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const res = await authFetch('/api/commissions/settle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: targetSeller, saleIds: targetSales, notes: notes || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al emitir la liquidación.');
      }
      setSuccessMsg(json.message || `Liquidación ${json.data?.settlementNumber} emitida exitosamente.`);
      setSelectedSaleIds([]);
      await Promise.all([fetchPendingCommissions(targetSeller), fetchSettlements(1, statusFilter, targetSeller)]);
      return { success: true, data: json.data };
    } catch (err) {
      console.error('Error emitiendo liquidación:', err);
      setErrorMsg(err.message || 'Error al procesar la liquidación.');
      return { success: false, error: err.message };
    } finally {
      setIsSubmitting(false);
    }
  }, [authFetch, selectedSellerId, selectedSaleIds, fetchPendingCommissions, fetchSettlements, statusFilter]);

  // Registrar pago bancario de liquidación (Super Admin)
  const markSettlementPaid = useCallback(async (settlementId, { paymentReference, notes } = {}) => {
    if (!authFetch) return { success: false, error: 'No autenticado' };
    if (!paymentReference || paymentReference.trim().length < 3) {
      const msg = 'La referencia bancaria es requerida (mínimo 3 caracteres).';
      setErrorMsg(msg);
      return { success: false, error: msg };
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const res = await authFetch(`/api/commissions/settlements/${settlementId}/pay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference: paymentReference.trim(), notes: notes || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al marcar liquidación como pagada.');
      }
      setSuccessMsg(json.message || 'Desembolso bancario registrado exitosamente.');
      await fetchSettlements();
      return { success: true, data: json.data };
    } catch (err) {
      console.error('Error registrando pago bancario:', err);
      setErrorMsg(err.message || 'Error al registrar el pago.');
      return { success: false, error: err.message };
    } finally {
      setIsSubmitting(false);
    }
  }, [authFetch, fetchSettlements]);

  // Consultar detalle 360 de liquidación por ID
  const fetchSettlementDetail = useCallback(async (settlementId) => {
    if (!authFetch) throw new Error('No autenticado');
    const res = await authFetch(`/api/commissions/settlements/${settlementId}`);
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Error al obtener detalle de la liquidación.');
    }
    return json.data;
  }, [authFetch]);

  return {
    pendingData,
    salesWaitingBalance,
    waitingSummary,
    settlements,
    pagination,
    page,
    setPage,
    sellers,
    selectedSellerId,
    setSelectedSellerId,
    selectedSaleIds,
    toggleSaleSelection,
    selectAllSales,
    clearSaleSelection,
    isAllSelected,
    calculatedSelection,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    statusFilter,
    setStatusFilter,
    isLoading: isLoadingPending || isLoadingSettlements,
    isLoadingPending,
    isLoadingSettlements,
    isLoadingSellers,
    isSubmitting,
    errorMsg,
    setErrorMsg,
    successMsg,
    setSuccessMsg,
    fetchPendingCommissions,
    fetchSettlements,
    fetchSellers,
    emitSettlement,
    markSettlementPaid,
    fetchSettlementDetail,
  };
}
