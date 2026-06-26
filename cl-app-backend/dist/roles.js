"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MODULE_PERMISSIONS = exports.USER_ROLES = void 0;
exports.isUserRole = isUserRole;
// 功能：定义系统用户角色，以及不同角色可访问的后台管理模块
exports.USER_ROLES = [
    "admin",
    "question_manager",
    "judge_manager",
    "analyst",
    "user"
];
// 后台页面根据 permissions 决定显示题库、判题、分析、用户、社区审核哪些模块
exports.MODULE_PERMISSIONS = {
    // admin 拥有全部后台模块权限
    admin: ["question-bank", "judge-system", "learning-analytics", "user-management", "community-moderation"],
    // 题库管理员只能维护题库，不能改判题配置或用户权限
    question_manager: ["question-bank"],
    // 判题管理员只能维护评测系统配置和队列
    judge_manager: ["judge-system"],
    // 分析员只能查看学习数据看板
    analyst: ["learning-analytics"],
    // 普通用户不能进入后台管理模块
    user: []
};
// 运行时校验角色字符串，避免无效角色写入用户表或权限判断
function isUserRole(value) {
    return typeof value === "string" && exports.USER_ROLES.includes(value);
}
