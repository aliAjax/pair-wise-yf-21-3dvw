import { currentLoad, type AppState, type DamageZone, type WorkOrder } from "../model";

export interface PoolEntry {
  order: WorkOrder;
  zone: DamageZone;
}

export interface DispatchMessage {
  type: "ok" | "err";
  lines: string[];
}

interface DispatchProps {
  state: AppState;
  pool: PoolEntry[]; // 与产地筛选同步的待分配破损区
  batch: Record<string, string>; // zoneId -> repairerId（"" 表示已勾选未选人）
  onToggle: (zoneId: string, checked: boolean) => void;
  onAssign: (zoneId: string, repairerId: string) => void;
  onDispatch: () => void;
  message: DispatchMessage | null;
}

export function Dispatch({ state, pool, batch, onToggle, onAssign, onDispatch, message }: DispatchProps) {
  const checkedIds = Object.keys(batch);
  const zoneOf = (id: string) => pool.find((p) => p.zone.id === id)?.zone;

  // 实时试算：本批叠加到各修复师当前在制工时上
  const projection = new Map<string, number>();
  for (const [zoneId, rid] of Object.entries(batch)) {
    if (!rid) continue;
    const z = zoneOf(zoneId);
    if (z) projection.set(rid, (projection.get(rid) ?? 0) + z.hours);
  }

  return (
    <section className="panel">
      <h2>批量派工</h2>
      <p className="hint">按当前产地筛选列出待分配破损区；整批校验工时上限，任一人超限则整批拒绝，状态不变。</p>

      <div className="pool">
        {pool.length === 0 && <p className="empty">当前筛选下没有待分配的破损区</p>}
        {pool.map(({ order, zone }) => {
          const checked = zone.id in batch;
          return (
            <div key={zone.id} className={"pool-row" + (checked ? " checked" : "")}>
              <label className="pool-check">
                <input type="checkbox" checked={checked} onChange={(e) => onToggle(zone.id, e.target.checked)} />
                <span>
                  <b>{order.code}</b> {zone.name}
                  <em>
                    {order.origin} · {zone.hours}h
                  </em>
                </span>
              </label>
              <select
                value={batch[zone.id] ?? ""}
                onChange={(e) => onAssign(zone.id, e.target.value)}
                title="选择负责修复师（每个破损区仅一名）"
              >
                <option value="">选择修复师</option>
                {state.repairers.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.status === "OFF"}>
                    {r.name}
                    {r.status === "OFF" ? "（离岗）" : ""}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {projection.size > 0 && (
        <div className="projection">
          <p className="hint">本批试算（在制 + 本批 ≤ 上限）：</p>
          {[...projection.entries()].map(([rid, add]) => {
            const r = state.repairers.find((x) => x.id === rid);
            if (!r) return null;
            const load = currentLoad(state, rid);
            const over = load + add > r.maxHours;
            return (
              <div key={rid} className={"proj-row" + (over ? " over" : "")}>
                {r.name}：{load}h + {add}h = {load + add}h / 上限 {r.maxHours}h{over ? " ✗ 超限" : " ✓"}
              </div>
            );
          })}
        </div>
      )}

      <button className="primary block" onClick={onDispatch} disabled={checkedIds.length === 0}>
        校验并整批派工（{checkedIds.length}）
      </button>

      {message && (
        <div className={"dispatch-msg " + message.type}>
          {message.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
    </section>
  );
}
