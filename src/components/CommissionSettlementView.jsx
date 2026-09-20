import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import useCommissionSettlements from './commissions/hooks/useCommissionSettlements';
import SellerCommissionDashboard from './commissions/SellerCommissionDashboard';
import AdminCommissionPanel from './commissions/AdminCommissionPanel';
import SettlementHistoryTable from './commissions/SettlementHistoryTable';
import ConfirmSettlementModal from './commissions/ConfirmSettlementModal';
import MarkSettlementPaidModal from './commissions/MarkSettlementPaidModal';
import SettlementDetailReceiptModal from './commissions/SettlementDetailReceiptModal';
import {
  DollarSign,
  Receipt,
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export default function CommissionSettlementView() {
  const { user, isSuperAdmin, isVendedorRedes } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('tablero');

  // Hook de dominio financiero
  const {
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
    isLoading,
    isLoadingPending,
    isSubmitting,
    errorMsg,
    successMsg,
    fetchPendingCommissions,
    emitSettlement,
    markSettlementPaid,
    fetchSettlementDetail,
  } = useCommissionSettlements();

  // Estados locales para control de modales
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [settlementToPay, setSettlementToPay] = useState(null);
  const [viewingReceiptId, setViewingReceiptId] = useState(null);

  const selectedSeller = sellers.find((s) => s.id === selectedSellerId) || user;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* 1. Cabecera Institucional del Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#121212] border border-neutral-800 rounded-[32px] p-5 sm:p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight">
              {isSuperAdmin ? 'Gestión Gerencial de Comisiones' : 'Mis Comisiones de Venta'}
            </h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              STAND {'{IA}'} • Invariante 20% sobre base neta de productos (flete 100% excluido)
            </p>
          </div>
        </div>

        {/* Selector de Sub-vistas (Tablero vs Historial) */}
        <div className="flex items-center bg-black/60 p-1.5 rounded-2xl border border-neutral-800 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('tablero')}
            className={`min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'tablero'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>{isSuperAdmin ? 'Auditoría & Emisión' : 'Mi Tablero'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('historial')}
            className={`min-h-[44px] px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'historial'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Historial Oficial</span>
          </button>
        </div>
      </div>

      {/* Banners Reactivos de Estado (Éxito / Error) */}
      {successMsg && (
        <div className="bg-emerald-950/60 border border-emerald-800 rounded-2xl p-3.5 text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-950/60 border border-red-800 rounded-2xl p-3.5 text-xs text-red-300 flex items-center gap-2 animate-fadeIn shadow-lg">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 2. Contenido de Sub-vistas */}
      {activeSubTab === 'tablero' && (
        <>
          {isSuperAdmin ? (
            <AdminCommissionPanel
              sellers={sellers}
              selectedSellerId={selectedSellerId}
              setSelectedSellerId={setSelectedSellerId}
              pendingData={pendingData}
              selectedSaleIds={selectedSaleIds}
              toggleSaleSelection={toggleSaleSelection}
              selectAllSales={selectAllSales}
              clearSaleSelection={clearSaleSelection}
              isAllSelected={isAllSelected}
              calculatedSelection={calculatedSelection}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              onEmitClick={() => setIsConfirmModalOpen(true)}
              isLoading={isLoadingPending}
            />
          ) : (
            <SellerCommissionDashboard
              pendingData={pendingData}
              salesWaitingBalance={salesWaitingBalance}
              waitingSummary={waitingSummary}
              isLoading={isLoadingPending}
              onRefresh={() => fetchPendingCommissions()}
            />
          )}
        </>
      )}

      {activeSubTab === 'historial' && (
        <SettlementHistoryTable
          settlements={settlements}
          pagination={pagination}
          page={page}
          setPage={setPage}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          isSuperAdmin={isSuperAdmin}
          onViewReceipt={(id) => setViewingReceiptId(id)}
          onMarkPaid={(settlement) => setSettlementToPay(settlement)}
          isLoading={isLoading}
        />
      )}

      {/* 3. Modales de Acción y Detalle */}
      <ConfirmSettlementModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        seller={selectedSeller}
        calculatedSelection={calculatedSelection}
        onConfirm={emitSettlement}
        isSubmitting={isSubmitting}
      />

      <MarkSettlementPaidModal
        isOpen={Boolean(settlementToPay)}
        onClose={() => setSettlementToPay(null)}
        settlement={settlementToPay}
        onConfirm={markSettlementPaid}
        isSubmitting={isSubmitting}
      />

      <SettlementDetailReceiptModal
        isOpen={Boolean(viewingReceiptId)}
        onClose={() => setViewingReceiptId(null)}
        settlementId={viewingReceiptId}
        fetchSettlementDetail={fetchSettlementDetail}
      />
    </div>
  );
}
