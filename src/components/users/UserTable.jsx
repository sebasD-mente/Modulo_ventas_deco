import React from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';

export default function UserTable({
  users = [], events = [], currentUser = null, roleDefinitions = [],
  onToggleRole, onAssignEvent, onToggleStatus, onDeleteUser, isLoading = false,
}) {
  if (isLoading) {
    return (
      <div className="py-12 text-center text-neutral-400 text-xs flex flex-col items-center justify-center gap-2">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
        <span>Cargando directorio de usuarios...</span>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-black border border-neutral-800 rounded-2xl p-8 text-center text-neutral-400 text-xs">
        No se encontraron usuarios registrados o coincidentes.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {users.map((u) => {
        const userRolesList = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role || 'VENDEDOR'];
        const hasVendedorRole = userRolesList.includes('VENDEDOR') || userRolesList.includes('SUPER_ADMIN');
        const isSelf = currentUser && currentUser.id === u.id;

        return (
          <div key={u.id} className={`bg-black border rounded-2xl p-4 space-y-3 transition-all ${u.status === 'INACTIVO' ? 'border-neutral-900 opacity-60' : 'border-neutral-800'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {u.avatarUrl ? (
                    <img src={u.avatarUrl} alt={u.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-sm font-bold text-neutral-400">{u.fullName ? u.fullName[0] : 'U'}</span>
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white truncate">{u.fullName}</h4>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      u.status === 'ACTIVO' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'
                    }`}>{u.status}</span>
                    {isSelf && <span className="text-[9px] font-bold bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded">Tú</span>}
                  </div>
                  <div className="text-xs text-neutral-400 truncate">{u.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button" onClick={() => onToggleStatus(u.id)}
                  className="text-xs font-bold text-neutral-400 hover:text-white px-2.5 py-1 rounded-xl bg-neutral-900 border border-neutral-800 cursor-pointer transition-all"
                >{u.status === 'ACTIVO' ? 'Desactivar' : 'Activar'}</button>
                {!isSelf && (
                  <button
                    type="button" onClick={() => onDeleteUser(u.id, u.fullName)} title="Eliminar usuario permanentemente"
                    className="p-1.5 rounded-xl text-neutral-500 hover:text-red-400 bg-neutral-900 border border-neutral-800 hover:border-red-900 cursor-pointer transition-all"
                  ><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-neutral-900">
              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">
                  Roles Asignados (Toca para activar/desactivar simultáneamente):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {roleDefinitions.map((roleDef) => (
                    <button
                      key={roleDef.key} type="button" onClick={() => onToggleRole(u.id, roleDef.key, userRolesList)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] border font-bold transition-all text-center cursor-pointer active:scale-95 ${
                        userRolesList.includes(roleDef.key) ? roleDef.activeClass : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'
                      }`}
                    >{roleDef.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                  Evento Físico Asignado (Para facturación en feria)
                </label>
                <select
                  value={u.assignedEventId || ''} onChange={(e) => onAssignEvent(u.id, e.target.value)} disabled={!hasVendedorRole}
                  className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white disabled:opacity-40 cursor-pointer"
                >
                  <option value="">Sin evento asignado</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.name} ({ev.status})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}