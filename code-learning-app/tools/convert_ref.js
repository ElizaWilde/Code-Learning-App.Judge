// 功能：批量转换题库参考内容格式，辅助维护学习和刷题数据
const fs = require('fs');
const path = 'f:/unishit/code-learning-app/pages/quest/quest.uvue';
let s = fs.readFileSync(path, 'utf8');
// Replace python:'...'
s = s.replace(/python:\s*'(.*?)'\s*,\s*java:\s*'(.*?)'/gs, "python: `$1`,\n\t\t\t\tjava: `$2`");
fs.writeFileSync(path, s, 'utf8');
console.log('converted');
