import { useState } from "react";
import { DYES, PROCESSES, THREAD_COLORS, type NewOrderData } from "../model";
import { RugMap, type MapMarker } from "./RugMap";

interface DraftZone {
  name: string;
  x: number;
  y: number;
  hours: number;
  threadColor: string;
  processes: string[];
}

interface OrderFormProps {
  origins: string[];
  onCreate: (data: NewOrderData) => void;
}

export function OrderForm({ origins, onCreate }: OrderFormProps) {
  const [origin, setOrigin] = useState("");
  const [era, setEra] = useState("");
  const [knotDensity, setKnotDensity] = useState("");
  const [dye, setDye] = useState(DYES[0]);
  const [zones, setZones] = useState<DraftZone[]>([]);
  const [error, setError] = useState("");

  const addZoneAt = (x: number, y: number) => {
    setZones((zs) => [
      ...zs,
      { name: `破损区${zs.length + 1}`, x, y, hours: 2, threadColor: "米白", processes: [] },
    ]);
  };

  const patchZone = (i: number, patch: Partial<DraftZone>) =>
    setZones((zs) => zs.map((z, idx) => (idx === i ? { ...z, ...patch } : z)));

  const toggleProcess = (i: number, p: string) =>
    setZones((zs) =>
      zs.map((z, idx) =>
        idx === i
          ? { ...z, processes: z.processes.includes(p) ? z.processes.filter((x) => x !== p) : [...z.processes, p] }
          : z
      )
    );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin.trim()) return setError("请填写产地");
    if (!era.trim()) return setError("请填写年代");
    const density = Number(knotDensity);
    if (!knotDensity || Number.isNaN(density) || density <= 0) return setError("请填写有效的结密度");
    if (zones.length === 0) return setError("请先在毯面图上点击添加至少一个破损区");
    if (zones.some((z) => !z.name.trim() || !(z.hours > 0))) return setError("破损区需填写名称且工时大于 0");
    onCreate({
      origin: origin.trim(),
      era: era.trim(),
      knotDensity: density,
      dye,
      zones: zones.map((z) => ({ ...z, name: z.name.trim() })),
    });
    setOrigin("");
    setEra("");
    setKnotDensity("");
    setDye(DYES[0]);
    setZones([]);
    setError("");
  };

  const markers: MapMarker[] = zones.map((z, i) => ({
    id: `draft-${i}`,
    name: z.name,
    x: z.x,
    y: z.y,
    color: "#0f766e",
  }));

  return (
    <section className="panel entry-panel">
      <h2>新工单录入</h2>
      <form onSubmit={submit}>
        <div className="field-grid">
          <label>
            <span>产地 *</span>
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="如：波斯·伊斯法罕"
              list="origin-list"
            />
            <datalist id="origin-list">
              {origins.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </label>
          <label>
            <span>年代 *</span>
            <input value={era} onChange={(e) => setEra(e.target.value)} placeholder="如：约1920年代 / 清末" />
          </label>
          <label>
            <span>结密度（结/平方英寸）*</span>
            <input
              type="number"
              min={1}
              value={knotDensity}
              onChange={(e) => setKnotDensity(e.target.value)}
              placeholder="如：400"
            />
          </label>
          <label>
            <span>染色类型</span>
            <select value={dye} onChange={(e) => setDye(e.target.value)}>
              {DYES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="draft-map-block">
          <p className="hint">破损区标记：点击下方毯面添加破损区（已添加 {zones.length} 个）</p>
          <RugMap markers={markers} onBackgroundClick={addZoneAt} />
        </div>

        {zones.map((z, i) => (
          <div className="draft-zone" key={i}>
            <div className="draft-zone-head">
              <b>#{i + 1}</b>
              <input
                className="zone-name"
                value={z.name}
                onChange={(e) => patchZone(i, { name: e.target.value })}
                placeholder="破损区名称"
              />
              <label className="inline">
                <span>工时</span>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={z.hours}
                  onChange={(e) => patchZone(i, { hours: Number(e.target.value) })}
                />
                h
              </label>
              <label className="inline">
                <span>补线色</span>
                <input value={z.threadColor} list="thread-colors" onChange={(e) => patchZone(i, { threadColor: e.target.value })} />
              </label>
              <button
                type="button"
                className="btn-mini danger"
                onClick={() => setZones((zs) => zs.filter((_, idx) => idx !== i))}
              >
                删除
              </button>
            </div>
            <div className="proc-row">
              {PROCESSES.map((p) => (
                <label key={p} className="proc-chip">
                  <input type="checkbox" checked={z.processes.includes(p)} onChange={() => toggleProcess(i, p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>
        ))}
        <datalist id="thread-colors">
          {THREAD_COLORS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="primary block">
          创建工单
        </button>
      </form>
    </section>
  );
}
