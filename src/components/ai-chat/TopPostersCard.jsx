import React from 'react';
import { Trophy, Image as ImageIcon } from 'lucide-react';

const SIZE_THEMES = {
  MEDIANO: { bar: 'bg-emerald-500', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  GRANDE: { bar: 'bg-amber-500', text: 'text-amber-400', dot: 'bg-amber-400' },
  PORTADA_ALBUM: { bar: 'bg-cyan-500', text: 'text-cyan-400', dot: 'bg-cyan-400' },
  ALBUM: { bar: 'bg-cyan-500', text: 'text-cyan-400', dot: 'bg-cyan-400' },
  MINI: { bar: 'bg-violet-500', text: 'text-violet-400', dot: 'bg-violet-400' },
  PEQUENO: { bar: 'bg-sky-500', text: 'text-sky-400', dot: 'bg-sky-400' },
  PEQUEÑO: { bar: 'bg-sky-500', text: 'text-sky-400', dot: 'bg-sky-400' },
  GIGANTE: { bar: 'bg-rose-500', text: 'text-rose-400', dot: 'bg-rose-400' },
};

const DEFAULT_THEME = { bar: 'bg-neutral-500', text: 'text-neutral-400', dot: 'bg-neutral-400' };

export default function TopPostersCard({ data }) {
  if (!data) return null;
  const { eventName, topPosters = [] } = data;
  if (!Array.isArray(topPosters) || topPosters.length === 0) return null;

  return (
    <div className="mt-3 p-3.5 rounded-2xl bg-black/95 border border-neutral-700/80 shadow-xl space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5" /> Podio Top 3 - Rendimiento y Formatos
        </span>
        <span className="text-[10px] text-neutral-400 truncate max-w-[150px]">
          {eventName || 'Evento Activo'}
        </span>
      </div>

      {/* Top 3 Podium List */}
      <div className="space-y-2.5">
        {topPosters.slice(0, 3).map((poster) => {
          const isGold = poster.rank === 1;
          const isSilver = poster.rank === 2;
          const badgeIcon = isGold ? '🥇' : isSilver ? '🥈' : '🥉';
          const rawSizes = Array.isArray(poster.sizes) ? poster.sizes.filter((s) => (s.units || 0) > 0) : [];
          const sizes = rawSizes.length > 0
            ? rawSizes
            : [{ sizeId: 'MEDIANO', name: 'Mediano', units: poster.unitsSold || 0, percentage: 100 }];

          return (
            <div
              key={poster.id || poster.title}
              className={`p-2.5 rounded-xl transition-all border ${
                isGold
                  ? 'bg-gradient-to-r from-amber-950/40 via-neutral-900 to-neutral-950 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                  : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {/* Rank Medal */}
                <div className="flex items-center justify-center w-6 text-base font-black shrink-0 text-center select-none pt-0.5">
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate leading-tight">
                      {poster.title}
                    </span>
                    <span className="text-xs text-emerald-400 font-mono font-bold shrink-0">
                      Q{Number(poster.totalRevenue || 0).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                    <span className="text-neutral-400 truncate font-medium">
                      {poster.category || 'Catálogo Oficial'}
                    </span>
                    <span className="text-neutral-600 shrink-0">•</span>
                    <span className="text-neutral-300 font-mono font-semibold shrink-0">
                      {poster.unitsSold || 0} {(poster.unitsSold || 0) === 1 ? 'unidad' : 'unidades'}
                    </span>
                  </div>

                  {/* Horizontal Segmented Progress Bar (Stacked) */}
                  <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden flex mt-2">
                    {sizes.map((sz, sIdx) => {
                      const theme = SIZE_THEMES[sz.sizeId?.toUpperCase()] || DEFAULT_THEME;
                      const barWidth = !poster.unitsSold || sz.units === 0 ? '0%' : (sizes.length === 1 ? '100%' : `${(sz.units / poster.unitsSold) * 100}%`);
                      const pct = Math.round(sz.percentage ?? (poster.unitsSold ? (sz.units / poster.unitsSold) * 100 : 0));
                      return (
                        <div
                          key={sz.sizeId || sIdx}
                          className={`${theme.bar} h-full transition-all duration-300`}
                          style={{ width: barWidth }}
                          title={`${sz.units} ${sz.name || sz.sizeId} (${pct}%)`}
                        />
                      );
                    })}
                  </div>

                  {/* Size Breakdown Chips */}
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] mt-1.5">
                    {sizes.map((sz, sIdx) => {
                      const theme = SIZE_THEMES[sz.sizeId?.toUpperCase()] || DEFAULT_THEME;
                      const pct = Math.round(sz.percentage ?? (poster.unitsSold ? (sz.units / poster.unitsSold) * 100 : 0));
                      return (
                        <span key={sz.sizeId || sIdx} className="inline-flex items-center gap-1 font-mono text-[9.5px]">
                          <span className={`w-1.5 h-1.5 rounded-full ${theme.dot} shrink-0`} />
                          <span className="text-neutral-200 font-bold">{sz.units}</span>
                          <span className={theme.text}>{sz.name || sz.sizeId || 'Estándar'}</span>
                          <span className="text-neutral-400 text-[9px]">({pct}%)</span>
                          {sIdx < sizes.length - 1 && <span className="text-neutral-600 ml-0.5">•</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
