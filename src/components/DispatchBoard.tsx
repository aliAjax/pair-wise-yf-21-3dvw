import { useMemo, useState } from "react";
import {
  allAreas,
  areaKey,
  scheduledHours,
  validateDispatch,
  type DispatchPlanItem,
} from "../helpers";
import type { AppState, Repairer } from "../types";
import { ProgressBar } from "./ui";

export default function DispatchBoard({
  state,
  onDispatch,
}: {
  state: AppState;
  onDispatch: (plan: DispatchPlanItem[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assign, setAssign] = useState<Record<string, string>>({});

  // 待分配池：无负责人且未完工的破损区（每个破损区只会出现一次）
  const pool = useMemo(
    () =>
      allAreas(state.carpets).filter(
        ({ area }) => !area.assigneeId && !area.completedAt,
      ),
    [state.carpets],
  );

  const activeRepairers = state.repairers.filter((r) => r.active);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  const allChecked = pool.length > 0 && pool.every((f) => selected.has(areaKey(f.carpet.id, f.area.id)));
  const toggleAll = () =>
    setSelected(allChecked ? new Set() : new Set(pool.map((f) => areaKey(f.carpet.id, f.area.id))));

  const plan: DispatchPlanItem[] = pool
    .filter((f) => selected.has(areaKey(f.carpet.id, f.area.id)))
    .flatMap((f) => {
      const repairerId = assign[areaKey(f.carpet.id, f.area.id)];
      if (!repairerId) return [];
      return [
        {
          areaKey: areaKey(f.carpet.id, f.area.id),
          repairerId,
          hours: f.area.estimatedHours,
        },
      ];
    });

  const addingByRepairer = new Map<string, number>();
  for (const p of plan) {
    addingByRepairer.set(p.repairerId, (addingByRepairer.get(p.repairerId) ?? 0) + p.hours);
  }
  const check = validateDispatch(state, plan);
  const unassignedSelection = selected.size - plan.length;

  const submit = () => {
    if (plan.length === 0) return;
    onDispatch(plan);
    setSelected(new Set());
    setAssign({});
  };

  const loadColor = (r: Repairer, adding: number): string => {
    const total = scheduledHours(r.id, state) + adding;
    if (total > r.hoursCap) return "#dc2626";
    if (total > r.hoursCap * 0.85) return "#d97706";
    return "#0f766e";
  };

  return (
    <div className="dispatch">
      <div className="dispatch-head">
        <div>
          <h3>批量派工台</h3>
          <p className="muted">
            勾选待分配破损区并指定修复师；提交时按每人周工时上限整批校验，任一人超限则整批拒绝，状态与排期不变。
          </p>
        </div>
        <div className="dispatch-capacity">
          {state.repairers.map((r) => {
            const adding = addingByRepairer.get(r.id) ?? 0;
            const current = scheduledHours(r.id, state);
            const pct = Math.min(100, Math.round(((current + adding) / r.hoursCap) * 100));
            return (
              <div key={r.id} className={`capacity ${r.active ? "" : "off"}`}>
                <div className="capacity-top">
                  <span>
                    {r.name}
                    {!r.active ? <em className="off-tag">离岗</em> : null}
                  </span>
                  <b className={current + adding > r.hoursCap ? "over" : ""}>
                    {current}
                    {adding > 0 ? <ins>+{adding}</ins> : null}
                    {" / "}
                    {r.hoursCap}h
                  </b>
                </div>
                <ProgressBar value={pct} color={r.active ? loadColor(r, adding) : "#94a3b8"} />
              </div>
            );
          })}
        </div>
      </div>

      {pool.length === 0 ? (
        <div className="empty-box">当前没有待分配的破损区。</div>
      ) : (
        <div className="table-wrap">
          <table className="pool-table">
            <thead>
              <tr>
                <th className="col-check">
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                </th>
                <th>地毯</th>
                <th>破损区</th>
                <th>类型</th>
                <th>补线色</th>
                <th className="col-hours">工时</th>
                <th>指派修复师</th>
              </tr>
            </thead>
            <tbody>
              {pool.map(({ carpet, area }) => {
                const key = areaKey(carpet.id, area.id);
                const isSel = selected.has(key);
                return (
                  <tr key={key} className={isSel ? "row-sel" : ""}>
                    <td>
                      <input type="checkbox" checked={isSel} onChange={() => toggle(key)} />
                    </td>
                    <td>
                      <b>{carpet.code}</b>
                      <span className="muted"> · {carpet.origin}</span>
                    </td>
                    <td>区 {area.code}</td>
                    <td>{area.damageType}</td>
                    <td>
                      <span className="color-value">
                        <i style={{ background: area.threadColor }} />
                        {area.threadColor}
                      </span>
                    </td>
                    <td>{area.estimatedHours}h</td>
                    <td>
                      <select
                        value={assign[key] ?? ""}
                        disabled={!isSel}
                        onChange={(e) =>
                          setAssign((prev) => ({ ...prev, [key]: e.target.value }))
                        }
                      >
                        <option value="">未指定</option>
                        {activeRepairers.map((r) => {
                          const cur = scheduledHours(r.id, state);
                          const over = cur + area.estimatedHours > r.hoursCap;
                          return (
                            <option key={r.id} value={r.id}>
                              {r.name}（已排 {cur}/{r.hoursCap}h{over ? "，将超限" : ""}）
                            </option>
                          );
                        })}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected.size > 0 ? (
        <div className="dispatch-bar">
          <div className="dispatch-bar-info">
            已选 <b>{selected.size}</b> 个破损区
            {unassignedSelection > 0 ? (
              <span className="warn-text">，其中 {unassignedSelection} 个尚未指定修复师（不会提交）</span>
            ) : null}
            {check.ok ? (
              <span className="ok-text">，工时校验通过，可整批派工</span>
            ) : (
              <span className="warn-text">，工时超限，整批派工将被拒绝</span>
            )}
          </div>
          <div className="dispatch-violations">
            {check.violations.map((v) => (
              <span key={v.repairerId} className="violation-chip">
                {v.name}：现有 {v.current}h + 本批 {v.adding}h = {v.total}h，超出上限 {v.cap}h
              </span>
            ))}
          </div>
          <button
            className="primary-btn"
            disabled={plan.length === 0 || !check.ok}
            onClick={submit}
          >
            整批派工（{plan.length} 个区）
          </button>
        </div>
      ) : null}
    </div>
  );
}
