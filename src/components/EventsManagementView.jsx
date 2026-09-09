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
  DollarSign,
  TrendingUp,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  ShoppingBag,
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
    <div className="space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-400" />
            Gestión de Eventos y Ventas por Stand
          </h2>
          <p className="text-xs text-slate-400">
            Control de eventos en curso, eventos confirmados y asignación de vendedores con cuenta Google
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreatingEvent(true)}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/10 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Evento Confirmado</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-2" />
          <div className="text-xs text-slate-400">Cargando eventos desde PostgreSQL VPS...</div>
        </div>
      ) : errorMsg ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          ⚠️ {errorMsg}
        </div>
      ) : (
        <div className="space-y-8">
          {/* SECCIÓN 1: EVENTOS EN CURSO */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
              <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Eventos En Curso ({activeEvents.length})
              </h3>
            </div>

            {activeEvents.length === 0 ? (
              <div className="p-6 rounded-2xl glass-card border border-slate-800 text-center text-xs text-slate-500">
                No hay ningún evento activo en curso en este momento. Activa uno de los eventos confirmados abajo.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="glass-card p-5 rounded-2xl border-2 border-emerald-500/50 shadow-xl relative overflow-hidden flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                          EN CURSO
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(ev.startDate).toLocaleDateString()} - {new Date(ev.endDate).toLocaleDateString()}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-base text-slate-100">{ev.name}</h4>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </div>
                      </div>

                      {/* Encargado y Correo de Google */}
                      <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1 text-xs">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Encargado del Evento:
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-amber-400" />
                            <span>{ev.assignedSellerName || 'Vendedor Stand'}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-blue-400 font-mono">
                            <Mail className="w-3 h-3" />
                            <span>{ev.assignedSellerEmail || 'Sin correo asignado'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Métricas de Ventas */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-center">
                        <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Total Vendido</span>
                          <span className="text-lg font-black text-emerald-400">
                            Q {Number(ev.totalSold || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Transacciones</span>
                          <span className="text-lg font-black text-slate-200">
                            {ev.salesCount || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botón para ver las ventas */}
                    <div className="mt-4 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => viewEventSales(ev)}
                        className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4 text-amber-400" />
                        <span>Ver Ventas del Evento ({ev.salesCount || 0})</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECCIÓN 2: EVENTOS CONFIRMADOS (POR INICIAR) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-400" />
              Eventos Confirmados / Próximos ({confirmedEvents.length})
            </h3>

            {confirmedEvents.length === 0 ? (
              <div className="p-6 rounded-2xl glass-card border border-slate-800 text-center text-xs text-slate-500">
                No hay más eventos confirmados registrados. Haz clic en "Nuevo Evento Confirmado" arriba.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {confirmedEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="glass-card p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold text-[10px] uppercase tracking-wider">
                          CONFIRMADO
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(ev.startDate).toLocaleDateString()}
                        </span>
                      </div>

                      <h4 className="font-bold text-sm text-slate-100">{ev.name}</h4>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{ev.location}</span>
                      </p>

                      <div className="text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                        <span className="text-[10px] text-slate-500 block uppercase">Encargado Asignado:</span>
                        <span className="font-semibold text-slate-300">
                          {ev.assignedSellerEmail || 'Sin asignar (se asigna al activar)'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openActivationModal(ev)}
                        className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Activar / En Curso</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => viewEventSales(ev)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400" />
                Poner Evento "En Curso"
              </h3>
              <button
                type="button"
                onClick={() => setActivatingEvent(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
              <span className="font-bold text-amber-400 block">{activatingEvent.name}</span>
              <span className="text-slate-400 block">{activatingEvent.location}</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Al activar este evento, todas las nuevas ventas registradas en la app quedarán asignadas a este evento y a su vendedor.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Correo de Google del Vendedor Encargado *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="ej. vendedor@gmail.com o @decovintage.gt"
                    value={sellerGoogleEmail}
                    onChange={(e) => setSellerGoogleEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Nombre del Vendedor (Opcional)
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="ej. Carlos Pérez"
                    value={sellerName}
                    onChange={(e) => setSellerName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActivatingEvent(null)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmActivation}
                disabled={isSubmittingActivation || !sellerGoogleEmail.trim()}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingActivation ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Activando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Confirmar y Poner en Curso</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: VISUALIZADOR DE VENTAS DEL EVENTO */}
      {selectedEventForSales && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
            <div className="px-5 py-3.5 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-400" />
                  Ventas Registradas: {selectedEventForSales.name}
                </h3>
                <span className="text-xs text-slate-400">
                  Total Acumulado: <strong className="text-emerald-400">Q {Number(selectedEventForSales.totalSold || 0).toFixed(2)}</strong> ({eventSalesList.length} transacciones)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEventForSales(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 no-scrollbar text-xs">
              {isLoadingSales ? (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin mb-2" />
                  <span className="text-slate-400">Cargando ventas...</span>
                </div>
              ) : eventSalesList.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No hay ventas registradas todavía para este evento.
                </div>
              ) : (
                eventSalesList.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-400 text-xs">
                        {sale.saleNumber}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(sale.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {sale.items.map((it, idx) => (
                        <div key={idx} className="flex justify-between text-slate-300 text-[11px]">
                          <span>
                            {it.quantity}x {it.description}
                          </span>
                          <span className="font-semibold text-slate-200">
                            Q {Number(it.subtotal).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-300">
                          {sale.payments?.[0]?.method || 'EFECTIVO'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {sale.seller?.fullName || 'Vendedor'}
                        </span>
                      </div>
                      <span className="font-extrabold text-emerald-400 text-sm">
                        Q {Number(sale.totalAmount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 bg-slate-800/90 border-t border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEventForSales(null)}
                className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REGISTRO DE NUEVO EVENTO CONFIRMADO */}
      {isCreatingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <form
            onSubmit={handleCreateEvent}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                Registrar Nuevo Evento Confirmado
              </h3>
              <button
                type="button"
                onClick={() => setIsCreatingEvent(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Nombre del Evento *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Bazar Navideño Majadas 2026"
                  value={newEventData.name}
                  onChange={(e) => setNewEventData({ ...newEventData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Ubicación / Centro Comercial *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Parque Las Majadas, Zona 11"
                  value={newEventData.location}
                  onChange={(e) => setNewEventData({ ...newEventData, location: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Fecha Inicio
                  </label>
                  <input
                    type="date"
                    value={newEventData.startDate}
                    onChange={(e) => setNewEventData({ ...newEventData, startDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Fecha Fin
                  </label>
                  <input
                    type="date"
                    value={newEventData.endDate}
                    onChange={(e) => setNewEventData({ ...newEventData, endDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Correo de Google del Vendedor Asignado
                </label>
                <input
                  type="email"
                  placeholder="ej. vendedor@gmail.com"
                  value={newEventData.assignedSellerEmail}
                  onChange={(e) => setNewEventData({ ...newEventData, assignedSellerEmail: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                  Meta de Ventas (Q)
                </label>
                <input
                  type="number"
                  min="0"
                  value={newEventData.salesTarget}
                  onChange={(e) => setNewEventData({ ...newEventData, salesTarget: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-medium"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreatingEvent(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Guardar Evento Confirmado
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
