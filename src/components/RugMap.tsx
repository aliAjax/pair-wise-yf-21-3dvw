import { useRef } from "react";
import type { ZoneStatus } from "../model";

export const ZONE_COLORS: Record<ZoneStatus, string> = {
  PENDING: "#94a3b8",
  ASSIGNED: "#2563eb",
  WORKING: "#d97706",
  DONE: "#0f766e",
};

export interface MapMarker {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  locked?: boolean;
}

interface RugMapProps {
  markers: MapMarker[];
  selectedId?: string | null;
  onMarkerClick?: (id: string) => void;
  onBackgroundClick?: (x: number, y: number) => void;
}

/** 地毯局部标记图：viewBox 100x64，坐标系与破损区 x/y 一致 */
export function RugMap({ markers, selectedId, onMarkerClick, onBackgroundClick }: RugMapProps) {
  const ref = useRef<SVGSVGElement>(null);

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onBackgroundClick || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 64;
    onBackgroundClick(
      Math.round(Math.min(94, Math.max(6, x))),
      Math.round(Math.min(56, Math.max(8, y)))
    );
  };

  return (
    <svg
      ref={ref}
      viewBox="0 0 100 64"
      className={"rug-map" + (onBackgroundClick ? " placing" : "")}
      onClick={handleClick}
      role="img"
      aria-label="地毯破损区标记图"
    >
      {Array.from({ length: 23 }, (_, i) => (
        <line key={`ft${i}`} x1={5 + i * 4} y1={1.5} x2={5 + i * 4} y2={5.5} className="fringe" />
      ))}
      {Array.from({ length: 23 }, (_, i) => (
        <line key={`fb${i}`} x1={5 + i * 4} y1={58.5} x2={5 + i * 4} y2={62.5} className="fringe" />
      ))}
      <rect x={4} y={5.5} width={92} height={53} rx={2} className="rug-outer" />
      <rect x={7.5} y={9} width={85} height={46} rx={1.5} className="rug-border" />
      <rect x={11} y={12.5} width={78} height={39} rx={1} className="rug-field" />
      <ellipse cx={50} cy={32} rx={17} ry={10.5} className="rug-medallion" />
      <ellipse cx={50} cy={32} rx={8} ry={4.8} className="rug-medallion inner" />
      {markers.map((m, i) => (
        <g
          key={m.id}
          transform={`translate(${m.x} ${m.y})`}
          className={"marker" + (selectedId === m.id ? " selected" : "")}
          onClick={(e) => {
            e.stopPropagation();
            onMarkerClick?.(m.id);
          }}
        >
          <circle r={3.2} fill={m.color} />
          <text y={0.15} className="marker-label">
            {i + 1}
          </text>
          {m.locked && (
            <text y={-4.8} className="marker-lock">
              🔒
            </text>
          )}
          <title>{m.name}</title>
        </g>
      ))}
    </svg>
  );
}
