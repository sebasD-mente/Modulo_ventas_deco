import React from 'react';
import { Loader2, Archive, ChevronDown, ChevronUp, Smartphone, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import useEventsManager from './events/hooks/useEventsManager';
import EventsFilterBar from './events/EventsFilterBar';
import EventCard from './events/EventCard';
import CreateEventModal from './events/modals/CreateEventModal';
import EditEventModal from './events/modals/EditEventModal';
import ActivateEventModal from './events/modals/ActivateEventModal';
import EventExpensesModal from './events/modals/EventExpensesModal';
import EventSalesModal from './events/modals/EventSalesModal';
import EventActionModals from './events/modals/EventActionModals';
import DigitalEventMonitorSection from './events/DigitalEventMonitorSection';

export default function EventsManagementView({ onEventActivated, onEventsChanged }) {
  const { isVendedorRedes, isSuperAdmin } = useAuth();
  const m = useEventsManager({ onEventActivated, onEventsChanged });
  const isVendedorRedesOnly = Boolean(isVendedorRedes && !isSuperAdmin);

  const digitalEvent = m.events?.find((e) => e.id === 'evt-ventas-redes-online') || m.activeEvents?.[0] || m.events?.[0];

  return (
    <div className="bg-[#121212] p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] border border-neutral-800 shadow-2xl space-y-5 text-white max-w-2xl mx-auto">
      {isVendedorRedesOnly ? (
        <div className="space-y-4 select-none">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                <span>Punto de Venta Digital</span>
              </h3>
              <p className="text-xs text-neutral-400">Canal exclusivo permanente para ventas de redes sociales y WhatsApp</p>
            </div>
          </div>

          {m.isLoading ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-7 h-7 text-white animate-spin mb-2" />
              <div className="text-xs text-neutral-400">Cargando punto de venta digital...</div>
            </div>
          ) : m.errorMsg ? (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">⚠️ {m.errorMsg}</div>
          ) : (
            <>
              <div data-testid="permanent-digital-pos-card" className="p-4 rounded-2xl bg-black border border-neutral-800 space-y-3 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span>Punto de Venta Permanente (Activo 24/7)</span>
                    </div>
                    <h4 className="text-sm sm:text-base font-black text-white truncate">Ventas en Línea y Redes Sociales</h4>
                    <p className="text-xs text-neutral-400 truncate">Canal unificado para WhatsApp, Instagram, Facebook y envíos</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#161616] border border-neutral-800 rounded-xl px-3 py-2 text-center flex flex-col items-center justify-center">
                    <span className="text-[10px] uppercase font-bold text-neutral-400">Acumulado Histórico</span>
                    <span className="text-sm sm:text-base font-black text-emerald-400 font-mono whitespace-nowrap">
                      Q {Number(m.digitalPos?.totalSold ?? digitalEvent?.totalSold ?? 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="bg-[#161616] border border-neutral-800 rounded-xl px-3 py-2 text-center flex flex-col items-center justify-center">
                    <span className="text-[10px] uppercase font-bold text-neutral-400">Órdenes</span>
                    <span className="text-sm sm:text-base font-black text-white font-mono whitespace-nowrap">
                      {m.digitalPos?.salesCount ?? digitalEvent?.salesCount ?? 0}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => (m.digitalPos || digitalEvent) && m.viewEventSales(m.digitalPos || digitalEvent)}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs flex items-center justify-center gap-2 transition-transform active:scale-[0.99] cursor-pointer shadow-sm"
                >
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  <span>Ver Ventas</span>
                </button>
              </div>

              {(m.digitalPos?.id || digitalEvent?.id) && (
                <div className="pt-2 border-t border-neutral-800/80">
                  <DigitalEventMonitorSection eventId={m.digitalPos?.id || digitalEvent.id} />
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <>
          <EventsFilterBar onOpenCreateModal={() => m.setIsCreatingEvent(true)} searchQuery={m.archivedSearchQuery} onSearchChange={m.setArchivedSearchQuery} />
          {m.isLoading ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-7 h-7 text-white animate-spin mb-2" />
              <div className="text-xs text-neutral-400">Cargando eventos desde PostgreSQL VPS...</div>
            </div>
          ) : m.errorMsg ? (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">⚠️ {m.errorMsg}</div>
          ) : (
            <div className="space-y-4">
              {/* TARJETA INMUTABLE: PUNTO DE VENTA DIGITAL PERMANENTE (24/7) PARA SUPER_ADMIN */}
              {m.digitalPos && (
                <div
                  data-testid="permanent-digital-pos-card"
                  className="p-3.5 sm:p-4 rounded-2xl bg-black border border-neutral-800 space-y-3 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                        <span>📱 Punto de Venta Permanente (Activo 24/7)</span>
                      </div>
                      <h4 className="text-sm sm:text-base font-black text-white truncate">Ventas en Línea y Redes Sociales</h4>
                      <p className="text-xs text-neutral-400 truncate">Canal unificado para WhatsApp, Instagram, Facebook y envíos</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#161616] border border-neutral-800 rounded-xl px-3 py-2 text-center flex flex-col items-center justify-center">
                      <div className="text-[10px] uppercase font-bold text-neutral-400">Acumulado Histórico</div>
                      <div className="text-sm sm:text-base font-black text-emerald-400 font-mono whitespace-nowrap">
                        Q {Number(m.digitalPos.totalSold || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-[#161616] border border-neutral-800 rounded-xl px-3 py-2 text-center flex flex-col items-center justify-center">
                      <div className="text-[10px] uppercase font-bold text-neutral-400">Órdenes</div>
                      <div className="text-sm sm:text-base font-black text-white font-mono whitespace-nowrap">
                        {m.digitalPos.salesCount || 0}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => m.viewEventSales(m.digitalPos)}
                    className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs flex items-center justify-center gap-2 transition-transform active:scale-[0.99] cursor-pointer shadow-sm"
                  >
                    <BarChart3 className="w-4 h-4 shrink-0" />
                    <span>Ver Ventas</span>
                  </button>
                </div>
              )}

              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Eventos en curso ({m.activeEvents.length})</h4>
                </div>
                {m.activeEvents.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-black border border-neutral-800 text-center text-xs text-neutral-500">No hay ningún evento activo en curso en este momento. Activa uno de los eventos confirmados abajo.</div>
                ) : m.activeEvents.map((ev) => (
                  <EventCard key={ev.id} event={ev} statusType="ACTIVO" onEdit={() => m.setEventToEdit(ev)} onViewSales={() => m.viewEventSales(ev)} onArchive={() => m.setEventToArchive(ev)} onDelete={() => m.openDeleteModal(ev)} onManageExpenses={() => m.setEventForExpenses(ev)} />
                ))}
              </div>

              {m.confirmedEvents.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">Eventos confirmados / Próximos ({m.confirmedEvents.length})</h4>
                  {m.confirmedEvents.map((ev) => (
                    <EventCard key={ev.id} event={ev} statusType="CONFIRMADO" onEdit={() => m.setEventToEdit(ev)} onActivate={() => m.openActivationModal(ev)} onViewSales={() => m.viewEventSales(ev)} onArchive={() => m.setEventToArchive(ev)} onDelete={() => m.openDeleteModal(ev)} onManageExpenses={() => m.setEventForExpenses(ev)} />
                  ))}
                </div>
              )}

              <div className="space-y-2.5 pt-2 border-t border-neutral-800/90">
                <button
                  type="button"
                  data-testid="toggle-archived-events-btn"
                  onClick={() => m.setShowArchivedSection(!m.showArchivedSection)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#161616] hover:bg-neutral-900 border border-neutral-800 flex items-center justify-between cursor-pointer select-none transition-colors"
                >
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                    <Archive className="w-4 h-4 shrink-0" />
                    <span>Eventos Archivados ({m.archivedEvents.length})</span>
                  </div>
                  {m.showArchivedSection ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                </button>
                {m.showArchivedSection && (
                  <div className="space-y-2.5 pt-1">
                    {m.filteredArchivedEvents.map((ev) => (
                      <EventCard key={ev.id} event={ev} statusType="ARCHIVADO" onEdit={() => m.setEventToEdit(ev)} onViewSales={() => m.viewEventSales(ev)} onUnarchive={() => m.handleUnarchiveEvent(ev)} onDelete={() => m.openDeleteModal(ev)} onManageExpenses={() => m.setEventForExpenses(ev)} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <CreateEventModal isOpen={m.isCreatingEvent} onClose={() => m.setIsCreatingEvent(false)} newEventData={m.newEventData} setNewEventData={m.setNewEventData} onSubmit={m.handleCreateEvent} usersList={m.usersList} />
          <EditEventModal isOpen={Boolean(m.eventToEdit)} onClose={() => m.setEventToEdit(null)} event={m.eventToEdit} usersList={m.usersList} onUpdate={m.handleUpdateEvent} isSubmitting={m.isSubmittingUpdate} />
          <ActivateEventModal event={m.activatingEvent} onClose={() => m.setActivatingEvent(null)} sellerGoogleEmail={m.sellerGoogleEmail} setSellerGoogleEmail={m.setSellerGoogleEmail} sellerName={m.sellerName} setSellerName={m.setSellerName} onConfirm={m.handleConfirmActivation} isSubmitting={m.isSubmittingActivation} />
          <EventActionModals eventToArchive={m.eventToArchive} onCloseArchive={() => m.setEventToArchive(null)} onConfirmArchive={m.handleConfirmArchive} isSubmittingArchive={m.isSubmittingArchive} eventToDelete={m.eventToDelete} onCloseDelete={() => { m.setEventToDelete(null); m.setDeleteErrorMsg(null); }} onConfirmDelete={m.handleConfirmDelete} isSubmittingDelete={m.isSubmittingDelete} deleteErrorMsg={m.deleteErrorMsg} />
          <EventExpensesModal isOpen={Boolean(m.eventForExpenses)} event={m.eventForExpenses} onClose={() => m.setEventForExpenses(null)} onExpensesUpdated={() => { m.loadEvents(); onEventsChanged?.(); }} />
        </>
      )}
      <EventSalesModal event={m.selectedEventForSales} salesList={m.eventSalesList} closingsList={m.eventClosingsList} isLoading={m.isLoadingSales} onClose={() => m.setSelectedEventForSales(null)} />
    </div>
  );
}
