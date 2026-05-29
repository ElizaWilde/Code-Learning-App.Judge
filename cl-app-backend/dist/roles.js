"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODULE_PERMISSIONS = exports.USER_ROLES = void 0;
exports.isUserRole = isUserRole;
exports.USER_ROLES = [
    "admin",
    "question_manager",
    "judge_manager",
    "analyst",
    "user"
];
exports.MODULE_PERMISSIONS = {
    admin: ["question-bank", "judge-system", "learning-analytics", "user-management", "community-moderation"],
    question_manager: ["question-bank"],
    judge_manager: ["judge-system"],
    analyst: ["learning-analytics"],
    user: []
};
function isUserRole(value) {
    return typeof value === "string" && exports.USER_ROLES.includes(value);
}
