# 数据结构/数据库设计
完整数据字典，包含 `4` 张 SQLite 表和 `2` 份 JSON 持久化数据。
**SQLite 表**
`1. users`  
来源: [db.ts](/f:/unishit/cl-app-backend/src/db.ts:71)

| 字段名 | 类型 | 约束/默认值 | 描述 |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | 用户主键 ID |
| `username` | `TEXT` | `NOT NULL UNIQUE COLLATE NOCASE` | 用户名，唯一，忽略大小写 |
| `password_hash` | `TEXT` | `NOT NULL` | 密码哈希 |
| `role` | `TEXT` | `NOT NULL DEFAULT 'user'` | 用户角色 |
| `user_type` | `TEXT` | `NOT NULL DEFAULT 'normal'` | 用户类型，代码中有 `normal`、`expert` |
| `created_at` | `TEXT` | `NOT NULL` | 创建时间，ISO 字符串 |

`2. analytics_activity_events`  
来源: [analyticsStore.ts](/f:/unishit/cl-app-backend/src/analyticsStore.ts:45)

| 字段名 | 类型 | 约束/默认值 | 描述 |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | 事件主键 ID |
| `username` | `TEXT` | `NOT NULL` | 用户名 |
| `event_type` | `TEXT` | `NOT NULL` | 行为事件类型 |
| `event_date` | `TEXT` | `NOT NULL` | 事件日期，`YYYY-MM-DD` |
| `created_at` | `TEXT` | `NOT NULL` | 写入时间，ISO 字符串 |

`3. analytics_submission_events`  
来源: [analyticsStore.ts](/f:/unishit/cl-app-backend/src/analyticsStore.ts:53)

| 字段名 | 类型 | 约束/默认值 | 描述 |
| `id` | `INTEGER` | `PRIMARY KEY AUTOINCREMENT` | 提交事件主键 ID |
| `username` | `TEXT` | `NOT NULL` | 用户名 |
| `quest_id` | `TEXT` | `NOT NULL` | 题目 ID |
| `status` | `TEXT` | `NOT NULL` | 提交状态，代码中有 `accepted`、`failed` |
| `event_date` | `TEXT` | `NOT NULL` | 提交日期，`YYYY-MM-DD` |
| `created_at` | `TEXT` | `NOT NULL` | 写入时间，ISO 字符串 |

`4. analytics_wrong_answer_snapshots`  
来源: [analyticsStore.ts](/f:/unishit/cl-app-backend/src/analyticsStore.ts:62)

| 字段名 | 类型 | 约束/默认值 | 描述 |
| `username` | `TEXT` | `NOT NULL` | 用户名 |
| `path_id` | `TEXT` | `NOT NULL` | 学习路径 ID |
| `path_title` | `TEXT` | `NOT NULL` | 学习路径标题 |
| `module_id` | `TEXT` | `NOT NULL` | 模块 ID |
| `module_title` | `TEXT` | `NOT NULL` | 模块标题 |
| `wrong_count` | `INTEGER` | `NOT NULL` | 错题数量 |
| `updated_at` | `TEXT` | `NOT NULL` | 更新时间，ISO 字符串 |

补充约束:
- 主键: `PRIMARY KEY (username, module_id)`

**JSON 持久化数据**
`5. quests.json`  
来源: [questStore.ts](/f:/unishit/cl-app-backend/src/questStore.ts:12)

文件作用:
- 持久化题库增删改
- 与内置 `questCatalog` 合并使用

顶层结构:
```json
{
  "quests": {
    "quest-id": {
      "...": "QuestDefinition"
    }
  },
  "deletedIds": ["quest-id-1"]
}
```

顶层字段:
| 字段名 | 类型 | 描述 |
| `quests` | `Record<string, QuestDefinition>` | 自定义/覆盖后的题目定义集合，key 为题目 ID |
| `deletedIds` | `string[]` | 被删除的题目 ID，用于屏蔽内置题目 |

`QuestDefinition`:
| 字段名 | 类型 | 描述 |
| `id` | `string` | 题目 ID |
| `title` | `string` | 标题 |
| `difficulty` | `string` | 难度文本 |
| `difficultyClass` | `string` | 难度样式标识 |
| `category` | `string` | 分类 |
| `acceptance` | `string` | 通过率/接受率文本 |
| `description` | `string` | 题目描述 |
| `example` | `string` | 示例 |
| `constraints` | `string` | 约束说明 |
| `kind` | `string` | 题目类型 |
| `starterCodes` | `{ python: string; java: string }` | 初始代码模板 |
| `referenceSolutions` | `{ python: string; java: string }` | 参考解答 |
| `visibleTests` | `JudgeTestCase[]` | 可见测试用例 |
| `hiddenTests` | `JudgeTestCase[]` | 隐藏测试用例 |
| `bestApproach` | `string` | 推荐解法说明 |
| `referenceTitle` | `string` | 参考标题 |
| `referenceNote` | `string` | 参考备注 |

`JudgeTestCase`:
| 字段名 | 类型 | 描述 |
| `name` | `string` | 用例名称 |
| `input` | `unknown` | 输入数据 |
| `expected` | `unknown` | 期望输出 |

`6. community-moderation.json`  
来源: [communityModerationStore.ts](/f:/unishit/cl-app-backend/src/communityModerationStore.ts:24)

文件作用:
- 持久化社区投稿和审核状态

顶层结构:
```json
{
  "items": [
    {
      "...": "CommunityModerationItem"
    }
  ]
}
```

顶层字段:
| 字段名 | 类型 | 描述 |
| `items` | `CommunityModerationItem[]` | 社区投稿/审核记录列表 |

`CommunityModerationItem`:
| 字段名 | 类型 | 描述 |
| `id` | `string` | 帖子或投稿 ID |
| `title` | `string` | 标题 |
| `summary` | `string` | 摘要 |
| `content` | `string` | 正文 |
| `author` | `string` | 作者 |
| `tags` | `string[]` | 标签列表 |
| `submittedAt` | `string` | 提交时间，ISO 字符串 |
| `status` | `"pending" \| "approved" \| "rejected"` | 审核状态 |
| `moderationNote` | `string` | 审核备注 |
| `reportCount` | `number` | 举报次数 |
