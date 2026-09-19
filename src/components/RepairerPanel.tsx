import { useState } from "react";
import { scheduledHours } from "../helpers";
import type { AppState, Repairer } from "../types";
import { ProgressBar } from "./ui";

export default function RepairerPanel({
  state,
  onAdd,
  onUpdate,
  onToggleActive,
  onDelete,
}: {
  state: AppState;
  onAdd: (data: { name: string; hoursCap: number }) => void;
  onUpdate: (id: string, patch: Partial<Repairer>) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [cap, setCap] = useState(36);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="repairers">
      <div className="repairer-grid">
        {state.repairers.map((r) => {
          const load = scheduledHours(r.id, state);
          const pct = Math.min(100, Math.round((load / r.hoursCap) * 100));
          const over = load > r.hoursCap;
          const busyAreas = state.carpets
            .flatMap((c) => c.areas.map((a) => ({ carpet: c, area: a })))
            .filter(({ area }) => area.assigneeId === r.id && !area.completedAt);
          return (
            <article key={r.id} className={`repairer-card ${r.active ? "" : "is-off"}`}>
              <div className="repairer-head">
                {editingId === r.id ? (
                  <input
                    className="repairer-name-input"
                    value={r.name}
                    onChange={(e) => onUpdate(r.id, { name: e.target.value })}
                  />
                ) : (
                  <h4>
                    {r.name}
                    {!r.active ? <em className="off-tag">已离岗</em> : null}
                  </h4>
                )}
                <div className="repairer-tools">
                  <button className="ghost-btn" onClick={() => setEditingId(editingId === r.id ? null : r.id)}>
                    {editingId === r.id ? "完成" : "编辑"}
                  </button>
                  <button
                    className="ghost-btn"
                    onClick={() => {
                      const goActive = !r.active;
                      onToggleActive(r.id, goActive);
                    }}
                  >
                    {r.active ? "离岗" : "返岗"}
                  </button>
                  <button
                    className="danger-btn"
                    onClick={() => {
                      if (busyAreas.length > 0) {
                        window.alert(
                          `${r.name} 名下还有 ${busyAreas.length} 个未完工破损区，不能删除。`,
                        );
                        return;
                      }
                      if (window.confirm(`确认删除修复师 ${r.name}？`)) onDelete(r.id);
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>

              <div className="repairer-load">
                <div className="capacity-top">
                  <span className="muted">本周排期</span>
                  <b className={over ? "over" : ""}>
                    {load} / {r.hoursCap} h
                  </b>
                </div>
                <ProgressBar
                  value={pct}
                  color={over ? "#dc2626" : r.active ? "#0f766e" : "#94a3b8"}
                />
                {editingId === r.id ? (
                  <label className="field cap-edit">
                    <span className="field-label">周工时上限（小时）</span>
                    <input
                      type="number"
                      min={1}
                      value={r.hoursCap}
                      onChange={(e) =>
                        onUpdate(r.id, { hoursCap: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </label>
                ) : null}
              </div>

              {busyAreas.length === 0 ? (
                <p className="muted repairer-areas">暂无在手工单</p>
              ) : (
                <ul className="repairer-areas">
                  {busyAreas.map(({ carpet, area }) => (
                    <li key={area.id}>
                      {carpet.code} · 区 {area.code}
                      {area.started ? <em className="tag">已开工</em> : <em className="tag tag-blue">未开工</em>}
                      {!r.active && area.started ? <em className="tag tag-red">锁定</em> : null}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}

        <article className="repairer-card add-card">
          <h4>新增修复师</h4>
          <label className="field">
            <span className="field-label">姓名</span>
            <input
              value={name}
              placeholder="如 阿依古丽"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">周工时上限（小时）</span>
            <input
              type="number"
              min={1}
              value={cap}
              onChange={(e) => setCap(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <button
            className="primary-btn"
            disabled={!name.trim()}
            onClick={() => {
              onAdd({ name: name.trim(), hoursCap: cap });
              setName("");
              setCap(36);
            }}
          >
            添加
          </button>
        </article>
      </div>
    </div>
  );
}
