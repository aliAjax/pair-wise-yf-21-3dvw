import type { AreaStatus } from "./types";

/** 标准修复工序（进度按工序完成数计算） */
export const PROCESS_STEPS = [
  "清洁除尘",
  "基底加固",
  "经线修复",
  "补线织造",
  "纹样补色",
  "平整整理",
] as const;

export const ORIGINS = ["波斯", "安纳托利亚", "高加索", "藏毯", "土库曼"];

export const DYEINGS = ["植物染", "化学染", "混合染"];

export const DAMAGE_TYPES = [
  "边缘磨损",
  "虫蛀孔洞",
  "角部破损",
  "中心纹样缺口",
  "局部褪色",
  "流苏缺损",
  "断裂开口",
];

export const STATUS_META: Record<
  AreaStatus,
  { label: string; color: string; hint: string }
> = {
  unassigned: {
    label: "待分配",
    color: "#64748b",
    hint: "尚未派给修复师",
  },
  assigned: {
    label: "已派工",
    color: "#2563eb",
    hint: "已派工，等待开工",
  },
  in_progress: {
    label: "施工中",
    color: "#d97706",
    hint: "修复师已开工",
  },
  locked: {
    label: "离岗锁定",
    color: "#dc2626",
    hint: "修复师已离岗，工单锁定，不能记完工",
  },
  done: {
    label: "已完工",
    color: "#0f766e",
    hint: "全部工序完成",
  },
};

export const STATUS_ORDER: AreaStatus[] = [
  "unassigned",
  "assigned",
  "in_progress",
  "locked",
  "done",
];
