import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=Object.fromEntries(process.argv.slice(2).reduce((pairs,value,i,all)=>i%2?pairs:[...pairs,[value.replace(/^--/,''),all[i+1]]],[]));
for(const key of ['game','normal','weird','utmt','runtime'])if(!args[key])throw Error(`Missing --${key}`);
const chapter=path.join(path.resolve(args.game),'chapter3_windows'),out=path.join(root,'dist/runtime');
const build=path.join(root,'.build');
fs.mkdirSync(build,{recursive:true});fs.mkdirSync(out,{recursive:true});
const normal=fs.readFileSync(args.normal,'utf8').trimEnd().split(/\r?\n/);
const weird=fs.readFileSync(args.weird,'utf8').trimEnd().split(/\r?\n/);
if(normal.length!==3055||weird.length!==3055||Number(weird[552+456])!==1)throw Error('Expected Chapter 3 saves and an enabled Weird Route flag.');
weird[7]='1';weird[8]='2';weird[9]='4';
for(let i=0;i<13;i++)weird[329+2*i]=normal[329+2*i];
const weirdData=Buffer.from(weird.join('\n')+'\n');
fs.mkdirSync(path.join(root,'dist/saves'),{recursive:true});
fs.writeFileSync(path.join(root,'dist/saves/weird-route-filech3_1'),weirdData);
const patched=path.join(build,'knight.win');
const result=spawnSync(path.resolve(args.utmt),['load',path.join(chapter,'data.win'),'-s',path.join(root,'scripts/patch-knight.csx'),'-o',patched,'-f'],{stdio:'inherit'});
if(result.status!==0)throw Error('Game-data patch failed.');
let offset=0;const files=[],buffers=[];
function pack(name,data){buffers.push(data);files.push({filename:'/assets/'+name,start:offset,end:offset+data.length,audio:0});offset+=data.length;}
for(const name of ['audiogroup1.dat','options.ini','lang/lang_ja.json'])pack(name,fs.readFileSync(path.join(chapter,name)));
pack('knight-normal.sav',fs.readFileSync(args.normal));pack('knight-weird.sav',weirdData);
fs.mkdirSync(path.join(out,'mus'),{recursive:true});
for(const name of fs.readdirSync(path.join(args.game,'mus')))if(/knight|kaizo|dontforget|gameover/.test(name)){
 const data=fs.readFileSync(path.join(args.game,'mus',name));
 fs.writeFileSync(path.join(out,'mus',name),data);
 if(/knight|kaizo|gameover/.test(name))pack('mus/'+name,data);
}
fs.writeFileSync(path.join(out,'runner.data'),Buffer.concat(buffers));
let runner=fs.readFileSync(path.join(args.runtime,'runner.js'),'utf8');
const metadata=/\{"files":\[.*?"package_uuid":"[^"]+"\}/s;
if(!metadata.test(runner))throw Error('Unsupported runner package metadata.');
runner=runner.replace(metadata,JSON.stringify({files,remote_package_size:offset,package_uuid:'kaizo-knight-v233'}));
fs.writeFileSync(path.join(out,'runner.js'),runner);
for(const name of ['runner.wasm','audio-worklet.js'])fs.copyFileSync(path.join(args.runtime,name),path.join(out,name));
for(const name of fs.readdirSync(chapter))if(name.endsWith('.ogg'))fs.copyFileSync(path.join(chapter,name),path.join(out,name.toLowerCase()));
const game=fs.readFileSync(patched),parts=[];
for(let pos=0,index=1;pos<game.length;pos+=20*1024*1024,index++){
 const name='game.part'+index;fs.writeFileSync(path.join(out,name),game.subarray(pos,pos+20*1024*1024));parts.push(name);
}
fs.writeFileSync(path.join(out,'game-manifest.json'),JSON.stringify({parts,totalBytes:game.length}));
console.log('Browser edition prepared. Run npm start. Original game and saves are unchanged.');
