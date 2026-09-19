import { useMemo, useState } from "react";
import "./styles.css";
import { ORIGINS, STATUS_META, STATUS_ORDER } from "./constants";
import type { AppState, Carpet, DamageArea, Filters, Repairer } from "./types";
import {
  allAreas,
  applyDeactivation,
  areaKey,
  areaProgress,
  areaStatus,
  carpetProgress,
  filterAreas,
  loadState,
  saveState,
  uid,
  validateDispatch,
  type DispatchPlanItem,
} from "./helpers";
import CarpetMap, { type MapAreaMarker } from "./components/CarpetMap";
import AreaDetail from "./components/AreaDetail";
import CarpetFormModal from "./components/CarpetFormModal";
import DispatchBoard from "./components/DispatchBoard";
import RepairerPanel from "./components/RepairerPanel";

type Tab = "workbench" | "dispatch" | "repairers";

interface Toast {
  id: number;
  type: "ok" | "err" | "info";
  text: string;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [tab, setTab] = useState<Tab>("workbench");
  const [filters, setFilters] = useState<Filters>({ origin: "all", status: "all", q: "" });
  const [selectedCarpetId, setSelectedCarpetId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCarpet, setEditingCarpet] = useState<Carpet | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const persist = (next: AppState) => {
    setState(next);
    saveState(next);
  };

  const pushToast = (type: Toast["type"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };

  /* ---------- 派生数据 ---------- */

  const filtered = useMemo(() => filterAreas(state, filters), [state, filters]);
  const visibleCarpets = useMemo(
    () =>
      filters.origin === "all"
        ? state.carpets
        : state.carpets.filter((c) => c.origin === filters.origin),
    [state.carpets, filters.origin],
  );

  const selectedCarpet =
    visibleCarpets.find((c) => c.id === selectedCarpetId) ?? visibleCarpets[0] ?? null;

  const selectedArea = selectedCarpet?.areas.find((a) => a.id === selectedAreaId) ?? null;

  const stats = useMemo(() => {
    const flats = allAreas(state.carpets);
    const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<
      (typeof STATUS_ORDER)[number],
      number
    >;
    let progressSum = 0;
    for (const { area } of flats) {
      counts[areaStatus(area, state.repairers)]++;
      progressSum += areaProgress(area);
    }
    const avgProgress = flats.length ? Math.round(progressSum / flats.length) : 0;
    return {
      total: flats.length,
      counts,
      avgProgress,
      activeRepairers: state.repairers.filter((r) => r.active).length,
    };
  }, [state]);

  /* ---------- 工单操作 ---------- */

  const mutateArea = (
    carpetId: string,
    areaId: string,
    fn: (a: DamageArea) => DamageArea,
  ) => {
    persist({
      ...state,
      carpets: state.carpets.map((c) =>
        c.id !== carpetId
          ? c
          : { ...c, areas: c.areas.map((a) => (a.id === areaId ? fn(a) : a)) },
      ),
    });
  };

  // 单个派工 / 改派：同样走工时上限校验
  const assignArea = (carpetId: string, areaId: string, repairerId: string) => {
    const area = state.carpets
      .find((c) => c.id === carpetId)
      ?.areas.find((a) => a.id === areaId);
    if (!area) return;
    const plan: DispatchPlanItem[] = [
      { areaKey: areaKey(carpetId, areaId), repairerId, hours: area.estimatedHours },
    ];
    // 改派时该破损区当前占用旧负责人排期，先解除后再校验
    const base: AppState = {
      ...state,
      carpets: state.carpets.map((c) =>
        c.id !== carpetId
          ? c
          : {
              ...c,
              areas: c.areas.map((a) =>
                a.id === areaId ? { ...a, assigneeId: null } : a,
              ),
            },
      ),
    };
    const check = validateDispatch(base, plan);
    if (!check.ok) {
      const v = check.violations[0];
      pushToast(
        "err",
        `派工被拒绝：${v.name} 排期 ${v.current}h + 本单 ${v.adding}h = ${v.total}h，超过周工时上限 ${v.cap}h`,
      );
      return;
    }
    mutateArea(carpetId, areaId, (a) => ({ ...a, assigneeId: repairerId }));
    const r = state.repairers.find((x) => x.id === repairerId);
    pushToast("ok", `破损区已派给 ${r?.name}`);
  };

  const unassignArea = (carpetId: string, areaId: string) => {
    mutateArea(carpetId, areaId, (a) => ({ ...a, assigneeId: null }));
    pushToast("info", "工单已撤回，回到待分配");
  };

  const startArea = (carpetId: string, areaId: string) => {
    mutateArea(carpetId, areaId, (a) => ({ ...a, started: true }));
    pushToast("ok", "已开工");
  };

  const toggleStep = (carpetId: string, areaId: string, index: number) => {
    const area = state.carpets
      .find((c) => c.id === carpetId)
      ?.areas.find((a) => a.id === areaId);
    if (!area) return;
    const repairer = state.repairers.find((r) => r.id === area.assigneeId);
    if (!repairer || !repairer.active || !area.started || area.completedAt) {
      pushToast("err", "当前状态不能修改工序（工单锁定或未开工）");
      return;
    }
    mutateArea(carpetId, areaId, (a) => ({
      ...a,
      steps: a.steps.map((s, i) => (i === index ? !s : s)),
    }));
  };

  const completeArea = (carpetId: string, areaId: string) => {
    const area = state.carpets
      .find((c) => c.id === carpetId)
      ?.areas.find((a) => a.id === areaId);
    if (!area) return;
    const repairer = state.repairers.find((r) => r.id === area.assigneeId);
    if (!repairer || !repairer.active) {
      pushToast("err", "修复师已离岗，工单锁定，不能记完工");
      return;
    }
    if (!area.started || !area.steps.every(Boolean)) {
      pushToast("err", "全部工序完成后才能记完工");
      return;
    }
    mutateArea(carpetId, areaId, (a) => ({
      ...a,
      completedAt: new Date().toISOString(),
    }));
    pushToast("ok", "破损区已记完工");
  };

  const updateArea = (
    carpetId: string,
    areaId: string,
    patch: Partial<DamageArea>,
  ) => mutateArea(carpetId, areaId, (a) => ({ ...a, ...patch }));

  /* ---------- 批量派工：先整批校验，通过才一次性提交 ---------- */

  const dispatchBatch = (plan: DispatchPlanItem[]) => {
    const check = validateDispatch(state, plan);
    if (!check.ok) {
      // 整批拒绝：不写入任何变更
      pushToast(
        "err",
        `整批派工被拒绝：${check.violations
          .map((v) => `${v.name} 合计 ${v.total}h 超上限 ${v.cap}h`)
          .join("；")}。破损状态与人员排期均未改变。`,
      );
      return;
    }
    const lookup = new Map(plan.map((p) => [p.areaKey, p.repairerId]));
    persist({
      ...state,
      carpets: state.carpets.map((c) => ({
        ...c,
        areas: c.areas.map((a) => {
          const repairerId = lookup.get(areaKey(c.id, a.id));
          return repairerId ? { ...a, assigneeId: repairerId } : a;
        }),
      })),
    });
    pushToast("ok", `整批派工成功：共 ${plan.length} 个破损区，工时均在上限内`);
  };

  /* ---------- 地毯档案 ---------- */

  const saveCarpet = (carpet: Carpet) => {
    const exists = state.carpets.some((c) => c.id === carpet.id);
    persist({
      ...state,
      carpets: exists
        ? state.carpets.map((c) => (c.id === carpet.id ? carpet : c))
        : [carpet, ...state.carpets],
    });
    setFormOpen(false);
    setEditingCarpet(null);
    setSelectedCarpetId(carpet.id);
    setSelectedAreaId(carpet.areas[0]?.id ?? null);
    pushToast("ok", exists ? `${carpet.code} 已更新` : `${carpet.code} 已建档`);
  };

  const deleteCarpet = (id: string) => {
    persist({ ...state, carpets: state.carpets.filter((c) => c.id !== id) });
    setFormOpen(false);
    setEditingCarpet(null);
    if (selectedCarpetId === id) {
      setSelectedAreaId(null);
    }
    pushToast("info", "地毯档案已删除");
  };

  /* ---------- 修复师 ---------- */

  const addRepairer = (data: { name: string; hoursCap: number }) => {
    const r: Repairer = { id: uid("rep"), ...data, active: true };
    persist({ ...state, repairers: [...state.repairers, r] });
    pushToast("ok", `已添加修复师 ${data.name}`);
  };

  const updateRepairer = (id: string, patch: Partial<Repairer>) =>
    persist({
      ...state,
      repairers: state.repairers.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });

  const deleteRepairer = (id: string) => {
    persist({ ...state, repairers: state.repairers.filter((r) => r.id !== id) });
  };

  const toggleRepairer = (id: string, active: boolean) => {
    const r = state.repairers.find((x) => x.id === id);
    if (active) {
      persist({
        ...state,
        repairers: state.repairers.map((x) => (x.id === id ? { ...x, active: true } : x)),
      });
      pushToast("ok", `${r?.name} 已返岗，锁定工单可继续施工`);
    } else {
      // 离岗：未开工单回待分配，已开工单保持锁定（原子生效）
      persist(applyDeactivation(state, id));
      pushToast(
        "info",
        `${r?.name} 已离岗：未开工单回到待分配，已开工单保持锁定、不能记完工`,
      );
    }
  };

  const clearAll = () => {
    if (
      window.confirm("将清空本浏览器保存的全部工单数据并重新载入演示数据，确定继续？")
    ) {
      localStorage.removeItem("rug-workbench-v1");
      const fresh = loadState();
      persist(fresh);
      setSelectedCarpetId(fresh.carpets[0]?.id ?? null);
      setSelectedAreaId(null);
      pushToast("info", "已重置为演示数据");
    }
  };

  /* ---------- 标记图 / 筛选同步 ---------- */

  const matchingAreaKeys = useMemo(
    () => new Set(filtered.flat.map((f) => areaKey(f.carpet.id, f.area.id))),
    [filtered],
  );

  const mapMarkers: MapAreaMarker[] = selectedCarpet
    ? selectedCarpet.areas.map((a) => ({
        id: a.id,
        code: a.code,
        x: a.x,
        y: a.y,
        color: a.threadColor,
        status: areaStatus(a, state.repairers),
        dim: !matchingAreaKeys.has(areaKey(selectedCarpet.id, a.id)),
        selected: a.id === selectedAreaId,
      }))
    : [];

  const selectedCarpetFlat = selectedCarpet
    ? filtered.flat.filter((f) => f.carpet.id === selectedCarpet.id)
    : [];

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">▰</span>
          <div>
            <h1>地毯修复工单台</h1>
            <p>局部标记图 · 工时整批校验 · 数据仅存本机浏览器</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            className="primary-btn"
            onClick={() => {
              setEditingCarpet(null);
              setFormOpen(true);
            }}
          >
            ＋ 录入地毯工单
          </button>
          <button className="ghost-btn" onClick={clearAll}>
            重置演示数据
          </button>
        </div>
      </header>

      <section className="stats">
        <article>
          <small>破损区总数</small>
          <strong>{stats.total}</strong>
        </article>
        <article>
          <small>待分配</small>
          <strong>{stats.counts.unassigned}</strong>
        </article>
        <article>
          <small>施工中 / 锁定</small>
          <strong>
            {stats.counts.in_progress}
            {stats.counts.locked ? <em className="num-red">/{stats.counts.locked}</em> : null}
          </strong>
        </article>
        <article>
          <small>已完工</small>
          <strong>{stats.counts.done}</strong>
        </article>
        <article>
          <small>平均工序进度</small>
          <strong>{stats.avgProgress}%</strong>
        </article>
        <article>
          <small>在岗修复师</small>
          <strong>
            {stats.activeRepairers}/{state.repairers.length}
          </strong>
        </article>
      </section>

      <nav className="tabs">
        {(
          [
            ["workbench", "工单与标记图"],
            ["dispatch", "批量派工"],
            ["repairers", "修复师排期"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "tab-active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="filters panel">
        <div className="filter-group">
          <span className="filter-label">产地</span>
          <div className="chips">
            <button
              className={filters.origin === "all" ? "chip-on" : ""}
              onClick={() => setFilters((f) => ({ ...f, origin: "all" }))}
            >
              全部
            </button>
            {ORIGINS.map((o) => (
              <button
                key={o}
                className={filters.origin === o ? "chip-on" : ""}
                onClick={() => setFilters((f) => ({ ...f, origin: o }))}
              >
                {o}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <span className="filter-label">状态</span>
          <div className="chips">
            <button
              className={filters.status === "all" ? "chip-on" : ""}
              onClick={() => setFilters((f) => ({ ...f, status: "all" }))}
            >
              全部
            </button>
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                className={filters.status === s ? "chip-on" : ""}
                style={filters.status === s ? { borderColor: STATUS_META[s].color } : undefined}
                onClick={() => setFilters((f) => ({ ...f, status: s }))}
              >
                <i className="chip-dot" style={{ background: STATUS_META[s].color }} />
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>
        <input
          className="search-input"
          placeholder="搜编号 / 类型 / 色号…"
          value={filters.q}
          onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
        />
      </section>

      {tab === "workbench" ? (
        <section className="board">
          <div className="board-left">
            {visibleCarpets.length === 0 ? (
              <div className="empty-box">没有符合产地筛选的地毯档案。</div>
            ) : (
              visibleCarpets.map((c) => {
                const matched = filtered.flat.filter((f) => f.carpet.id === c.id);
                const dimmed = matched.length === 0;
                const active = selectedCarpet?.id === c.id;
                return (
                  <article
                    key={c.id}
                    className={`carpet-card ${active ? "carpet-on" : ""} ${dimmed ? "carpet-dim" : ""}`}
                    onClick={() => {
                      setSelectedCarpetId(c.id);
                      setSelectedAreaId(null);
                    }}
                  >
                    <div className="carpet-card-top">
                      <div>
                        <h3>{c.code}</h3>
                        <p className="muted">
                          {c.origin} · {c.era} · {c.knotDensity} 结/dm² · {c.dyeing}
                        </p>
                      </div>
                      {active ? (
                        <button
                          className="ghost-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCarpet(c);
                            setFormOpen(true);
                          }}
                        >
                          编辑档案
                        </button>
                      ) : null}
                    </div>
                    <div className="carpet-meta">
                      <span>
                        破损区 <b>{c.areas.length}</b> 个
                      </span>
                      <span>
                        整毯完工 <b>{carpetProgress(c, state.repairers)}%</b>
                      </span>
                      <span className="muted">
                        筛选命中 <b>{matched.length}</b>
                      </span>
                    </div>
                    <div className="area-dots">
                      {c.areas.map((a) => {
                        const st = areaStatus(a, state.repairers);
                        const hit = matchingAreaKeys.has(areaKey(c.id, a.id));
                        return (
                          <i
                            key={a.id}
                            className={`area-dot ${hit ? "" : "dot-dim"}`}
                            style={{ background: STATUS_META[st].color }}
                            title={`区 ${a.code} · ${STATUS_META[st].label}`}
                          />
                        );
                      })}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="board-center">
            {selectedCarpet ? (
              <>
                <CarpetMap
                  carpet={selectedCarpet}
                  markers={mapMarkers}
                  selectedAreaId={selectedAreaId}
                  onSelectArea={setSelectedAreaId}
                />
                <div className="legend">
                  {STATUS_ORDER.map((s) => (
                    <span key={s}>
                      <i className="chip-dot" style={{ background: STATUS_META[s].color }} />
                      {STATUS_META[s].label}
                    </span>
                  ))}
                  <span className="muted">淡显标记 = 不符合当前筛选</span>
                </div>
              </>
            ) : (
              <div className="empty-box map-empty">
                暂无地毯档案，点击右上角「录入地毯工单」开始。
              </div>
            )}
          </div>

          <div className="board-right panel">
            {selectedCarpet && selectedArea ? (
              <AreaDetail
                key={selectedArea.id}
                carpet={selectedCarpet}
                area={selectedArea}
                repairers={state.repairers}
                onAssign={(rid) => assignArea(selectedCarpet.id, selectedArea.id, rid)}
                onUnassign={() => unassignArea(selectedCarpet.id, selectedArea.id)}
                onStart={() => startArea(selectedCarpet.id, selectedArea.id)}
                onToggleStep={(i) => toggleStep(selectedCarpet.id, selectedArea.id, i)}
                onComplete={() => completeArea(selectedCarpet.id, selectedArea.id)}
                onUpdateArea={(patch) => updateArea(selectedCarpet.id, selectedArea.id, patch)}
              />
            ) : (
              <div className="empty-side">
                <h4>破损区列表</h4>
                {selectedCarpet && selectedCarpetFlat.length === 0 ? (
                  <p className="muted">当前筛选下没有命中的破损区。</p>
                ) : null}
                {selectedCarpet
                  ? selectedCarpetFlat.map(({ carpet, area }) => {
                      const st = areaStatus(area, state.repairers);
                      return (
                        <button
                          key={area.id}
                          className="area-row"
                          onClick={() => setSelectedAreaId(area.id)}
                        >
                          <i className="chip-dot" style={{ background: STATUS_META[st].color }} />
                          <span className="area-row-code">区 {area.code}</span>
                          <span className="muted">{area.damageType}</span>
                          <span className="area-row-pct">{areaProgress(area)}%</span>
                        </button>
                      );
                    })
                  : null}
                {selectedCarpet && selectedCarpetFlat.length > 0 ? (
                  <p className="muted side-note">点击行或标记图上的圆点查看工序与派工</p>
                ) : null}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {tab === "dispatch" ? (
        <section className="panel">
          <DispatchBoard state={state} onDispatch={dispatchBatch} />
        </section>
      ) : null}

      {tab === "repairers" ? (
        <section className="panel">
          <RepairerPanel
            state={state}
            onAdd={addRepairer}
            onUpdate={updateRepairer}
            onToggleActive={toggleRepairer}
            onDelete={deleteRepairer}
          />
        </section>
      ) : null}

      {formOpen ? (
        <CarpetFormModal
          initial={editingCarpet}
          onClose={() => {
            setFormOpen(false);
            setEditingCarpet(null);
          }}
          onSave={saveCarpet}
          onDelete={deleteCarpet}
        />
      ) : null}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.text}
          </div>
        ))}
      </div>
    </main>
  );
}
