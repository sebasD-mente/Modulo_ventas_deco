import { useState, useMemo } from 'react';

export const DENOMINATIONS = [
  { value: 200, label: 'Q200', type: 'billete' }, { value: 100, label: 'Q100', type: 'billete' },
  { value: 50, label: 'Q50', type: 'billete' }, { value: 20, label: 'Q20', type: 'billete' },
  { value: 10, label: 'Q10', type: 'billete' }, { value: 5, label: 'Q5', type: 'billete' },
  { value: 1, label: 'Q1', type: 'moneda' },
];

export const INITIAL_COUNTS = { 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0, 1: 0 };

export function calculateDenominationsTotal(counts = {}) {
  const safe = counts || {};
  return DENOMINATIONS.reduce((sum, d) => sum + (Number(safe[d.value]) || 0) * d.value, 0);
}

export function calculateDifference(numReported, calculatedCash) {
  return Number(((Number(numReported) || 0) - (Number(calculatedCash) || 0)).toFixed(2));
}

export function getDiscrepancyStatus(diff) {
  if (diff === 0) return { status: 'CUADRADA', label: 'Caja cuadrada exacta', badgeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' };
  if (diff > 0) return { status: 'SOBRANTE', label: 'Sobrante en caja', badgeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' };
  return { status: 'FALTANTE', label: 'Faltante en caja', badgeClass: 'bg-red-500/10 border-red-500/30 text-red-400' };
}

export function formatWhatsAppSummary({ activeEvent, liveMetrics, calculatedCash, cardAmount, transferAmount, totalGross, numReported, difference, observations }) {
  const todayStr = new Date().toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const diffText = difference === 0 ? 'Q 0.00 (Cuadrado Exacto ✅)' : difference > 0 ? `+Q ${difference.toFixed(2)} (Sobrante 🟢)` : `-Q ${Math.abs(difference).toFixed(2)} (Faltante 🔴)`;
  return `🎪 *CIERRE DE CAJA — ${activeEvent?.tenant?.name || 'DECO VINTAGE'}*
📅 *Fecha:* ${todayStr}
📍 *Evento:* ${activeEvent?.name || 'Evento'} (${activeEvent?.location || 'Stand'})

💰 *TOTAL GENERAL:* Q ${(totalGross || 0).toFixed(2)}
🧾 *Transacciones:* ${liveMetrics?.totalTransactions || 0} ventas
🖼️ *Pósters Vendidos:* ${liveMetrics?.totalUnits || 0} unidades

💳 *DESGLOSE POR MÉTODO DE PAGO:*
• 💵 Efectivo en Caja: Q ${(calculatedCash || 0).toFixed(2)} (${liveMetrics?.paymentBreakdown?.EFECTIVO?.count || 0} tx)
• 💳 Tarjeta (POS): Q ${(cardAmount || 0).toFixed(2)} (${liveMetrics?.paymentBreakdown?.TARJETA?.count || 0} tx)
• 📲 Transferencia: Q ${(transferAmount || 0).toFixed(2)} (${liveMetrics?.paymentBreakdown?.TRANSFERENCIA?.count || 0} tx)

⚖️ *ARQUEO DE EFECTIVO:*
• Sistema: Q ${(calculatedCash || 0).toFixed(2)}
• Físico Contado: Q ${(numReported || 0).toFixed(2)}
• Balance: ${diffText}${observations ? `\n\n📝 *Notas:* ${observations}` : ''}
⚡ _Generado por Deko EventSales SaaS_`;
}

export function useCashClosing({ liveMetrics, activeEvent, eventId, onClosingCompleted, authFetch } = {}) {
  const fetchFn = authFetch || globalThis.fetch;
  const [counts, setCounts] = useState(INITIAL_COUNTS);
  const [manualCash, setManualCash] = useState('');
  const [observations, setObservations] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const denomTotal = useMemo(() => calculateDenominationsTotal(counts), [counts]);
  const numReported = denomTotal > 0 ? denomTotal : (manualCash === '' ? 0 : Number(manualCash));
  const calculatedCash = liveMetrics?.paymentBreakdown?.EFECTIVO?.amount || 0;
  const cardAmount = liveMetrics?.paymentBreakdown?.TARJETA?.amount || 0;
  const transferAmount = liveMetrics?.paymentBreakdown?.TRANSFERENCIA?.amount || 0;
  const totalGross = liveMetrics?.totalAmount || 0;
  const difference = useMemo(() => calculateDifference(numReported, calculatedCash), [numReported, calculatedCash]);
  const discrepancy = useMemo(() => getDiscrepancyStatus(difference), [difference]);

  const updateCount = (val, deltaOrExact) => {
    setCounts(prev => ({
      ...prev,
      [val]: Math.max(0, typeof deltaOrExact === 'function' ? deltaOrExact(prev[val] || 0) : (Number(deltaOrExact) || 0))
    }));
  };

  const resetCounts = () => { setCounts(INITIAL_COUNTS); setManualCash(''); };

  const copyToClipboard = () => {
    const text = formatWhatsAppSummary({ activeEvent, liveMetrics, calculatedCash, cardAmount, transferAmount, totalGross, numReported, difference, observations });
    navigator?.clipboard?.writeText?.(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const submitClosing = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetchFn('/api/closings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: activeEvent?.id || eventId,
          closingType: 'DIARIO',
          totalCashReported: numReported,
          observations: observations || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error registrando cierre');
      setSuccessMsg('¡Cierre de caja asentado y conciliado con éxito en PostgreSQL!');
      if (onClosingCompleted) onClosingCompleted();
      return true;
    } catch (err) {
      setErrorMsg(err.message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    counts, updateCount, resetCounts, denomTotal, manualCash, setManualCash,
    reportedCash: manualCash, setReportedCash: setManualCash, observations, setObservations,
    numReported, calculatedCash, cardAmount, transferAmount, totalGross, difference, discrepancy,
    isSubmitting, copied, successMsg, errorMsg, setErrorMsg, setSuccessMsg, copyToClipboard,
    submitClosing,
    formatWhatsAppSummary: () => formatWhatsAppSummary({ activeEvent, liveMetrics, calculatedCash, cardAmount, transferAmount, totalGross, numReported, difference, observations }),
  };
}

export default useCashClosing;
