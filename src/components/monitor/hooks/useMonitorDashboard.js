import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';

const getGuatemalaDateStr = () => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
};

const getGuatemalaTimeStr = () => {
  return new Date().toLocaleTimeString('es-GT', {
    timeZone: 'America/Guatemala',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export function useMonitorDashboard() {
  const { authFetch } = useAuth();
  const [selectedDate, setSelectedDate] = useState(getGuatemalaDateStr());
  const [monitorData, setMonitorData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(getGuatemalaTimeStr());
  const [expandedEvents, setExpandedEvents] = useState({});
  const pollingRef = useRef(null);

  const fetchMonitorData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await authFetch(`/api/sales/monitor?date=${selectedDate}`);
      const json = await res.json();
      if (json.success && json.data) {
        setMonitorData(json.data);
        setLastSyncTime(getGuatemalaTimeStr());

        setExpandedEvents((prev) => {
          if (Object.keys(prev).length === 0 && json.data.eventDetails?.length > 0) {
            const initial = {};
            json.data.eventDetails.forEach((ev) => {
              initial[ev.eventId] = true;
            });
            return initial;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Error cargando métricas del monitor:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authFetch, selectedDate]);

  useEffect(() => {
    fetchMonitorData();

    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => {
      fetchMonitorData();
    }, 5000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selectedDate, fetchMonitorData]);

  const toggleEvent = useCallback((eventId) => {
    setExpandedEvents((prev) => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  }, []);

  return {
    selectedDate,
    setSelectedDate,
    monitorData,
    isLoading,
    isRefreshing,
    lastSyncTime,
    expandedEvents,
    toggleEvent,
    fetchMonitorData,
  };
}

export default useMonitorDashboard;
