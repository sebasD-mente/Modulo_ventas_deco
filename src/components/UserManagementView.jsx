import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Shield, UserPlus, Calendar, RefreshCw, Check, AlertCircle, ToggleLeft, ToggleRight } from 'lucide-react';

export default function UserManagementView() {
  const { authFetch } = useAuth();
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(null);

  const fetchUsersAndEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const [usersRes, eventsRes] = await Promise.all([
        authFetch('/api/users'),
        authFetch('/api/events'),
      ]);

      const usersData = await usersRes.json();
      const eventsData = await eventsRes.json();

      if (usersData.success && usersData.data) {
        setUsers(usersData.data);
      }
      if (eventsData.success && eventsData.data) {
        setEvents(eventsData.data);
      }
    } catch (err) {
      console.error('Error cargando usuarios/eventos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchUsersAndEvents();
  }, [fetchUsersAndEvents]);

  const handleToggleRole = async (userId, targetRole, currentRoles = []) => {
    try {
      let updatedRoles = [];
      const rolesList = Array.isArray(currentRoles) && currentRoles.length > 0 ? [...currentRoles] : ['VENDEDOR'];

      if (rolesList.includes(targetRole)) {
        // Evitar dejar al usuario sin ningún rol
        if (rolesList.length === 1) {
          alert('El usuario debe conservar al menos un rol activo.');
          return;
        }
        updatedRoles = rolesList.filter((r) => r !== targetRole);
      } else {
        updatedRoles = [...rolesList, targetRole];
      }

      const res = await authFetch(`/api/users/${userId}/roles`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: updatedRoles }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
        setTimeout(() => setMessage(null), 3000);
        fetchUsersAndEvents();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error('Error actualizando roles:', err);
    }
  };

  const handleAssignEvent = async (userId, eventId) => {
    try {
      const res = await authFetch(`/api/users/${userId}/assign-event`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: eventId || null }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
        setTimeout(() => setMessage(null), 3000);
        fetchUsersAndEvents();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error('Error asignando evento:', err);
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      const res = await authFetch(`/api/users/${userId}/toggle-status`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message);
        setTimeout(() => setMessage(null), 3000);
        fetchUsersAndEvents();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error('Error alternando estado:', err);
    }
  };

  const roleDefinitions = [
    { key: 'SUPER_ADMIN', label: '👑 Super Admin', activeClass: 'bg-emerald-950 border-emerald-500 text-emerald-300' },
    { key: 'VENDEDOR', label: '💼 Vendedor POS', activeClass: 'bg-white border-white text-black font-black' },
    { key: 'OPERARIO_1', label: '👷 Op. 1 (Stock)', activeClass: 'bg-amber-950 border-amber-500 text-amber-300' },
    { key: 'OPERARIO_2', label: '🖨️ Op. 2 (Taller)', activeClass: 'bg-cyan-950 border-cyan-500 text-cyan-300' },
  ];

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl text-white max-w-2xl mx-auto space-y-6 select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center text-emerald-400 shadow-inner">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Gestión de Usuarios & Multi-Roles
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                SUPER ADMIN
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Asignación combinada de roles simultáneos y eventos físicos
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchUsersAndEvents}
          className="p-2 rounded-xl bg-black border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>

      {message && (
        <div className="bg-emerald-950/60 border border-emerald-800 rounded-2xl p-3 text-xs text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{message}</span>
        </div>
      )}

      {/* Lista de Usuarios */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-neutral-400 text-xs flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Cargando directorio de usuarios...</span>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-black border border-neutral-800 rounded-2xl p-8 text-center text-neutral-400 text-xs">
            No hay usuarios registrados aún.
          </div>
        ) : (
          users.map((u) => {
            const userRolesList = Array.isArray(u.roles) && u.roles.length > 0
              ? u.roles
              : [u.role || 'VENDEDOR'];
            const hasVendedorRole = userRolesList.includes('VENDEDOR') || userRolesList.includes('SUPER_ADMIN');

            return (
              <div
                key={u.id}
                className={`bg-black border rounded-2xl p-4 space-y-3 transition-all ${
                  u.status === 'INACTIVO' ? 'border-neutral-900 opacity-60' : 'border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt={u.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-neutral-400">{u.fullName[0]}</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white truncate">{u.fullName}</h4>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            u.status === 'ACTIVO'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-red-950 text-red-300 border border-red-800'
                          }`}
                        >
                          {u.status}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400 truncate">{u.email}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleStatus(u.id)}
                    className="text-xs font-bold text-neutral-400 hover:text-white px-2.5 py-1 rounded-xl bg-neutral-900 border border-neutral-800 cursor-pointer"
                  >
                    {u.status === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                  </button>
                </div>

                {/* Controles Multi-Rol y Asignación de Evento */}
                <div className="space-y-2.5 pt-2 border-t border-neutral-900">
                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1.5">
                      Roles Asignados (Toca para activar/desactivar simultáneamente):
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {roleDefinitions.map((roleDef) => {
                        const isAssigned = userRolesList.includes(roleDef.key);
                        return (
                          <button
                            key={roleDef.key}
                            type="button"
                            onClick={() => handleToggleRole(u.id, roleDef.key, userRolesList)}
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] border font-bold transition-all text-center cursor-pointer active:scale-95 ${
                              isAssigned
                                ? roleDef.activeClass
                                : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300'
                            }`}
                          >
                            {roleDef.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                      Evento Físico Asignado (Para facturación en feria)
                    </label>
                    <select
                      value={u.assignedEventId || ''}
                      onChange={(e) => handleAssignEvent(u.id, e.target.value)}
                      disabled={!hasVendedorRole}
                      className="w-full bg-neutral-950 border border-neutral-700/80 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-white disabled:opacity-40 cursor-pointer"
                    >
                      <option value="">Sin evento asignado</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.name} ({ev.status})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
