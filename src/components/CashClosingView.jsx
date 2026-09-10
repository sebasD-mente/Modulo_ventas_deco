import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Copy, Check, Calculator, AlertCircle, Share2 } from 'lucide-react';

export default function CashClosingView({ liveMetrics, activeEvent, onClosingCompleted }) {
  const { authFetch } = useAuth();
  const [reportedCash, setReportedCash] = useState('');
  const [observations, setObservations] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const calculatedCash = liveMetrics?.paymentBreakdown?.EFECTIVO?.amount || 0;
  const cardAmount = liveMetrics?.paymentBreakdown?.TARJETA?.amount || 0;
  const transferAmount = liveMetrics?.paymentBreakdown?.TRANSFERENCIA?.amount || 0;
  const totalGross = liveMetrics?.totalAmount || 0;

  const numReported = reportedCash === '' ? 0 : Number(reportedCash);
  const difference = Number((numReported - calculatedCash).toFixed(2));

  // Generar texto para WhatsApp
  const generateWhatsAppSummary = () => {
    const todayStr = new Date().toLocaleDateString('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const diffText = difference === 0
      ? 'Q 0.00 (Cuadrado Exacto ✅)'
      : difference > 0
      ? `+Q ${difference.toFixed(2)} (Sobrante 🟢)`
      : `-Q ${Math.abs(difference).toFixed(2)} (Faltante 🔴)`;

    return `🎪 *CIERRE DE CAJA — ${activeEvent?.tenant?.name || 'DECO VINTAGE'}*
📅 *Fecha:* ${todayStr}
📍 *Evento:* ${activeEvent?.name || 'Evento'} (${activeEvent?.location || 'Stand'})

💰 *TOTAL GENERAL:* Q ${totalGross.toFixed(2)}
🧾 *Transacciones:* ${liveMetrics?.totalTransactions || 0} ventas
🖼️ *Pósters Vendidos:* ${liveMetrics?.totalUnits || 0} unidades

💳 *DESGLOSE POR MÉTODO DE PAGO:*
• 💵 Efectivo en Caja: Q ${calculatedCash.toFixed(2)} (${liveMetrics?.paymentBreakdown?.EFECTIVO?.count || 0} tx)
• 💳 Tarjeta (POS): Q ${cardAmount.toFixed(2)} (${liveMetrics?.paymentBreakdown?.TARJETA?.count || 0} tx)
• 📲 Transferencia: Q ${transferAmount.toFixed(2)} (${liveMetrics?.paymentBreakdown?.TRANSFERENCIA?.count || 0} tx)

⚖️ *ARQUEO DE EFECTIVO:*
• Sistema: Q ${calculatedCash.toFixed(2)}
• Físico Contado: Q ${numReported.toFixed(2)}
• Balance: ${diffText}
${observations ? `\n📝 *Notas:* ${observations}` : ''}
⚡ _Generado por Deko EventSales SaaS_`;
  };

  const copyToClipboard = () => {
    const text = generateWhatsAppSummary();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCreateClosing = async (e) => {
    e.preventDefault();
    if (reportedCash === '') {
      setErrorMsg('Ingresa el monto de efectivo físico contado en caja.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await authFetch('/api/closings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: activeEvent?.id,
          closingType: 'DIARIO',
          totalCashReported: numReported,
          observations: observations || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error registrando cierre');
      }

      setSuccessMsg('¡Cierre de caja asentado y conciliado con éxito en PostgreSQL!');
      if (onClosingCompleted) onClosingCompleted();
    } catch (err) {
      console.error('Error guardando cierre:', err);
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto text-white">
      {/* 1. Formulario de Arqueo de Efectivo Físico */}
      <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl space-y-6">
        <div className="flex items-center gap-2.5 pb-3 border-b border-neutral-800">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-white" />
              Arqueo de efectivo diario
            </h3>
            <p className="text-xs text-neutral-400">Verifica el efectivo físico presente en la gaveta del stand</p>
          </div>
        </div>

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleCreateClosing} className="space-y-4">
          {/* Efectivo esperado por sistema */}
          <div className="p-3.5 rounded-2xl bg-black border border-neutral-800 flex items-center justify-between text-xs">
            <span className="font-medium text-neutral-400">Efectivo Esperado (Sistema):</span>
            <span className="text-base font-black text-white font-mono">
              Q {calculatedCash.toFixed(2)}
            </span>
          </div>

          {/* Input de conteo físico */}
          <div>
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-1.5">
              Efectivo Físico Contado en Caja (Q)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={reportedCash}
              onChange={(e) => setReportedCash(e.target.value)}
              className="w-full bg-black border border-neutral-700/90 rounded-2xl px-4 py-3 text-xl font-black text-emerald-400 placeholder:text-neutral-600 focus:outline-none focus:border-white font-mono shadow-inner text-center"
            />
          </div>

          {/* Indicador de Diferencia / Cuadre */}
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between ${
              difference === 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : difference > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider">
              {difference === 0 ? 'Caja cuadrada exacta' : difference > 0 ? 'Sobrante en caja' : 'Faltante en caja'}
            </span>
            <span className="text-base font-black font-mono">
              {difference >= 0 ? `+Q ${difference.toFixed(2)}` : `-Q ${Math.abs(difference).toFixed(2)}`}
            </span>
          </div>

          {/* Observaciones */}
          <div>
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-1.5">
              Observaciones o incidencias del turno
            </label>
            <textarea
              rows="3"
              placeholder="Ej. Q20 sobrante por propina / fondo de cambio inicial Q100..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full bg-black border border-neutral-700/90 rounded-2xl px-4 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner"
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || reportedCash === ''}
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/20 disabled:opacity-40 transition-all cursor-pointer active:scale-95"
          >
            {isSubmitting ? 'Guardando en PostgreSQL...' : 'Registrar y conciliar cierre'}
          </button>
        </form>
      </div>

      {/* 2. Resumen para WhatsApp de Gerencia */}
      <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl space-y-4 text-white">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-white" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Resumen ejecutivo para WhatsApp
            </h3>
          </div>
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-neutral-200 text-black font-black text-xs transition-transform active:scale-95 shadow-md cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '¡Copiado!' : 'Copiar texto'}</span>
          </button>
        </div>

        <p className="text-xs text-neutral-400">
          Formato estructurado con emojis listo para supervisores y gerencia:
        </p>

        <pre className="p-4 rounded-2xl bg-black border border-neutral-800 text-xs font-mono text-emerald-400 whitespace-pre-wrap leading-relaxed overflow-x-auto select-all shadow-inner">
          {generateWhatsAppSummary()}
        </pre>

        <div className="pt-2 text-[11px] text-neutral-500 text-center">
          Inmutable • Registrado en PostgreSQL VPS • Deko Labs Architecture
        </div>
      </div>
    </div>
  );
}

