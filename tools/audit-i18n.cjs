const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require('tsx/cjs');const {translations}=require('../apps/web/src/i18n.ts');
const missing=new Set(),rawJsx=[];
for(const name of fs.readdirSync('apps/web/src').filter(n=>n.endsWith('.tsx'))){
 const src=fs.readFileSync(path.join('apps/web/src',name),'utf8'),file=ts.createSourceFile(name,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 function visit(n){
  if(ts.isJsxText(n)&&/[А-Яа-яЁё]/.test(n.text)&&n.text.trim()!=='Русский · RU')rawJsx.push(name+': '+n.text.trim());
  if(ts.isStringLiteral(n)&&/[А-Яа-яЁё]/.test(n.text)&&!translations[n.text])missing.add(n.text);
  ts.forEachChild(n,visit);
 }visit(file);
}
for(const [key,entry]of Object.entries(translations))for(const lang of ['uz','en']){
 if(!entry[lang])missing.add(lang+': '+key);
 const tokens=s=>[...s.matchAll(/\{\{\s*([\w]+)\s*\}\}/g)].map(x=>x[1]).sort().join(',');
 if(tokens(key)!==tokens(entry[lang]))missing.add('interpolation '+lang+': '+key);
}
console.log(JSON.stringify({keys:Object.keys(translations).length,missing:[...missing],rawJsx},null,2));
if(missing.size||rawJsx.length)process.exitCode=1;
