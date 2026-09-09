import React, { useState } from 'react';
import { ShieldCheck, Copy, Check, Calculator, AlertCircle, FileText, Share2 } from 'lucide-react';

export default function CashClosingView({ liveMetrics, activeEvent, onClosingCompleted }) {
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
      const res = await fetch('/api/closings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: activeEvent.id,
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Formulario de Arqueo de Efectivo Físico */}
      <div className="glass-card p-6 rounded-2xl border border-slate-700/80">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Calculator className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-100">
              Arqueo de Efectivo Diario
            </h3>
            <p className="text-xs text-slate-400">Verifica el efectivo físico presente en la gaveta del stand</p>
          </div>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> {successMsg}
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreateClosing} className="space-y-4">
          {/* Efectivo esperado por sistema */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Efectivo Esperado (Sistema):</span>
            <span className="text-base font-bold text-slate-100">
              Q {calculatedCash.toFixed(2)}
            </span>
          </div>

          {/* Input de conteo físico */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
              Efectivo Físico Contado en Caja (Q)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={reportedCash}
              onChange={(e) => setReportedCash(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-lg font-black text-amber-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Indicador de Diferencia / Cuadre */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between ${
              difference === 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : difference > 0
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider">
              {difference === 0 ? 'Caja Cuadrada Exacta' : difference > 0 ? 'Sobrante en Caja' : 'Faltante en Caja'}
            </span>
            <span className="text-base font-black">
              {difference >= 0 ? `+Q ${difference.toFixed(2)}` : `-Q ${Math.abs(difference).toFixed(2)}`}
            </span>
          </div>

          {/* Observaciones */}
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Observaciones o Incidencias del Turno
            </label>
            <textarea
              rows="3"
              placeholder="Ej. Q20 sobrante por propina / fondo de cambio inicial Q100..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            ></textarea>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || reportedCash === ''}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 disabled:opacity-40 transition-all cursor-pointer"
          >
            {isSubmitting ? 'Guardando en PostgreSQL...' : 'Registrar y Conciliar Cierre'}
          </button>
        </form>
      </div>

      {/* Resumen para WhatsApp de Gerencia */}
      <div className="glass-card p-6 rounded-2xl border border-slate-700/80 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Resumen Ejecutivo para WhatsApp
              </h3>
            </div>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 mb-3">
            Formato listo con emojis para enviar al grupo de WhatsApp de supervisores y gerencia:
          </p>

          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300/90 whitespace-pre-wrap leading-relaxed overflow-x-auto select-all">
            {generateWhatsAppSummary()}
          </pre>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 text-center">
          Inmutable • Registrado en PostgreSQL VPS • Deko Labs Architecture
        </div>
      </div>
    </div>
  );
}
