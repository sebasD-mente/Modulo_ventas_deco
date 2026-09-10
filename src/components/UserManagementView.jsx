import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Shield,
  UserPlus,
  Calendar,
  RefreshCw,
  Check,
  AlertCircle,
  Trash2,
  X,
  Mail,
  User,
  ShieldCheck,
} from 'lucide-react';

export default function UserManagementView() {
  const { authFetch, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Estado del formulario para crear nuevo empleado
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRoles, setNewRoles] = useState(['VENDEDOR']);
  const [newEventId, setNewEventId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const showNotification = (msg, isErr = false) => {
    if (isErr) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 4000);
    } else {
      setMessage(msg);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      showNotification('Ingresa un correo electrónico de Google válido.', true);
      return;
    }
    if (!newName.trim()) {
      showNotification('Ingresa el nombre completo del empleado.', true);
      return;
    }
    if (newRoles.length === 0) {
      showNotification('Selecciona al menos un rol para el usuario.', true);
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          roles: newRoles,
          assignedEventId: newEventId || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showNotification(data.message || 'Usuario pre-autorizado con éxito.');
        setShowCreateModal(false);
        setNewName('');
        setNewEmail('');
        setNewRoles(['VENDEDOR']);
        setNewEventId('');
        fetchUsersAndEvents();
      } else {
        showNotification(data.error || 'Error al registrar usuario.', true);
      }
    } catch (err) {
      showNotification(err.message || 'Error de conexión con el servidor.', true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleNewRole = (roleKey) => {
    if (newRoles.includes(roleKey)) {
      if (newRoles.length === 1) return;
      setNewRoles(newRoles.filter((r) => r !== roleKey));
    } else {
      setNewRoles([...newRoles, roleKey]);
    }
  };

  const handleToggleRole = async (userId, targetRole, currentRoles = []) => {
    try {
      let updatedRoles = [];
      const rolesList = Array.isArray(currentRoles) && currentRoles.length > 0 ? [...currentRoles] : ['VENDEDOR'];

      if (rolesList.includes(targetRole)) {
        if (rolesList.length === 1) {
          showNotification('El usuario debe conservar al menos un rol activo.', true);
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
        showNotification(data.message);
        fetchUsersAndEvents();
      } else {
        showNotification(data.error, true);
      }
    } catch (err) {
      showNotification(err.message, true);
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
        showNotification(data.message);
        fetchUsersAndEvents();
      } else {
        showNotification(data.error, true);
      }
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      const res = await authFetch(`/api/users/${userId}/toggle-status`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (data.success) {
        showNotification(data.message);
        fetchUsersAndEvents();
      } else {
        showNotification(data.error, true);
      }
    } catch (err) {
      showNotification(err.message, true);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${userName}"? Esta acción revocará de inmediato su acceso al sistema.`)) {
      return;
    }

    try {
      const res = await authFetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        showNotification(data.message);
        fetchUsersAndEvents();
      } else {
        showNotification(data.error, true);
      }
    } catch (err) {
      showNotification(err.message, true);
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
              Autorización y asignación de permisos para cuentas de Google
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all cursor-pointer shadow-lg shadow-emerald-500/10 active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span>Registrar Empleado</span>
          </button>

          <button
            type="button"
            onClick={fetchUsersAndEvents}
            className="p-2 rounded-xl bg-black border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer"
            title="Refrescar lista"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Alertas */}
      {message && (
        <div className="bg-emerald-950/60 border border-emerald-800 rounded-2xl p-3 text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-950/60 border border-red-800 rounded-2xl p-3 text-xs text-red-300 flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Modal / Card para Registrar Nuevo Empleado */}
      {showCreateModal && (
        <div className="bg-black border border-emerald-500/40 rounded-3xl p-5 space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2 font-bold text-sm text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Autorizar Nuevo Empleado / Usuario</span>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-3.5">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-neutral-400" />
                <span>Nombre Completo:</span>
              </label>
              <input
                type="text"
                placeholder="Ej: Marcos López"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-neutral-400" />
                <span>Correo Electrónico de Google (Gmail / Workspace):</span>
              </label>
              <input
                type="email"
                placeholder="Ej: empleado@gmail.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-neutral-500">
                Solo este correo podrá iniciar sesión con Google OAuth 2.0.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-300 block">
                Roles Iniciales Asignados:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {roleDefinitions.map((rDef) => {
                  const isSelected = newRoles.includes(rDef.key);
                  return (
                    <button
                      key={rDef.key}
                      type="button"
                      onClick={() => handleToggleNewRole(rDef.key)}
                      className={`px-2 py-1.5 rounded-xl text-[11px] font-bold border transition-all text-center cursor-pointer ${
                        isSelected
                          ? rDef.activeClass
                          : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-700'
                      }`}
                    >
                      {rDef.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-400" />
                <span>Asignar a Evento Físico (Opcional):</span>
              </label>
              <select
                value={newEventId}
                onChange={(e) => setNewEventId(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="">Sin evento asignado</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isSubmitting ? 'Guardando...' : 'Autorizar y Guardar'}
              </button>
            </div>
          </form>
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
            const isSelf = currentUser && currentUser.id === u.id;

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
                        {isSelf && (
                          <span className="text-[9px] font-bold bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded">
                            Tú
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400 truncate">{u.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(u.id)}
                      className="text-xs font-bold text-neutral-400 hover:text-white px-2.5 py-1 rounded-xl bg-neutral-900 border border-neutral-800 cursor-pointer transition-all"
                    >
                      {u.status === 'ACTIVO' ? 'Desactivar' : 'Activar'}
                    </button>

                    {!isSelf && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u.id, u.fullName)}
                        className="p-1.5 rounded-xl text-neutral-500 hover:text-red-400 bg-neutral-900 border border-neutral-800 hover:border-red-900 cursor-pointer transition-all"
                        title="Eliminar usuario permanentemente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
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
