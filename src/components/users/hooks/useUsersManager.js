import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';

export const ROLE_DEFINITIONS = [
  { key: 'SUPER_ADMIN', label: '👑 Super Admin', activeClass: 'bg-emerald-950 border-emerald-500 text-emerald-300' },
  { key: 'VENDEDOR', label: '💼 Vendedor POS', activeClass: 'bg-white border-white text-black font-black' },
  { key: 'OPERARIO_1', label: '👷 Op. 1 (Stock)', activeClass: 'bg-amber-950 border-amber-500 text-amber-300' },
  { key: 'OPERARIO_2', label: '🖨️ Op. 2 (Taller)', activeClass: 'bg-cyan-950 border-cyan-500 text-cyan-300' },
];

export function useUsersManager() {
  const { authFetch, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsersAndEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      const [uRes, eRes] = await Promise.all([authFetch('/api/users'), authFetch('/api/events')]);
      const [uData, eData] = await Promise.all([uRes.json(), eRes.json()]);
      if (uData.success && uData.data) setUsers(uData.data);
      if (eData.success && eData.data) setEvents(eData.data);
    } catch (err) {
      console.error('Error cargando usuarios/eventos:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { fetchUsersAndEvents(); }, [fetchUsersAndEvents]);

  const showNotification = (msg, isErr = false) => {
    if (isErr) { setErrorMsg(msg); setTimeout(() => setErrorMsg(null), 4000); }
    else { setMessage(msg); setTimeout(() => setMessage(null), 3000); }
  };

  const handleCreateUser = async ({ fullName, email, roles, assignedEventId }) => {
    if (!email || !email.includes('@')) return showNotification('Ingresa un correo de Google válido.', true);
    if (!fullName?.trim()) return showNotification('Ingresa el nombre completo del empleado.', true);
    if (!roles?.length) return showNotification('Selecciona al menos un rol para el usuario.', true);
    try {
      setIsSubmitting(true);
      const res = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), email: email.trim().toLowerCase(), roles, assignedEventId: assignedEventId || null }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(data.message || 'Usuario pre-autorizado con éxito.');
        setShowCreateModal(false);
        await fetchUsersAndEvents();
        return true;
      }
      showNotification(data.error || 'Error al registrar usuario.', true);
      return false;
    } catch (err) {
      showNotification(err.message || 'Error de conexión con el servidor.', true);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleRole = async (userId, targetRole, currentRoles = []) => {
    try {
      const rolesList = Array.isArray(currentRoles) && currentRoles.length > 0 ? [...currentRoles] : ['VENDEDOR'];
      if (rolesList.includes(targetRole) && rolesList.length === 1) {
        return showNotification('El usuario debe conservar al menos un rol activo.', true);
      }
      const updatedRoles = rolesList.includes(targetRole) ? rolesList.filter((r) => r !== targetRole) : [...rolesList, targetRole];
      const res = await authFetch(`/api/users/${userId}/roles`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: updatedRoles }),
      });
      const data = await res.json();
      data.success ? (showNotification(data.message), fetchUsersAndEvents()) : showNotification(data.error, true);
    } catch (err) { showNotification(err.message, true); }
  };

  const handleAssignEvent = async (userId, eventId) => {
    try {
      const res = await authFetch(`/api/users/${userId}/assign-event`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: eventId || null }),
      });
      const data = await res.json();
      data.success ? (showNotification(data.message), fetchUsersAndEvents()) : showNotification(data.error, true);
    } catch (err) { showNotification(err.message, true); }
  };

  const handleToggleStatus = async (userId) => {
    try {
      const res = await authFetch(`/api/users/${userId}/toggle-status`, { method: 'PATCH' });
      const data = await res.json();
      data.success ? (showNotification(data.message), fetchUsersAndEvents()) : showNotification(data.error, true);
    } catch (err) { showNotification(err.message, true); }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${userName}"? Esta acción revocará de inmediato su acceso al sistema.`)) return;
    try {
      const res = await authFetch(`/api/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      data.success ? (showNotification(data.message), fetchUsersAndEvents()) : showNotification(data.error, true);
    } catch (err) { showNotification(err.message, true); }
  };

  const filteredUsers = useMemo(() => users.filter((u) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = !term || (u.fullName && u.fullName.toLowerCase().includes(term)) || (u.email && u.email.toLowerCase().includes(term));
    const userRoles = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : [u.role || 'VENDEDOR'];
    const matchesRole = !roleFilter || roleFilter === 'ALL' || userRoles.includes(roleFilter);
    return matchesSearch && matchesRole;
  }), [users, searchTerm, roleFilter]);

  return {
    users, events, filteredUsers, isLoading, message, errorMsg,
    searchTerm, setSearchTerm, roleFilter, setRoleFilter,
    showCreateModal, setShowCreateModal, isSubmitting, currentUser,
    roleDefinitions: ROLE_DEFINITIONS, fetchUsersAndEvents,
    handleCreateUser, handleToggleRole, handleAssignEvent, handleToggleStatus, handleDeleteUser,
  };
}

export default useUsersManager;