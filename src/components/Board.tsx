import {
  ZONE_STATUS_LABEL,
  orderProgress,
  orderStatusLabel,
  repairerOf,
  type AppState,
  type DamageZone,
  type WorkOrder,
} from "../model";
import { RugMap, ZONE_COLORS, type MapMarker } from "./RugMap";

interface BoardProps {
  state: AppState;
  orders: WorkOrder[]; // 已按产地筛选
  selectedOrder: WorkOrder | null;
  selectedZoneId: string | null;
  onSelectOrder: (id: string) => void;
  onSelectZone: (id: string | null) => void;
  onStart: (zoneId: string) => void;
  onComplete: (zoneId: string) => void;
  onRecall: (zoneId: string) => void;
  onDeleteOrder: (orderId: string) => void;
}

export function Board(props: BoardProps) {
  const { state, orders, selectedOrder, selectedZoneId } = props;

  const zoneLocked = (z: DamageZone): boolean => {
    const r = repairerOf(state, z.repairerId);
    return z.status === "WORKING" && r?.status === "OFF";
  };

  const markers: MapMarker[] = (selectedOrder?.zones ?? []).map((z) => ({
    id: z.id,
    name: z.name,
    x: z.x,
    y: z.y,
    color: ZONE_COLORS[z.status],
    locked: zoneLocked(z),
  }));

  const pickZone = (id: string) => {
    props.onSelectZone(id);
    requestAnimationFrame(() => {
      document.getElementById(`zone-row-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  return (
    <>
      <div className="order-list">
        {orders.length === 0 && <p className="empty">该产地暂无工单</p>}
        {orders.map((o) => {
          const p = orderProgress(o);
          return (
            <article
              key={o.id}
              className={"order-card" + (selectedOrder?.id === o.id ? " active" : "")}
              onClick={() => props.onSelectOrder(o.id)}
            >
              <div className="order-card-head">
                <b>{o.code}</b>
                <span className="badge">{orderStatusLabel(o)}</span>
                <button
                  className="btn-mini danger"
                  title="删除工单"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onDeleteOrder(o.id);
                  }}
                >
                  ✕
                </button>
              </div>
              <p className="order-meta">
                {o.origin} · {o.era} · 结密度 {o.knotDensity} · {o.dye}
              </p>
              <div className="pbar" title={`${p.done}/${p.total} 破损区完工`}>
                <div className="pbar-inner" style={{ width: `${p.pct}%` }} />
              </div>
              <p className="order-meta dim">
                进度 {p.done}/{p.total}（{p.pct}%）
              </p>
            </article>
          );
        })}
      </div>

      {selectedOrder && (
        <div className="panel detail-panel">
          <div className="heading">
            <div>
              <p>局部标记图</p>
              <h3>
                {selectedOrder.code} · {selectedOrder.origin}
              </h3>
            </div>
            <div className="legend">
              <i style={{ background: ZONE_COLORS.PENDING }} /> 待分配
              <i style={{ background: ZONE_COLORS.ASSIGNED }} /> 已派工
              <i style={{ background: ZONE_COLORS.WORKING }} /> 修复中
              <i style={{ background: ZONE_COLORS.DONE }} /> 已完工
            </div>
          </div>
          <RugMap markers={markers} selectedId={selectedZoneId} onMarkerClick={pickZone} />

          <table className="zone-table">
            <thead>
              <tr>
                <th>#</th>
                <th>破损区</th>
                <th>补线色</th>
                <th>工序</th>
                <th>工时</th>
                <th>状态</th>
                <th>修复师</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {selectedOrder.zones.map((z, i) => {
                const r = repairerOf(state, z.repairerId);
                const locked = zoneLocked(z);
                return (
                  <tr
                    key={z.id}
                    id={`zone-row-${z.id}`}
                    className={selectedZoneId === z.id ? "selected" : ""}
                    onClick={() => props.onSelectZone(z.id)}
                  >
                    <td>{i + 1}</td>
                    <td>{z.name}</td>
                    <td>
                      <span className="thread-dot" aria-hidden /> {z.threadColor}
                    </td>
                    <td>
                      {z.processes.length > 0
                        ? z.processes.map((p) => (
                            <span key={p} className="proc-tag">
                              {p}
                            </span>
                          ))
                        : "—"}
                    </td>
                    <td>{z.hours}h</td>
                    <td>
                      <span className="badge" data-s={z.status}>
                        {ZONE_STATUS_LABEL[z.status]}
                      </span>
                      {locked && <span className="lock-tag">🔒离岗锁定</span>}
                    </td>
                    <td>{r ? r.name : "—"}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {z.status === "PENDING" && <span className="dim">待批量派工</span>}
                      {z.status === "ASSIGNED" && (
                        <>
                          <button className="btn-mini" onClick={() => props.onStart(z.id)}>
                            开工
                          </button>{" "}
                          <button className="btn-mini" onClick={() => props.onRecall(z.id)}>
                            收回
                          </button>
                        </>
                      )}
                      {z.status === "WORKING" && (
                        <button
                          className="btn-mini ok"
                          disabled={locked}
                          title={locked ? "修复师离岗中：已开工单保持锁定，不能记完工" : "标记该破损区完工"}
                          onClick={() => props.onComplete(z.id)}
                        >
                          记完工
                        </button>
                      )}
                      {z.status === "DONE" && <span className="done-mark">✓ 完工</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
