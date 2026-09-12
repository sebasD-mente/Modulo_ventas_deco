import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';

const INITIAL_EVENT_DATA = { name: '', location: '', startDate: '', endDate: '', salesTarget: 15000, assignedSellerEmail: '', assignedSellerName: '' };

export function useEventsManager({ onEventActivated } = {}) {
  const { authFetch } = useAuth();
  const [events, setEvents] = useState([]), [isLoading, setIsLoading] = useState(true), [errorMsg, setErrorMsg] = useState(null);
  const [selectedEventForSales, setSelectedEventForSales] = useState(null), [eventSalesList, setEventSalesList] = useState([]), [isLoadingSales, setIsLoadingSales] = useState(false);
  const [activatingEvent, setActivatingEvent] = useState(null), [sellerGoogleEmail, setSellerGoogleEmail] = useState(''), [sellerName, setSellerName] = useState(''), [isSubmittingActivation, setIsSubmittingActivation] = useState(false);
  const [eventToArchive, setEventToArchive] = useState(null), [isSubmittingArchive, setIsSubmittingArchive] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null), [isSubmittingDelete, setIsSubmittingDelete] = useState(false), [deleteErrorMsg, setDeleteErrorMsg] = useState(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false), [newEventData, setNewEventData] = useState(INITIAL_EVENT_DATA);
  const [archivedSearchQuery, setArchivedSearchQuery] = useState(''), [archivedDateFilter, setArchivedDateFilter] = useState(''), [showArchivedSection, setShowArchivedSection] = useState(true);

  const loadEvents = async () => {
    setIsLoading(true); setErrorMsg(null);
    try {
      const res = await authFetch('/api/events');
      const json = await res.json();
      if (json.success) setEvents(json.data || []);
      else throw new Error(json.error || 'Error cargando eventos');
    } catch (err) { setErrorMsg(err.message); }
    finally { setIsLoading(false); }
  };
  useEffect(() => { loadEvents(); }, []);

  const viewEventSales = async (event) => {
    setSelectedEventForSales(event); setIsLoadingSales(true);
    try {
      const res = await authFetch(`/api/sales/events/${event.id}`);
      const json = await res.json();
      if (json.success) setEventSalesList(json.data || []);
    } catch (e) { console.error(e); }
    finally { setIsLoadingSales(false); }
  };

  const openActivationModal = (event) => {
    setActivatingEvent(event);
    setSellerGoogleEmail(event.assignedSellerEmail || '');
    setSellerName(event.assignedSellerName || '');
  };

  const handleConfirmActivation = async () => {
    if (!sellerGoogleEmail.trim()) { alert('Debes ingresar el correo de Google del vendedor.'); return; }
    setIsSubmittingActivation(true);
    try {
      const res = await authFetch(`/api/events/${activatingEvent.id}/activate`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedSellerEmail: sellerGoogleEmail.trim(),
          assignedSellerName: sellerName.trim() || sellerGoogleEmail.split('@')[0],
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error activando evento');
      setActivatingEvent(null); await loadEvents();
      if (onEventActivated) onEventActivated(json.data);
    } catch (err) { alert(err.message); }
    finally { setIsSubmittingActivation(false); }
  };

  const handleConfirmArchive = async () => {
    if (!eventToArchive) return;
    setIsSubmittingArchive(true);
    try {
      const res = await authFetch(`/api/events/${eventToArchive.id}/archive`, { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al archivar el evento.');
      setEventToArchive(null); await loadEvents();
    } catch (err) { alert(err.message); }
    finally { setIsSubmittingArchive(false); }
  };

  const handleUnarchiveEvent = async (event) => {
    try {
      const res = await authFetch(`/api/events/${event.id}/unarchive`, { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al restaurar el evento.');
      await loadEvents();
    } catch (err) { alert(err.message); }
  };

  const openDeleteModal = (ev) => { setDeleteErrorMsg(null); setEventToDelete(ev); };

  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;
    setIsSubmittingDelete(true); setDeleteErrorMsg(null);
    try {
      const res = await authFetch(`/api/events/${eventToDelete.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al eliminar el evento.');
      setEventToDelete(null); await loadEvents();
    } catch (err) { setDeleteErrorMsg(err.message); }
    finally { setIsSubmittingDelete(false); }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!newEventData.name || !newEventData.location) { alert('Nombre y ubicación son obligatorios.'); return; }
    try {
      const res = await authFetch('/api/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEventData),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error creando evento');
      setIsCreatingEvent(false); setNewEventData(INITIAL_EVENT_DATA); await loadEvents();
    } catch (err) { alert(err.message); }
  };

  const activeEvents = events.filter((e) => e.status === 'ACTIVO');
  const confirmedEvents = events.filter((e) => e.status === 'CONFIRMADO' || (e.status !== 'ACTIVO' && e.status !== 'ARCHIVADO'));
  const archivedEvents = events.filter((e) => e.status === 'ARCHIVADO');

  const filteredArchivedEvents = useMemo(() => {
    return archivedEvents.filter((ev) => {
      const q = archivedSearchQuery.toLowerCase().trim();
      const matchText = !q || ev.name.toLowerCase().includes(q) || ev.location.toLowerCase().includes(q) ||
        (ev.assignedSellerName && ev.assignedSellerName.toLowerCase().includes(q)) ||
        (ev.assignedSellerEmail && ev.assignedSellerEmail.toLowerCase().includes(q)) ||
        new Date(ev.startDate).toLocaleDateString().toLowerCase().includes(q) ||
        new Date(ev.endDate).toLocaleDateString().toLowerCase().includes(q);

      if (!archivedDateFilter) return matchText;
      const target = new Date(archivedDateFilter).toISOString().slice(0, 10);
      const start = new Date(ev.startDate).toISOString().slice(0, 10);
      const end = new Date(ev.endDate).toISOString().slice(0, 10);
      return matchText && (target === start || target === end || (target >= start && target <= end));
    });
  }, [archivedEvents, archivedSearchQuery, archivedDateFilter]);

  return {
    events, isLoading, errorMsg, loadEvents, activeEvents, confirmedEvents, archivedEvents,
    archivedSearchQuery, setArchivedSearchQuery, archivedDateFilter, setArchivedDateFilter,
    showArchivedSection, setShowArchivedSection, filteredArchivedEvents,
    selectedEventForSales, setSelectedEventForSales, eventSalesList, isLoadingSales, viewEventSales,
    activatingEvent, setActivatingEvent, openActivationModal, sellerGoogleEmail, setSellerGoogleEmail,
    sellerName, setSellerName, isSubmittingActivation, handleConfirmActivation,
    eventToArchive, setEventToArchive, isSubmittingArchive, handleConfirmArchive, handleUnarchiveEvent,
    eventToDelete, setEventToDelete, openDeleteModal, isSubmittingDelete, deleteErrorMsg, setDeleteErrorMsg, handleConfirmDelete,
    isCreatingEvent, setIsCreatingEvent, newEventData, setNewEventData, handleCreateEvent,
  };
}

export default useEventsManager;
