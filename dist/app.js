const $=id=>document.getElementById(id);
let currentRoute='normal',gameURL=null,loadingPromise=null,session=0,timeout;
const isRoute=v=>v==='normal'||v==='weird';
function status(text,value){$('load-label').textContent=text;if(value!==undefined)$('progress').value=value;}
function screen(id){for(const name of ['title-screen','loading','game-host','result','error'])$(name).hidden=name!==id;}
async function loadGame(){
 if(gameURL)return gameURL;
 if(loadingPromise)return loadingPromise;
 loadingPromise=(async()=>{
  const meta=await fetch('runtime/game-manifest.json');if(!meta.ok)throw new Error('Game files are missing. Run the local build step described in the README.');
  const {parts,totalBytes}=await meta.json();let received=0;const buffers=[];
  for(const part of parts){
   const response=await fetch('runtime/'+part);if(!response.ok)throw new Error('A game download failed. Check your connection and try again.');
   const chunks=[];const reader=response.body.getReader();
   for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);received+=value.length;status('Loading the Knight… '+Math.round(received/totalBytes*100)+'%',received/totalBytes*100);}
   buffers.push(new Blob(chunks));
  }
  gameURL=URL.createObjectURL(new Blob(buffers,{type:'application/octet-stream'}));return gameURL;
 })().catch(e=>{loadingPromise=null;throw e;});
 return loadingPromise;
}
function fail(message){clearTimeout(timeout);$('error-text').textContent=message;screen('error');$('game-host').replaceChildren();}
async function start(route=currentRoute){
 if(!isRoute(route))throw new Error('Unknown route');currentRoute=route;const run=++session;
 clearTimeout(timeout);$('game-host').replaceChildren();document.body.classList.add('playing');screen('loading');status('Preparing the Knight…',0);
 $('route-name').textContent=route==='weird'?'WEIRD ROUTE':'NORMAL ROUTE';$('menu').hidden=false;$('retry').hidden=true;
 try{
  await loadGame();if(run!==session)return;
  status('Entering the arena…',100);
  const frame=document.createElement('iframe');frame.title='Kaizo Roaring Knight — '+route+' route';frame.allow='autoplay; fullscreen; gamepad';frame.src='runtime/?route='+route;frame.id='game-frame';$('game-host').append(frame);
  timeout=setTimeout(()=>{if(run===session)fail('The game took too long to start. Try again, or use a current desktop Chrome or Edge browser.');},90000);
 }catch(error){if(run===session)fail(error.message);}
}
function menu(){session++;clearTimeout(timeout);$('game-host').replaceChildren();screen('title-screen');document.body.classList.remove('playing');$('route-name').textContent='';$('retry').hidden=true;$('menu').hidden=true;document.querySelector('[data-route="'+currentRoute+'"]').focus();}
window.knightHost={getGameURL:()=>gameURL,ready(){clearTimeout(timeout);screen('game-host');$('retry').hidden=false;$('game-frame')?.contentWindow.focus();},result(value){clearTimeout(timeout);$('game-host').hidden=false;$('result').hidden=false;$('result-title').textContent=value==='VICTORY'?'THE KNIGHT FALLS.':'THE FIGHT IS NOT OVER.';},error:fail,retry:()=>start(),menu};
for(const button of document.querySelectorAll('[data-route]'))button.addEventListener('click',()=>start(button.dataset.route));
$('menu').onclick=menu;$('retry').onclick=()=>start();$('again').onclick=()=>start();$('choose').onclick=menu;$('try-again').onclick=()=>start();$('error-menu').onclick=menu;
$('fullscreen').onclick=()=>{if(document.fullscreenElement)document.exitFullscreen();else $('stage').requestFullscreen().catch(()=>{});};
document.addEventListener('keydown',event=>{if(event.code==='KeyR'&&$('title-screen').hidden){event.preventDefault();start();}else if(event.code==='Escape'&&$('title-screen').hidden){menu();}});
if(navigator.modelContext?.registerTool){
 navigator.modelContext.registerTool({name:'start_knight_fight',description:'Start the Kaizo Knight battle in the selected route.',inputSchema:{type:'object',properties:{route:{type:'string',enum:['normal','weird']}},required:['route']},execute:async({route})=>{await start(route);return {content:[{type:'text',text:'Starting '+route+' route.'}]};}});
 navigator.modelContext.registerTool({name:'return_to_routes',description:'End this attempt and return to route selection.',inputSchema:{type:'object',properties:{}},execute:async()=>{menu();return {content:[{type:'text',text:'Route selection opened.'}]};}});
}
