import React from 'react';

/**
 * Gráfico Donut SVG Puro estilizado para fondo oscuro neutro
 */
export default function DonutChart({ data, size = 260 }) {
  const total = data.reduce((acc, d) => acc + (d.amount || 0), 0);
  const center = size / 2;
  const outerRadius = size * 0.44;
  const innerRadius = size * 0.20;
  const labelRadius = (outerRadius + innerRadius) / 2;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={center}
            cy={center}
            r={(outerRadius + innerRadius) / 2}
            fill="none"
            stroke="#262626"
            strokeWidth={outerRadius - innerRadius}
          />
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#737373"
            fontSize="12"
            fontWeight="bold"
          >
            Sin ventas
          </text>
        </svg>
        <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-neutral-400">
          {data.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }}></span>
              <span>{item.icon} {item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Generar rebanadas SVG con arcos
  let cumulativeAngle = -Math.PI / 2; // Empezar arriba (12 en punto)

  const slices = data
    .filter((d) => d.amount > 0)
    .map((item) => {
      const sliceAngle = (item.amount / total) * 2 * Math.PI;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + sliceAngle;
      cumulativeAngle += sliceAngle;

      // Coordenadas del arco exterior
      const x1 = center + outerRadius * Math.cos(startAngle);
      const y1 = center + outerRadius * Math.sin(startAngle);
      const x2 = center + outerRadius * Math.cos(endAngle);
      const y2 = center + outerRadius * Math.sin(endAngle);

      // Coordenadas del arco interior
      const x3 = center + innerRadius * Math.cos(endAngle);
      const y3 = center + innerRadius * Math.sin(endAngle);
      const x4 = center + innerRadius * Math.cos(startAngle);
      const y4 = center + innerRadius * Math.sin(startAngle);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;

      const pathData = `
        M ${x1} ${y1}
        A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}
        L ${x3} ${y3}
        A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
        Z
      `;

      // Posición de la etiqueta en el punto medio del arco
      const midAngle = startAngle + sliceAngle / 2;
      const lx = center + labelRadius * Math.cos(midAngle);
      const ly = center + labelRadius * Math.sin(midAngle);

      // Calcular rotación del texto para legibilidad radial
      let rotDeg = (midAngle * 180) / Math.PI;
      if (rotDeg > 90 && rotDeg < 270) {
        rotDeg += 180;
      } else if (rotDeg < -90 && rotDeg > -270) {
        rotDeg += 180;
      }

      return {
        ...item,
        pathData,
        lx,
        ly,
        rotDeg,
        sliceAngle,
        pct: ((item.amount / total) * 100).toFixed(1),
      };
    });

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible">
          {slices.map((s) => (
            <g key={s.key} className="transition-transform hover:opacity-90">
              <path d={s.pathData} fill={s.color} stroke="#000000" strokeWidth="2" />
              {/* Etiqueta dentro del arco si el porcentaje es suficiente */}
              {s.sliceAngle > 0.45 && (
                <g transform={`translate(${s.lx}, ${s.ly}) rotate(${s.rotDeg})`}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#FFFFFF"
                    fontSize="9"
                    fontWeight="700"
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}
                  >
                    <tspan x="0" dy="-0.55em">{s.icon} {s.label}</tspan>
                    <tspan x="0" dy="1.15em">{s.pct}%</tspan>
                  </text>
                </g>
              )}
            </g>
          ))}
          {/* Círculo interior oscuro puro */}
          <circle cx={center} cy={center} r={innerRadius - 1} fill="#000000" />
        </svg>
      </div>

      {/* Leyenda inferior */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-3 text-[11px] text-neutral-300 font-semibold">
        {data.map((item) => (
          <div key={item.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }}></span>
            <span>{item.icon} {item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
