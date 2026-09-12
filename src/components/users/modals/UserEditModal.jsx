import React, { useState } from 'react';
import { ShieldCheck, X, User, Mail, Calendar, Loader2 } from 'lucide-react';

export default function UserEditModal({
  isOpen = false, onClose, events = [], onSubmit, isSubmitting = false, roleDefinitions = [],
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState(['VENDEDOR']);
  const [eventId, setEventId] = useState('');

  if (!isOpen) return null;

  const handleToggleRole = (roleKey) => {
    if (roles.includes(roleKey)) {
      if (roles.length > 1) setRoles(roles.filter((r) => r !== roleKey));
    } else {
      setRoles([...roles, roleKey]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await onSubmit({ fullName: name, email, roles, assignedEventId: eventId });
    if (success) { setName(''); setEmail(''); setRoles(['VENDEDOR']); setEventId(''); }
  };

  return (
    <div className="bg-black border border-emerald-500/40 rounded-3xl p-5 space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2 font-bold text-sm text-white">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Autorizar Nuevo Empleado / Usuario</span>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-neutral-400" />
            <span>Nombre Completo:</span>
          </label>
          <input
            type="text" placeholder="Ej: Marcos López" value={name} onChange={(e) => setName(e.target.value)} required
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-neutral-400" />
            <span>Correo Electrónico de Google (Gmail / Workspace):</span>
          </label>
          <input
            type="email" placeholder="Ej: empleado@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
          />
          <p className="text-[10px] text-neutral-500">Solo este correo podrá iniciar sesión con Google OAuth 2.0.</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-bold text-neutral-300 block">Roles Iniciales Asignados:</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {roleDefinitions.map((rDef) => (
              <button
                key={rDef.key} type="button" onClick={() => handleToggleRole(rDef.key)}
                className={`px-2 py-1.5 rounded-xl text-[11px] font-bold border transition-all text-center cursor-pointer ${
                  roles.includes(rDef.key) ? rDef.activeClass : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'
                }`}
              >{rDef.label}</button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-neutral-400" />
            <span>Asignar a Evento Físico (Opcional):</span>
          </label>
          <select
            value={eventId} onChange={(e) => setEventId(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="">Sin evento asignado</option>
            {events.map((ev) => (<option key={ev.id} value={ev.id}>{ev.name} ({ev.status})</option>))}
          </select>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-xl text-xs font-bold text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800 cursor-pointer">
            Cancelar
          </button>
          <button
            type="submit" disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isSubmitting ? 'Guardando...' : 'Autorizar y Guardar'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}