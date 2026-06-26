// 基础配置：集中维护后端地址、本地存储 key、轮询间隔和题目目录排序规则
// 功能：后台管理页交互逻辑，负责登录、接口请求、题库管理、判题配置、数据分析、用户管理和社区审核
const API_ORIGIN = "http://127.0.0.1:8080";
const TOKEN_KEY = "codebox_admin_token";
const APP_LANGUAGE_KEY = "appLanguage";
const QUEUE_POLL_INTERVAL_MS = 4000;
const QUEST_DIRECTORY_CATEGORY_ORDER = [
	"Array",
	"Graph DFS",
	"Monotonic Stack",
	"Sliding Window",
	"Stack",
	"Tree",
	"Tree BFS"
];

// 模块元信息：在切换模块时写入页面标题、说明文字和状态标签。
const moduleMeta = {
	"question-bank": {
		title: "题库更新",
		copy: "Browse all quests stored in the backend management service, create new quests, and update existing quest records.",
		status: "Question Bank"
	},
	"judge-system": {
		title: "评测系统维护",
		copy: "Manage language configuration, compilation commands, resource limits, and the live judge queue.",
		status: "Judge System"
	},
	"learning-analytics": {
		title: "用户学习数据统计",
		copy: "Review DAU, quest submission volume, quest pass rate, and wrong-answer distribution across learning path modules.",
		status: "Learning Analytics"
	},
	"user-management": {
		title: "User Management",
		copy: "Review platform accounts, inspect assigned permissions, and update user roles.",
		status: "User Management"
	},
	"community-moderation": {
		title: "Community Moderation",
		copy: "Inspect submitted community posts and update moderation status.",
		status: "Community Moderation"
	}
};

// 语言按钮集合：登录页和后台页各有一组按钮，统一保存后便于同步激活态。
const languageButtons = {
	en: [],
	zh: []
};

// 国际化文案表：所有带 data-i18n 的静态文案和运行时提示都从这里读取。
const translations = {
	en: {
		"login.kicker": "CodeBox Admin Access",
		"login.title": "Backend Management Login",
		"login.text": "Sign in to access the admin workspace for question bank updates, judge maintenance, and learning analytics.",
		"login.username": "Username",
		"login.password": "Password",
		"login.usernamePlaceholder": "Enter username",
		"login.passwordPlaceholder": "Enter password",
		"login.hintLabel": "Default API admin:",
		"login.signIn": "Sign In",
		"brand.label": "Backend Management System",
		"topbar.eyebrow": "Web Admin",
		"topbar.signOut": "Sign Out",
		"module.questionBank.name": "Question Bank",
		"module.questionBank.desc": "Question bank maintenance",
		"module.judgeSystem.name": "Judge System",
		"module.judgeSystem.desc": "Judge system maintenance",
		"module.learningAnalytics.name": "Learning Analytics",
		"module.learningAnalytics.desc": "Learning data analytics",
		"module.userManagement.name": "User Management",
		"module.userManagement.desc": "Accounts, roles, and permissions",
		"module.communityModeration.name": "Community Moderation",
		"module.communityModeration.desc": "Review and moderate community posts",
		"module.questionBank.title": "Question Bank",
		"module.questionBank.copy": "Browse all quests stored in the backend management service, create new quests, and update existing quest records.",
		"module.questionBank.status": "Question Bank",
		"module.judgeSystem.title": "Judge System",
		"module.judgeSystem.copy": "Manage language configuration, compilation commands, resource limits, and the live judge queue.",
		"module.judgeSystem.status": "Judge System",
		"module.learningAnalytics.title": "Learning Analytics",
		"module.learningAnalytics.copy": "Review DAU, quest submission volume, quest pass rate, and wrong-answer distribution across learning path modules.",
		"module.learningAnalytics.status": "Learning Analytics",
		"module.userManagement.title": "User Management",
		"module.userManagement.copy": "Review platform accounts, inspect assigned permissions, and update user roles.",
		"module.userManagement.status": "User Management",
		"module.communityModeration.title": "Community Moderation",
		"module.communityModeration.copy": "Inspect submitted community posts and update moderation status.",
		"module.communityModeration.status": "Community Moderation",
		"common.noAccessTitle": "No Module Access",
		"common.noAccessCopy": "This account is authenticated, but it does not have permission to access any admin module.",
		"common.noAccessStatus": "No Access",
		"common.noAccessMessage": "No admin module permissions are assigned to this account.",
		"common.loginFailed": "Login failed.",
		"common.unreachableLogin": "Unable to reach the login server.",
		"common.rolePrefix": "Role:",
		"common.refreshUsers": "Refresh Users",
		"user.directory": "User Directory",
		"user.details": "User Details",
		"user.role": "Role",
		"user.userType": "User Type",
		"user.saveRole": "Save Role",
		"user.roleAdmin": "admin",
		"user.roleQuestionManager": "question_manager",
		"user.roleJudgeManager": "judge_manager",
		"user.roleAnalyst": "analyst",
		"user.roleUser": "user",
		"user.typeNormal": "normal",
		"user.typeExpert": "expert",
		"moderation.queue": "Moderation Queue",
		"moderation.refreshQueue": "Refresh Queue",
		"moderation.postReview": "Post Review",
		"moderation.summary": "Summary",
		"moderation.fullContent": "Full Content",
		"moderation.status": "Status",
		"moderation.statusPending": "pending",
		"moderation.statusApproved": "approved",
		"moderation.statusRejected": "rejected",
		"moderation.note": "Moderation Note",
		"moderation.saveDecision": "Save Moderation Decision",
		"quest.directory": "Quest Directory",
		"quest.newQuest": "New Quest",
		"quest.details": "Quest Details",
		"quest.question": "Question",
		"quest.example": "Example",
		"quest.constraints": "Constraints",
		"quest.labels": "Labels",
		"quest.bestApproach": "Judge Result: Best Approach",
		"quest.reference": "Judge Result: Reference",
		"quest.judgeCases": "Run Logs / Judge Cases",
		"quest.visibleTests": "Visible tests",
		"quest.hiddenTests": "Hidden tests",
		"quest.referenceSolution": "Reference Solution",
		"quest.editor": "Quest Editor",
		"quest.editorCopy": "Create a new quest or update the selected quest. New quests must use a supported judge kind.",
		"quest.questId": "Quest ID",
		"quest.title": "Title",
		"quest.difficulty": "Difficulty",
		"quest.difficultyClass": "Difficulty Class",
		"quest.category": "Category",
		"quest.acceptance": "Acceptance",
		"quest.judgeKind": "Judge Kind",
		"quest.referenceTitle": "Reference Title",
		"quest.description": "Description",
		"quest.bestApproachPlain": "Best Approach",
		"quest.referenceNote": "Reference Note",
		"quest.starterCodes": "Starter Codes",
		"quest.starterCodesCopy": "These are shown to learners before they write a solution.",
		"quest.pythonStarter": "Python Starter Code",
		"quest.javaStarter": "Java Starter Code",
		"quest.referenceSolutions": "Reference Solutions",
		"quest.referenceSolutionsCopy": "These are unlocked in the learner quest page after submit.",
		"quest.pythonReference": "Python Reference Solution",
		"quest.javaReference": "Java Reference Solution",
		"quest.judgeTests": "Judge Tests",
		"quest.judgeTestsCopy": "Provide JSON arrays with objects shaped like { \"name\": \"...\", \"input\": ..., \"expected\": ... }.",
		"quest.visibleTestsJson": "Visible Tests JSON",
		"quest.hiddenTestsJson": "Hidden Tests JSON",
		"quest.deleteQuest": "Delete Quest",
		"quest.saveQuest": "Save Quest",
		"judge.queueMonitoring": "Queue Monitoring",
		"judge.recentJobs": "Recent Jobs",
		"judge.refreshQueue": "Refresh Queue",
		"judge.config": "Evaluation Configuration",
		"judge.languageConfig": "Language Configuration",
		"judge.languageConfigCopy": "Enable languages and control how the judge resolves source files and entry points.",
		"judge.enabled": "Enabled",
		"judge.label": "Label",
		"judge.dockerImage": "Docker Image",
		"judge.sourceFile": "Source File",
		"judge.entryPoint": "Entry Point",
		"judge.notes": "Notes",
		"judge.containerCommands": "Container Commands",
		"judge.containerCommandsCopy": "These commands run inside the language container. Use one argument per line. Available placeholders: {source}, {entry}.",
		"judge.pythonCompile": "Python Compile Command",
		"judge.pythonRun": "Python Run Command",
		"judge.javaCompile": "Java Compile Command",
		"judge.javaRun": "Java Run Command",
		"judge.resourceLimits": "Resource Limits",
		"judge.resourceLimitsCopy": "Control compile/runtime limits, Docker memory, output buffering, and queue concurrency.",
		"judge.compileTimeout": "Compile Timeout (ms)",
		"judge.runTimeout": "Run Timeout (ms)",
		"judge.maxBuffer": "Max Output Buffer (KB)",
		"judge.memoryLimit": "Memory Limit (KB)",
		"judge.maxConcurrent": "Max Concurrent Jobs",
		"judge.historySize": "Queue History Size",
		"judge.queueAlert": "Queue Alert Threshold",
		"judge.saveConfig": "Save Judge Configuration",
		"analytics.controls": "Analytics Controls",
		"analytics.timeWindow": "Time Window (days)",
		"analytics.refresh": "Refresh Analytics",
		"analytics.stats": "User Learning Data Statistics",
		"analytics.statsCopy": "ECharts charts for daily activity, quest outcomes, and wrong-answer distribution across learning modules.",
		"analytics.submissionVolume": "Quest Submission Volume",
		"analytics.passRate": "Quest Pass Rate",
		"analytics.wrongDistribution": "Distribution of Incorrect Answers",
		"state.loadQueueMetrics": "Load judge queue metrics from backend.",
		"state.noJudgeConfig": "No judge configuration loaded.",
		"state.loadJudgeConfig": "Load the current backend configuration before editing.",
		"state.loadUsers": "Load platform users from backend storage.",
		"state.selectUser": "Select a user to review account details and update access.",
		"state.editUserRole": "Select a user to edit their role.",
		"state.selectUserBeforeSaving": "Select a user before saving.",
		"state.loadModeration": "Load community posts awaiting review.",
		"state.selectPost": "Select a post to inspect content and update moderation status.",
		"state.reviewPost": "Select a post to review.",
		"state.selectPostBeforeSaving": "Select a post before saving.",
		"state.signInToLoadQuestions": "Sign in to load questions."
		,"dynamic.loadingQuests":"Loading quests..."
		,"dynamic.noBackendQuestRecords":"No backend quest records were returned."
		,"dynamic.questsLoadedSuffix":"quests loaded from backend storage."
		,"dynamic.selectQuest":"Select a quest to inspect its stored backend record."
		,"dynamic.createOrSelectQuest":"Create or select a quest"
		,"dynamic.creatingBackendQuest":"Creating a new backend quest record."
		,"dynamic.viewingBackendRecord":"Viewing backend record for"
		,"dynamic.createMode":"Create mode"
		,"dynamic.editMode":"Edit mode"
		,"dynamic.newQuest":"(new quest)"
		,"dynamic.questId":"Quest ID:"
		,"dynamic.notAssigned":"(not assigned)"
		,"dynamic.uncategorized":"Uncategorized"
		,"dynamic.noAcceptance":"No acceptance"
		,"dynamic.noVisibleTests":"No visible tests stored."
		,"dynamic.noHiddenTests":"No hidden tests stored."
		,"dynamic.createQuest":"Create Quest"
		,"dynamic.saveQuest":"Save Quest"
		,"dynamic.visibleTests":"Visible tests"
		,"dynamic.hiddenTests":"Hidden tests"
		,"dynamic.creatingNewQuest":"Creating a new quest."
		,"dynamic.questLoadedIntoEditor":"Quest loaded into editor."
		,"dynamic.questIdRequired":"Quest id is required."
		,"dynamic.creatingQuest":"Creating quest..."
		,"dynamic.savingQuest":"Saving quest..."
		,"dynamic.questSaveFailed":"Quest save failed."
		,"dynamic.questSaved":"Quest saved."
		,"dynamic.unreachableApi":"Unable to reach the backend API."
		,"dynamic.discardDraft":"New quest drafts can be discarded by selecting another quest."
		,"dynamic.selectSavedQuest":"Select a saved quest before deleting."
		,"dynamic.deleteQuestConfirm":"Delete quest"
		,"dynamic.deleteQuestConfirmSuffix":"? This removes it from admin and the learner practice catalog."
		,"dynamic.deletingQuest":"Deleting quest..."
		,"dynamic.questDeleteFailed":"Quest delete failed."
		,"dynamic.questDeleted":"Quest deleted."
		,"dynamic.latestDau":"Latest DAU"
		,"dynamic.submissions":"Submissions"
		,"dynamic.latestPassRate":"Latest Pass Rate"
		,"dynamic.wrongAnswers":"Wrong Answers"
		,"dynamic.echartsFailed":"ECharts failed to load in this browser session."
		,"dynamic.activeJobs":"Active Jobs"
		,"dynamic.queuedJobs":"Queued Jobs"
		,"dynamic.completed":"Completed"
		,"dynamic.failed":"Failed"
		,"dynamic.submitted":"Submitted"
		,"dynamic.concurrency":"Concurrency"
		,"dynamic.queueThreshold":"Queue threshold"
		,"dynamic.active":"Active"
		,"dynamic.queued":"queued"
		,"dynamic.noJudgeJobs":"No judge jobs recorded yet."
		,"dynamic.job":"Job"
		,"dynamic.queuedAt":"queued"
		,"dynamic.noSummary":"No summary"
		,"dynamic.configurationUpdatedAt":"Configuration updated at"
		,"dynamic.unknownTime":"unknown time"
		,"dynamic.judgeConfigLoaded":"Judge configuration loaded."
		,"dynamic.savingJudgeConfig":"Saving judge configuration..."
		,"dynamic.unableSaveJudgeConfig":"Unable to save judge configuration."
		,"dynamic.judgeConfigSaved":"Judge configuration saved."
		,"dynamic.loadingJudgeConfig":"Loading judge configuration..."
		,"dynamic.unableLoadJudgeConfig":"Unable to load judge configuration."
		,"dynamic.loadingQueueMetrics":"Loading queue metrics..."
		,"dynamic.unableLoadQueueMetrics":"Unable to load queue metrics."
		,"dynamic.queueRequestFailed":"Queue request failed."
		,"dynamic.loadedAnalyticsWindow":"Loaded"
		,"dynamic.dayAnalyticsWindow":"-day analytics window."
		,"dynamic.noUsersReturned":"No users were returned by the backend."
		,"dynamic.permissions":"permissions"
		,"dynamic.totalUsers":"Total Users"
		,"dynamic.admins":"Admins"
		,"dynamic.managers":"Managers"
		,"dynamic.standardUsers":"Standard Users"
		,"dynamic.experts":"Experts"
		,"dynamic.reviewingAccount":"Reviewing account"
		,"dynamic.createdAt":"Created at"
		,"dynamic.unknown":"unknown"
		,"dynamic.noAdminModules":"No admin modules"
		,"dynamic.loadingUsers":"Loading platform users..."
		,"dynamic.unableLoadUsers":"Unable to load users."
		,"dynamic.userRequestFailed":"User request failed."
		,"dynamic.usersLoadedSuffix":"users loaded from backend storage."
		,"dynamic.savingAccountSettings":"Saving account settings..."
		,"dynamic.roleUpdateFailed":"Role update failed."
		,"dynamic.userTypeUpdateFailed":"User type update failed."
		,"dynamic.accountSettingsUpdated":"Account settings updated."
		,"dynamic.noModerationPosts":"No moderation posts were returned."
		,"dynamic.pending":"Pending"
		,"dynamic.approved":"Approved"
		,"dynamic.rejected":"Rejected"
		,"dynamic.reviewingPost":"Reviewing post"
		,"dynamic.loadingModerationQueue":"Loading community moderation queue..."
		,"dynamic.unableLoadModeration":"Unable to load moderation queue."
		,"dynamic.moderationRequestFailed":"Moderation request failed."
		,"dynamic.communityPostsLoadedSuffix":"community posts loaded."
		,"dynamic.savingModerationDecision":"Saving moderation decision..."
		,"dynamic.moderationSaveFailed":"Moderation save failed."
		,"dynamic.moderationDecisionSaved":"Moderation decision saved."
		,"dynamic.noQuestionSelected":"No question selected."
		,"dynamic.noUserSelected":"No user selected."
		,"dynamic.noPostSelected":"No post selected."
		,"dynamic.loadingQuestionBank":"Loading question bank..."
		,"dynamic.unableLoadQuestionBank":"Unable to load question bank data."
		,"dynamic.questionBankRequestFailed":"Question bank request failed."
		,"dynamic.loadingAnalytics":"Loading backend learning analytics..."
		,"dynamic.unableLoadAnalytics":"Unable to load learning analytics."
		,"dynamic.jsonArrayRequired":"must be a JSON array."
		,"dynamic.invalidJson":"is invalid JSON."
	},
	zh: {
		"login.kicker": "CodeBox 管理后台入口",
		"login.title": "后台管理登录",
		"login.text": "登录后可进入管理后台，进行题库更新、评测维护和学习数据分析。",
		"login.username": "用户名",
		"login.password": "密码",
		"login.usernamePlaceholder": "请输入用户名",
		"login.passwordPlaceholder": "请输入密码",
		"login.hintLabel": "默认 API 管理员：",
		"login.signIn": "登录",
		"brand.label": "后台管理系统",
		"topbar.eyebrow": "Web 管理台",
		"topbar.signOut": "退出登录",
		"module.questionBank.name": "题库更新",
		"module.questionBank.desc": "题库维护与更新",
		"module.judgeSystem.name": "评测系统维护",
		"module.judgeSystem.desc": "评测系统配置与维护",
		"module.learningAnalytics.name": "学习数据统计",
		"module.learningAnalytics.desc": "学习数据分析",
		"module.userManagement.name": "用户管理",
		"module.userManagement.desc": "账号、角色与权限",
		"module.communityModeration.name": "社区内容审核",
		"module.communityModeration.desc": "审核和处理社区帖子",
		"module.questionBank.title": "题库更新",
		"module.questionBank.copy": "浏览后端管理服务中的全部题目，创建新题目，并更新现有题目记录。",
		"module.questionBank.status": "题库更新",
		"module.judgeSystem.title": "评测系统维护",
		"module.judgeSystem.copy": "管理语言配置、编译命令、资源限制以及实时评测队列。",
		"module.judgeSystem.status": "评测系统",
		"module.learningAnalytics.title": "学习数据统计",
		"module.learningAnalytics.copy": "查看 DAU、题目提交量、通过率以及各学习路径中的错题分布。",
		"module.learningAnalytics.status": "学习分析",
		"module.userManagement.title": "用户管理",
		"module.userManagement.copy": "查看平台账号、检查分配权限，并更新用户角色。",
		"module.userManagement.status": "用户管理",
		"module.communityModeration.title": "社区内容审核",
		"module.communityModeration.copy": "检查用户提交的社区帖子、审核内容，并更新审核状态。",
		"module.communityModeration.status": "社区审核",
		"common.noAccessTitle": "无模块访问权限",
		"common.noAccessCopy": "该账号已通过认证，但没有任何后台模块访问权限。",
		"common.noAccessStatus": "无权限",
		"common.noAccessMessage": "该账号未被分配任何后台模块权限。",
		"common.loginFailed": "登录失败。",
		"common.unreachableLogin": "无法连接登录服务器。",
		"common.rolePrefix": "角色：",
		"common.refreshUsers": "刷新用户",
		"user.directory": "用户目录",
		"user.details": "用户详情",
		"user.role": "角色",
		"user.userType": "用户类型",
		"user.saveRole": "保存角色",
		"user.roleAdmin": "管理员",
		"user.roleQuestionManager": "题库管理员",
		"user.roleJudgeManager": "评测管理员",
		"user.roleAnalyst": "数据分析员",
		"user.roleUser": "普通用户",
		"user.typeNormal": "普通用户",
		"user.typeExpert": "专家用户",
		"moderation.queue": "审核队列",
		"moderation.refreshQueue": "刷新队列",
		"moderation.postReview": "帖子审核",
		"moderation.summary": "摘要",
		"moderation.fullContent": "全文内容",
		"moderation.status": "状态",
		"moderation.statusPending": "待审核",
		"moderation.statusApproved": "已通过",
		"moderation.statusRejected": "已拒绝",
		"moderation.note": "审核备注",
		"moderation.saveDecision": "保存审核结果",
		"quest.directory": "题目目录",
		"quest.newQuest": "新建题目",
		"quest.details": "题目详情",
		"quest.question": "题面",
		"quest.example": "示例",
		"quest.constraints": "约束条件",
		"quest.labels": "标签",
		"quest.bestApproach": "评测结果：最佳思路",
		"quest.reference": "评测结果：参考题解",
		"quest.judgeCases": "运行日志 / 测试用例",
		"quest.visibleTests": "可见测试",
		"quest.hiddenTests": "隐藏测试",
		"quest.referenceSolution": "参考代码",
		"quest.editor": "题目编辑器",
		"quest.editorCopy": "新建题目或更新当前选中的题目。新题目必须使用已支持的评测类型。",
		"quest.questId": "题目 ID",
		"quest.title": "标题",
		"quest.difficulty": "难度",
		"quest.difficultyClass": "难度样式",
		"quest.category": "分类",
		"quest.acceptance": "通过率",
		"quest.judgeKind": "评测类型",
		"quest.referenceTitle": "参考标题",
		"quest.description": "题目描述",
		"quest.bestApproachPlain": "最佳思路",
		"quest.referenceNote": "参考说明",
		"quest.starterCodes": "起始代码",
		"quest.starterCodesCopy": "这些代码会在学习者编写解法前展示。",
		"quest.pythonStarter": "Python 起始代码",
		"quest.javaStarter": "Java 起始代码",
		"quest.referenceSolutions": "参考解法",
		"quest.referenceSolutionsCopy": "这些内容会在学习端提交后解锁。",
		"quest.pythonReference": "Python 参考解法",
		"quest.javaReference": "Java 参考解法",
		"quest.judgeTests": "评测测试",
		"quest.judgeTestsCopy": "请提供 JSON 数组，每项形如 { \"name\": \"...\", \"input\": ..., \"expected\": ... }。",
		"quest.visibleTestsJson": "可见测试 JSON",
		"quest.hiddenTestsJson": "隐藏测试 JSON",
		"quest.deleteQuest": "删除题目",
		"quest.saveQuest": "保存题目",
		"judge.queueMonitoring": "队列监控",
		"judge.recentJobs": "最近任务",
		"judge.refreshQueue": "刷新队列",
		"judge.config": "评测配置",
		"judge.languageConfig": "语言配置",
		"judge.languageConfigCopy": "启用语言，并控制评测服务如何解析源文件和入口点。",
		"judge.enabled": "启用",
		"judge.label": "显示名称",
		"judge.dockerImage": "Docker 镜像",
		"judge.sourceFile": "源文件",
		"judge.entryPoint": "入口点",
		"judge.notes": "备注",
		"judge.containerCommands": "容器命令",
		"judge.containerCommandsCopy": "这些命令会在语言容器内执行。每行填写一个参数。可用占位符：{source}、{entry}。",
		"judge.pythonCompile": "Python 编译命令",
		"judge.pythonRun": "Python 运行命令",
		"judge.javaCompile": "Java 编译命令",
		"judge.javaRun": "Java 运行命令",
		"judge.resourceLimits": "资源限制",
		"judge.resourceLimitsCopy": "控制编译/运行超时、Docker 内存、输出缓冲区和队列并发。",
		"judge.compileTimeout": "编译超时（ms）",
		"judge.runTimeout": "运行超时（ms）",
		"judge.maxBuffer": "最大输出缓冲区（KB）",
		"judge.memoryLimit": "内存限制（KB）",
		"judge.maxConcurrent": "最大并发任务数",
		"judge.historySize": "队列历史数量",
		"judge.queueAlert": "队列告警阈值",
		"judge.saveConfig": "保存评测配置",
		"analytics.controls": "统计控制",
		"analytics.timeWindow": "时间窗口（天）",
		"analytics.refresh": "刷新统计",
		"analytics.stats": "用户学习数据统计",
		"analytics.statsCopy": "使用 ECharts 展示日活、题目结果和各学习模块的错题分布。",
		"analytics.submissionVolume": "题目提交量",
		"analytics.passRate": "题目通过率",
		"analytics.wrongDistribution": "错题分布",
		"state.loadQueueMetrics": "从后端加载评测队列指标。",
		"state.noJudgeConfig": "尚未加载评测配置。",
		"state.loadJudgeConfig": "编辑前请先加载当前后端配置。",
		"state.loadUsers": "从后端存储加载平台用户。",
		"state.selectUser": "选择一个用户以查看账号详情并更新访问权限。",
		"state.editUserRole": "选择一个用户后可编辑其角色。",
		"state.selectUserBeforeSaving": "保存前请先选择用户。",
		"state.loadModeration": "加载等待审核的社区帖子。",
		"state.selectPost": "选择一个帖子以查看内容并更新审核状态。",
		"state.reviewPost": "选择一个帖子开始审核。",
		"state.selectPostBeforeSaving": "保存前请先选择帖子。",
		"state.signInToLoadQuestions": "登录后加载题目。"
		,"dynamic.loadingQuests":"正在加载题目..."
		,"dynamic.noBackendQuestRecords":"后端未返回任何题目记录。"
		,"dynamic.questsLoadedSuffix":"个题目已从后端存储加载。"
		,"dynamic.selectQuest":"选择一个题目以查看其后端记录。"
		,"dynamic.createOrSelectQuest":"新建或选择题目"
		,"dynamic.creatingBackendQuest":"正在创建新的后端题目记录。"
		,"dynamic.viewingBackendRecord":"正在查看后端记录："
		,"dynamic.createMode":"创建模式"
		,"dynamic.editMode":"编辑模式"
		,"dynamic.newQuest":"（新题目）"
		,"dynamic.questId":"题目 ID："
		,"dynamic.notAssigned":"（未分配）"
		,"dynamic.uncategorized":"未分类"
		,"dynamic.noAcceptance":"暂无通过率"
		,"dynamic.noVisibleTests":"暂无可见测试。"
		,"dynamic.noHiddenTests":"暂无隐藏测试。"
		,"dynamic.createQuest":"创建题目"
		,"dynamic.saveQuest":"保存题目"
		,"dynamic.visibleTests":"可见测试"
		,"dynamic.hiddenTests":"隐藏测试"
		,"dynamic.creatingNewQuest":"正在创建新题目。"
		,"dynamic.questLoadedIntoEditor":"题目已载入编辑器。"
		,"dynamic.questIdRequired":"题目 ID 不能为空。"
		,"dynamic.creatingQuest":"正在创建题目..."
		,"dynamic.savingQuest":"正在保存题目..."
		,"dynamic.questSaveFailed":"保存题目失败。"
		,"dynamic.questSaved":"题目已保存。"
		,"dynamic.unreachableApi":"无法连接后端 API。"
		,"dynamic.discardDraft":"选择其他题目即可丢弃新建草稿。"
		,"dynamic.selectSavedQuest":"删除前请先选择已保存的题目。"
		,"dynamic.deleteQuestConfirm":"删除题目"
		,"dynamic.deleteQuestConfirmSuffix":"？这会将它从后台和学习端题库中移除。"
		,"dynamic.deletingQuest":"正在删除题目..."
		,"dynamic.questDeleteFailed":"删除题目失败。"
		,"dynamic.questDeleted":"题目已删除。"
		,"dynamic.latestDau":"最新 DAU"
		,"dynamic.submissions":"提交数"
		,"dynamic.latestPassRate":"最新通过率"
		,"dynamic.wrongAnswers":"错题数"
		,"dynamic.echartsFailed":"当前浏览器会话未成功加载 ECharts。"
		,"dynamic.activeJobs":"进行中任务"
		,"dynamic.queuedJobs":"排队任务"
		,"dynamic.completed":"已完成"
		,"dynamic.failed":"失败"
		,"dynamic.submitted":"已提交"
		,"dynamic.concurrency":"并发数"
		,"dynamic.queueThreshold":"队列阈值"
		,"dynamic.active":"进行中"
		,"dynamic.queued":"排队"
		,"dynamic.noJudgeJobs":"暂无评测任务记录。"
		,"dynamic.job":"任务"
		,"dynamic.queuedAt":"入队时间"
		,"dynamic.noSummary":"暂无摘要"
		,"dynamic.configurationUpdatedAt":"配置更新时间："
		,"dynamic.unknownTime":"未知时间"
		,"dynamic.judgeConfigLoaded":"评测配置已加载。"
		,"dynamic.savingJudgeConfig":"正在保存评测配置..."
		,"dynamic.unableSaveJudgeConfig":"无法保存评测配置。"
		,"dynamic.judgeConfigSaved":"评测配置已保存。"
		,"dynamic.loadingJudgeConfig":"正在加载评测配置..."
		,"dynamic.unableLoadJudgeConfig":"无法加载评测配置。"
		,"dynamic.loadingQueueMetrics":"正在加载队列指标..."
		,"dynamic.unableLoadQueueMetrics":"无法加载队列指标。"
		,"dynamic.queueRequestFailed":"队列请求失败。"
		,"dynamic.loadedAnalyticsWindow":"已加载"
		,"dynamic.dayAnalyticsWindow":"天分析窗口。"
		,"dynamic.noUsersReturned":"后端未返回任何用户。"
		,"dynamic.permissions":"个权限"
		,"dynamic.totalUsers":"总用户数"
		,"dynamic.admins":"管理员"
		,"dynamic.managers":"管理角色"
		,"dynamic.standardUsers":"普通用户"
		,"dynamic.experts":"大神用户"
		,"dynamic.reviewingAccount":"正在查看账号"
		,"dynamic.createdAt":"创建时间"
		,"dynamic.unknown":"未知"
		,"dynamic.noAdminModules":"无后台模块权限"
		,"dynamic.loadingUsers":"正在加载平台用户..."
		,"dynamic.unableLoadUsers":"无法加载用户。"
		,"dynamic.userRequestFailed":"用户请求失败。"
		,"dynamic.usersLoadedSuffix":"个用户已从后端存储加载。"
		,"dynamic.savingAccountSettings":"正在保存账号设置..."
		,"dynamic.roleUpdateFailed":"更新角色失败。"
		,"dynamic.userTypeUpdateFailed":"更新用户类型失败。"
		,"dynamic.accountSettingsUpdated":"账号设置已更新。"
		,"dynamic.noModerationPosts":"后端未返回任何待审核帖子。"
		,"dynamic.pending":"待审核"
		,"dynamic.approved":"已通过"
		,"dynamic.rejected":"已拒绝"
		,"dynamic.reviewingPost":"正在审核帖子"
		,"dynamic.loadingModerationQueue":"正在加载社区审核队列..."
		,"dynamic.unableLoadModeration":"无法加载审核队列。"
		,"dynamic.moderationRequestFailed":"审核请求失败。"
		,"dynamic.communityPostsLoadedSuffix":"个社区帖子已加载。"
		,"dynamic.savingModerationDecision":"正在保存审核结果..."
		,"dynamic.moderationSaveFailed":"保存审核结果失败。"
		,"dynamic.moderationDecisionSaved":"审核结果已保存。"
		,"dynamic.noQuestionSelected":"未选择题目。"
		,"dynamic.noUserSelected":"未选择用户。"
		,"dynamic.noPostSelected":"未选择帖子。"
		,"dynamic.loadingQuestionBank":"正在加载题库..."
		,"dynamic.unableLoadQuestionBank":"无法加载题库数据。"
		,"dynamic.questionBankRequestFailed":"题库请求失败。"
		,"dynamic.loadingAnalytics":"正在加载后端学习分析..."
		,"dynamic.unableLoadAnalytics":"无法加载学习分析数据。"
		,"dynamic.jsonArrayRequired":"必须是 JSON 数组。"
		,"dynamic.invalidJson":"不是有效的 JSON。"
	}
};

// 当前语言状态：优先读取本地存储，缺省使用英文，切换后会回写 localStorage。
let currentLanguage = localStorage.getItem(APP_LANGUAGE_KEY) || "en";

// 根据当前语言获取文案；如果当前语言缺失该 key，则回退到英文或原 key。
function t(key) {
	return translations[currentLanguage]?.[key] || translations.en[key] || key;
}

function translateMappedValue(value, keyMap) {
	const key = keyMap[value];
	return key ? t(key) : value;
}

function getRoleLabel(role) {
	return translateMappedValue(role, {
		admin: "user.roleAdmin",
		question_manager: "user.roleQuestionManager",
		judge_manager: "user.roleJudgeManager",
		analyst: "user.roleAnalyst",
		user: "user.roleUser"
	});
}

function getUserTypeLabel(userType) {
	return translateMappedValue(userType, {
		normal: "user.typeNormal",
		expert: "user.typeExpert"
	});
}

function getModerationStatusLabel(status) {
	return translateMappedValue(status, {
		pending: "moderation.statusPending",
		approved: "moderation.statusApproved",
		rejected: "moderation.statusRejected"
	});
}

function getPermissionLabel(permission) {
	const meta = getModuleMeta(permission);
	return meta ? meta.title : permission;
}

// 根据模块 id 生成可展示的标题、说明和状态文案，支持国际化回退。
function getModuleMeta(moduleId) {
	const keyMap = {
		"question-bank": "module.questionBank",
		"judge-system": "module.judgeSystem",
		"learning-analytics": "module.learningAnalytics",
		"user-management": "module.userManagement",
		"community-moderation": "module.communityModeration"
	};
	const baseKey = keyMap[moduleId];
	return baseKey
		? { title: t(`${baseKey}.title`), copy: t(`${baseKey}.copy`), status: t(`${baseKey}.status`) }
		: moduleMeta[moduleId];
}

// 扫描 data-i18n 与 data-i18n-placeholder，将静态 DOM 文案替换为当前语言。
function applyStaticTranslations() {
	document.documentElement.lang = currentLanguage === "zh" ? "zh-CN" : "en";
	document.querySelectorAll("[data-i18n]").forEach((node) => {
		node.textContent = t(node.dataset.i18n);
	});
	document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
		node.placeholder = t(node.dataset.i18nPlaceholder);
	});
}

// 登录、顶栏和导航 DOM 引用：后续登录态切换、模块切换和语言刷新都会使用。
const loginShell = document.getElementById("login-shell");
const adminShell = document.getElementById("admin-shell");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutButton = document.getElementById("logout-button");
const pageTitle = document.getElementById("page-title");
const heroTitle = document.getElementById("hero-title");
const heroCopy = document.getElementById("hero-copy");
const roleBadge = document.getElementById("role-badge");
const accessMessage = document.getElementById("access-message");
const statusChip = document.getElementById("status-chip");
const navItems = Array.from(document.querySelectorAll(".module-item"));
languageButtons.en = Array.from(document.querySelectorAll("#login-language-en, #admin-language-en"));
languageButtons.zh = Array.from(document.querySelectorAll("#login-language-zh, #admin-language-zh"));

// 各模块工作区与列表/表单 DOM 引用：集中缓存，避免业务函数重复查询节点。
const questionBankWorkspace = document.getElementById("question-bank-workspace");
const judgeSystemWorkspace = document.getElementById("judge-system-workspace");
const analyticsWorkspace = document.getElementById("analytics-workspace");
const userManagementWorkspace = document.getElementById("user-management-workspace");
const communityModerationWorkspace = document.getElementById("community-moderation-workspace");
const analyticsStatusCopy = document.getElementById("analytics-status-copy");
const analyticsDaysSelect = document.getElementById("analytics-days-select");
const refreshAnalyticsButton = document.getElementById("refresh-analytics-button");
const analyticsSummaryMetrics = document.getElementById("analytics-summary-metrics");
const chartDauElement = document.getElementById("chart-dau");
const chartSubmissionVolumeElement = document.getElementById("chart-submission-volume");
const chartPassRateElement = document.getElementById("chart-pass-rate");
const chartWrongAnswerDistributionElement = document.getElementById("chart-wrong-answer-distribution");
const userManagementStatusCopy = document.getElementById("user-management-status-copy");
const refreshUsersButton = document.getElementById("refresh-users-button");
const userSummaryMetrics = document.getElementById("user-summary-metrics");
const userDirectory = document.getElementById("user-directory");
const userSelectedState = document.getElementById("user-selected-state");
const userEmpty = document.getElementById("user-empty");
const userDetail = document.getElementById("user-detail");
const userDetailName = document.getElementById("user-detail-name");
const userDetailCreated = document.getElementById("user-detail-created");
const userDetailPermissions = document.getElementById("user-detail-permissions");
const userRoleForm = document.getElementById("user-role-form");
const userRoleSelect = document.getElementById("user-role-select");
const userTypeSelect = document.getElementById("user-type-select");
const userRoleStatus = document.getElementById("user-role-status");
const moderationStatusCopy = document.getElementById("moderation-status-copy");
const refreshModerationButton = document.getElementById("refresh-moderation-button");
const moderationSummaryMetrics = document.getElementById("moderation-summary-metrics");
const moderationDirectory = document.getElementById("moderation-directory");
const moderationSelectedState = document.getElementById("moderation-selected-state");
const moderationEmpty = document.getElementById("moderation-empty");
const moderationDetail = document.getElementById("moderation-detail");
const moderationDetailTitle = document.getElementById("moderation-detail-title");
const moderationDetailMeta = document.getElementById("moderation-detail-meta");
const moderationDetailTags = document.getElementById("moderation-detail-tags");
const moderationDetailSummary = document.getElementById("moderation-detail-summary");
const moderationDetailContent = document.getElementById("moderation-detail-content");
const moderationForm = document.getElementById("moderation-form");
const moderationStatusSelect = document.getElementById("moderation-status-select");
const moderationNoteInput = document.getElementById("moderation-note-input");
const moderationFormStatus = document.getElementById("moderation-form-status");

// 题库模块 DOM 引用：负责题目目录、详情预览、新建/编辑表单和删除按钮。
const questTotal = document.getElementById("quest-total");
const questDirectory = document.getElementById("quest-directory");
const questSelectedState = document.getElementById("quest-selected-state");
const questEmpty = document.getElementById("quest-empty");
const questDetail = document.getElementById("quest-detail");
const detailTitle = document.getElementById("detail-title");
const detailId = document.getElementById("detail-id");
const detailTags = document.getElementById("detail-tags");
const detailDescription = document.getElementById("detail-description");
const detailExample = document.getElementById("detail-example");
const detailConstraints = document.getElementById("detail-constraints");
const detailLabels = document.getElementById("detail-labels");
const detailBestApproach = document.getElementById("detail-best-approach");
const detailReferenceTitle = document.getElementById("detail-reference-title");
const detailReferenceNote = document.getElementById("detail-reference-note");
const detailVisibleTests = document.getElementById("detail-visible-tests");
const detailHiddenTests = document.getElementById("detail-hidden-tests");
const detailReferencePython = document.getElementById("detail-reference-python");
const detailReferenceJava = document.getElementById("detail-reference-java");
const newQuestButton = document.getElementById("new-quest-button");
const questEditorMode = document.getElementById("quest-editor-mode");
const questForm = document.getElementById("quest-form");
const questFormStatus = document.getElementById("quest-form-status");
const questSaveButton = document.getElementById("quest-save-button");
const questDeleteButton = document.getElementById("quest-delete-button");
const questFormId = document.getElementById("quest-form-id");
const questFormTitle = document.getElementById("quest-form-title");
const questFormDifficulty = document.getElementById("quest-form-difficulty");
const questFormDifficultyClass = document.getElementById("quest-form-difficulty-class");
const questFormCategory = document.getElementById("quest-form-category");
const questFormAcceptance = document.getElementById("quest-form-acceptance");
const questFormKind = document.getElementById("quest-form-kind");
const questFormReferenceTitle = document.getElementById("quest-form-reference-title");
const questFormDescription = document.getElementById("quest-form-description");
const questFormExample = document.getElementById("quest-form-example");
const questFormConstraints = document.getElementById("quest-form-constraints");
const questFormBestApproach = document.getElementById("quest-form-best-approach");
const questFormReferenceNote = document.getElementById("quest-form-reference-note");
const questFormStarterPython = document.getElementById("quest-form-starter-python");
const questFormStarterJava = document.getElementById("quest-form-starter-java");
const questFormReferencePython = document.getElementById("quest-form-reference-python");
const questFormReferenceJava = document.getElementById("quest-form-reference-java");
const questFormVisibleTests = document.getElementById("quest-form-visible-tests");
const questFormHiddenTests = document.getElementById("quest-form-hidden-tests");

// 评测系统 DOM 引用：负责队列指标、任务列表、语言配置和资源限制表单。
const queueStatusCopy = document.getElementById("queue-status-copy");
const queueMetrics = document.getElementById("queue-metrics");
const queueJobs = document.getElementById("queue-jobs");
const refreshQueueButton = document.getElementById("refresh-queue-button");
const judgeConfigForm = document.getElementById("judge-config-form");
const judgeConfigUpdated = document.getElementById("judge-config-updated");
const judgeConfigStatus = document.getElementById("judge-config-status");

const langPythonEnabled = document.getElementById("lang-python-enabled");
const langPythonLabel = document.getElementById("lang-python-label");
const langPythonImage = document.getElementById("lang-python-image");
const langPythonSource = document.getElementById("lang-python-source");
const langPythonEntry = document.getElementById("lang-python-entry");
const langPythonNotes = document.getElementById("lang-python-notes");
const langPythonCompile = document.getElementById("lang-python-compile");
const langPythonRun = document.getElementById("lang-python-run");

const langJavaEnabled = document.getElementById("lang-java-enabled");
const langJavaLabel = document.getElementById("lang-java-label");
const langJavaImage = document.getElementById("lang-java-image");
const langJavaSource = document.getElementById("lang-java-source");
const langJavaEntry = document.getElementById("lang-java-entry");
const langJavaNotes = document.getElementById("lang-java-notes");
const langJavaCompile = document.getElementById("lang-java-compile");
const langJavaRun = document.getElementById("lang-java-run");

const limitCompileTimeout = document.getElementById("limit-compile-timeout");
const limitRunTimeout = document.getElementById("limit-run-timeout");
const limitMaxBuffer = document.getElementById("limit-max-buffer");
const limitMemory = document.getElementById("limit-memory");
const limitMaxConcurrent = document.getElementById("limit-max-concurrent");
const limitHistorySize = document.getElementById("limit-history-size");
const limitQueueAlert = document.getElementById("limit-queue-alert");

// 运行时状态：保存当前权限、选中模块、已加载数据、轮询定时器和当前选中记录。
let currentPermissions = [];
let currentModuleId = "question-bank";
let questItems = [];
let activeQuestId = "";
let isCreatingQuest = false;
let queuePollTimer = null;
let analyticsCharts = [];
let userItems = [];
let activeUsername = "";
let moderationItems = [];
let activeModerationId = "";

function getStoredToken() {
	return sessionStorage.getItem(TOKEN_KEY) || "";
}

function storeToken(token) {
	sessionStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
	sessionStorage.removeItem(TOKEN_KEY);
}

// 同步语言按钮选中态，让登录页和后台页的语言按钮显示一致。
function updateLanguageButtons() {
	languageButtons.en.forEach((button) => {
		button.classList.toggle("is-active", currentLanguage === "en");
	});
	languageButtons.zh.forEach((button) => {
		button.classList.toggle("is-active", currentLanguage === "zh");
	});
}

// 切换界面语言：更新本地存储、静态文案、模块标题以及各模块动态提示。
function setLanguage(language) {
	currentLanguage = language === "zh" ? "zh" : "en";
	localStorage.setItem(APP_LANGUAGE_KEY, currentLanguage);
	applyStaticTranslations();
	updateLanguageButtons();
	if (currentPermissions.length > 0) {
		setActiveModule(currentModuleId);
	}
}

// 统一接口请求封装：自动拼接 API 地址、携带 Bearer token，并处理未授权跳转登录。
async function apiRequest(path, options = {}) {
	const token = getStoredToken();
	const headers = {
		"Content-Type": "application/json",
		...(options.headers || {})
	};

	if (token) {
		// 后台所有受保护接口都通过 Bearer token 识别当前管理员
		headers.Authorization = `Bearer ${token}`;
	}

	const response = await fetch(`${API_ORIGIN}${path}`, {
		...options,
		headers
	});

	let data = null;
	try {
		// 后端约定返回 JSON；解析失败时保留 null，交给调用方显示兜底错误
		data = await response.json();
	} catch (_error) {
		data = null;
	}

	return { response, data };
}

// 根据模块 id 只显示对应工作区，其余模块面板保持隐藏。
function showWorkspace(moduleId) {
	questionBankWorkspace.classList.toggle("is-hidden", moduleId !== "question-bank");
	judgeSystemWorkspace.classList.toggle("is-hidden", moduleId !== "judge-system");
	analyticsWorkspace.classList.toggle("is-hidden", moduleId !== "learning-analytics");
	userManagementWorkspace.classList.toggle("is-hidden", moduleId !== "user-management");
	communityModerationWorkspace.classList.toggle("is-hidden", moduleId !== "community-moderation");
}

// 创建标签 DOM，用于难度、分类、权限、审核状态等短文本标记。
function renderTag(text, variant = "") {
	const tag = document.createElement("span");
	tag.className = `quest-tag${variant ? ` ${variant}` : ""}`;
	tag.textContent = text;
	return tag;
}

// 把对象或数组格式化为缩进 JSON，便于测试用例和配置在 textarea 中编辑。
function formatJson(value) {
	return JSON.stringify(value, null, 2);
}

// 把命令数组转换成多行文本，让编译/运行命令可以按行编辑。
function formatCommandLines(command) {
	return Array.isArray(command) ? command.join("\n") : "";
}

// 把多行命令文本还原为数组，保存评测配置时提交给后端。
function parseCommandLines(value) {
	return String(value || "")
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

// 构造新题目的默认数据结构，保证编辑表单保存时字段完整。
function defaultQuestRecord() {
	return {
		id: "",
		title: "",
		difficulty: "Easy",
		difficultyClass: "easy",
		category: "",
		acceptance: "",
		description: "",
		example: "",
		constraints: "",
		kind: "two_sum",
		starterCodes: {
			python: "",
			java: ""
		},
		referenceSolutions: {
			python: "",
			java: ""
		},
		visibleTests: [],
		hiddenTests: [],
		bestApproach: "",
		referenceTitle: "Local Editorial Reference",
		referenceNote: ""
	};
}

// 渲染可见/隐藏测试用例列表；无数据时显示空态提示。
function renderTests(container, tests, emptyMessage) {
	container.innerHTML = "";

	if (!Array.isArray(tests) || tests.length === 0) {
		const empty = document.createElement("p");
		empty.className = "test-empty";
		empty.textContent = emptyMessage;
		container.appendChild(empty);
		return;
	}

	tests.forEach((testCase) => {
		const card = document.createElement("article");
		card.className = "test-card";

		const name = document.createElement("h6");
		name.className = "test-name";
		name.textContent = testCase.name || (currentLanguage === "zh" ? "未命名测试" : "unnamed-test");

		const input = document.createElement("pre");
		input.className = "test-code";
		input.textContent = `${currentLanguage === "zh" ? "输入" : "Input"}\n${formatJson(testCase.input)}`;

		const expected = document.createElement("pre");
		expected.className = "test-code";
		expected.textContent = `${currentLanguage === "zh" ? "期望" : "Expected"}\n${formatJson(testCase.expected)}`;

		card.appendChild(name);
		card.appendChild(input);
		card.appendChild(expected);
		container.appendChild(card);
	});
}

// 标准化题目分类，缺失分类时归入 Uncategorized，便于目录分组。
function normalizeQuestCategory(category) {
	const value = String(category || "").trim();
	if (!value) {
		return "Uncategorized";
	}

	const matchedCategory = QUEST_DIRECTORY_CATEGORY_ORDER.find(
		(item) => item.toLowerCase() === value.toLowerCase()
	);

	return matchedCategory || value;
}

// 创建题目目录项，并绑定点击事件以切换当前查看/编辑的题目。
function buildQuestDirectoryItem(quest) {
	const button = document.createElement("button");
	button.type = "button";
	button.className = "quest-directory-item";
	if (quest.id === activeQuestId && !isCreatingQuest) {
		button.classList.add("is-active");
	}

	button.addEventListener("click", () => {
		activeQuestId = quest.id;
		isCreatingQuest = false;
		renderQuestDirectory();
		renderQuestDetail(quest);
		applyQuestForm(quest);
		questFormStatus.textContent = t("dynamic.questLoadedIntoEditor");
	});

	const title = document.createElement("strong");
	title.className = "directory-title";
	title.textContent = quest.title;

	const meta = document.createElement("span");
	meta.className = "directory-meta";
	meta.textContent = `${quest.difficulty} · ${normalizeQuestCategory(quest.category)}`;

	const sub = document.createElement("span");
	sub.className = "directory-sub";
	sub.textContent = quest.id;

	button.appendChild(title);
	button.appendChild(meta);
	button.appendChild(sub);
	return button;
}

// 按分类和预设顺序渲染题目目录，同时维护题目总数和空态。
function renderQuestDirectory() {
	questDirectory.innerHTML = "";

	if (questItems.length === 0) {
		questDirectory.innerHTML = `<p class="directory-empty">${t("dynamic.noBackendQuestRecords")}</p>`;
		questTotal.textContent = currentLanguage === "zh" ? `0${t("dynamic.questsLoadedSuffix")}` : `0 ${t("dynamic.questsLoadedSuffix")}`;
		return;
	}

	questTotal.textContent = currentLanguage === "zh" ? `${questItems.length}${t("dynamic.questsLoadedSuffix")}` : `${questItems.length} ${t("dynamic.questsLoadedSuffix")}`;

	const groupedQuests = new Map();
	questItems.forEach((quest) => {
		const category = normalizeQuestCategory(quest.category);
		if (!groupedQuests.has(category)) {
			groupedQuests.set(category, []);
		}
		groupedQuests.get(category).push(quest);
	});

	const orderedCategories = [
		...QUEST_DIRECTORY_CATEGORY_ORDER.filter((category) => groupedQuests.has(category)),
		...Array.from(groupedQuests.keys())
			.filter((category) => !QUEST_DIRECTORY_CATEGORY_ORDER.includes(category))
			.sort((left, right) => left.localeCompare(right))
	];

	orderedCategories.forEach((category) => {
		const group = document.createElement("section");
		group.className = "directory-group";

		const heading = document.createElement("h5");
		heading.className = "directory-group-title";
		heading.textContent = category;

		const list = document.createElement("div");
		list.className = "directory-group-list";

		groupedQuests.get(category).forEach((quest) => {
			list.appendChild(buildQuestDirectoryItem(quest));
		});

		group.appendChild(heading);
		group.appendChild(list);
		questDirectory.appendChild(group);
	});
}

// 将选中题目的题面、标签、测试、参考代码等内容写入详情区域。
function renderQuestDetail(quest) {
	if (!quest) {
		questEmpty.classList.remove("is-hidden");
		questDetail.classList.add("is-hidden");
		questSelectedState.textContent = t("dynamic.selectQuest");
		questEditorMode.textContent = t("dynamic.createOrSelectQuest");
		return;
	}

	questEmpty.classList.add("is-hidden");
	questDetail.classList.remove("is-hidden");
	questSelectedState.textContent = isCreatingQuest
		? t("dynamic.creatingBackendQuest")
		: `${t("dynamic.viewingBackendRecord")} ${quest.title}.`;
	questEditorMode.textContent = isCreatingQuest ? t("dynamic.createMode") : t("dynamic.editMode");

	detailTitle.textContent = quest.title || t("dynamic.newQuest");
	detailId.textContent = `${t("dynamic.questId")} ${quest.id || t("dynamic.notAssigned")}`;
	detailDescription.textContent = quest.description || "";
	detailExample.textContent = quest.example || "";
	detailConstraints.textContent = quest.constraints || "";
	detailBestApproach.textContent = quest.bestApproach || "";
	detailReferenceTitle.textContent = quest.referenceTitle || "";
	detailReferenceNote.textContent = quest.referenceNote || "";
	detailReferencePython.textContent = quest.referenceSolutions?.python || "";
	detailReferenceJava.textContent = quest.referenceSolutions?.java || "";

	detailTags.innerHTML = "";
	detailTags.appendChild(renderTag(quest.difficulty || "Unknown", "quest-tag-difficulty"));
	detailTags.appendChild(renderTag(quest.category || t("dynamic.uncategorized")));
	detailTags.appendChild(renderTag(quest.acceptance || t("dynamic.noAcceptance")));

	detailLabels.innerHTML = "";
	detailLabels.appendChild(renderTag(`difficultyClass: ${quest.difficultyClass || ""}`));
	detailLabels.appendChild(renderTag(`kind: ${quest.kind || ""}`));
	detailLabels.appendChild(renderTag(`visibleTests: ${Array.isArray(quest.visibleTests) ? quest.visibleTests.length : 0}`));
	detailLabels.appendChild(renderTag(`hiddenTests: ${Array.isArray(quest.hiddenTests) ? quest.hiddenTests.length : 0}`));

	renderTests(detailVisibleTests, quest.visibleTests, t("dynamic.noVisibleTests"));
	renderTests(detailHiddenTests, quest.hiddenTests, t("dynamic.noHiddenTests"));
}

// 把题目记录填入编辑表单；进入编辑模式时同步按钮和状态提示。
function applyQuestForm(quest) {
	const source = quest || defaultQuestRecord();
	questFormId.value = source.id || "";
	questFormTitle.value = source.title || "";
	questFormDifficulty.value = source.difficulty || "";
	questFormDifficultyClass.value = source.difficultyClass || "";
	questFormCategory.value = source.category || "";
	questFormAcceptance.value = source.acceptance || "";
	questFormKind.value = source.kind || "";
	questFormReferenceTitle.value = source.referenceTitle || "";
	questFormDescription.value = source.description || "";
	questFormExample.value = source.example || "";
	questFormConstraints.value = source.constraints || "";
	questFormBestApproach.value = source.bestApproach || "";
	questFormReferenceNote.value = source.referenceNote || "";
	questFormStarterPython.value = source.starterCodes?.python || "";
	questFormStarterJava.value = source.starterCodes?.java || "";
	questFormReferencePython.value = source.referenceSolutions?.python || "";
	questFormReferenceJava.value = source.referenceSolutions?.java || "";
	questFormVisibleTests.value = formatJson(Array.isArray(source.visibleTests) ? source.visibleTests : []);
	questFormHiddenTests.value = formatJson(Array.isArray(source.hiddenTests) ? source.hiddenTests : []);
	questSaveButton.textContent = isCreatingQuest ? t("dynamic.createQuest") : t("dynamic.saveQuest");
	questDeleteButton.disabled = isCreatingQuest || (source.id || "").length === 0;
	questDeleteButton.textContent = t("quest.deleteQuest");
}

// 校验 textarea 中的 JSON 数组文本，解析失败时抛出带字段名的错误。
function parseJsonArray(text, label) {
	try {
		const parsed = JSON.parse(String(text || "[]"));
		if (!Array.isArray(parsed)) {
			return {
				ok: false,
				message: `${label} ${t("dynamic.jsonArrayRequired")}`
			};
		}
		return { ok: true, value: parsed };
	} catch (error) {
		return {
			ok: false,
			message: `${label} ${t("dynamic.invalidJson")}`
		};
	}
}

// 从题目表单收集并清洗输入，组装为后端保存接口需要的题目对象。
function collectQuestForm() {
	const visibleTests = parseJsonArray(questFormVisibleTests.value, t("quest.visibleTestsJson"));
	if (!visibleTests.ok) {
		return visibleTests;
	}

	const hiddenTests = parseJsonArray(questFormHiddenTests.value, t("quest.hiddenTestsJson"));
	if (!hiddenTests.ok) {
		return hiddenTests;
	}

	return {
		ok: true,
		value: {
			id: questFormId.value.trim(),
			title: questFormTitle.value.trim(),
			difficulty: questFormDifficulty.value.trim(),
			difficultyClass: questFormDifficultyClass.value.trim(),
			category: questFormCategory.value.trim(),
			acceptance: questFormAcceptance.value.trim(),
			description: questFormDescription.value,
			example: questFormExample.value,
			constraints: questFormConstraints.value,
			kind: questFormKind.value.trim(),
			starterCodes: {
				python: questFormStarterPython.value,
				java: questFormStarterJava.value
			},
			referenceSolutions: {
				python: questFormReferencePython.value,
				java: questFormReferenceJava.value
			},
			visibleTests: visibleTests.value,
			hiddenTests: hiddenTests.value,
			bestApproach: questFormBestApproach.value,
			referenceTitle: questFormReferenceTitle.value.trim(),
			referenceNote: questFormReferenceNote.value
		}
	};
}

// 进入新建题目模式：清空当前选中项并填入默认题目模板。
function beginNewQuest() {
	isCreatingQuest = true;
	activeQuestId = "";
	const draft = defaultQuestRecord();
	renderQuestDirectory();
	renderQuestDetail(draft);
	applyQuestForm(draft);
	questFormStatus.textContent = t("dynamic.creatingNewQuest");
}

// 从后端加载题库列表，成功后刷新目录并选中第一条题目。
async function loadQuestionBank() {
	if (!currentPermissions.includes("question-bank")) {
		// 前端权限拦截只控制体验；真正权限仍由后端 requireRole 校验
		return;
	}

	questDirectory.innerHTML = `<p class="directory-empty">${t("dynamic.loadingQuestionBank")}</p>`;
	questTotal.textContent = t("dynamic.loadingQuests");

	try {
		const { response, data } = await apiRequest("/api/judge/quests", { method: "GET" });

		if (!response.ok || !Array.isArray(data?.items)) {
			questDirectory.innerHTML = `<p class="directory-empty">${t("dynamic.unableLoadQuestionBank")}</p>`;
			questTotal.textContent = data?.message || t("dynamic.questionBankRequestFailed");
			return;
		}

		questItems = data.items.sort((left, right) => left.title.localeCompare(right.title));
		if (!isCreatingQuest) {
			// 普通浏览模式下自动选中第一道题，避免详情区空白
			activeQuestId = questItems[0]?.id || "";
			renderQuestDirectory();
			const selected = questItems.find((quest) => quest.id === activeQuestId) || questItems[0] || null;
			renderQuestDetail(selected);
			applyQuestForm(selected || defaultQuestRecord());
		} else {
			renderQuestDirectory();
		}
	} catch (_error) {
		questDirectory.innerHTML = `<p class="directory-empty">${t("dynamic.unreachableApi")}</p>`;
		questTotal.textContent = t("dynamic.questionBankRequestFailed");
	}
}

// 保存题目：根据当前是否新建选择创建或更新接口，并刷新本地目录。
async function saveQuest() {
	const payload = collectQuestForm();
	if (!payload.ok) {
		// JSON 测试用例解析失败或字段缺失时不向后端提交
		questFormStatus.textContent = payload.message;
		return;
	}

	if (!payload.value.id) {
		questFormStatus.textContent = t("dynamic.questIdRequired");
		return;
	}

	questFormStatus.textContent = isCreatingQuest ? t("dynamic.creatingQuest") : t("dynamic.savingQuest");

	try {
		const endpoint = isCreatingQuest
			? "/api/judge/admin/quests"
			: `/api/judge/admin/quests/${encodeURIComponent(payload.value.id)}`;
		// 新建用 POST，编辑已有题目用 PUT
		const method = isCreatingQuest ? "POST" : "PUT";
		const { response, data } = await apiRequest(endpoint, {
			method,
			body: JSON.stringify(payload.value)
		});

		if (!response.ok || !data?.quest) {
			questFormStatus.textContent = data?.message || t("dynamic.questSaveFailed");
			return;
		}

		isCreatingQuest = false;
		activeQuestId = data.quest.id;
		await loadQuestionBank();
		renderQuestDirectory();
		renderQuestDetail(data.quest);
		applyQuestForm(data.quest);
		questFormStatus.textContent = t("dynamic.questSaved");
	} catch (_error) {
		questFormStatus.textContent = t("dynamic.unreachableApi");
	}
}

// 删除当前选中的已保存题目，删除前弹出确认，成功后重新加载题库。
async function deleteQuest() {
	if (isCreatingQuest) {
		// 新建草稿还没有后端记录，不需要调用删除接口
		questFormStatus.textContent = t("dynamic.discardDraft");
		return;
	}

	const questId = questFormId.value.trim();
	if (!questId) {
		questFormStatus.textContent = t("dynamic.selectSavedQuest");
		return;
	}

	const confirmed = window.confirm(`${t("dynamic.deleteQuestConfirm")} "${questId}"${t("dynamic.deleteQuestConfirmSuffix")}`);
	if (!confirmed) {
		return;
	}

	questFormStatus.textContent = t("dynamic.deletingQuest");

	try {
		const { response, data } = await apiRequest(`/api/judge/admin/quests/${encodeURIComponent(questId)}`, {
			method: "DELETE"
		});

		if (!response.ok || !data?.deleted) {
			questFormStatus.textContent = data?.message || t("dynamic.questDeleteFailed");
			return;
		}

		activeQuestId = "";
		isCreatingQuest = false;
		await loadQuestionBank();
		const nextQuest = questItems[0] || null;
		renderQuestDirectory();
		renderQuestDetail(nextQuest);
		applyQuestForm(nextQuest || defaultQuestRecord());
		questFormStatus.textContent = t("dynamic.questDeleted");
	} catch (_error) {
		questFormStatus.textContent = t("dynamic.unreachableApi");
	}
}

// 创建指标卡片 DOM，供学习统计、队列状态、用户统计和审核统计复用。
function renderMetricCard(label, value, tone = "") {
	const card = document.createElement("article");
	card.className = `metric-card${tone ? ` ${tone}` : ""}`;

	const title = document.createElement("p");
	title.className = "metric-label";
	title.textContent = label;

	const number = document.createElement("strong");
	number.className = "metric-value";
	number.textContent = String(value);

	card.appendChild(title);
	card.appendChild(number);
	return card;
}

// 释放已创建的 ECharts 实例，避免重复渲染时产生内存和事件残留。
function disposeAnalyticsCharts() {
	analyticsCharts.forEach((chart) => {
		if (chart && typeof chart.dispose === "function") {
			chart.dispose();
		}
	});
	analyticsCharts = [];
}

// 确保指定容器拥有 ECharts 实例；库未加载时返回 null 并显示失败提示。
function ensureChart(element) {
	if (!element || typeof window.echarts === "undefined") {
		return null;
	}
	const chart = window.echarts.getInstanceByDom(element) || window.echarts.init(element);
	analyticsCharts.push(chart);
	return chart;
}

// 渲染折线图，用于 DAU、提交量、通过率等时间序列指标。
function renderAnalyticsLineChart(element, title, series, color, valueSuffix = "") {
	const chart = ensureChart(element);
	if (!chart) {
		return;
	}

	chart.setOption({
		tooltip: {
			trigger: "axis",
			valueFormatter: (value) => `${value}${valueSuffix}`
		},
		xAxis: {
			type: "category",
			data: series.map((item) => item.date)
		},
		yAxis: {
			type: "value"
		},
		series: [
			{
				name: title,
				type: "line",
				smooth: true,
				data: series.map((item) => item.value),
				lineStyle: { color },
				itemStyle: { color },
				areaStyle: { color: `${color}22` }
			}
		],
		grid: {
			left: 40,
			right: 16,
			top: 20,
			bottom: 30
		}
	});
}

// 渲染柱状图，用于展示各学习模块的错题分布。
function renderAnalyticsBarChart(element, items) {
	const chart = ensureChart(element);
	if (!chart) {
		return;
	}

	chart.setOption({
		tooltip: {
			trigger: "axis"
		},
		xAxis: {
			type: "category",
			data: items.map((item) => item.pathTitle),
			axisLabel: {
				interval: 0,
				rotate: 18
			}
		},
		yAxis: {
			type: "value"
		},
		series: [
			{
				type: "bar",
				data: items.map((item) => item.wrongCount),
				itemStyle: {
					color: "#c74b28"
				}
			}
		],
		grid: {
			left: 40,
			right: 16,
			top: 20,
			bottom: 80
		}
	});
}

// 渲染学习统计顶部汇总指标，包括 DAU、提交量、通过率和错题数。
function renderAnalyticsSummary(data) {
	analyticsSummaryMetrics.innerHTML = "";
	const dauLatest = data.dau.length > 0 ? data.dau[data.dau.length - 1].value : 0;
	const totalSubmissions = data.submissionVolume.reduce((sum, item) => sum + Number(item.value || 0), 0);
	const latestPassRate = data.passRate.length > 0 ? data.passRate[data.passRate.length - 1].value : 0;
	const totalWrongAnswers = data.wrongAnswerDistribution.reduce((sum, item) => sum + Number(item.wrongCount || 0), 0);

	analyticsSummaryMetrics.appendChild(renderMetricCard(t("dynamic.latestDau"), dauLatest));
	analyticsSummaryMetrics.appendChild(renderMetricCard(t("dynamic.submissions"), totalSubmissions));
	analyticsSummaryMetrics.appendChild(renderMetricCard(t("dynamic.latestPassRate"), `${latestPassRate}%`));
	analyticsSummaryMetrics.appendChild(renderMetricCard(t("dynamic.wrongAnswers"), totalWrongAnswers));
}

// 根据后端统计数据刷新所有图表和汇总卡片。
function renderAnalyticsDashboard(data) {
	analyticsSummaryMetrics.innerHTML = "";
	// 每次刷新前销毁旧图表，避免 ECharts 实例叠加
	disposeAnalyticsCharts();

	if (typeof window.echarts === "undefined") {
		analyticsStatusCopy.textContent = t("dynamic.echartsFailed");
		return;
	}

	renderAnalyticsSummary(data);
	renderAnalyticsLineChart(chartDauElement, "DAU", data.dau || [], "#27414a");
	renderAnalyticsLineChart(chartSubmissionVolumeElement, t("analytics.submissionVolume"), data.submissionVolume || [], "#b65436");
	renderAnalyticsLineChart(chartPassRateElement, t("analytics.passRate"), data.passRate || [], "#d89f45", "%");
	renderAnalyticsBarChart(chartWrongAnswerDistributionElement, data.wrongAnswerDistribution || []);
}

// 渲染评测队列快照，展示任务数量、并发配置和最近任务状态。
function renderQueueSnapshot(snapshot) {
	queueMetrics.innerHTML = "";
	queueJobs.innerHTML = "";

	// 排队数达到阈值时用告警样式提示管理员关注评测积压
	const queueTone = snapshot.queuedCount >= snapshot.queueAlertThreshold ? "metric-alert" : "";
	queueMetrics.appendChild(renderMetricCard(t("dynamic.activeJobs"), snapshot.activeCount));
	queueMetrics.appendChild(renderMetricCard(t("dynamic.queuedJobs"), snapshot.queuedCount, queueTone));
	queueMetrics.appendChild(renderMetricCard(t("dynamic.completed"), snapshot.completedCount));
	queueMetrics.appendChild(renderMetricCard(t("dynamic.failed"), snapshot.failedCount));
	queueMetrics.appendChild(renderMetricCard(t("dynamic.submitted"), snapshot.totalSubmitted));
	queueMetrics.appendChild(renderMetricCard(t("dynamic.concurrency"), snapshot.maxConcurrentJobs));

	queueStatusCopy.textContent = `${t("dynamic.queueThreshold")} ${snapshot.queueAlertThreshold}. ${t("dynamic.active")} ${snapshot.activeCount}, ${t("dynamic.queued")} ${snapshot.queuedCount}.`;

	if (!Array.isArray(snapshot.recentJobs) || snapshot.recentJobs.length === 0) {
		queueJobs.innerHTML = `<p class="directory-empty">${t("dynamic.noJudgeJobs")}</p>`;
		return;
	}

	snapshot.recentJobs.forEach((job) => {
		const card = document.createElement("article");
		card.className = "queue-job-card";

		const row = document.createElement("div");
		row.className = "queue-job-head";

		const title = document.createElement("strong");
		title.textContent = `${job.questId} · ${job.language} · ${job.mode}`;

		const status = document.createElement("span");
		status.className = `queue-status queue-status-${job.status}`;
		status.textContent = currentLanguage === "zh"
			? ({ queued: "排队", running: "运行中", completed: "已完成", failed: "失败" }[job.status] || job.status)
			: job.status;

		row.appendChild(title);
		row.appendChild(status);

		const meta = document.createElement("p");
		meta.className = "queue-job-meta";
		meta.textContent = `${t("dynamic.job")} ${job.id} · ${t("dynamic.queuedAt")} ${job.queuedAt}`;

		const summary = document.createElement("p");
		summary.className = "queue-job-summary";
		summary.textContent = `${job.summary || t("dynamic.noSummary")}${job.durationMs != null ? ` · ${job.durationMs} ms` : ""}`;

		card.appendChild(row);
		card.appendChild(meta);
		card.appendChild(summary);
		queueJobs.appendChild(card);
	});
}

// 将后端评测配置填入表单，包括语言开关、镜像、命令和资源限制。
function applyJudgeConfig(config) {
	const python = config.languages?.python || {};
	const java = config.languages?.java || {};
	const limits = config.resourceLimits || {};

	// 语言配置决定判题容器镜像、源码文件名、编译命令和运行命令
	langPythonEnabled.checked = Boolean(python.enabled);
	langPythonLabel.value = python.label || "";
	langPythonImage.value = python.dockerImage || "";
	langPythonSource.value = python.sourceFileName || "";
	langPythonEntry.value = python.entryPoint || "";
	langPythonNotes.value = python.notes || "";
	langPythonCompile.value = formatCommandLines(python.compileCommand);
	langPythonRun.value = formatCommandLines(python.runCommand);

	langJavaEnabled.checked = Boolean(java.enabled);
	langJavaLabel.value = java.label || "";
	langJavaImage.value = java.dockerImage || "";
	langJavaSource.value = java.sourceFileName || "";
	langJavaEntry.value = java.entryPoint || "";
	langJavaNotes.value = java.notes || "";
	langJavaCompile.value = formatCommandLines(java.compileCommand);
	langJavaRun.value = formatCommandLines(java.runCommand);

	limitCompileTimeout.value = String(limits.compileTimeoutMs ?? "");
	limitRunTimeout.value = String(limits.runTimeoutMs ?? "");
	limitMaxBuffer.value = String(limits.maxOutputBufferKb ?? "");
	limitMemory.value = limits.memoryLimitKb == null ? "" : String(limits.memoryLimitKb);
	limitMaxConcurrent.value = String(limits.maxConcurrentJobs ?? "");
	limitHistorySize.value = String(limits.historySize ?? "");
	limitQueueAlert.value = String(limits.queueAlertThreshold ?? "");

	judgeConfigUpdated.textContent = `${t("dynamic.configurationUpdatedAt")} ${config.updatedAt || t("dynamic.unknownTime")}.`;
	judgeConfigStatus.textContent = t("dynamic.judgeConfigLoaded");
}

// 拉取当前评测配置，加载成功后允许管理员在表单中编辑。
async function loadJudgeConfig() {
	judgeConfigStatus.textContent = t("dynamic.loadingJudgeConfig");

	try {
		const { response, data } = await apiRequest("/api/judge/admin/config", { method: "GET" });
		if (!response.ok || !data?.languages || !data?.resourceLimits) {
			judgeConfigStatus.textContent = data?.message || t("dynamic.unableLoadJudgeConfig");
			return;
		}

		applyJudgeConfig(data);
	} catch (_error) {
		judgeConfigStatus.textContent = t("dynamic.unreachableApi");
	}
}

// 拉取实时评测队列指标，用于手动刷新和定时轮询。
async function loadJudgeQueue() {
	queueStatusCopy.textContent = t("dynamic.loadingQueueMetrics");

	try {
		const { response, data } = await apiRequest("/api/judge/admin/queue", { method: "GET" });
		if (!response.ok || !data) {
			queueStatusCopy.textContent = data?.message || t("dynamic.unableLoadQueueMetrics");
			queueJobs.innerHTML = `<p class="directory-empty">${t("dynamic.queueRequestFailed")}</p>`;
			return;
		}

		renderQueueSnapshot(data);
	} catch (_error) {
		queueStatusCopy.textContent = t("dynamic.unreachableApi");
		queueJobs.innerHTML = `<p class="directory-empty">${t("dynamic.queueRequestFailed")}</p>`;
	}
}

// 按选择的天数窗口加载学习统计数据并刷新仪表盘。
async function loadAnalyticsDashboard() {
	analyticsStatusCopy.textContent = t("dynamic.loadingAnalytics");

	try {
		const days = encodeURIComponent(String(analyticsDaysSelect.value || "14"));
		const { response, data } = await apiRequest(`/api/analytics/dashboard?days=${days}`, { method: "GET" });
		if (!response.ok || !data) {
			analyticsStatusCopy.textContent = data?.message || t("dynamic.unableLoadAnalytics");
			return;
		}

		renderAnalyticsDashboard(data);
		analyticsStatusCopy.textContent = currentLanguage === "zh"
			? `${t("dynamic.loadedAnalyticsWindow")}${data.windowDays || analyticsDaysSelect.value}${t("dynamic.dayAnalyticsWindow")}`
			: `${t("dynamic.loadedAnalyticsWindow")} ${data.windowDays || analyticsDaysSelect.value}${t("dynamic.dayAnalyticsWindow")}`;
	} catch (_error) {
	analyticsStatusCopy.textContent = t("dynamic.unreachableApi");
	}
}

// 启动评测队列轮询，进入评测模块时持续刷新队列状态。
function startJudgeQueuePolling() {
	stopJudgeQueuePolling();
	void loadJudgeQueue();
	queuePollTimer = window.setInterval(() => {
		if (currentModuleId === "judge-system") {
			void loadJudgeQueue();
		}
	}, QUEUE_POLL_INTERVAL_MS);
}

// 停止评测队列轮询，离开评测模块时避免无意义请求。
function stopJudgeQueuePolling() {
	if (queuePollTimer != null) {
		window.clearInterval(queuePollTimer);
		queuePollTimer = null;
	}
}

// 从评测配置表单读取输入，并转换为后端配置对象。
function collectJudgeConfigForm() {
	return {
		languages: {
			python: {
				enabled: langPythonEnabled.checked,
				label: langPythonLabel.value.trim(),
				dockerImage: langPythonImage.value.trim(),
				sourceFileName: langPythonSource.value.trim(),
				entryPoint: langPythonEntry.value.trim(),
				compileCommand: parseCommandLines(langPythonCompile.value),
				runCommand: parseCommandLines(langPythonRun.value),
				notes: langPythonNotes.value.trim()
			},
			java: {
				enabled: langJavaEnabled.checked,
				label: langJavaLabel.value.trim(),
				dockerImage: langJavaImage.value.trim(),
				sourceFileName: langJavaSource.value.trim(),
				entryPoint: langJavaEntry.value.trim(),
				compileCommand: parseCommandLines(langJavaCompile.value),
				runCommand: parseCommandLines(langJavaRun.value),
				notes: langJavaNotes.value.trim()
			}
		},
		resourceLimits: {
			// 后端会再次清洗这些数字，前端这里只做表单值到 JSON 的转换
			compileTimeoutMs: Number(limitCompileTimeout.value),
			runTimeoutMs: Number(limitRunTimeout.value),
			maxOutputBufferKb: Number(limitMaxBuffer.value),
			memoryLimitKb: limitMemory.value.trim().length > 0 ? Number(limitMemory.value) : null,
			maxConcurrentJobs: Number(limitMaxConcurrent.value),
			historySize: Number(limitHistorySize.value),
			queueAlertThreshold: Number(limitQueueAlert.value)
		}
	};
}

// 提交评测配置更新，成功后用后端返回值回填表单。
async function saveJudgeConfig() {
	judgeConfigStatus.textContent = t("dynamic.savingJudgeConfig");

	try {
		// 保存后端判题配置会影响之后进入队列的判题任务
		const payload = collectJudgeConfigForm();
		const { response, data } = await apiRequest("/api/judge/admin/config", {
			method: "POST",
			body: JSON.stringify(payload)
		});

		if (!response.ok || !data?.config) {
			judgeConfigStatus.textContent = data?.message || t("dynamic.unableSaveJudgeConfig");
			return;
		}

		applyJudgeConfig(data.config);
		judgeConfigStatus.textContent = t("dynamic.judgeConfigSaved");
		void loadJudgeQueue();
	} catch (_error) {
		judgeConfigStatus.textContent = t("dynamic.unreachableApi");
	}
}

// 渲染用户目录，点击用户后显示账号详情和可编辑角色。
function renderUserDirectory() {
	userDirectory.innerHTML = "";

	if (userItems.length === 0) {
		userDirectory.innerHTML = `<p class="directory-empty">${t("dynamic.noUsersReturned")}</p>`;
		return;
	}

	userItems.forEach((user) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "quest-directory-item";
		if (user.username === activeUsername) {
			button.classList.add("is-active");
		}

		button.addEventListener("click", () => {
			activeUsername = user.username;
			renderUserDirectory();
			renderUserDetail(user);
		});

		const title = document.createElement("strong");
		title.className = "directory-title";
		title.textContent = user.username;

		const meta = document.createElement("span");
		meta.className = "directory-meta";
		meta.textContent = `${t("common.rolePrefix")} ${getRoleLabel(user.role)}`;

		const sub = document.createElement("span");
		sub.className = "directory-sub";
		sub.textContent = currentLanguage === "zh"
			? `${Array.isArray(user.permissions) ? user.permissions.length : 0}${t("dynamic.permissions")}`
			: `${Array.isArray(user.permissions) ? user.permissions.length : 0} ${t("dynamic.permissions")}`;

		button.appendChild(title);
		button.appendChild(meta);
		button.appendChild(sub);
		userDirectory.appendChild(button);
	});
}

// 渲染用户统计卡片，包括总用户、管理员、管理角色、普通用户和专家用户。
function renderUserSummary() {
	userSummaryMetrics.innerHTML = "";
	const adminCount = userItems.filter((user) => user.role === "admin").length;
	const managerCount = userItems.filter((user) => user.role !== "admin" && user.role !== "user").length;
	const standardCount = userItems.filter((user) => user.role === "user").length;
	const expertCount = userItems.filter((user) => user.userType === "expert").length;

	userSummaryMetrics.appendChild(renderMetricCard(t("dynamic.totalUsers"), userItems.length));
	userSummaryMetrics.appendChild(renderMetricCard(t("dynamic.admins"), adminCount));
	userSummaryMetrics.appendChild(renderMetricCard(t("dynamic.managers"), managerCount));
	userSummaryMetrics.appendChild(renderMetricCard(t("dynamic.standardUsers"), standardCount));
	userSummaryMetrics.appendChild(renderMetricCard(t("dynamic.experts"), expertCount));
}

// 展示选中用户的创建时间、权限标签、角色和用户类型。
function renderUserDetail(user) {
	if (!user) {
		userEmpty.classList.remove("is-hidden");
		userDetail.classList.add("is-hidden");
		userSelectedState.textContent = t("state.selectUser");
		return;
	}

	userEmpty.classList.add("is-hidden");
	userDetail.classList.remove("is-hidden");
	userSelectedState.textContent = `${t("dynamic.reviewingAccount")} ${user.username}.`;
	userDetailName.textContent = user.username;
	userDetailCreated.textContent = `${t("dynamic.createdAt")} ${user.createdAt || t("dynamic.unknown")}`;
	userRoleSelect.value = user.role || "user";
	userTypeSelect.value = user.userType || "normal";
	userDetailPermissions.innerHTML = "";

	// 权限标签来自后端 role -> permissions 映射，用于解释该账号能访问哪些后台模块
	(user.permissions || []).forEach((permission) => {
		userDetailPermissions.appendChild(renderTag(getPermissionLabel(permission)));
	});

	userDetailPermissions.appendChild(renderTag(`${t("user.userType")}：${getUserTypeLabel(user.userType || "normal")}`));

	if (!Array.isArray(user.permissions) || user.permissions.length === 0) {
		userDetailPermissions.appendChild(renderTag(t("dynamic.noAdminModules")));
	}
}

// 从后端加载平台用户列表，刷新统计和目录。
async function loadUsers() {
	userManagementStatusCopy.textContent = t("dynamic.loadingUsers");

	try {
		const { response, data } = await apiRequest("/api/auth/users", { method: "GET" });
		if (!response.ok || !Array.isArray(data?.users)) {
			userManagementStatusCopy.textContent = data?.message || t("dynamic.unableLoadUsers");
			userDirectory.innerHTML = `<p class="directory-empty">${t("dynamic.userRequestFailed")}</p>`;
			return;
		}

		userItems = data.users.slice().sort((left, right) => left.username.localeCompare(right.username));
		renderUserSummary();

		if (!activeUsername && userItems.length > 0) {
			// 首次进入用户管理时默认选中第一个账号
			activeUsername = userItems[0].username;
		}

		const activeUser = userItems.find((user) => user.username === activeUsername) || userItems[0] || null;
		activeUsername = activeUser?.username || "";
		renderUserDirectory();
		renderUserDetail(activeUser);
		userManagementStatusCopy.textContent = currentLanguage === "zh"
			? `${userItems.length}${t("dynamic.usersLoadedSuffix")}`
			: `${userItems.length} ${t("dynamic.usersLoadedSuffix")}`;
	} catch (_error) {
		userManagementStatusCopy.textContent = t("dynamic.unreachableApi");
		userDirectory.innerHTML = `<p class="directory-empty">${t("dynamic.userRequestFailed")}</p>`;
	}
}

// 保存选中用户的角色和用户类型，并重新加载用户列表。
async function saveUserRole() {
	if (!activeUsername) {
		userRoleStatus.textContent = t("state.selectUserBeforeSaving");
		return;
	}

	userRoleStatus.textContent = t("dynamic.savingAccountSettings");

	try {
		// 角色决定后台模块权限，例如题库、判题、分析、用户和社区审核
		const roleResult = await apiRequest(`/api/auth/users/${encodeURIComponent(activeUsername)}/role`, {
			method: "PATCH",
			body: JSON.stringify({
				role: userRoleSelect.value
			})
		});

		if (!roleResult.response.ok || !roleResult.data?.user) {
			userRoleStatus.textContent = roleResult.data?.message || t("dynamic.roleUpdateFailed");
			return;
		}

		// 用户类型影响前端专家徽章展示，不等同于后台管理权限
		const typeResult = await apiRequest(`/api/auth/users/${encodeURIComponent(activeUsername)}/type`, {
			method: "PATCH",
			body: JSON.stringify({
				userType: userTypeSelect.value
			})
		});

		if (!typeResult.response.ok || !typeResult.data?.user) {
			userRoleStatus.textContent = typeResult.data?.message || t("dynamic.userTypeUpdateFailed");
			return;
		}

		userRoleStatus.textContent = t("dynamic.accountSettingsUpdated");
		await loadUsers();
	} catch (_error) {
		userRoleStatus.textContent = t("dynamic.unreachableApi");
	}
}

// 渲染社区审核队列，点击帖子后进入详情审核。
function renderModerationDirectory() {
	moderationDirectory.innerHTML = "";

	if (moderationItems.length === 0) {
		moderationDirectory.innerHTML = `<p class="directory-empty">${t("dynamic.noModerationPosts")}</p>`;
		return;
	}

	moderationItems.forEach((item) => {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "quest-directory-item";
		if (item.id === activeModerationId) {
			button.classList.add("is-active");
		}

		button.addEventListener("click", () => {
			activeModerationId = item.id;
			renderModerationDirectory();
			renderModerationDetail(item);
		});

		const title = document.createElement("strong");
		title.className = "directory-title";
		title.textContent = item.title;

		const meta = document.createElement("span");
		meta.className = "directory-meta";
		meta.textContent = getModerationStatusLabel(item.status);

		const sub = document.createElement("span");
		sub.className = "directory-sub";
		sub.textContent = `${item.author} | ${item.submittedAt}`;

		button.appendChild(title);
		button.appendChild(meta);
		button.appendChild(sub);
		moderationDirectory.appendChild(button);
	});
}

// 渲染社区帖子审核统计，包括待审核、已通过、已拒绝等数量。
function renderModerationSummary() {
	moderationSummaryMetrics.innerHTML = "";
	const pendingCount = moderationItems.filter((item) => item.status === "pending").length;
	const approvedCount = moderationItems.filter((item) => item.status === "approved").length;
	const rejectedCount = moderationItems.filter((item) => item.status === "rejected").length;

	moderationSummaryMetrics.appendChild(renderMetricCard(t("dynamic.pending"), pendingCount, pendingCount > 0 ? "metric-alert" : ""));
	moderationSummaryMetrics.appendChild(renderMetricCard(t("dynamic.approved"), approvedCount));
	moderationSummaryMetrics.appendChild(renderMetricCard(t("dynamic.rejected"), rejectedCount));
}

// 展示选中帖子的摘要、全文、状态和审核备注。
function renderModerationDetail(item) {
	if (!item) {
		moderationEmpty.classList.remove("is-hidden");
		moderationDetail.classList.add("is-hidden");
		moderationSelectedState.textContent = t("state.selectPost");
		return;
	}

	moderationEmpty.classList.add("is-hidden");
	moderationDetail.classList.remove("is-hidden");
	moderationSelectedState.textContent = `${t("dynamic.reviewingPost")} ${item.title}.`;
	moderationDetailTitle.textContent = item.title;
	moderationDetailMeta.textContent = `${item.author} | ${item.submittedAt}`;
	moderationDetailSummary.textContent = item.summary || "";
	moderationDetailContent.textContent = item.content || "";
	moderationStatusSelect.value = item.status || "pending";
	moderationNoteInput.value = item.moderationNote || "";
	moderationDetailTags.innerHTML = "";
	// 审核状态会决定用户端社区列表是否能看到该帖子
	const moderationStatusLabel = getModerationStatusLabel(item.status);
	moderationDetailTags.appendChild(renderTag(`${currentLanguage === "zh" ? "状态" : "status"}: ${moderationStatusLabel}`));
	(item.tags || []).forEach((tag) => {
		moderationDetailTags.appendChild(renderTag(`#${tag}`));
	});
}

// 从后端加载社区帖子审核队列，刷新列表和统计。
async function loadModerationQueue() {
	moderationStatusCopy.textContent = t("dynamic.loadingModerationQueue");

	try {
		const { response, data } = await apiRequest("/api/community/admin/posts", { method: "GET" });
		if (!response.ok || !Array.isArray(data?.items)) {
			moderationStatusCopy.textContent = data?.message || t("dynamic.unableLoadModeration");
			moderationDirectory.innerHTML = `<p class="directory-empty">${t("dynamic.moderationRequestFailed")}</p>`;
			return;
		}

		moderationItems = data.items;
		renderModerationSummary();

		if (!activeModerationId && moderationItems.length > 0) {
			// 首次进入审核模块时自动选中最新一条投稿
			activeModerationId = moderationItems[0].id;
		}

		const activeItem = moderationItems.find((item) => item.id === activeModerationId) || moderationItems[0] || null;
		activeModerationId = activeItem?.id || "";
		renderModerationDirectory();
		renderModerationDetail(activeItem);
		moderationStatusCopy.textContent = currentLanguage === "zh"
			? `${moderationItems.length}${t("dynamic.communityPostsLoadedSuffix")}`
			: `${moderationItems.length} ${t("dynamic.communityPostsLoadedSuffix")}`;
	} catch (_error) {
		moderationStatusCopy.textContent = t("dynamic.unreachableApi");
		moderationDirectory.innerHTML = `<p class="directory-empty">${t("dynamic.moderationRequestFailed")}</p>`;
	}
}

// 保存帖子审核状态和备注，成功后重新加载审核队列。
async function saveModerationDecision() {
	if (!activeModerationId) {
		moderationFormStatus.textContent = t("state.selectPostBeforeSaving");
		return;
	}

	moderationFormStatus.textContent = t("dynamic.savingModerationDecision");

	try {
		// approved 会让帖子进入用户端社区列表；pending/rejected 不公开展示
		const { response, data } = await apiRequest(`/api/community/admin/posts/${encodeURIComponent(activeModerationId)}/status`, {
			method: "PATCH",
			body: JSON.stringify({
				status: moderationStatusSelect.value,
				moderationNote: moderationNoteInput.value
			})
		});

		if (!response.ok || !data?.item) {
			moderationFormStatus.textContent = data?.message || t("dynamic.moderationSaveFailed");
			return;
		}

		moderationFormStatus.textContent = t("dynamic.moderationDecisionSaved");
		await loadModerationQueue();
	} catch (_error) {
		moderationFormStatus.textContent = t("dynamic.unreachableApi");
	}
}

// 切换当前后台模块：更新导航态、说明区、工作区，并触发对应数据加载。
function setActiveModule(moduleId) {
	const meta = getModuleMeta(moduleId);
	if (!meta) {
		return;
	}

	currentModuleId = moduleId;

	navItems.forEach((item) => {
		item.classList.toggle("is-active", item.dataset.module === moduleId);
	});

	pageTitle.textContent = meta.title;
	heroTitle.textContent = meta.title;
	heroCopy.textContent = meta.copy;
	statusChip.textContent = meta.status;
	showWorkspace(moduleId);
	// 离开评测模块时停止轮询，切换回来后再重新开启
	stopJudgeQueuePolling();

	if (moduleId === "question-bank") {
		void loadQuestionBank();
		return;
	}

	if (moduleId === "judge-system") {
		void loadJudgeConfig();
		startJudgeQueuePolling();
		return;
	}

	if (moduleId === "learning-analytics") {
		void loadAnalyticsDashboard();
		return;
	}

	if (moduleId === "user-management") {
		void loadUsers();
		return;
	}

	if (moduleId === "community-moderation") {
		void loadModerationQueue();
	}
}

// 根据当前用户权限启用/禁用模块导航，并自动进入第一个可访问模块。
function applyPermissions(permissions) {
	currentPermissions = permissions;

	let firstVisibleModule = null;

	navItems.forEach((item) => {
		const moduleId = item.dataset.module;
		const allowed = permissions.includes(moduleId);
		// 无权限模块直接从左侧导航隐藏
		item.classList.toggle("is-hidden", !allowed);

		if (allowed && firstVisibleModule === null) {
			firstVisibleModule = moduleId;
		}
	});

	if (firstVisibleModule) {
		accessMessage.textContent = "";
		// 进入当前账号第一个可访问模块
		setActiveModule(firstVisibleModule);
		return;
	}

	pageTitle.textContent = t("common.noAccessTitle");
	heroTitle.textContent = t("common.noAccessTitle");
	heroCopy.textContent = t("common.noAccessCopy");
	statusChip.textContent = t("common.noAccessStatus");
	accessMessage.textContent = t("common.noAccessMessage");
}

// 显示后台界面并隐藏登录页，通常在登录成功或 token 校验成功后调用。
function showAdmin() {
	loginShell.classList.add("is-hidden");
	adminShell.classList.remove("is-hidden");
}

// 显示登录页并隐藏后台界面，同时停止队列轮询和清空错误提示。
function showLogin() {
	stopJudgeQueuePolling();
	adminShell.classList.add("is-hidden");
	loginShell.classList.remove("is-hidden");
	loginForm.reset();
	loginError.textContent = "";
	roleBadge.textContent = "";
	accessMessage.textContent = "";
	// 回到登录页时清空各模块内存状态，避免下一个账号看到上一个账号的数据
	questItems = [];
	activeQuestId = "";
	isCreatingQuest = false;
	questDirectory.innerHTML = "";
	renderQuestDetail(null);
	applyQuestForm(defaultQuestRecord());
	questFormStatus.textContent = t("dynamic.createOrSelectQuest");
	queueMetrics.innerHTML = "";
	queueJobs.innerHTML = "";
	queueStatusCopy.textContent = t("state.loadQueueMetrics");
	judgeConfigUpdated.textContent = t("state.noJudgeConfig");
	judgeConfigStatus.textContent = t("state.loadJudgeConfig");
	userItems = [];
	activeUsername = "";
	userSummaryMetrics.innerHTML = "";
	userDirectory.innerHTML = "";
	userEmpty.classList.remove("is-hidden");
	userDetail.classList.add("is-hidden");
	userManagementStatusCopy.textContent = t("state.loadUsers");
	userSelectedState.textContent = t("state.selectUser");
	userRoleStatus.textContent = t("state.editUserRole");
	moderationItems = [];
	activeModerationId = "";
	moderationSummaryMetrics.innerHTML = "";
	moderationDirectory.innerHTML = "";
	moderationEmpty.classList.remove("is-hidden");
	moderationDetail.classList.add("is-hidden");
	moderationStatusCopy.textContent = t("state.loadModeration");
	moderationSelectedState.textContent = t("state.selectPost");
	moderationFormStatus.textContent = t("state.reviewPost");
}

// 渲染当前登录管理员的角色徽标和权限模块。
function renderUser(user) {
	roleBadge.textContent = `${t("common.rolePrefix")} ${getRoleLabel(user.role)}`;
	// 登录用户返回的 permissions 决定后台侧边栏和默认进入模块
	applyPermissions(Array.isArray(user.permissions) ? user.permissions : []);
}

// 使用本地 token 获取当前管理员信息；失败时清除 token 并回到登录页。
async function loadCurrentUser() {
	const { response, data } = await apiRequest("/api/auth/me", { method: "GET" });

	if (!response.ok || !data?.user) {
		clearToken();
		showLogin();
		return;
	}

	renderUser(data.user);
	showAdmin();
}

// 提交登录请求，保存返回 token，加载当前用户并进入后台。
async function signIn(username, password) {
	loginError.textContent = "";

	try {
		const { response, data } = await apiRequest("/api/auth/login", {
			method: "POST",
			body: JSON.stringify({ username, password })
		});

		if (!response.ok || !data?.token || !data?.user) {
			loginError.textContent = data?.message || t("common.loginFailed");
			return;
		}

		storeToken(data.token);
		// 登录成功后立即按当前用户权限渲染后台模块
		renderUser(data.user);
		showAdmin();
	} catch (_error) {
		loginError.textContent = t("common.unreachableLogin");
	}
}

// 调用退出接口并清除本地 token，最后回到登录页。
async function signOut() {
	try {
		await apiRequest("/api/auth/logout", { method: "POST" });
	} catch (_error) {
	}

	clearToken();
	showLogin();
}

// 事件绑定区：把导航、表单提交、刷新按钮、语言按钮和初始化加载连接到对应业务函数。
navItems.forEach((item) => {
	item.addEventListener("click", () => {
		const moduleId = item.dataset.module;
		if (!currentPermissions.includes(moduleId)) {
			return;
		}
		setActiveModule(moduleId);
	});
});

loginForm.addEventListener("submit", (event) => {
	event.preventDefault();

	const formData = new FormData(loginForm);
	const username = String(formData.get("username") || "").trim();
	const password = String(formData.get("password") || "");

	void signIn(username, password);
});

logoutButton.addEventListener("click", () => {
	void signOut();
});

languageButtons.en.forEach((button) => {
	button.addEventListener("click", () => {
		setLanguage("en");
	});
});

languageButtons.zh.forEach((button) => {
	button.addEventListener("click", () => {
		setLanguage("zh");
	});
});

refreshQueueButton.addEventListener("click", () => {
	void loadJudgeQueue();
});

refreshAnalyticsButton.addEventListener("click", () => {
	void loadAnalyticsDashboard();
});

refreshUsersButton.addEventListener("click", () => {
	void loadUsers();
});

refreshModerationButton.addEventListener("click", () => {
	void loadModerationQueue();
});

judgeConfigForm.addEventListener("submit", (event) => {
	event.preventDefault();
	void saveJudgeConfig();
});

newQuestButton.addEventListener("click", () => {
	beginNewQuest();
});

questForm.addEventListener("submit", (event) => {
	event.preventDefault();
	void saveQuest();
});

questDeleteButton.addEventListener("click", () => {
	void deleteQuest();
});

userRoleForm.addEventListener("submit", (event) => {
	event.preventDefault();
	void saveUserRole();
});

moderationForm.addEventListener("submit", (event) => {
	event.preventDefault();
	void saveModerationDecision();
});

applyStaticTranslations();
updateLanguageButtons();

if (getStoredToken()) {
	void loadCurrentUser();
} else {
	showLogin();
}
