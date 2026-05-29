// 功能：检测内容数据中的单引号引用格式，辅助校验题库文本规范。
const fs=require('fs');
const p='f:/unishit/code-learning-app/pages/quest/quest.uvue';
const s=fs.readFileSync(p,'utf8');
const re=/referenceSolutions:\s*\{[\s\S]*?python:\s*'/g;
let m;
let found=false;
while((m=re.exec(s))!==null){
 console.log('Found single-quoted python referenceSolutions at index', m.index);
 found=true;
}
if(!found) console.log('No single-quoted python referenceSolutions found');
