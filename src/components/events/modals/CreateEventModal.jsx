import React from 'react';
import { Calendar, X } from 'lucide-react';

export default function CreateEventModal({ isOpen, onClose, newEventData, setNewEventData, onSubmit }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <form
        onSubmit={onSubmit}
        className="bg-[#141414] border border-neutral-800 rounded-[32px] w-full max-w-md p-6 shadow-2xl space-y-4 text-white"
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-white" />
            Registrar nuevo evento
          </h3>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
              Nombre del evento *
            </label>
            <input
              type="text" required placeholder="Ej. Bazar Navideño Majadas 2026"
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
              type="text" required placeholder="Ej. Parque Las Majadas, Zona 11"
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
                type="date" value={newEventData.startDate}
                onChange={(e) => setNewEventData({ ...newEventData, startDate: e.target.value })}
                className="w-full bg-black border border-neutral-700/90 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Fecha fin
              </label>
              <input
                type="date" value={newEventData.endDate}
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
              type="email" placeholder="ej. vendedor@gmail.com"
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
              type="number" min="0" value={newEventData.salesTarget}
              onChange={(e) => setNewEventData({ ...newEventData, salesTarget: e.target.value })}
              className="w-full bg-black border border-neutral-700/90 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
          <button
            type="button" onClick={onClose}
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
  );
}
