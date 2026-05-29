const { judgeSubmission } = require('./dist/judgeService');
(async () => {
  try {
    const code = `def solve(nums, target):
    for i in range(len(nums)):
        for j in range(i + 1, len(nums)):
            if nums[i] + nums[j] == target:
                return [i, j]
`;
    const result = await judgeSubmission('two-sum', 'python', code, 'run');
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('ERROR', e);
  }
})();
