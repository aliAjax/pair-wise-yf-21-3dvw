import { useState } from "react";
import { ZONE_STATUS_LABEL, currentLoad, type AppState } from "../model";

interface TeamProps {
  state: AppState;
  onToggleStatus: (repairerId: string) => void;
  onUpdateMaxHours: (repairerId: string, hours: number) => void;
  onAdd: (name: string, maxHours: number) => void;
}

export function Team({ state, onToggleStatus, onUpdateMaxHours, onAdd }: TeamProps) {
  const [name, setName] = useState("");
  const [hours, setHours] = useState("8");

  const assignedOf = (rid: string) =>
    state.orders.flatMap((o) =>
      o.zones
        .filter((z) => z.repairerId === rid && (z.status === "ASSIGNED" || z.status === "WORKING"))
        .map((z) => ({ code: o.code, zone: z }))
    );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const h = Number(hours);
    if (!name.trim() || Number.isNaN(h) || h <= 0) return;
    onAdd(name.trim(), h);
    setName("");
    setHours("8");
  };

  return (
    <section className="panel">
      <h2>修复师排期</h2>
      {state.repairers.map((r) => {
        const load = currentLoad(state, r.id);
        const pct = r.maxHours > 0 ? Math.min(100, Math.round((load / r.maxHours) * 100)) : 0;
        const over = load > r.maxHours;
        const items = assignedOf(r.id);
        return (
          <article key={r.id} className={"repairer-card" + (r.status === "OFF" ? " off" : "")}>
            <div className="repairer-head">
              <b>{r.name}</b>
              <span className="badge" data-s={r.status === "ON" ? "在岗" : "离岗"}>
                {r.status === "ON" ? "在岗" : "离岗"}
              </span>
              <button className="btn-mini" onClick={() => onToggleStatus(r.id)}>
                {r.status === "ON" ? "离岗" : "返岗"}
              </button>
            </div>
            <div className="repairer-meta">
              <span>
                在制 {load}h / 上限
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={r.maxHours}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v) && v >= 1) onUpdateMaxHours(r.id, v);
                  }}
                />
                h
              </span>
            </div>
            <div className={"pbar load" + (over ? " over" : "")}>
              <div className="pbar-inner" style={{ width: `${pct}%` }} />
            </div>
            {items.length > 0 ? (
              <ul className="assign-list">
                {items.map(({ code, zone }) => (
                  <li key={zone.id}>
                    {code}·{zone.name}（{ZONE_STATUS_LABEL[zone.status]} {zone.hours}h）
                    {r.status === "OFF" && zone.status === "WORKING" && <span className="lock-tag">🔒锁定</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dim small">暂无在制破损区</p>
            )}
          </article>
        );
      })}

      <form className="add-repairer" onSubmit={submit}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="新修复师姓名" />
        <input
          type="number"
          min={1}
          max={24}
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          title="工时上限 h"
        />
        <button type="submit" className="btn-mini">
          添加
        </button>
      </form>
    </section>
  );
}
