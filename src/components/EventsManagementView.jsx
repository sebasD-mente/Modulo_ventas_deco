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
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl space-y-6 text-white max-w-2xl mx-auto">
      {isVendedorRedesOnly ? (
        <div className="space-y-5 select-none">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <span>Punto de Venta Digital</span>
              </h3>
              <p className="text-xs text-neutral-400">Canal exclusivo permanente para ventas de redes sociales y WhatsApp</p>
            </div>
          </div>

          {m.isLoading ? (
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-2" />
              <div className="text-xs text-neutral-400">Cargando punto de venta digital...</div>
            </div>
          ) : m.errorMsg ? (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">⚠️ {m.errorMsg}</div>
          ) : (
            <>
              <div data-testid="permanent-digital-pos-card" className="p-6 rounded-3xl bg-black border border-neutral-800 space-y-5 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>🟢 Canal Digital Permanente Activo (24/7)</span>
                    </div>
                    <h4 className="text-lg font-black text-white">📱 Ventas en Línea y Redes Sociales</h4>
                    <p className="text-xs text-neutral-400 mt-0.5">Ubicación: <span className="text-neutral-300 font-semibold">Canal Digital (WhatsApp / IG / FB)</span></p>
                  </div>
                  {(m.digitalPos?.totalSold !== undefined || digitalEvent?.totalSold !== undefined) && (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl px-4 py-2.5 text-right shrink-0">
                      <div className="text-[10px] uppercase font-bold text-neutral-400">Total Vendido</div>
                      <div className="text-base font-black text-amber-400">Q {Number(m.digitalPos?.totalSold ?? digitalEvent?.totalSold ?? 0).toFixed(2)}</div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => (m.digitalPos || digitalEvent) && m.viewEventSales(m.digitalPos || digitalEvent)}
                  className="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-400/10 active:scale-[0.99] cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  <span>📊 Ver Ventas y Métricas de este Punto de Venta</span>
                </button>
              </div>

              {/* MONITOR UNIFICADO DEL EVENTO DIGITAL */}
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
            <div className="py-16 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
              <div className="text-xs text-neutral-400">Cargando eventos desde PostgreSQL VPS...</div>
            </div>
          ) : m.errorMsg ? (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">⚠️ {m.errorMsg}</div>
          ) : (
            <div className="space-y-6">
              {/* TARJETA INMUTABLE: PUNTO DE VENTA DIGITAL PERMANENTE (24/7) PARA SUPER_ADMIN */}
              {m.digitalPos && (
                <div
                  data-testid="permanent-digital-pos-card"
                  className="p-5 rounded-3xl bg-neutral-950 border border-purple-900/50 space-y-4 shadow-xl"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-900">
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                        <span>📱 Punto de Venta Permanente (Activo 24/7)</span>
                      </div>
                      <h4 className="text-base sm:text-lg font-black text-white">Ventas en Línea y Redes Sociales</h4>
                      <p className="text-xs text-neutral-400">Canal unificado para WhatsApp, Instagram, Facebook y envíos</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {m.digitalPos.totalSold !== undefined && (
                        <div className="bg-black border border-neutral-800 rounded-xl px-3 py-1.5 text-right">
                          <div className="text-[10px] uppercase font-bold text-neutral-400">Total Vendido</div>
                          <div className="text-sm font-black text-amber-400">Q {Number(m.digitalPos.totalSold).toFixed(2)}</div>
                        </div>
                      )}
                      {m.digitalPos.salesCount !== undefined && (
                        <div className="bg-black border border-neutral-800 rounded-xl px-3 py-1.5 text-right">
                          <div className="text-[10px] uppercase font-bold text-neutral-400">Órdenes</div>
                          <div className="text-sm font-black text-white">{m.digitalPos.salesCount}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {Array.isArray(m.digitalPos.assignedSellers) && m.digitalPos.assignedSellers.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <span className="font-semibold text-neutral-300">Vendedores de Redes:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {m.digitalPos.assignedSellers.map((s) => (
                          <span key={s.id} className="px-2 py-0.5 rounded-lg bg-neutral-900 border border-neutral-800 text-[11px] text-white font-medium">
                            {s.fullName || s.email}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => m.viewEventSales(m.digitalPos)}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <BarChart3 className="w-4 h-4 shrink-0" />
                      <span>Ver Ventas</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => m.setEventToEdit(m.digitalPos)}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4 text-purple-400 shrink-0" />
                      <span>Asignar Vendedores de Redes</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Eventos en curso ({m.activeEvents.length})</h4>
                </div>
                {m.activeEvents.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-black border border-neutral-800 text-center text-xs text-neutral-500">No hay ningún evento activo en curso en este momento. Activa uno de los eventos confirmados abajo.</div>
                ) : m.activeEvents.map((ev) => (
                  <EventCard key={ev.id} event={ev} statusType="ACTIVO" onEdit={() => m.setEventToEdit(ev)} onViewSales={() => m.viewEventSales(ev)} onArchive={() => m.setEventToArchive(ev)} onDelete={() => m.openDeleteModal(ev)} onManageExpenses={() => m.setEventForExpenses(ev)} />
                ))}
              </div>
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">Eventos confirmados / Próximos ({m.confirmedEvents.length})</h4>
                {m.confirmedEvents.map((ev) => (
                  <EventCard key={ev.id} event={ev} statusType="CONFIRMADO" onEdit={() => m.setEventToEdit(ev)} onActivate={() => m.openActivationModal(ev)} onViewSales={() => m.viewEventSales(ev)} onArchive={() => m.setEventToArchive(ev)} onDelete={() => m.openDeleteModal(ev)} onManageExpenses={() => m.setEventForExpenses(ev)} />
                ))}
              </div>
              <div className="space-y-3 pt-4 border-t border-neutral-800/90">
                <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => m.setShowArchivedSection(!m.showArchivedSection)}>
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                    <Archive className="w-4 h-4" /> Eventos Archivados ({m.archivedEvents.length})
                  </div>
                  {m.showArchivedSection ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                </div>
                {m.showArchivedSection && (
                  <div className="space-y-3">
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
