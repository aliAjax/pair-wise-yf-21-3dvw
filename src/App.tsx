import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  addOrder,
  addRepairer,
  applyBatch,
  findZone,
  loadState,
  removeOrder,
  repairerOf,
  resetStorage,
  saveState,
  seedState,
  setRepairerStatus,
  updateRepairerHours,
  updateZone,
  validateBatch,
  type AppState,
  type NewOrderData,
  type ZoneStatus,
} from "./model";
import { OrderForm } from "./components/OrderForm";
import { Board } from "./components/Board";
import { Dispatch, type DispatchMessage, type PoolEntry } from "./components/Dispatch";
import { Team } from "./components/Team";

function App() {
  const [state, setState] = useState<AppState>(() => loadState() ?? seedState());
  const [originFilter, setOriginFilter] = useState("ALL");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [batch, setBatch] = useState<Record<string, string>>({});
  const [dispatchMsg, setDispatchMsg] = useState<DispatchMessage | null>(null);

  // 数据只存浏览器本地
  useEffect(() => saveState(state), [state]);

  const origins = useMemo(() => [...new Set(state.orders.map((o) => o.origin))], [state.orders]);
  const filtered = useMemo(
    () => (originFilter === "ALL" ? state.orders : state.orders.filter((o) => o.origin === originFilter)),
    [state.orders, originFilter]
  );
  const selectedOrder = filtered.find((o) => o.id === selectedOrderId) ?? filtered[0] ?? null;

  // 派工池与产地筛选同步
  const pool: PoolEntry[] = useMemo(
    () => filtered.flatMap((order) => order.zones.filter((z) => z.status === "PENDING").map((zone) => ({ order, zone }))),
    [filtered]
  );

  // ---------- 统计（随筛选同步） ----------
  const statsOf = (orders: typeof state.orders) => {
    const zones = orders.flatMap((o) => o.zones);
    const count = (s: ZoneStatus) => zones.filter((z) => z.status === s).length;
    const done = count("DONE");
    return {
      orders: orders.length,
      zones: zones.length,
      pending: count("PENDING"),
      assigned: count("ASSIGNED"),
      working: count("WORKING"),
      done,
      pct: zones.length ? Math.round((done / zones.length) * 100) : 0,
    };
  };
  const globalStats = statsOf(state.orders);
  const filterStats = statsOf(filtered);

  // ---------- 操作 ----------
  const changeFilter = (v: string) => {
    setOriginFilter(v);
    setBatch({});
    setDispatchMsg(null);
    setSelectedZoneId(null);
  };

  const createOrder = (data: NewOrderData) => {
    setState((s) => addOrder(s, data));
    setOriginFilter("ALL"); // 新单立即可见
  };

  const deleteOrder = (orderId: string) => {
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) return;
    if (!window.confirm(`确认删除工单 ${order.code}？其破损区与派工信息将一并移除。`)) return;
    const zoneIds = new Set(order.zones.map((z) => z.id));
    setState((s) => removeOrder(s, orderId));
    setBatch((b) => Object.fromEntries(Object.entries(b).filter(([zid]) => !zoneIds.has(zid))));
    if (selectedOrderId === orderId) {
      setSelectedOrderId(null);
      setSelectedZoneId(null);
    }
  };

  const startZone = (zoneId: string) => setState((s) => updateZone(s, zoneId, { status: "WORKING" }));

  const completeZone = (zoneId: string) => {
    const found = findZone(state, zoneId);
    if (!found) return;
    const r = repairerOf(state, found.zone.repairerId);
    if (r?.status === "OFF") return; // 离岗锁定：已开工单不能记完工
    setState((s) => updateZone(s, zoneId, { status: "DONE" }));
  };

  const recallZone = (zoneId: string) =>
    setState((s) => updateZone(s, zoneId, { status: "PENDING", repairerId: null }));

  const toggleRepairer = (repairerId: string) => {
    const r = state.repairers.find((x) => x.id === repairerId);
    if (!r) return;
    const next = r.status === "ON" ? "OFF" : "ON";
    setState((s) => setRepairerStatus(s, repairerId, next));
    if (next === "OFF") setDispatchMsg(null); // 未开始工单已回到待分配，旧提示作废
  };

  // 批量派工：先整批校验，通过才落状态；失败则什么都不改
  const dispatchBatch = () => {
    const items = Object.entries(batch).map(([zoneId, repairerId]) => ({ zoneId, repairerId }));
    const result = validateBatch(state, items);
    if (!result.ok) {
      setDispatchMsg({ type: "err", lines: ["整批已拒绝，破损状态与人员排期未变化：", ...result.failures] });
      return;
    }
    setState((s) => applyBatch(s, items));
    setBatch({});
    setDispatchMsg({ type: "ok", lines: [`整批派工成功：${items.length} 个破损区已派工`] });
  };

  const resetAll = () => {
    if (!window.confirm("确认清空本地数据并恢复演示数据？")) return;
    resetStorage();
    setState(seedState());
    setBatch({});
    setDispatchMsg(null);
    setSelectedOrderId(null);
    setSelectedZoneId(null);
    setOriginFilter("ALL");
  };

  return (
    <main className="app">
      <header className="hero">
        <p>手工地毯修复工作室 · 纯前端工单台</p>
        <h1>地毯修复工单台</h1>
        <span>
          录入产地、年代、结密度、染色、破损区、补线色与工序；每个破损区仅由一名修复师负责，批量派工按每人工时上限整批校验；修复师离岗后未开始工单回到待分配，已开工单锁定不可记完工。
        </span>
      </header>

      <section className="metrics">
        <article>
          <small>工单总数</small>
          <strong>{globalStats.orders}</strong>
        </article>
        <article>
          <small>待分配破损区</small>
          <strong>{globalStats.pending}</strong>
        </article>
        <article>
          <small>修复中</small>
          <strong>{globalStats.working}</strong>
        </article>
        <article>
          <small>完工率</small>
          <strong>{globalStats.pct}%</strong>
        </article>
      </section>

      <div className="layout">
        <OrderForm origins={origins} onCreate={createOrder} />

        <section className="board-col">
          <div className="panel filter-panel">
            <label className="filter-label">
              <span>产地筛选</span>
              <select value={originFilter} onChange={(e) => changeFilter(e.target.value)}>
                <option value="ALL">全部产地</option>
                {origins.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <p className="filter-stats">
              {filterStats.orders} 单 · 破损区 {filterStats.zones} · 待分配 {filterStats.pending} · 已派工{" "}
              {filterStats.assigned} · 修复中 {filterStats.working} · 已完工 {filterStats.done} · 完工率{" "}
              {filterStats.pct}%
            </p>
          </div>

          <Board
            state={state}
            orders={filtered}
            selectedOrder={selectedOrder}
            selectedZoneId={selectedZoneId}
            onSelectOrder={(id) => {
              setSelectedOrderId(id);
              setSelectedZoneId(null);
            }}
            onSelectZone={setSelectedZoneId}
            onStart={startZone}
            onComplete={completeZone}
            onRecall={recallZone}
            onDeleteOrder={deleteOrder}
          />
        </section>

        <aside className="side-col">
          <Team
            state={state}
            onToggleStatus={toggleRepairer}
            onUpdateMaxHours={(id, h) => setState((s) => updateRepairerHours(s, id, h))}
            onAdd={(name, h) => setState((s) => addRepairer(s, name, h))}
          />
          <Dispatch
            state={state}
            pool={pool}
            batch={batch}
            onToggle={(zoneId, checked) =>
              setBatch((b) => {
                const nb = { ...b };
                if (checked) nb[zoneId] = nb[zoneId] ?? "";
                else delete nb[zoneId];
                return nb;
              })
            }
            onAssign={(zoneId, repairerId) => setBatch((b) => ({ ...b, [zoneId]: repairerId }))}
            onDispatch={dispatchBatch}
            message={dispatchMsg}
          />
        </aside>
      </div>

      <footer className="foot">
        <span>数据仅保存在本浏览器 localStorage，不上传服务器。</span>
        <button className="btn-mini" onClick={resetAll}>
          清空并重置演示数据
        </button>
      </footer>
    </main>
  );
}

export default App;
