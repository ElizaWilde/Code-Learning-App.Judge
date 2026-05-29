// 功能：检测 Java 相关内容中的单引号引用格式，辅助定位数据清洗问题。
const fs=require('fs');
const p='f:/unishit/code-learning-app/pages/quest/quest.uvue';
const s=fs.readFileSync(p,'utf8');
const re=/referenceSolutions:\s*\{[\s\S]*?java:\s*'/g;
let m, found=false;
while((m=re.exec(s))!==null){ console.log('Found single-quoted java referenceSolutions at index', m.index); found=true; }
if(!found) console.log('No single-quoted java referenceSolutions found');
