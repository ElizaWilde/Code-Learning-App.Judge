// 功能：检测参考内容中的单引号格式问题，辅助定位题库文本规范问题
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
