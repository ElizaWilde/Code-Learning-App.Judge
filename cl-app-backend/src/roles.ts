export const USER_ROLES = [
  "admin",
  "question_manager",
  "judge_manager",
  "analyst",
  "user"
] as const;

export type UserRole = typeof USER_ROLES[number];

export const MODULE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ["question-bank", "judge-system", "learning-analytics", "user-management", "community-moderation"],
  question_manager: ["question-bank"],
  judge_manager: ["judge-system"],
  analyst: ["learning-analytics"],
  user: []
};

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}
