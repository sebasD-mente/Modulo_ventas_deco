import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Truck,
  DollarSign,
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Package,
} from 'lucide-react';
import OrderTrackingCard from './orders/OrderTrackingCard';
import OrderDeliveryModal from './orders/OrderDeliveryModal';
import BalancePaymentModal from './sales/BalancePaymentModal';

export default function OrderTrackingView() {
  const { authFetch } = useAuth();
  const [orders, setOrders] = useState([]);
  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    withBalanceCount: 0,
    totalBalancePending: 0,
    deliveredCount: 0,
    inWorkshopCount: 0,
  });
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modales
  const [paymentSale, setPaymentSale] = useState(null);
  const [deliverySale, setDeliverySale] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (paymentFilter !== 'ALL') params.append('paymentStatus', paymentFilter);
      if (debouncedSearch.trim()) params.append('search', debouncedSearch.trim());

      const res = await authFetch(`/api/sales/orders/tracking?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data || []);
        if (data.metrics) setMetrics(data.metrics);
      }
    } catch (err) {
      console.error('Error cargando seguimiento de pedidos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, paymentFilter, debouncedSearch]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl text-white max-w-2xl mx-auto space-y-6 select-none">
      {/* Encabezado Superior con Refresh */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-950/60 border border-cyan-800/80 flex items-center justify-center text-cyan-400 shadow-inner">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Seguimiento de Pedidos & Logística
              <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300">
                CRM REDES
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Control de taller, despacho por transportadora y cobro de saldos
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchOrders}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-black border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer"
          title="Refrescar lista de pedidos"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

      {/* 4 Tarjetas de Métricas Rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-black border border-neutral-800 rounded-2xl p-3 text-center">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total Pedidos</div>
          <div className="text-xl font-black text-white mt-0.5">{metrics.totalOrders}</div>
        </div>
        <div className="bg-black border border-neutral-800 rounded-2xl p-3 text-center">
          <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Saldo por Cobrar</div>
          <div className="text-base sm:text-lg font-black text-amber-400 mt-0.5 truncate" title={`Q ${metrics.totalBalancePending.toFixed(2)}`}>
            Q {metrics.totalBalancePending.toFixed(2)}
          </div>
        </div>
        <div className="bg-black border border-neutral-800 rounded-2xl p-3 text-center">
          <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">En Taller</div>
          <div className="text-xl font-black text-cyan-400 mt-0.5">{metrics.inWorkshopCount}</div>
        </div>
        <div className="bg-black border border-neutral-800 rounded-2xl p-3 text-center">
          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Entregados</div>
          <div className="text-xl font-black text-emerald-400 mt-0.5">{metrics.deliveredCount}</div>
        </div>
      </div>

      {/* Barra de Filtros de Pago y Búsqueda */}
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-black rounded-2xl border border-neutral-800">
          {[
            { id: 'ALL', label: 'Todos' },
            { id: 'CON_SALDO', label: 'Con Saldo (Cobrar)' },
            { id: 'PAGADO_TOTAL', label: 'Solventados' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPaymentFilter(tab.id)}
              className={`min-h-[44px] px-2 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
                paymentFilter === tab.id
                  ? 'bg-white text-black shadow-md font-black'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por cliente, teléfono WhatsApp o ticket..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[44px] bg-black border border-neutral-700/90 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 shadow-inner placeholder:text-neutral-500"
          />
        </div>
      </div>

      {/* Lista de Pedidos */}
      <div className="space-y-3.5">
        {isLoading ? (
          <div className="py-12 text-center text-neutral-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
            <span>Consultando pedidos y logística...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-black border border-neutral-800/80 rounded-2xl p-8 text-center text-neutral-400 text-xs">
            No se encontraron pedidos con los filtros seleccionados.
          </div>
        ) : (
          orders.map((order) => (
            <OrderTrackingCard
              key={order.id}
              order={order}
              onOpenPayment={(s) => setPaymentSale(s)}
              onOpenDelivery={(s) => setDeliverySale(s)}
            />
          ))
        )}
      </div>

      {/* Modal de Cobro de Saldos (Reutilizado) */}
      {paymentSale && (
        <BalancePaymentModal
          sale={paymentSale}
          onClose={() => setPaymentSale(null)}
          onSuccess={() => {
            setPaymentSale(null);
            fetchOrders();
          }}
        />
      )}

      {/* Modal de Logística de Envío y Despacho */}
      {deliverySale && (
        <OrderDeliveryModal
          sale={deliverySale}
          onClose={() => setDeliverySale(null)}
          onSuccess={() => {
            setDeliverySale(null);
            fetchOrders();
          }}
        />
      )}
    </div>
  );
}
