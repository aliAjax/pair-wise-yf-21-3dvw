import { PROCESS_STEPS } from "./constants";
import type {
  AppState,
  AreaStatus,
  Carpet,
  DamageArea,
  Filters,
  Repairer,
} from "./types";

const STORAGE_KEY = "rug-workbench-v1";

export function uid(prefix = "id"): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rnd}`;
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (Array.isArray(parsed.carpets) && Array.isArray(parsed.repairers)) {
        return parsed;
      }
    }
  } catch {
    // 损坏的本地数据视为首次使用
  }
  const seed = seedState();
  saveState(seed);
  return seed;
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * 破损区状态派生：
 * - 完工 → done
 * - 无负责人 → unassigned
 * - 修复师离岗且已开工 → locked（保持锁定，不能记完工）
 * - 已开工 → in_progress，否则 assigned
 */
export function areaStatus(area: DamageArea, repairers: Repairer[]): AreaStatus {
  if (area.completedAt) return "done";
  if (!area.assigneeId) return "unassigned";
  const r = repairers.find((x) => x.id === area.assigneeId);
  if (!r) return "unassigned";
  if (!r.active) return area.started ? "locked" : "unassigned";
  return area.started ? "in_progress" : "assigned";
}

export function getRepairer(
  area: DamageArea,
  repairers: Repairer[],
): Repairer | undefined {
  return repairers.find((r) => r.id === area.assigneeId);
}

/**
 * 某修复师当前排期工时：负责人为该修复师的未完工破损区工时之和。
 * 离岗修复师的已开工锁定工单仍占用排期。
 */
export function scheduledHours(repairerId: string, state: AppState): number {
  let total = 0;
  for (const c of state.carpets) {
    for (const a of c.areas) {
      if (a.assigneeId === repairerId && !a.completedAt) {
        total += a.estimatedHours;
      }
    }
  }
  return total;
}

export function areaProgress(area: DamageArea): number {
  const done = area.steps.filter(Boolean).length;
  return Math.round((done / area.steps.length) * 100);
}

export function carpetProgress(carpet: Carpet, repairers: Repairer[]): number {
  if (carpet.areas.length === 0) return 0;
  const doneCount = carpet.areas.filter(
    (a) => areaStatus(a, repairers) === "done",
  ).length;
  return Math.round((doneCount / carpet.areas.length) * 100);
}

/** 遍历所有破损区（带上所属地毯信息） */
export interface FlatArea {
  carpet: Carpet;
  area: DamageArea;
}

export function allAreas(carpets: Carpet[]): FlatArea[] {
  return carpets.flatMap((carpet) =>
    carpet.areas.map((area) => ({ carpet, area })),
  );
}

export function filterAreas(
  state: AppState,
  filters: Filters,
): { flat: FlatArea[]; carpetIds: Set<string> } {
  const q = filters.q.trim().toLowerCase();
  const flat = allAreas(state.carpets).filter(({ carpet, area }) => {
    if (filters.origin !== "all" && carpet.origin !== filters.origin)
      return false;
    if (
      filters.status !== "all" &&
      areaStatus(area, state.repairers) !== filters.status
    )
      return false;
    if (q) {
      const hay = `${carpet.code} ${carpet.origin} ${area.code} ${area.damageType} ${area.threadColor}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  return { flat, carpetIds: new Set(flat.map((f) => f.carpet.id)) };
}

export interface DispatchPlanItem {
  areaKey: string; // carpetId + ":" + areaId
  repairerId: string;
  hours: number;
}

export interface DispatchViolation {
  repairerId: string;
  name: string;
  cap: number;
  current: number;
  adding: number;
  total: number;
}

/**
 * 批量派工整批校验：
 * 按修复师汇总（当前排期 + 本批工时），任一人超过周工时上限即返回违规。
 * 校验失败时调用方必须整体拒绝，不写入任何变更（破损状态与人员排期保持不变）。
 */
export function validateDispatch(
  state: AppState,
  plan: DispatchPlanItem[],
): { ok: boolean; violations: DispatchViolation[] } {
  const addingByRepairer = new Map<string, number>();
  for (const item of plan) {
    addingByRepairer.set(
      item.repairerId,
      (addingByRepairer.get(item.repairerId) ?? 0) + item.hours,
    );
  }
  const violations: DispatchViolation[] = [];
  for (const [repairerId, adding] of addingByRepairer) {
    const r = state.repairers.find((x) => x.id === repairerId);
    if (!r) continue;
    const current = scheduledHours(repairerId, state);
    const total = current + adding;
    if (total > r.hoursCap) {
      violations.push({
        repairerId,
        name: r.name,
        cap: r.hoursCap,
        current,
        adding,
        total,
      });
    }
  }
  return { ok: violations.length === 0, violations };
}

/** 修复师离岗：未开工单回到待分配，已开工单保持锁定。 */
export function applyDeactivation(state: AppState, repairerId: string): AppState {
  return {
    ...state,
    repairers: state.repairers.map((r) =>
      r.id === repairerId ? { ...r, active: false } : r,
    ),
    carpets: state.carpets.map((c) => ({
      ...c,
      areas: c.areas.map((a) => {
        if (a.assigneeId !== repairerId || a.completedAt) return a;
        // 已开工 → 保留负责人（锁定）；未开工 → 回待分配
        return a.started
          ? a
          : { ...a, assigneeId: null };
      }),
    })),
  };
}

export function areaKey(carpetId: string, areaId: string): string {
  return `${carpetId}:${areaId}`;
}

export function splitAreaKey(key: string): [string, string] {
  const idx = key.indexOf(":");
  return [key.slice(0, idx), key.slice(idx + 1)];
}

function makeArea(
  code: string,
  damageType: string,
  x: number,
  y: number,
  threadColor: string,
  estimatedHours: number,
  steps?: boolean[],
): DamageArea {
  return {
    id: uid("ar"),
    code,
    damageType,
    x,
    y,
    threadColor,
    estimatedHours,
    assigneeId: null,
    started: false,
    steps: steps ?? PROCESS_STEPS.map(() => false),
    completedAt: null,
  };
}

function seedState(): AppState {
  const repairers: Repairer[] = [
    { id: "rep_lin", name: "林素芳", hoursCap: 40, active: true },
    { id: "rep_chen", name: "陈守拙", hoursCap: 36, active: true },
    { id: "rep_wang", name: "王织云", hoursCap: 30, active: false },
    { id: "rep_zhao", name: "赵砚秋", hoursCap: 42, active: true },
  ];

  const c1a = makeArea("A", "边缘磨损", 8, 50, "#8b5a2b", 12);
  const c1b = makeArea("B", "虫蛀孔洞", 55, 42, "#a33a2a", 10, [
    true,
    true,
    true,
    false,
    false,
    false,
  ]);
  c1a.assigneeId = "rep_chen";
  c1b.assigneeId = "rep_wang";
  c1b.started = true;

  const c2a = makeArea("A", "中心纹样缺口", 50, 50, "#1f4e8a", 14);
  const c2b = makeArea("B", "流苏缺损", 50, 94, "#d9c28b", 6);
  const c2c = makeArea("C", "角部破损", 90, 12, "#7a3b18", 9);
  c2a.assigneeId = "rep_lin";
  c2a.started = true;
  c2a.steps = [true, true, false, false, false, false];

  const c3a = makeArea("A", "断裂开口", 30, 70, "#3f6b48", 16);
  const c3b = makeArea("B", "局部褪色", 68, 30, "#c8a35b", 8);
  c3a.assigneeId = "rep_zhao";

  const now = Date.now();
  const carpets: Carpet[] = [
    {
      id: "car_101",
      code: "CAR-101",
      origin: "波斯",
      era: "约 1960s",
      knotDensity: 320,
      dyeing: "植物染",
      createdAt: new Date(now - 86400000 * 12).toISOString(),
      areas: [c1a, c1b],
    },
    {
      id: "car_117",
      code: "CAR-117",
      origin: "安纳托利亚",
      era: "约 1930s",
      knotDensity: 420,
      dyeing: "植物染",
      createdAt: new Date(now - 86400000 * 8).toISOString(),
      areas: [c2a, c2b, c2c],
    },
    {
      id: "car_138",
      code: "CAR-138",
      origin: "藏毯",
      era: "约 1980s",
      knotDensity: 260,
      dyeing: "混合染",
      createdAt: new Date(now - 86400000 * 3).toISOString(),
      areas: [c3a, c3b],
    },
  ];

  return { carpets, repairers };
}
