// ---------- 数据模型 ----------
export type ZoneStatus = "PENDING" | "ASSIGNED" | "WORKING" | "DONE";
export type RepairerStatus = "ON" | "OFF";

export interface DamageZone {
  id: string;
  name: string;
  x: number; // 标记图坐标 0-100
  y: number; // 标记图坐标 0-64
  hours: number; // 预计工时
  threadColor: string; // 补线色
  processes: string[]; // 工序
  status: ZoneStatus;
  repairerId: string | null; // 每个破损区至多一名修复师
}

export interface WorkOrder {
  id: string;
  code: string;
  origin: string; // 产地
  era: string; // 年代
  knotDensity: number; // 结密度（结/平方英寸）
  dye: string; // 染色类型
  zones: DamageZone[];
  createdAt: number;
}

export interface Repairer {
  id: string;
  name: string;
  maxHours: number; // 工时上限
  status: RepairerStatus;
}

export interface AppState {
  orders: WorkOrder[];
  repairers: Repairer[];
  seq: number;
}

export const PROCESSES = ["清洗", "整经", "补绒", "染色校正", "锁边", "定型"];
export const DYES = ["植物染", "化学染", "混合染"];
export const THREAD_COLORS = ["米白", "本白", "靛蓝", "枣红", "藏红", "金黄", "墨绿", "赭石"];

export const ZONE_STATUS_LABEL: Record<ZoneStatus, string> = {
  PENDING: "待分配",
  ASSIGNED: "已派工",
  WORKING: "修复中",
  DONE: "已完工",
};

// ---------- 查询 ----------
export function findZone(state: AppState, zoneId: string): { order: WorkOrder; zone: DamageZone } | null {
  for (const order of state.orders) {
    const zone = order.zones.find((z) => z.id === zoneId);
    if (zone) return { order, zone };
  }
  return null;
}

/** 修复师当前在制工时 = 已派工 + 修复中 的破损区工时之和 */
export function currentLoad(state: AppState, repairerId: string): number {
  let sum = 0;
  for (const o of state.orders)
    for (const z of o.zones)
      if (z.repairerId === repairerId && (z.status === "ASSIGNED" || z.status === "WORKING")) sum += z.hours;
  return sum;
}

export function repairerOf(state: AppState, id: string | null): Repairer | null {
  return state.repairers.find((r) => r.id === id) ?? null;
}

export function orderProgress(order: WorkOrder): { done: number; total: number; pct: number } {
  const total = order.zones.length;
  const done = order.zones.filter((z) => z.status === "DONE").length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function orderStatusLabel(order: WorkOrder): string {
  const zs = order.zones;
  if (zs.length > 0 && zs.every((z) => z.status === "DONE")) return "已完工";
  if (zs.some((z) => z.status !== "PENDING")) return "进行中";
  return "待分配";
}

// ---------- 批量派工：整批校验，任一超限则全部拒绝 ----------
export interface BatchItem {
  zoneId: string;
  repairerId: string;
}
export type BatchResult = { ok: true } | { ok: false; failures: string[] };

export function validateBatch(state: AppState, items: BatchItem[]): BatchResult {
  if (items.length === 0) return { ok: false, failures: ["本批为空：请先勾选待分配的破损区"] };
  const added = new Map<string, number>();
  for (const it of items) {
    const found = findZone(state, it.zoneId);
    if (!found) return { ok: false, failures: ["存在已失效的破损区，请刷新后重试"] };
    if (found.zone.status !== "PENDING")
      return { ok: false, failures: [`破损区「${found.zone.name}」状态已变化（${ZONE_STATUS_LABEL[found.zone.status]}），请重新勾选`] };
    if (!it.repairerId) return { ok: false, failures: [`破损区「${found.zone.name}」尚未选择修复师`] };
    added.set(it.repairerId, (added.get(it.repairerId) ?? 0) + found.zone.hours);
  }
  const failures: string[] = [];
  for (const [rid, add] of added) {
    const r = repairerOf(state, rid);
    if (!r) {
      failures.push("存在无效修复师");
      continue;
    }
    if (r.status === "OFF") failures.push(`${r.name} 已离岗，不能接收新派工`);
    const load = currentLoad(state, rid);
    if (load + add > r.maxHours)
      failures.push(`${r.name} 超限：在制 ${load}h + 本批 ${add}h = ${load + add}h ＞ 上限 ${r.maxHours}h`);
  }
  return failures.length ? { ok: false, failures } : { ok: true };
}

/** 仅在 validateBatch 通过后调用；校验先于任何修改，保证整批要么全成、要么不变 */
export function applyBatch(state: AppState, items: BatchItem[]): AppState {
  const assign = new Map(items.map((it) => [it.zoneId, it.repairerId]));
  return {
    ...state,
    orders: state.orders.map((o) => ({
      ...o,
      zones: o.zones.map((z) =>
        assign.has(z.id) && z.status === "PENDING"
          ? { ...z, status: "ASSIGNED" as ZoneStatus, repairerId: assign.get(z.id)! }
          : z
      ),
    })),
  };
}

// ---------- 离岗 / 返岗 ----------
export function setRepairerStatus(state: AppState, repairerId: string, status: RepairerStatus): AppState {
  const repairers = state.repairers.map((r) => (r.id === repairerId ? { ...r, status } : r));
  let orders = state.orders;
  if (status === "OFF") {
    // 未开始（已派工）工单回到待分配；已开（修复中）工单保持锁定在原修复师名下
    orders = state.orders.map((o) => ({
      ...o,
      zones: o.zones.map((z) =>
        z.repairerId === repairerId && z.status === "ASSIGNED"
          ? { ...z, status: "PENDING" as ZoneStatus, repairerId: null }
          : z
      ),
    }));
  }
  return { ...state, repairers, orders };
}

// ---------- 其它变更 ----------
export function updateZone(state: AppState, zoneId: string, patch: Partial<DamageZone>): AppState {
  return {
    ...state,
    orders: state.orders.map((o) =>
      o.zones.some((z) => z.id === zoneId)
        ? { ...o, zones: o.zones.map((z) => (z.id === zoneId ? { ...z, ...patch } : z)) }
        : o
    ),
  };
}

export interface NewOrderData {
  origin: string;
  era: string;
  knotDensity: number;
  dye: string;
  zones: Array<Pick<DamageZone, "name" | "x" | "y" | "hours" | "threadColor" | "processes">>;
}

export function addOrder(state: AppState, data: NewOrderData): AppState {
  const order: WorkOrder = {
    id: `o${state.seq}`,
    code: `CAR-${state.seq}`,
    origin: data.origin,
    era: data.era,
    knotDensity: data.knotDensity,
    dye: data.dye,
    createdAt: Date.now(),
    zones: data.zones.map((z, i) => ({
      ...z,
      id: `z${state.seq}-${i}`,
      status: "PENDING" as ZoneStatus,
      repairerId: null,
    })),
  };
  return { ...state, seq: state.seq + 1, orders: [order, ...state.orders] };
}

export function removeOrder(state: AppState, orderId: string): AppState {
  return { ...state, orders: state.orders.filter((o) => o.id !== orderId) };
}

export function addRepairer(state: AppState, name: string, maxHours: number): AppState {
  const repairer: Repairer = { id: `r${state.seq}`, name, maxHours, status: "ON" };
  return { ...state, seq: state.seq + 1, repairers: [...state.repairers, repairer] };
}

export function updateRepairerHours(state: AppState, repairerId: string, maxHours: number): AppState {
  return {
    ...state,
    repairers: state.repairers.map((r) => (r.id === repairerId ? { ...r, maxHours } : r)),
  };
}

// ---------- 本地存储 ----------
const LS_KEY = "carpet-repair-board-v1";

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || !Array.isArray(parsed.orders) || !Array.isArray(parsed.repairers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* 存储不可用时静默降级为内存态 */
  }
}

export function resetStorage(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

// ---------- 演示数据 ----------
export function seedState(): AppState {
  const now = Date.now();
  return {
    seq: 104,
    repairers: [
      { id: "r1", name: "王秀兰", maxHours: 8, status: "ON" },
      { id: "r2", name: "李国强", maxHours: 6, status: "ON" },
      { id: "r3", name: "阿依古丽", maxHours: 8, status: "ON" },
    ],
    orders: [
      {
        id: "o1",
        code: "CAR-101",
        origin: "波斯·伊斯法罕",
        era: "约1920年代",
        knotDensity: 400,
        dye: "植物染",
        createdAt: now - 86400000 * 6,
        zones: [
          { id: "z1", name: "边缘磨损", x: 16, y: 46, hours: 3, threadColor: "米白", processes: ["锁边", "补绒"], status: "PENDING", repairerId: null },
          { id: "z2", name: "中央虫蛀", x: 52, y: 30, hours: 5, threadColor: "靛蓝", processes: ["补绒", "染色校正"], status: "WORKING", repairerId: "r1" },
        ],
      },
      {
        id: "o2",
        code: "CAR-102",
        origin: "新疆·和田",
        era: "1950年代",
        knotDensity: 260,
        dye: "化学染",
        createdAt: now - 86400000 * 4,
        zones: [
          { id: "z3", name: "角部撕裂", x: 84, y: 16, hours: 4, threadColor: "枣红", processes: ["整经", "锁边"], status: "WORKING", repairerId: "r2" },
        ],
      },
      {
        id: "o3",
        code: "CAR-103",
        origin: "西藏·江孜",
        era: "清末",
        knotDensity: 150,
        dye: "植物染",
        createdAt: now - 86400000 * 2,
        zones: [
          { id: "z4", name: "表面磨薄", x: 40, y: 38, hours: 6, threadColor: "藏红", processes: ["补绒"], status: "PENDING", repairerId: null },
          { id: "z5", name: "流苏缺失", x: 50, y: 54, hours: 2, threadColor: "本白", processes: ["锁边"], status: "ASSIGNED", repairerId: "r2" },
        ],
      },
    ],
  };
}
