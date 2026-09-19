// 地毯修复工单台 —— 数据模型（仅存浏览器 localStorage）

export type AreaStatus =
  | "unassigned" // 待分配
  | "assigned" // 已派工（未开工）
  | "in_progress" // 施工中
  | "locked" // 修复师离岗，已开工单锁定
  | "done"; // 已完工

export interface Repairer {
  id: string;
  name: string;
  /** 每周工时上限（批量派工按此整批校验） */
  hoursCap: number;
  /** 是否在岗；离岗后未开工单回池，已开工单锁定 */
  active: boolean;
}

export interface DamageArea {
  id: string;
  /** 区内编号 A / B / C … */
  code: string;
  damageType: string;
  /** 在局部标记图上的坐标（百分比 0-100） */
  x: number;
  y: number;
  /** 补线色（hex） */
  threadColor: string;
  /** 预估工时（小时） */
  estimatedHours: number;
  /** 每个破损区只能由一名修复师负责 */
  assigneeId: string | null;
  started: boolean;
  /** 修复工序完成情况，与 PROCESS_STEPS 等长 */
  steps: boolean[];
  completedAt: string | null;
}

export interface Carpet {
  id: string;
  /** 档案编号，如 CAR-101 */
  code: string;
  origin: string;
  era: string;
  /** 结密度（结 / 平方分米） */
  knotDensity: number;
  dyeing: string;
  createdAt: string;
  areas: DamageArea[];
}

export interface AppState {
  carpets: Carpet[];
  repairers: Repairer[];
}

export interface Filters {
  origin: string; // "all" 或具体产地
  status: "all" | AreaStatus;
  q: string;
}
