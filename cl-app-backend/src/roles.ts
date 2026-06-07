// 功能：定义系统用户角色，以及不同角色可访问的后台管理模块
export const USER_ROLES = [
  "admin",
  "question_manager",
  "judge_manager",
  "analyst",
  "user"
] as const;

export type UserRole = typeof USER_ROLES[number];

// 后台页面根据 permissions 决定显示题库、判题、分析、用户、社区审核哪些模块
export const MODULE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ["question-bank", "judge-system", "learning-analytics", "user-management", "community-moderation"],
  question_manager: ["question-bank"],
  judge_manager: ["judge-system"],
  analyst: ["learning-analytics"],
  user: []
};

// 运行时校验角色字符串，避免无效角色写入用户表或权限判断
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}
