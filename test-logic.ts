import {
  applyBatch,
  currentLoad,
  findZone,
  seedState,
  setRepairerStatus,
  validateBatch,
} from "./src/model";

let failures = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok:", msg);
  }
}

const s = seedState();

// 初始负载：李国强 = z3修复中4h + z5已派工2h = 6h（正好顶到上限）
check(currentLoad(s, "r2") === 6, "李国强在制 6h/上限 6h");
check(currentLoad(s, "r1") === 5, "王秀兰在制 5h/上限 8h");

// 超限整批拒绝：z1(3h)+z4(6h) 都给阿依古丽 => 9h > 8h
const bad = validateBatch(s, [
  { zoneId: "z1", repairerId: "r3" },
  { zoneId: "z4", repairerId: "r3" },
]);
check(!bad.ok, "阿依古丽 9h>8h 超限，整批拒绝");
check(findZone(s, "z1")!.zone.status === "PENDING", "拒绝后 z1 状态不变（待分配）");
check(findZone(s, "z4")!.zone.repairerId === null, "拒绝后 z4 仍无人负责");

// 多人混合，任一人超限即整批拒绝：z1->r1(5+3=8 ok) z4->r1(再+6=14 超)
const bad2 = validateBatch(s, [
  { zoneId: "z1", repairerId: "r1" },
  { zoneId: "z4", repairerId: "r1" },
]);
check(!bad2.ok, "同一人批内累计超限，整批拒绝");

// 合法批：z1(3h)->r1（5+3=8≤8），z4(6h)->r3（0+6=6≤8）
const goodItems = [
  { zoneId: "z1", repairerId: "r1" },
  { zoneId: "z4", repairerId: "r3" },
];
check(validateBatch(s, goodItems).ok, "合法批次通过校验");
const s2 = applyBatch(s, goodItems);
check(findZone(s2, "z1")!.zone.status === "ASSIGNED" && findZone(s2, "z1")!.zone.repairerId === "r1", "z1 派给王秀兰");
check(findZone(s2, "z4")!.zone.status === "ASSIGNED" && findZone(s2, "z4")!.zone.repairerId === "r3", "z4 派给阿依古丽");
check(currentLoad(s2, "r1") === 8, "派工后王秀兰 8h/8h");

// 离岗：未开始（已派工 z5）回到待分配；已开工（修复中 z3）保持锁定
const s3 = setRepairerStatus(s, "r2", "OFF");
check(findZone(s3, "z5")!.zone.status === "PENDING" && findZone(s3, "z5")!.zone.repairerId === null, "离岗后未开始工单回到待分配");
check(findZone(s3, "z3")!.zone.status === "WORKING" && findZone(s3, "z3")!.zone.repairerId === "r2", "离岗后已开工单保持锁定在原修复师名下");
check(currentLoad(s3, "r2") === 4, "离岗后在制只剩修复中的 4h");

// 离岗修复师不能接收新派工
check(!validateBatch(s3, [{ zoneId: "z5", repairerId: "r2" }]).ok, "离岗修复师派工被拒绝");

// 返岗后可正常派工
const s4 = setRepairerStatus(s3, "r2", "ON");
check(validateBatch(s4, [{ zoneId: "z5", repairerId: "r2" }]).ok, "返岗后 z5 可再派给李国强（4+2=6≤6）");

// 未选修复师的批次被拒绝
check(!validateBatch(s, [{ zoneId: "z1", repairerId: "" }]).ok, "未选修复师整批拒绝");

if (failures > 0) {
  console.error(`\n${failures} 项失败`);
  process.exit(1);
}
console.log("\n全部业务规则验证通过");
