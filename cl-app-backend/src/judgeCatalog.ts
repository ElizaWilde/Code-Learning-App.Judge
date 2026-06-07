// 功能：定义内置算法题库、题目类型、语言模板、可见测试和隐藏测试
/*
  * 内置题库数据结构和示例题目定义
*/
export type JudgeLanguage = "python" | "java";

export type QuestKind =
  | "two_sum"
  | "valid_parentheses"
  | "merge_strings"
  | "contains_duplicate"
  | "product_except_self"
  | "best_time_stock"
  | "longest_substring"
  | "min_stack"
  | "daily_temperatures"
  | "invert_binary_tree"
  | "binary_level_order"
  | "number_of_islands";

export const QUEST_KIND_VALUES: QuestKind[] = [
  "two_sum",
  "valid_parentheses",
  "merge_strings",
  "contains_duplicate",
  "product_except_self",
  "best_time_stock",
  "longest_substring",
  "min_stack",
  "daily_temperatures",
  "invert_binary_tree",
  "binary_level_order",
  "number_of_islands"
];

export type JudgeTestCase = {
  name: string;
  input: unknown;
  expected: unknown;
};

export type StarterCodes = Record<JudgeLanguage, string>;

export type QuestDefinition = {
  id: string;
  title: string;
  difficulty: string;
  difficultyClass: string;
  category: string;
  acceptance: string;
  description: string;
  example: string;
  constraints: string;
  kind: QuestKind;
  starterCodes: StarterCodes;
  referenceSolutions: StarterCodes;
  visibleTests: JudgeTestCase[];
  hiddenTests: JudgeTestCase[];
  bestApproach: string;
  referenceTitle: string;
  referenceNote: string;
};

function pythonStarter(kind: QuestKind): string {
  switch (kind) {
    case "two_sum":
      return `def solve(nums, target):\n    # return the indices of the two values\n    return []\n`;
    case "valid_parentheses":
      return `def solve(s):\n    # return True if the parentheses are valid\n    return False\n`;
    case "merge_strings":
      return `def solve(word1, word2):\n    # return the merged string\n    return ""\n`;
    case "contains_duplicate":
      return `def solve(nums):\n    # return True if any duplicate exists\n    return False\n`;
    case "product_except_self":
      return `def solve(nums):\n    # return the product array without using division\n    return []\n`;
    case "best_time_stock":
      return `def solve(prices):\n    # return the max profit\n    return 0\n`;
    case "longest_substring":
      return `def solve(s):\n    # return the longest unique-window length\n    return 0\n`;
    case "min_stack":
      return `class MinStack:\n    def __init__(self):\n        # initialize your stack\n        pass\n\n    def push(self, val):\n        pass\n\n    def pop(self):\n        pass\n\n    def top(self):\n        return 0\n\n    def getMin(self):\n        return 0\n`;
    case "daily_temperatures":
      return `def solve(temperatures):\n    # return the waiting days for a warmer temperature\n    return []\n`;
    case "invert_binary_tree":
      return `class TreeNode:\n    def __init__(self, val=0, left=None, right=None):\n        self.val = val\n        self.left = left\n        self.right = right\n\n\ndef solve(root):\n    # return the inverted tree root\n    return root\n`;
    case "binary_level_order":
      return `class TreeNode:\n    def __init__(self, val=0, left=None, right=None):\n        self.val = val\n        self.left = left\n        self.right = right\n\n\ndef solve(root):\n    # return the level-order traversal\n    return []\n`;
    case "number_of_islands":
      return `def solve(grid):\n    # return the number of islands\n    return 0\n`;
  }
}

function javaStarter(kind: QuestKind): string {
  switch (kind) {
    case "two_sum":
      return `class Solution {\n    public int[] solve(int[] nums, int target) {\n        return new int[0];\n    }\n}\n`;
    case "valid_parentheses":
      return `class Solution {\n    public boolean solve(String s) {\n        return false;\n    }\n}\n`;
    case "merge_strings":
      return `class Solution {\n    public String solve(String word1, String word2) {\n        return "";\n    }\n}\n`;
    case "contains_duplicate":
      return `class Solution {\n    public boolean solve(int[] nums) {\n        return false;\n    }\n}\n`;
    case "product_except_self":
      return `class Solution {\n    public int[] solve(int[] nums) {\n        return new int[0];\n    }\n}\n`;
    case "best_time_stock":
      return `class Solution {\n    public int solve(int[] prices) {\n        return 0;\n    }\n}\n`;
    case "longest_substring":
      return `class Solution {\n    public int solve(String s) {\n        return 0;\n    }\n}\n`;
    case "min_stack":
      return `class MinStack {\n    public MinStack() {\n    }\n\n    public void push(int val) {\n    }\n\n    public void pop() {\n    }\n\n    public int top() {\n        return 0;\n    }\n\n    public int getMin() {\n        return 0;\n    }\n}\n`;
    case "daily_temperatures":
      return `class Solution {\n    public int[] solve(int[] temperatures) {\n        return new int[0];\n    }\n}\n`;
    case "invert_binary_tree":
      return `class TreeNode {\n    int val;\n    TreeNode left;\n    TreeNode right;\n\n    TreeNode(int val) {\n        this.val = val;\n    }\n}\n\nclass Solution {\n    public TreeNode solve(TreeNode root) {\n        return root;\n    }\n}\n`;
    case "binary_level_order":
      return `import java.util.*;\n\nclass TreeNode {\n    int val;\n    TreeNode left;\n    TreeNode right;\n\n    TreeNode(int val) {\n        this.val = val;\n    }\n}\n\nclass Solution {\n    public List<List<Integer>> solve(TreeNode root) {\n        return new ArrayList<>();\n    }\n}\n`;
    case "number_of_islands":
      return `class Solution {\n    public int solve(char[][] grid) {\n        return 0;\n    }\n}\n`;
  }
}

function quest(
  id: string,
  title: string,
  difficulty: string,
  difficultyClass: string,
  category: string,
  acceptance: string,
  description: string,
  example: string,
  constraints: string,
  kind: QuestKind,
  visibleTests: JudgeTestCase[],
  hiddenTests: JudgeTestCase[],
  bestApproach: string,
  referenceNote: string,
  referenceSolutions: StarterCodes
): QuestDefinition {
  return {
    id,
    title,
    difficulty,
    difficultyClass,
    category,
    acceptance,
    description,
    example,
    constraints,
    kind,
    starterCodes: {
      python: pythonStarter(kind),
      java: javaStarter(kind)
    },
    referenceSolutions,
    visibleTests,
    hiddenTests,
    bestApproach,
    referenceTitle: "Local Editorial Reference",
    referenceNote
  };
}

export const questCatalog: Record<string, QuestDefinition> = {
  "two-sum": quest(
    "two-sum",
    "Two Sum",
    "Easy",
    "easy",
    "Array",
    "Acceptance 49.2%",
    "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    "Input: nums = [2,7,11,15], target = 9\nOutput: [0,1]\nExplanation: nums[0] + nums[1] == 9",
    "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\nOnly one valid answer exists.",
    "two_sum",
    [
      { name: "sample-1", input: { nums: [2, 7, 11, 15], target: 9 }, expected: [0, 1] },
      { name: "sample-2", input: { nums: [3, 2, 4], target: 6 }, expected: [1, 2] }
    ],
    [
      { name: "hidden-1", input: { nums: [3, 3], target: 6 }, expected: [0, 1] },
      { name: "hidden-2", input: { nums: [1, 5, 8, 10], target: 18 }, expected: [2, 3] }
    ],
    "Use a hash map from value to index so each number can find its complement in O(1) average time.",
    "LeetCode-style editorial pattern: one pass with a hash map.",
    {
      python: `def solve(nums, target):\n    lookup = {}\n    for i, v in enumerate(nums):\n        need = target - v\n        if need in lookup:\n            return [lookup[need], i]\n        lookup[v] = i\n`,
      java: `import java.util.*;\nclass Solution {\n    public int[] solve(int[] nums, int target) {\n        Map<Integer, Integer> map = new HashMap<>();\n        for (int i = 0; i < nums.length; i++) {\n            int need = target - nums[i];\n            if (map.containsKey(need)) {\n                return new int[]{map.get(need), i};\n            }\n            map.put(nums[i], i);\n        }\n        return new int[0];\n    }\n}\n`
    }
  ),
  "valid-parentheses": quest(
    "valid-parentheses",
    "Valid Parentheses",
    "Easy",
    "easy",
    "Stack",
    "Acceptance 41.8%",
    "Given a string s containing just the characters (), {}, and [], determine if the input string is valid.",
    "Input: s = \"()[]{}\"\nOutput: true",
    "1 <= s.length <= 10^4\ns consists of parentheses only.",
    "valid_parentheses",
    [
      { name: "sample-1", input: { s: "()[]{}" }, expected: true },
      { name: "sample-2", input: { s: "(]" }, expected: false }
    ],
    [
      { name: "hidden-1", input: { s: "([{}])" }, expected: true },
      { name: "hidden-2", input: { s: "(((" }, expected: false }
    ],
    "Push opening brackets and verify each closing bracket matches the latest open bracket.",
    "LeetCode-style stack matching editorial.",
    {
      python: `def solve(s):\n    stack = []\n    pairs = {")": "(", "]": "[", "}": "{"}\n    for ch in s:\n        if ch in pairs.values():\n            stack.append(ch)\n        elif ch in pairs:\n            if not stack or stack.pop() != pairs[ch]:\n                return False\n        else:\n            return False\n    return not stack\n`,
      java: `import java.util.*;\nclass Solution {\n    public boolean solve(String s) {\n        Deque<Character> st = new ArrayDeque<>();\n        for (char c : s.toCharArray()) {\n            if (c == '(' || c == '[' || c == '{') {\n                st.push(c);\n            } else {\n                if (st.isEmpty()) {\n                    return false;\n                }\n                char t = st.pop();\n                if ((c == ')' && t != '(') || (c == ']' && t != '[') || (c == '}' && t != '{')) {\n                    return false;\n                }\n            }\n        }\n        return st.isEmpty();\n    }\n}\n`
    }
  ),
  "merge-strings": quest(
    "merge-strings",
    "Merge Strings Alternately",
    "Easy",
    "easy",
    "Two Pointers",
    "Acceptance 82.1%",
    "You are given two strings word1 and word2. Merge the strings by adding letters in alternating order, starting with word1.",
    "Input: word1 = \"abc\", word2 = \"pqr\"\nOutput: \"apbqcr\"",
    "1 <= word1.length, word2.length <= 100",
    "merge_strings",
    [
      { name: "sample-1", input: { word1: "abc", word2: "pqr" }, expected: "apbqcr" },
      { name: "sample-2", input: { word1: "ab", word2: "pqrs" }, expected: "apbqrs" }
    ],
    [
      { name: "hidden-1", input: { word1: "abcd", word2: "pq" }, expected: "apbqcd" },
      { name: "hidden-2", input: { word1: "a", word2: "z" }, expected: "az" }
    ],
    "Walk through both strings with two pointers and append remaining characters after one string ends.",
    "LeetCode-style two-pointer editorial.",
    {
      python: `def solve(word1, word2):\n    i = 0\n    j = 0\n    parts = []\n    while i < len(word1) or j < len(word2):\n        if i < len(word1):\n            parts.append(word1[i])\n            i += 1\n        if j < len(word2):\n            parts.append(word2[j])\n            j += 1\n    return "".join(parts)\n`,
      java: `class Solution {\n    public String solve(String word1, String word2) {\n        StringBuilder sb = new StringBuilder();\n        int i = 0;\n        int j = 0;\n        while (i < word1.length() || j < word2.length()) {\n            if (i < word1.length()) {\n                sb.append(word1.charAt(i++));\n            }\n            if (j < word2.length()) {\n                sb.append(word2.charAt(j++));\n            }\n        }\n        return sb.toString();\n    }\n}\n`
    }
  ),
  "contains-duplicate": quest(
    "contains-duplicate",
    "Contains Duplicate",
    "Easy",
    "easy",
    "Array",
    "Acceptance 61.4%",
    "Given an integer array nums, return true if any value appears at least twice in the array and false if every element is distinct.",
    "Input: nums = [1,2,3,1]\nOutput: true",
    "1 <= nums.length <= 10^5",
    "contains_duplicate",
    [
      { name: "sample-1", input: { nums: [1, 2, 3, 1] }, expected: true },
      { name: "sample-2", input: { nums: [1, 2, 3, 4] }, expected: false }
    ],
    [
      { name: "hidden-1", input: { nums: [7, 7, 7] }, expected: true },
      { name: "hidden-2", input: { nums: [4, 5, 6, 7, 8] }, expected: false }
    ],
    "Track seen numbers in a set; the first repeated value ends the search.",
    "LeetCode-style hash set editorial.",
    {
      python: `def solve(nums):\n    return len(set(nums)) != len(nums)\n`,
      java: `import java.util.*;\nclass Solution {\n    public boolean solve(int[] nums) {\n        Set<Integer> seen = new HashSet<>();\n        for (int n : nums) {\n            if (!seen.add(n)) {\n                return true;\n            }\n        }\n        return false;\n    }\n}\n`
    }
  ),
  "product-except-self": quest(
    "product-except-self",
    "Product of Array Except Self",
    "Medium",
    "medium",
    "Array",
    "Acceptance 66.7%",
    "Return an array answer such that answer[i] is equal to the product of all the elements of nums except nums[i].",
    "Input: nums = [1,2,3,4]\nOutput: [24,12,8,6]",
    "2 <= nums.length <= 10^5\nDo not use division.",
    "product_except_self",
    [
      { name: "sample-1", input: { nums: [1, 2, 3, 4] }, expected: [24, 12, 8, 6] },
      { name: "sample-2", input: { nums: [-1, 1, 0, -3, 3] }, expected: [0, 0, 9, 0, 0] }
    ],
    [
      { name: "hidden-1", input: { nums: [2, 3, 4, 5] }, expected: [60, 40, 30, 24] },
      { name: "hidden-2", input: { nums: [5, 1] }, expected: [1, 5] }
    ],
    "Build prefix products left-to-right and suffix products right-to-left, then multiply them per index.",
    "LeetCode-style prefix/suffix editorial.",
    {
      python: `def solve(nums):\n    n = len(nums)\n    res = [1] * n\n    prefix = 1\n    for i in range(n):\n        res[i] = prefix\n        prefix *= nums[i]\n    suffix = 1\n    for i in range(n - 1, -1, -1):\n        res[i] *= suffix\n        suffix *= nums[i]\n    return res\n`,
      java: `import java.util.*;\nclass Solution {\n    public int[] solve(int[] nums) {\n        int n = nums.length;\n        int[] res = new int[n];\n        Arrays.fill(res, 1);\n        int prefix = 1;\n        for (int i = 0; i < n; i++) {\n            res[i] = prefix;\n            prefix *= nums[i];\n        }\n        int suffix = 1;\n        for (int i = n - 1; i >= 0; i--) {\n            res[i] *= suffix;\n            suffix *= nums[i];\n        }\n        return res;\n    }\n}\n`
    }
  ),
  "best-time-stock": quest(
    "best-time-stock",
    "Best Time to Buy and Sell Stock",
    "Easy",
    "easy",
    "Two Pointers",
    "Acceptance 55.3%",
    "Choose one day to buy and one later day to sell for the maximum profit.",
    "Input: prices = [7,1,5,3,6,4]\nOutput: 5",
    "1 <= prices.length <= 10^5",
    "best_time_stock",
    [
      { name: "sample-1", input: { prices: [7, 1, 5, 3, 6, 4] }, expected: 5 },
      { name: "sample-2", input: { prices: [7, 6, 4, 3, 1] }, expected: 0 }
    ],
    [
      { name: "hidden-1", input: { prices: [2, 4, 1] }, expected: 2 },
      { name: "hidden-2", input: { prices: [1, 2, 11, 4] }, expected: 10 }
    ],
    "Track the minimum price seen so far and compute the best profit at each step.",
    "LeetCode-style single-pass editorial.",
    {
      python: `def solve(prices):\n    min_price = float("inf")\n    max_profit = 0\n    for p in prices:\n        if p < min_price:\n            min_price = p\n        elif p - min_price > max_profit:\n            max_profit = p - min_price\n    return max_profit\n`,
      java: `class Solution {\n    public int solve(int[] prices) {\n        int minPrice = Integer.MAX_VALUE;\n        int maxProfit = 0;\n        for (int p : prices) {\n            if (p < minPrice) {\n                minPrice = p;\n            } else if (p - minPrice > maxProfit) {\n                maxProfit = p - minPrice;\n            }\n        }\n        return maxProfit;\n    }\n}\n`
    }
  ),
  "longest-substring": quest(
    "longest-substring",
    "Longest Substring Without Repeating Characters",
    "Medium",
    "medium",
    "Sliding Window",
    "Acceptance 37.1%",
    "Given a string s, find the length of the longest substring without repeating characters.",
    "Input: s = \"abcabcbb\"\nOutput: 3",
    "0 <= s.length <= 5 * 10^4",
    "longest_substring",
    [
      { name: "sample-1", input: { s: "abcabcbb" }, expected: 3 },
      { name: "sample-2", input: { s: "bbbbb" }, expected: 1 }
    ],
    [
      { name: "hidden-1", input: { s: "pwwkew" }, expected: 3 },
      { name: "hidden-2", input: { s: "" }, expected: 0 }
    ],
    "Use a sliding window and map last-seen indices so the left boundary jumps past duplicates.",
    "LeetCode-style sliding window editorial.",
    {
      python: `def solve(s):\n    last = {}\n    start = 0\n    best = 0\n    for i, ch in enumerate(s):\n        if ch in last and last[ch] >= start:\n            start = last[ch] + 1\n        last[ch] = i\n        best = max(best, i - start + 1)\n    return best\n`,
      java: `import java.util.*;\nclass Solution {\n    public int solve(String s) {\n        int[] last = new int[128];\n        Arrays.fill(last, -1);\n        int start = 0;\n        int best = 0;\n        for (int i = 0; i < s.length(); i++) {\n            char c = s.charAt(i);\n            if (last[c] >= start) {\n                start = last[c] + 1;\n            }\n            last[c] = i;\n            best = Math.max(best, i - start + 1);\n        }\n        return best;\n    }\n}\n`
    }
  ),
  "min-stack": quest(
    "min-stack",
    "Min Stack",
    "Medium",
    "medium",
    "Stack",
    "Acceptance 56.1%",
    "Design a stack that supports push, pop, top, and retrieving the minimum element in constant time.",
    "Input: push(-2), push(0), push(-3), getMin()\nOutput: -3",
    "Implement push, pop, top, and getMin in O(1).",
    "min_stack",
    [
      {
        name: "sample-1",
        input: { ops: ["MinStack", "push", "push", "push", "getMin", "pop", "top", "getMin"], values: [null, -2, 0, -3, null, null, null, null] },
        expected: [null, null, null, null, -3, null, 0, -2]
      }
    ],
    [
      {
        name: "hidden-1",
        input: { ops: ["MinStack", "push", "push", "getMin", "push", "getMin", "pop", "top"], values: [null, 2, 1, null, 3, null, null, null] },
        expected: [null, null, null, 1, null, 1, null, 1]
      }
    ],
    "Keep a second stack of current minimums so getMin stays O(1).",
    "LeetCode-style design stack editorial.",
    {
      python: `class MinStack:\n    def __init__(self):\n        self.stack = []\n        self.minstack = []\n\n    def push(self, val):\n        self.stack.append(val)\n        if not self.minstack or val <= self.minstack[-1]:\n            self.minstack.append(val)\n\n    def pop(self):\n        val = self.stack.pop()\n        if val == self.minstack[-1]:\n            self.minstack.pop()\n\n    def top(self):\n        return self.stack[-1]\n\n    def getMin(self):\n        return self.minstack[-1]\n`,
      java: `import java.util.*;\nclass MinStack {\n    private Deque<Integer> stack = new ArrayDeque<>();\n    private Deque<Integer> mins = new ArrayDeque<>();\n\n    public MinStack() {\n    }\n\n    public void push(int val) {\n        stack.push(val);\n        if (mins.isEmpty() || val <= mins.peek()) {\n            mins.push(val);\n        }\n    }\n\n    public void pop() {\n        int v = stack.pop();\n        if (v == mins.peek()) {\n            mins.pop();\n        }\n    }\n\n    public int top() {\n        return stack.peek();\n    }\n\n    public int getMin() {\n        return mins.peek();\n    }\n}\n`
    }
  ),
  "daily-temperatures": quest(
    "daily-temperatures",
    "Daily Temperatures",
    "Medium",
    "medium",
    "Monotonic Stack",
    "Acceptance 67.2%",
    "Return the number of days you have to wait after each day to get a warmer temperature.",
    "Input: temperatures = [73,74,75,71,69,72,76,73]\nOutput: [1,1,4,2,1,1,0,0]",
    "1 <= temperatures.length <= 10^5",
    "daily_temperatures",
    [
      { name: "sample-1", input: { temperatures: [73, 74, 75, 71, 69, 72, 76, 73] }, expected: [1, 1, 4, 2, 1, 1, 0, 0] },
      { name: "sample-2", input: { temperatures: [30, 40, 50, 60] }, expected: [1, 1, 1, 0] }
    ],
    [
      { name: "hidden-1", input: { temperatures: [30, 60, 90] }, expected: [1, 1, 0] },
      { name: "hidden-2", input: { temperatures: [90, 80, 70] }, expected: [0, 0, 0] }
    ],
    "Maintain a decreasing stack of indices; pop while the current day is warmer.",
    "LeetCode-style monotonic stack editorial.",
    {
      python: `def solve(temperatures):\n    n = len(temperatures)\n    res = [0] * n\n    stack = []\n    for i, t in enumerate(temperatures):\n        while stack and temperatures[stack[-1]] < t:\n            idx = stack.pop()\n            res[idx] = i - idx\n        stack.append(i)\n    return res\n`,
      java: `import java.util.*;\nclass Solution {\n    public int[] solve(int[] temperatures) {\n        int n = temperatures.length;\n        int[] res = new int[n];\n        Deque<Integer> st = new ArrayDeque<>();\n        for (int i = 0; i < n; i++) {\n            while (!st.isEmpty() && temperatures[st.peek()] < temperatures[i]) {\n                int idx = st.pop();\n                res[idx] = i - idx;\n            }\n            st.push(i);\n        }\n        return res;\n    }\n}\n`
    }
  ),
  "invert-binary-tree": quest(
    "invert-binary-tree",
    "Invert Binary Tree",
    "Easy",
    "easy",
    "Tree",
    "Acceptance 78.4%",
    "Given the root of a binary tree, invert the tree and return its root.",
    "Input: root = [4,2,7,1,3,6,9]\nOutput: [4,7,2,9,6,3,1]",
    "The number of nodes in the tree is in the range [0, 100].",
    "invert_binary_tree",
    [
      { name: "sample-1", input: { root: [4, 2, 7, 1, 3, 6, 9] }, expected: [4, 7, 2, 9, 6, 3, 1] },
      { name: "sample-2", input: { root: [2, 1, 3] }, expected: [2, 3, 1] }
    ],
    [
      { name: "hidden-1", input: { root: [] }, expected: [] },
      { name: "hidden-2", input: { root: [1] }, expected: [1] }
    ],
    "Swap left and right children recursively or with BFS across all nodes.",
    "LeetCode-style DFS/BFS tree editorial.",
    {
      python: `class TreeNode:\n    def __init__(self, val=0, left=None, right=None):\n        self.val = val\n        self.left = left\n        self.right = right\n\n\ndef solve(root):\n    if root is None:\n        return None\n    root.left, root.right = solve(root.right), solve(root.left)\n    return root\n`,
      java: `class TreeNode {\n    int val;\n    TreeNode left;\n    TreeNode right;\n\n    TreeNode(int val) {\n        this.val = val;\n    }\n}\n\nclass Solution {\n    public TreeNode solve(TreeNode root) {\n        if (root == null) {\n            return null;\n        }\n        TreeNode left = solve(root.left);\n        TreeNode right = solve(root.right);\n        root.left = right;\n        root.right = left;\n        return root;\n    }\n}\n`
    }
  ),
  "binary-level-order": quest(
    "binary-level-order",
    "Binary Tree Level Order Traversal",
    "Medium",
    "medium",
    "Tree BFS",
    "Acceptance 70.2%",
    "Return the level order traversal of a binary tree's node values.",
    "Input: root = [3,9,20,null,null,15,7]\nOutput: [[3],[9,20],[15,7]]",
    "The number of nodes in the tree is in the range [0, 2000].",
    "binary_level_order",
    [
      { name: "sample-1", input: { root: [3, 9, 20, null, null, 15, 7] }, expected: [[3], [9, 20], [15, 7]] },
      { name: "sample-2", input: { root: [1] }, expected: [[1]] }
    ],
    [
      { name: "hidden-1", input: { root: [] }, expected: [] },
      { name: "hidden-2", input: { root: [1, 2, 3, 4, null, null, 5] }, expected: [[1], [2, 3], [4, 5]] }
    ],
    "Use BFS with a queue and process one level at a time.",
    "LeetCode-style queue traversal editorial.",
    {
      python: `class TreeNode:\n    def __init__(self, val=0, left=None, right=None):\n        self.val = val\n        self.left = left\n        self.right = right\n\n\ndef solve(root):\n    if not root:\n        return []\n    from collections import deque\n    q = deque([root])\n    out = []\n    while q:\n        level = []\n        for _ in range(len(q)):\n            node = q.popleft()\n            level.append(node.val)\n            if node.left:\n                q.append(node.left)\n            if node.right:\n                q.append(node.right)\n        out.append(level)\n    return out\n`,
      java: `import java.util.*;\nclass TreeNode {\n    int val;\n    TreeNode left;\n    TreeNode right;\n\n    TreeNode(int val) {\n        this.val = val;\n    }\n}\n\nclass Solution {\n    public List<List<Integer>> solve(TreeNode root) {\n        List<List<Integer>> res = new ArrayList<>();\n        if (root == null) {\n            return res;\n        }\n        Queue<TreeNode> q = new LinkedList<>();\n        q.add(root);\n        while (!q.isEmpty()) {\n            int sz = q.size();\n            List<Integer> level = new ArrayList<>();\n            for (int i = 0; i < sz; i++) {\n                TreeNode node = q.poll();\n                level.add(node.val);\n                if (node.left != null) {\n                    q.add(node.left);\n                }\n                if (node.right != null) {\n                    q.add(node.right);\n                }\n            }\n            res.add(level);\n        }\n        return res;\n    }\n}\n`
    }
  ),
  "number-of-islands": quest(
    "number-of-islands",
    "Number of Islands",
    "Medium",
    "medium",
    "Graph DFS",
    "Acceptance 61.9%",
    "Given an m x n 2D binary grid, return the number of islands.",
    "Input: grid = [[\"1\",\"1\",\"0\"],[\"1\",\"0\",\"0\"],[\"0\",\"0\",\"1\"]]\nOutput: 2",
    "1 <= m, n <= 300",
    "number_of_islands",
    [
      { name: "sample-1", input: { grid: [["1", "1", "0"], ["1", "0", "0"], ["0", "0", "1"]] }, expected: 2 },
      { name: "sample-2", input: { grid: [["1", "1"], ["1", "1"]] }, expected: 1 }
    ],
    [
      { name: "hidden-1", input: { grid: [["1", "0", "1"], ["0", "1", "0"], ["1", "0", "1"]] }, expected: 5 },
      { name: "hidden-2", input: { grid: [["0", "0"], ["0", "0"]] }, expected: 0 }
    ],
    "Traverse each unvisited land cell with DFS or BFS and count connected components.",
    "LeetCode-style graph traversal editorial.",
    {
      python: `def solve(grid):\n    if not grid:\n        return 0\n    m = len(grid)\n    n = len(grid[0])\n\n    def dfs(i, j):\n        if i < 0 or j < 0 or i >= m or j >= n or grid[i][j] != "1":\n            return\n        grid[i][j] = "0"\n        dfs(i + 1, j)\n        dfs(i - 1, j)\n        dfs(i, j + 1)\n        dfs(i, j - 1)\n\n    count = 0\n    for i in range(m):\n        for j in range(n):\n            if grid[i][j] == "1":\n                count += 1\n                dfs(i, j)\n    return count\n`,
      java: `class Solution {\n    public int solve(char[][] grid) {\n        if (grid == null || grid.length == 0) {\n            return 0;\n        }\n        int m = grid.length;\n        int n = grid[0].length;\n        int count = 0;\n        for (int i = 0; i < m; i++) {\n            for (int j = 0; j < n; j++) {\n                if (grid[i][j] == '1') {\n                    count++;\n                    dfs(grid, i, j, m, n);\n                }\n            }\n        }\n        return count;\n    }\n\n    private void dfs(char[][] g, int i, int j, int m, int n) {\n        if (i < 0 || j < 0 || i >= m || j >= n || g[i][j] != '1') {\n            return;\n        }\n        g[i][j] = '0';\n        dfs(g, i + 1, j, m, n);\n        dfs(g, i - 1, j, m, n);\n        dfs(g, i, j + 1, m, n);\n        dfs(g, i, j - 1, m, n);\n    }\n}\n`
    }
  )
};

export function getQuestDefinition(questId: string): QuestDefinition | null {
  return questCatalog[questId] ?? null;
}

export function listQuestDefinitions(): QuestDefinition[] {
  return Object.values(questCatalog);
}

export function isQuestKind(value: unknown): value is QuestKind {
  return typeof value === "string" && QUEST_KIND_VALUES.includes(value as QuestKind);
}
