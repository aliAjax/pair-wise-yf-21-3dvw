import { STATUS_META } from "../constants";
import type { AreaStatus, Carpet } from "../types";

export interface MapAreaMarker {
  id: string;
  code: string;
  x: number;
  y: number;
  color: string;
  status: AreaStatus;
  dim?: boolean;
  selected?: boolean;
}

/**
 * 局部标记图：一张风格化地毯纹样 SVG，破损区以定位标记叠放。
 * 筛选后不符合条件的标记以 dim 形式淡显，保证图 / 列表 / 进度同步。
 */
export default function CarpetMap({
  carpet,
  markers,
  selectedAreaId,
  onSelectArea,
  onCanvasClick,
  placing,
}: {
  carpet: Carpet;
  markers: MapAreaMarker[];
  selectedAreaId?: string | null;
  onSelectArea?: (areaId: string) => void;
  onCanvasClick?: (xPct: number, yPct: number) => void;
  placing?: boolean;
}) {
  const W = 720;
  const H = 520;

  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onCanvasClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    onCanvasClick(
      Math.max(3, Math.min(97, Number(x.toFixed(1)))),
      Math.max(3, Math.min(97, Number(y.toFixed(1)))),
    );
  };

  return (
    <div className={`map-wrap ${placing ? "map-placing" : ""}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="map-svg"
        onClick={handleClick}
        role="img"
        aria-label={`${carpet.code} 局部标记图`}
      >
        <defs>
          <radialGradient id={`rug-${carpet.id}`} cx="50%" cy="48%" r="75%">
            <stop offset="0%" stopColor="#8f3f1f" />
            <stop offset="70%" stopColor="#6e2c15" />
            <stop offset="100%" stopColor="#55200f" />
          </radialGradient>
          <pattern
            id={`dots-${carpet.id}`}
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="12" cy="12" r="1.6" fill="#e2c692" opacity="0.28" />
          </pattern>
        </defs>

        {/* 流苏 */}
        {Array.from({ length: 30 }).map((_, i) => (
          <line
            key={`t1-${i}`}
            x1={20 + i * ((W - 40) / 29)}
            y1={6}
            x2={20 + i * ((W - 40) / 29)}
            y2={22}
            stroke="#d9c28b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ))}
        {Array.from({ length: 30 }).map((_, i) => (
          <line
            key={`t2-${i}`}
            x1={20 + i * ((W - 40) / 29)}
            y1={H - 6}
            x2={20 + i * ((W - 40) / 29)}
            y2={H - 22}
            stroke="#d9c28b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ))}

        {/* 毯面 */}
        <rect x="18" y="24" width={W - 36} height={H - 48} rx="6" fill={`url(#rug-${carpet.id})`} />
        <rect x="18" y="24" width={W - 36} height={H - 48} rx="6" fill={`url(#dots-${carpet.id})`} />
        <rect
          x="34"
          y="40"
          width={W - 68}
          height={H - 80}
          rx="4"
          fill="none"
          stroke="#e2c692"
          strokeOpacity="0.7"
          strokeWidth="3"
        />
        <rect
          x="48"
          y="54"
          width={W - 96}
          height={H - 108}
          rx="3"
          fill="none"
          stroke="#c89b54"
          strokeOpacity="0.55"
          strokeWidth="1.6"
        />

        {/* 中心徽章纹样 */}
        <g opacity="0.55">
          <ellipse cx={W / 2} cy={H / 2} rx="92" ry="62" fill="none" stroke="#e2c692" strokeWidth="2.4" />
          <ellipse cx={W / 2} cy={H / 2} rx="60" ry="40" fill="none" stroke="#c89b54" strokeWidth="1.8" />
          <path
            d={`M${W / 2 - 46} ${H / 2} Q ${W / 2} ${H / 2 - 30} ${W / 2 + 46} ${H / 2} Q ${W / 2} ${H / 2 + 30} ${W / 2 - 46} ${H / 2} Z`}
            fill="#e2c692"
            opacity="0.18"
          />
          <circle cx={W / 2} cy={H / 2} r="9" fill="#e2c692" opacity="0.7" />
        </g>

        {/* 角花 */}
        {[
          [64, 70, 1, 1],
          [W - 64, 70, -1, 1],
          [64, H - 70, 1, -1],
          [W - 64, H - 70, -1, -1],
        ].map(([cx, cy, sx, sy], i) => (
          <path
            key={i}
            d={`M0 0 q34 -6 46 22 q-28 2 -34 18 q-16 -22 -12 -40 Z`}
            transform={`translate(${cx} ${cy}) scale(${sx} ${sy})`}
            fill="#c89b54"
            opacity="0.3"
          />
        ))}

        {/* 破损区标记 */}
        {markers.map((m) => {
          const cx = (m.x / 100) * W;
          const cy = (m.y / 100) * H;
          const c = STATUS_META[m.status].color;
          const active = selectedAreaId === m.id;
          return (
            <g
              key={m.id}
              className={`map-marker ${m.dim ? "dim" : ""} ${active ? "active" : ""} ${onSelectArea ? "clickable" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                if (!m.dim) onSelectArea?.(m.id);
              }}
              transform={`translate(${cx} ${cy})`}
            >
              <circle r="15" fill={c} opacity="0.18" />
              <circle
                r="10.5"
                fill={c}
                stroke="#fff8ee"
                strokeWidth={active ? 3 : 2}
              />
              <text
                textAnchor="middle"
                dy="3.6"
                fontSize="10"
                fontWeight="700"
                fill="#fff"
                pointerEvents="none"
              >
                {m.code}
              </text>
              <circle r="10.5" fill="none" stroke={m.color} strokeWidth="1.4" opacity="0.9" />
            </g>
          );
        })}
      </svg>
      <div className="map-caption">
        <span>
          {carpet.code} · {carpet.origin} · {carpet.era} · {carpet.knotDensity} 结/dm² ·{" "}
          {carpet.dyeing}
        </span>
        {placing ? (
          <span className="map-hint">点击毯面放置破损区标记</span>
        ) : null}
      </div>
    </div>
  );
}
