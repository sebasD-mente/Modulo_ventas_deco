import React, { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Mail,
  User,
  CheckCircle,
  Play,
  Clock,
  Plus,
  Eye,
  X,
  Loader2,
} from 'lucide-react';

export default function EventsManagementView({ onEventActivated }) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Modales
  const [selectedEventForSales, setSelectedEventForSales] = useState(null);
  const [eventSalesList, setEventSalesList] = useState([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);

  const [activatingEvent, setActivatingEvent] = useState(null);
  const [sellerGoogleEmail, setSellerGoogleEmail] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [isSubmittingActivation, setIsSubmittingActivation] = useState(false);

  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [newEventData, setNewEventData] = useState({
    name: '',
    location: '',
    startDate: '',
    endDate: '',
    salesTarget: 15000,
    assignedSellerEmail: '',
    assignedSellerName: '',
  });

  // Cargar lista de eventos
  const loadEvents = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/events');
      const json = await res.json();
      if (json.success) {
        setEvents(json.data || []);
      } else {
        throw new Error(json.error || 'Error cargando eventos');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  // Cargar ventas de un evento específico
  const viewEventSales = async (event) => {
    setSelectedEventForSales(event);
    setIsLoadingSales(true);
    try {
      const res = await fetch(`/api/sales/events/${event.id}`);
      const json = await res.json();
      if (json.success) {
        setEventSalesList(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingSales(false);
    }
  };

  // Abrir modal de activación de evento
  const openActivationModal = (event) => {
    setActivatingEvent(event);
    setSellerGoogleEmail(event.assignedSellerEmail || '');
    setSellerName(event.assignedSellerName || '');
  };

  // Confirmar activación a 'EN CURSO' con correo de Google
  const handleConfirmActivation = async () => {
    if (!sellerGoogleEmail.trim()) {
      alert('Debes ingresar el correo de Google del vendedor para activar el evento.');
      return;
    }

    setIsSubmittingActivation(true);
    try {
      const res = await fetch(`/api/events/${activatingEvent.id}/activate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedSellerEmail: sellerGoogleEmail.trim(),
          assignedSellerName: sellerName.trim() || sellerGoogleEmail.split('@')[0],
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error activando evento');
      }

      setActivatingEvent(null);
      await loadEvents();
      if (onEventActivated) onEventActivated(json.data);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setIsSubmittingActivation(false);
    }
  };

  // Crear nuevo evento confirmado
  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!newEventData.name || !newEventData.location) {
      alert('Nombre y ubicación son obligatorios.');
      return;
    }

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEventData),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error creando evento');
      }

      setIsCreatingEvent(false);
      setNewEventData({
        name: '',
        location: '',
        startDate: '',
        endDate: '',
        salesTarget: 15000,
        assignedSellerEmail: '',
        assignedSellerName: '',
      });
      await loadEvents();
    } catch (err) {
      alert(err.message);
    }
  };

  // Separar eventos en curso vs confirmados
  const activeEvents = events.filter((e) => e.status === 'ACTIVO');
  const confirmedEvents = events.filter((e) => e.status !== 'ACTIVO');

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl space-y-6 text-white max-w-2xl mx-auto">
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-white" />
            Gestión de eventos
          </h3>
          <p className="text-xs text-neutral-400">
            Control de eventos activos, confirmados y asignación de vendedores
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreatingEvent(true)}
          className="px-4 py-2 rounded-full bg-white hover:bg-neutral-200 text-black font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo evento</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
          <div className="text-xs text-neutral-400">Cargando eventos desde PostgreSQL VPS...</div>
        </div>
      ) : errorMsg ? (
        <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
          ⚠️ {errorMsg}
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECCIÓN 1: EVENTOS EN CURSO */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Eventos en curso ({activeEvents.length})
              </h4>
            </div>

            {activeEvents.length === 0 ? (
              <div className="p-6 rounded-2xl bg-black border border-neutral-800 text-center text-xs text-neutral-500">
                No hay ningún evento activo en curso en este momento. Activa uno de los eventos confirmados abajo.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {activeEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-4 sm:p-5 rounded-2xl bg-black border-2 border-emerald-500/70 shadow-xl space-y-4 relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-3 py-1 rounded-full border border-emerald-500 bg-white text-emerald-600 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          EN CURSO
                        </span>
                        <span className="text-[11px] text-neutral-400 font-medium">
                          {new Date(ev.startDate).toLocaleDateString()} - {new Date(ev.endDate).toLocaleDateString()}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-base text-white">{ev.name}</h4>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </div>
                      </div>

                      {/* Encargado y Correo de Google */}
                      <div className="p-3 rounded-xl bg-[#181818] border border-neutral-800 space-y-1 text-xs">
                        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                          Encargado del evento:
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-white" />
                            <span>{ev.assignedSellerName || 'Vendedor Stand'}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-neutral-300 font-mono">
                            <Mail className="w-3 h-3 text-neutral-400" />
                            <span>{ev.assignedSellerEmail || 'Sin correo asignado'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Métricas de Ventas */}
                      <div className="grid grid-cols-2 gap-2 pt-1 text-center">
                        <div className="p-2.5 rounded-xl bg-[#181818] border border-neutral-800">
                          <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Total Vendido</span>
                          <span className="text-lg font-black text-emerald-400 font-mono">
                            Q {Number(ev.totalSold || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[#181818] border border-neutral-800">
                          <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Transacciones</span>
                          <span className="text-lg font-black text-white font-mono">
                            {ev.salesCount || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botón para ver las ventas */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => viewEventSales(ev)}
                        className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer shadow-md"
                      >
                        <Eye className="w-4 h-4" />
                        <span>Ver ventas del evento ({ev.salesCount || 0})</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECCIÓN 2: EVENTOS CONFIRMADOS (POR INICIAR) */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              Eventos confirmados / Próximos ({confirmedEvents.length})
            </h4>

            {confirmedEvents.length === 0 ? (
              <div className="p-6 rounded-2xl bg-black border border-neutral-800 text-center text-xs text-neutral-500">
                No hay más eventos confirmados registrados. Haz clic en "Nuevo evento" arriba.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {confirmedEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-4 rounded-2xl bg-black border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 font-bold text-[10px] uppercase tracking-wider">
                          CONFIRMADO
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {new Date(ev.startDate).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-white">{ev.name}</h4>
                      <p className="text-xs text-neutral-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-neutral-400 shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </p>

                      <div className="text-xs text-neutral-400 pt-2 border-t border-neutral-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-neutral-500 uppercase font-semibold">Encargado:</span>
                        <span className="font-semibold text-neutral-300 text-[11px] truncate max-w-[200px]">
                          {ev.assignedSellerEmail || 'Sin asignar'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-800/80 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openActivationModal(ev)}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Activar / En curso</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => viewEventSales(ev)}
                        className="p-2 rounded-xl bg-[#181818] hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:text-white cursor-pointer"
                        title="Ver historial de ventas"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 1: ACTIVAR EVENTO Y ASIGNAR VENDEDOR CON CORREO DE GOOGLE */}
      {activatingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#141414] border border-neutral-800 rounded-[32px] w-full max-w-md p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400" />
                Poner evento "En curso"
              </h3>
              <button
                type="button"
                onClick={() => setActivatingEvent(null)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-black border border-neutral-800 text-xs text-neutral-300 space-y-1">
              <span className="font-bold text-white block">{activatingEvent.name}</span>
              <span className="text-neutral-400 block">{activatingEvent.location}</span>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Al activar este evento, todas las nuevas ventas registradas en la app quedarán asignadas a este stand y vendedor.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
                  Correo de Google del vendedor encargado *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="ej. vendedor@gmail.com o @decovintage.gt"
                    value={sellerGoogleEmail}
                    onChange={(e) => setSellerGoogleEmail(e.target.value)}
                    className="w-full bg-black border border-neutral-700/90 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
                  Nombre del vendedor (Opcional)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="ej. Carlos Pérez"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    className="w-full bg-black border border-neutral-700/90 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActivatingEvent(null)}
                className="px-4 py-2 rounded-xl border border-neutral-800 text-neutral-400 text-xs font-bold hover:text-white hover:border-neutral-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmActivation}
                disabled={isSubmittingActivation || !sellerGoogleEmail.trim()}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer transition-transform active:scale-95"
              >
                {isSubmittingActivation ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Activando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Confirmar y poner en curso</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: VISUALIZADOR DE VENTAS DEL EVENTO */}
      {selectedEventForSales && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#141414] border border-neutral-800 rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-white">
            <div className="px-6 py-4 bg-[#181818] border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-white" />
                  Ventas registradas: {selectedEventForSales.name}
                </h3>
                <span className="text-xs text-neutral-400">
                  Total Acumulado: <strong className="text-emerald-400 font-mono">Q {Number(selectedEventForSales.totalSold || 0).toFixed(2)}</strong> ({eventSalesList.length} transacciones)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEventForSales(null)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1 no-scrollbar text-xs">
              {isLoadingSales ? (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin mb-2" />
                  <span className="text-neutral-400">Cargando ventas...</span>
                </div>
              ) : eventSalesList.length === 0 ? (
                <div className="p-8 text-center text-neutral-500">
                  No hay ventas registradas todavía para este evento.
                </div>
              ) : (
                eventSalesList.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-3.5 rounded-2xl bg-black border border-neutral-800 space-y-2 hover:border-neutral-700 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-white text-xs">
                        {sale.saleNumber}
                      </span>
                      <span className="text-[10px] text-neutral-400">
                        {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(sale.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {sale.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-neutral-300 text-[11px]">
                          <span>
                            {it.quantity}x {it.description}
                          </span>
                          <span className="font-semibold text-neutral-200 font-mono">
                            Q {Number(it.subtotal).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#181818] border border-neutral-800 text-neutral-300">
                          {sale.payments?.[0]?.method || 'EFECTIVO'}
                        </span>
                        <span className="text-[10px] text-neutral-400">
                          {sale.seller?.fullName || 'Vendedor'}
                        </span>
                      </div>
                      <span className="font-extrabold text-emerald-400 text-sm font-mono">
                        Q {Number(sale.totalAmount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3.5 bg-[#181818] border-t border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEventForSales(null)}
                className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs cursor-pointer shadow-md transition-transform active:scale-95"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTRO DE NUEVO EVENTO CONFIRMADO */}
      {isCreatingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <form
            onSubmit={handleCreateEvent}
            className="bg-[#141414] border border-neutral-800 rounded-[32px] w-full max-w-md p-6 shadow-2xl space-y-4 text-white"
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-white" />
                Registrar nuevo evento
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatingEvent(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
                  Nombre del evento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Bazar Navideño Majadas 2026"
                  value={newEventData.name}
                  onChange={(e) => setNewEventData({ ...newEventData, name: e.target.value })}
                  className="w-full bg-black border border-neutral-700/90 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
                  Ubicación / Centro comercial *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Parque Las Majadas, Zona 11"
                  value={newEventData.location}
                  onChange={(e) => setNewEventData({ ...newEventData, location: e.target.value })}
                  className="w-full bg-black border border-neutral-700/90 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    value={newEventData.startDate}
                    onChange={(e) => setNewEventData({ ...newEventData, startDate: e.target.value })}
                    className="w-full bg-black border border-neutral-700/90 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                    Fecha fin
                  </label>
                  <input
                    type="date"
                    value={newEventData.endDate}
                    onChange={(e) => setNewEventData({ ...newEventData, endDate: e.target.value })}
                    className="w-full bg-black border border-neutral-700/90 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
                  Correo de Google del vendedor asignado
                </label>
                <input
                  type="email"
                  placeholder="ej. vendedor@gmail.com"
                  value={newEventData.assignedSellerEmail}
                  onChange={(e) => setNewEventData({ ...newEventData, assignedSellerEmail: e.target.value })}
                  className="w-full bg-black border border-neutral-700/90 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
                  Meta de ventas (Q)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newEventData.salesTarget}
                  onChange={(e) => setNewEventData({ ...newEventData, salesTarget: e.target.value })}
                  className="w-full bg-black border border-neutral-700/90 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingEvent(false)}
                className="px-4 py-2 rounded-xl border border-neutral-800 text-neutral-400 text-xs font-bold hover:text-white hover:border-neutral-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer"
              >
                Guardar evento
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
