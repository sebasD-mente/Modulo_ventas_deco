import React from 'react';
import { Trophy, Image as ImageIcon, Sparkles } from 'lucide-react';

export default function TopPostersCard({ data, onAddPoster }) {
  if (!data) return null;
  const { eventName, topPosters = [] } = data;
  if (!Array.isArray(topPosters) || topPosters.length === 0) return null;

  return (
    <div className="mt-3 p-3.5 rounded-2xl bg-black/95 border border-neutral-700/80 shadow-xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" /> Podio Top 3 - Más Vendidos
        </span>
        <span className="text-[10px] text-neutral-400 truncate max-w-[150px]">
          {eventName || 'Evento Activo'}
        </span>
      </div>

      {/* Top 3 Podium List */}
      <div className="space-y-2">
        {topPosters.slice(0, 3).map((poster) => {
          const isGold = poster.rank === 1;
          const isSilver = poster.rank === 2;
          const badgeIcon = isGold ? '🥇' : isSilver ? '🥈' : '🥉';

          return (
            <div
              key={poster.id || poster.title}
              className={`flex items-center gap-2.5 p-2 rounded-xl transition-all border ${
                isGold
                  ? 'bg-gradient-to-r from-amber-950/40 via-neutral-900 to-neutral-950 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                  : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              {/* Rank Medal */}
              <div className="flex items-center justify-center w-7 text-sm font-black shrink-0 text-center select-none">
                {badgeIcon}
              </div>

              {/* Poster Thumbnail */}
              <div className="w-11 h-14 rounded-lg overflow-hidden bg-neutral-950 border border-neutral-700 shrink-0 flex items-center justify-center relative">
                {poster.thumbUrl || poster.imageUrl ? (
                  <img
                    src={poster.thumbUrl || poster.imageUrl}
                    alt={poster.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <ImageIcon className="w-5 h-5 text-neutral-600" />
                )}
                {isGold && (
                  <div className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </div>

              {/* Artwork Info & Sales Metrics */}
              <div className="flex-1 min-w-0 pr-1">
                <span className="text-xs font-bold text-white block truncate leading-tight">
                  {poster.title}
                </span>
                <span className="text-[10px] text-neutral-400 block truncate font-medium">
                  {poster.category || 'Catálogo Oficial'}
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    {poster.unitsSold} {poster.unitsSold === 1 ? 'unidad' : 'unidades'}
                  </span>
                  <span className="text-[10px] text-neutral-400 font-mono">
                    • Q{Number(poster.totalRevenue || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Button: Instant Draft (+44px touch target) */}
              {onAddPoster && (
                <button
                  type="button"
                  onClick={() =>
                    onAddPoster({
                      id: poster.id,
                      titulo: poster.title,
                      subtitulo: poster.category,
                      categoria: poster.category,
                      thumbUrl: poster.thumbUrl || poster.imageUrl,
                      imageUrl: poster.imageUrl
                    })
                  }
                  className="min-h-[44px] min-w-[44px] px-3 py-2 bg-white hover:bg-neutral-200 active:scale-95 text-black rounded-xl text-xs font-black shrink-0 shadow cursor-pointer transition-all flex items-center justify-center gap-1"
                  title={`Agregar "${poster.title}" al borrador de venta`}
                >
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  + Vender
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
