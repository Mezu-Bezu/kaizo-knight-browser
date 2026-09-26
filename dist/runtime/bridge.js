var g_pWadLoadCallback, g_pJSExceptionHandler, g_pAddAsyncMethod=-1;
function setWadLoadCallback(fn){g_pWadLoadCallback=fn;}
function setAddAsyncMethod(fn){g_pAddAsyncMethod=fn;}
function setJSExceptionHandler(fn){g_pJSExceptionHandler=fn;}
function hasJSExceptionHandler(){return typeof g_pJSExceptionHandler==='function';}
function doJSExceptionHandler(s){if(hasJSExceptionHandler())g_pJSExceptionHandler(JSON.parse(s));}
function manifestFiles(){return 'game.unx;';}
function manifestFilesMD5(){return ';';}
function onFirstFrameRendered(){console.log('FIRST FRAME');}
function onGameSetWindowSize(w,h){console.log('WINDOW SIZE',w,h);}
function ModuleName(){return Module;}
const host=window.parent!==window?window.parent.knightHost:null;
const nativeOpen=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method,url,...rest){if(typeof url==='string'&&/(^|\/)game\.unx(?:\?|$)/.test(url)&&host?.getGameURL())url=host.getGameURL();return nativeOpen.call(this,method,url,...rest);};
function gameLog(...args){const line=args.join(' ');console.log(...args);if(line.startsWith('KNIGHT_READY:'))host?.ready();if(line.startsWith('KNIGHT_RESULT:'))host?.result(line.split(':')[1]);if(line.includes('ERROR!!!')||line.includes('FATAL ERROR'))host?.error('The game encountered a runtime error. Retry the fight.');}
var Module={canvas:document.getElementById('canvas'),preRun:[function(){Module.FS_createPath('/','assets',true,true);Module.FS_createDataFile('/assets','browser-route.txt',new URLSearchParams(location.search).get('route')==='weird'?'1':'0',true,true);}],postRun:[],arguments:[],print:gameLog,printErr:(...a)=>console.error(...a),setStatus:s=>document.getElementById('status').textContent=s};
document.getElementById('canvas').addEventListener('click',()=>document.getElementById('canvas').focus());
document.addEventListener('keydown',event=>{if(event.code==='KeyR'&&host){event.preventDefault();event.stopImmediatePropagation();host.retry();}else if(event.code==='Escape'&&host&&!document.fullscreenElement){event.preventDefault();event.stopImmediatePropagation();host.menu();}},true);
window.addEventListener('error',e=>{document.getElementById('status').textContent+='\n'+e.message;host?.error(e.message);});
