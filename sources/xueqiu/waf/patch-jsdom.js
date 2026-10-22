// jsdom 把跨文档跳转实现成 "Not implemented"，navigate() 是唯一能拿到目标 URL 的地方。
// Location 实例上的 href/assign/replace 都不可重定义，所以只能在这里插钩子。
// 幂等：重复执行不会重复插入。
const fs = require('fs');
const path = require('path');

const MARK = '__wafNav';
let target;
try {
  target = path.join(
    path.dirname(require.resolve('jsdom/package.json')),
    'lib/jsdom/living/window/navigation.js',
  );
} catch (e) {
  console.error('找不到 jsdom，先 npm install');
  process.exit(1);
}

let src = fs.readFileSync(target, 'utf8');
if (src.includes(MARK)) {
  console.log('jsdom 已打过补丁:', target);
  process.exit(0);
}

const needle = 'const document0 = window._document;';
// 兼容不同 jsdom 版本：优先找 navigate 的函数体开头
const anchor = 'exports.navigate = (window, newURL, flags) => {';
if (!src.includes(anchor)) {
  console.error('jsdom 版本不匹配，没找到 navigate 定义:', target);
  process.exit(1);
}

src = src.replace(
  anchor,
  anchor + `\n  try { if (global.${MARK}) global.${MARK}(window, newURL, flags); } catch (e) {}`,
);
fs.writeFileSync(target, src);
console.log('已给 jsdom 打补丁:', target);
