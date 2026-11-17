import React from 'react';
import { Package, Clock, Printer, CheckCircle2, ExternalLink, Scissors, Lock, UserCheck } from 'lucide-react';

const STATUS_BORDER = {
  PENDIENTE: 'border-neutral-800',
  A_PRODUCCION: 'border-cyan-500/40 bg-cyan-950/10',
  SEPARADO: 'border-emerald-500/30',
  IMPRESO: 'border-neutral-800 bg-neutral-950/80',
};

const STATUS_BADGE = {
  PENDIENTE: 'bg-neutral-900 text-white border-neutral-700',
  SEPARADO: 'bg-emerald-950 text-emerald-300 border-emerald-800/80',
  A_PRODUCCION: 'bg-cyan-950 text-cyan-300 border-cyan-800/80',
  IMPRESO: 'bg-neutral-900 text-neutral-200 border-neutral-700',
};

const CANONICAL_SIZE_DISPLAY = {
  mini: { sizeLabel: 'Mini', dimensionsHint: '14×21 cm' },
  pequeno: { sizeLabel: 'Pequeño', dimensionsHint: '21×27 cm' },
  'pequeño': { sizeLabel: 'Pequeño', dimensionsHint: '21×27 cm' },
  portada: { sizeLabel: 'Portada de Álbum', dimensionsHint: '30×30 cm' },
  portada_album: { sizeLabel: 'Portada de Álbum', dimensionsHint: '30×30 cm' },
  'portada album': { sizeLabel: 'Portada de Álbum', dimensionsHint: '30×30 cm' },
  'portada álbum': { sizeLabel: 'Portada de Álbum', dimensionsHint: '30×30 cm' },
  'portada de album': { sizeLabel: 'Portada de Álbum', dimensionsHint: '30×30 cm' },
  'portada de álbum': { sizeLabel: 'Portada de Álbum', dimensionsHint: '30×30 cm' },
  mediano: { sizeLabel: 'Mediano', dimensionsHint: '30×45 cm' },
  grande: { sizeLabel: 'Grande', dimensionsHint: '45×60 cm' },
  gigante: { sizeLabel: 'Gigante', dimensionsHint: '60×100 cm' },
};

const PRICE_TO_SIZE_FALLBACK = {
  25: CANONICAL_SIZE_DISPLAY.mini,
  35: CANONICAL_SIZE_DISPLAY['pequeño'],
  55: CANONICAL_SIZE_DISPLAY['portada de álbum'],
  65: CANONICAL_SIZE_DISPLAY.mediano,
  125: CANONICAL_SIZE_DISPLAY.grande,
  210: CANONICAL_SIZE_DISPLAY.gigante,
};

const ACTION_STATUS_LABELS = {
  SEPARADO: 'Separado de Stock',
  A_PRODUCCION: 'Enviado a Impresión',
  IMPRESO: 'Impreso en Taller',
  PENDIENTE: 'Revertido a Pendiente',
};

/**
 * Extrae de forma determinista el tamaño del póster y limpia el título para vista móvil sin truncamiento.
 */
export function extractPosterSizeInfo(item = {}) {
  const rawDescription = String(item?.description || '').trim();
  const customDims = String(item?.customDimensions || '').trim();

  const trailingStdRe = /\(\s*(Mini|Peque[ñn]o|Portada(?:\s+de)?\s+[AÁaá]lbum|Portada_Album|Portada|Mediano|Grande|Gigante)\s*\)\s*$/i;
  const trailingMatch = rawDescription.match(trailingStdRe);
  if (trailingMatch) {
    const key = trailingMatch[1].trim().toLowerCase().replace(/\s+/g, ' ');
    const mapped = CANONICAL_SIZE_DISPLAY[key] || { sizeLabel: trailingMatch[1].trim(), dimensionsHint: null };
    const cleanTitle = rawDescription.slice(0, trailingMatch.index).trim() || rawDescription;
    return {
      sizeLabel: mapped.sizeLabel,
      dimensionsHint: mapped.dimensionsHint,
      displayTitle: cleanTitle,
    };
  }

  const inlineStdRe = /\(\s*(Mini|Peque[ñn]o|Portada(?:\s+de)?\s+[AÁaá]lbum|Portada_Album|Mediano|Grande|Gigante)\s*\)/i;
  const inlineMatch = rawDescription.match(inlineStdRe);
  if (inlineMatch) {
    const key = inlineMatch[1].trim().toLowerCase().replace(/\s+/g, ' ');
    const mapped = CANONICAL_SIZE_DISPLAY[key] || { sizeLabel: inlineMatch[1].trim(), dimensionsHint: null };
    const cleanTitle = rawDescription.replace(inlineMatch[0], '').replace(/\s{2,}/g, ' ').trim() || rawDescription;
    return {
      sizeLabel: mapped.sizeLabel,
      dimensionsHint: mapped.dimensionsHint,
      displayTitle: cleanTitle,
    };
  }

  if (customDims) {
    let cleanTitle = rawDescription;
    const customParenEnd = rawDescription.match(/\([^)]*\)\s*$/);
    if (customParenEnd && customParenEnd[0].toLowerCase().includes(customDims.toLowerCase())) {
      cleanTitle = rawDescription.slice(0, customParenEnd.index).trim() || rawDescription;
    }
    return {
      sizeLabel: customDims,
      dimensionsHint: null,
      displayTitle: cleanTitle,
    };
  }

  const trailingDimsRe = /\(\s*([^)]*\d+\s*[x×]\s*\d+[^)]*)\s*\)\s*$/i;
  const dimsMatch = rawDescription.match(trailingDimsRe);
  if (dimsMatch) {
    const cleanTitle = rawDescription.slice(0, dimsMatch.index).trim() || rawDescription;
    return {
      sizeLabel: dimsMatch[1].trim(),
      dimensionsHint: null,
      displayTitle: cleanTitle,
    };
  }

  if (!item?.isCustom) {
    const fallbackByPrice = PRICE_TO_SIZE_FALLBACK[Number(item?.unitPrice)];
    if (fallbackByPrice) {
      return {
        sizeLabel: fallbackByPrice.sizeLabel,
        dimensionsHint: fallbackByPrice.dimensionsHint,
        displayTitle: rawDescription || 'Obra sin título',
      };
    }
  }

  return {
    sizeLabel: 'Estándar',
    dimensionsHint: null,
    displayTitle: rawDescription || 'Obra sin título',
  };
}

/**
 * Formatea fecha y hora exacta en zona horaria America/Guatemala (es-GT).
 */
export function formatGuatemalaDateTime(dateInput) {
  if (!dateInput) return 'Fecha no registrada';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return 'Fecha no registrada';
  const dateStr = new Intl.DateTimeFormat('es-GT', {
    timeZone: 'America/Guatemala',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
  const timeStr = new Intl.DateTimeFormat('es-GT', {
    timeZone: 'America/Guatemala',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
  return `${dateStr} • ${timeStr}`;
}

/**
 * Construye el historial cronológico inmutable de acciones ejecutadas sobre el diseño.
 */
export function extractAuditEntries(item = {}) {
  const logs = Array.isArray(item?.productionLogs) ? [...item.productionLogs] : [];
  if (logs.length > 0) {
    logs.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    return logs.map((log, idx) => ({
      id: log.id || `log-${idx}`,
      status: log.newStatus,
      actionLabel: ACTION_STATUS_LABELS[log.newStatus] || log.newStatus,
      userName: log.user?.fullName || log.user?.email || 'Operario registrado',
      formattedDateTime: formatGuatemalaDateTime(log.createdAt),
    }));
  }

  const currentStatus = item?.productionStatus || 'PENDIENTE';
  if (currentStatus !== 'PENDIENTE') {
    const fallbackDate = item?.impresoAt || item?.statusChangedAt || item?.updatedAt;
    return [
      {
        id: `legacy-${item?.id || 'item'}`,
        status: currentStatus,
        actionLabel: ACTION_STATUS_LABELS[currentStatus] || currentStatus,
        userName: 'Registro histórico',
        formattedDateTime: formatGuatemalaDateTime(fallbackDate),
      },
    ];
  }

  return [];
}

export default function ProductionOrderCard({
  item,
  isUpdating = false,
  isOp2Only = false,
  hasOp2Access = false,
  isSuperAdmin = false,
  isVendedorRedesOnly = false,
  isArchiveMode = false,
  onStatusChange,
}) {
  const status = item.productionStatus || 'PENDIENTE';
  const cardBorder = STATUS_BORDER[status] || 'border-neutral-800';
  const badgeColor = STATUS_BADGE[status] || 'bg-neutral-900 text-neutral-300 border-neutral-800';
  const saleTimeStr = item.createdAt
    ? new Intl.DateTimeFormat('es-GT', {
        timeZone: 'America/Guatemala',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(item.createdAt))
    : '';
  const artUrl = item.customImageUrl || item.product?.imageUrl;
  const isWorkshopCut =
    item.isCustom ||
    item.customDimensions?.toLowerCase().includes('corte taller') ||
    item.description?.toLowerCase().includes('corte taller');

  const sizeInfo = extractPosterSizeInfo(item);
  const auditEntries = extractAuditEntries(item);
  const isOperatorResolved = !isSuperAdmin && (isOp2Only ? status !== 'A_PRODUCCION' : status !== 'PENDIENTE');
  const showActionButtons = !isVendedorRedesOnly && !isArchiveMode && !isOperatorResolved;
  const showAuditBlock = isArchiveMode || status !== 'PENDIENTE' || auditEntries.length > 0;

  return (
    <div className={`bg-black border rounded-2xl p-3.5 sm:p-4 transition-all ${cardBorder}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="relative group w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center">
          {artUrl ? (
            <>
              <img src={artUrl} alt={sizeInfo.displayTitle} className="w-full h-full object-cover" loading="lazy" />
              <a
                href={artUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir arte original en alta resolución para RIP de taller"
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-cyan-300 min-h-[44px] min-w-[44px]"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </>
          ) : (
            <Package className="w-6 h-6 text-neutral-600" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Fila prioritaria en móvil: TAMAÑO DEL PÓSTER y CANTIDAD nunca se truncan */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              data-testid="poster-size-badge"
              className="inline-flex items-center gap-1 shrink-0 bg-white text-black font-black text-[11px] sm:text-xs uppercase tracking-wide px-2.5 py-0.5 rounded-lg shadow-sm"
            >
              📐 {sizeInfo.sizeLabel}
            </span>
            <span
              data-testid="poster-qty-badge"
              className={`inline-flex items-center shrink-0 font-black text-[11px] sm:text-xs px-2 py-0.5 rounded-lg border ${
                item.quantity > 1
                  ? 'bg-emerald-400 text-black border-emerald-300'
                  : 'bg-neutral-900 text-white border-neutral-700'
              }`}
            >
              Cant: x{item.quantity || 1}
            </span>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${badgeColor}`}>
              {status.replace('_', ' ')}
            </span>
          </div>

          {/* Título completo hasta 2 líneas sin ocultamiento por truncate */}
          <h4
            data-testid="poster-title"
            className="text-xs sm:text-sm font-bold text-white leading-snug line-clamp-2 break-words"
          >
            {sizeInfo.displayTitle}
          </h4>

          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-neutral-400">
            <span className="font-semibold text-neutral-300">Ticket: #{item.sale?.saleNumber || 'S/N'}</span>
            <span>•</span>
            <span>{item.sale?.event?.name || 'Evento'}</span>
            {saleTimeStr && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-neutral-500" />
                  {saleTimeStr}
                </span>
              </>
            )}
          </div>

          {item.productionNotes && (
            <p className="text-[11px] text-neutral-300 italic bg-neutral-900/60 rounded px-2 py-1 border border-neutral-800">
              Nota: {item.productionNotes}
            </p>
          )}

          {(artUrl || item.material || isWorkshopCut) && (
            <div className="pt-0.5 flex items-center gap-1.5 flex-wrap">
              {artUrl && (
                <a
                  href={artUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir arte original en alta resolución para RIP de taller"
                  className="text-[10px] font-bold text-cyan-300 bg-cyan-950/80 border border-cyan-800/80 hover:border-cyan-400 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 transition-colors"
                >
                  <ExternalLink className="w-3 h-3 text-cyan-400" />
                  <span>Arte RIP</span>
                </a>
              )}
              {item.material && (
                <span className="bg-neutral-900 border border-neutral-700 text-neutral-200 text-[10px] font-bold px-2 py-0.5 rounded-md">
                  {item.material}
                </span>
              )}
              {isWorkshopCut && (
                <span className="bg-neutral-900 text-white border border-neutral-600 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                  <Scissors className="w-3 h-3 text-neutral-200" />
                  <span>CORTE TALLER</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Registro Inmutable de Auditoría (Usuario + Fecha + Hora exacta Guatemala) */}
      {showAuditBlock && auditEntries.length > 0 && (
        <div
          data-testid="immutable-audit-record"
          className="mt-3 pt-2.5 border-t border-neutral-800/90 space-y-1.5"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-400">
            <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Registro Inmutable de Producción</span>
          </div>
          <div className="space-y-1">
            {auditEntries.map((entry) => (
              <div
                key={entry.id}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]"
              >
                <span className="font-bold text-white flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{entry.actionLabel}:</span>
                  <span className="text-neutral-200 font-semibold">{entry.userName}</span>
                </span>
                <span className="text-neutral-400 font-medium text-[10px] sm:text-[11px]">
                  {entry.formattedDateTime}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botones táctiles de acción: 0 botones en modo Archivo o ítems ya resueltos por operario */}
      {showActionButtons && (
        <div className="mt-3 pt-3 border-t border-neutral-900 flex items-center justify-end gap-2 flex-wrap">
          {/* ACCIONES DE OPERARIO 2 (TALLER DE IMPRESIÓN) */}
          {((isOp2Only || (isSuperAdmin && status === 'A_PRODUCCION')) || (hasOp2Access && status === 'A_PRODUCCION')) &&
            status !== 'IMPRESO' && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => onStatusChange(item.id, 'IMPRESO')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-black text-xs transition-all shadow-lg shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 text-black" />
                <span>✅ Marcar como IMPRESO</span>
              </button>
            )}

          {/* ACCIONES DE OPERARIO 1 (STOCK & ALISTAMIENTO) */}
          {(!isOp2Only || isSuperAdmin) && (isSuperAdmin || status === 'PENDIENTE') && (
            <>
              {status !== 'SEPARADO' && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => onStatusChange(item.id, 'SEPARADO')}
                  className="min-h-[44px] bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Package className="w-3.5 h-3.5 text-black" />
                  <span>📦 Separar Stock</span>
                </button>
              )}
              {status !== 'A_PRODUCCION' && status !== 'IMPRESO' && (
                <button
                  type="button"
                  disabled={isUpdating}
                  onClick={() => onStatusChange(item.id, 'A_PRODUCCION')}
                  className="min-h-[44px] bg-white hover:bg-neutral-200 text-black font-black text-xs px-3.5 py-2 rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5 text-black" />
                  <span>🖨️ A Imprimir</span>
                </button>
              )}
            </>
          )}

          {/* REVERSIÓN ADMINISTRATIVA EXCLUSIVA DE SUPER ADMIN EN COLA ACTIVA */}
          {status !== 'PENDIENTE' && isSuperAdmin && (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onStatusChange(item.id, 'PENDIENTE')}
              className="min-h-[44px] bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 font-bold text-xs px-3 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              <span>Revertir a Pendiente</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
