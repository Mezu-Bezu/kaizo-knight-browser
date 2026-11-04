import assert from 'node:assert/strict';
import {test} from 'node:test';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium,firefox} from 'playwright';

// Exercise the real launcher and bridge without downloading the game. The
// fixture uses requestAnimationFrame, just as the runner does during startup.
test('runner stays rendered beneath loading, then supports both routes and retry',async()=>{
 const server=spawn(process.execPath,['scripts/serve.mjs'],{stdio:['ignore','pipe','pipe']});
 let browser;
 try{
  await Promise.race([
   once(server.stdout,'data'),
   once(server,'exit').then(([code])=>{throw Error(`Server exited: ${code}`);}),
   delay(10000).then(()=>{throw Error('Server startup timed out');})
  ]);
  const engine=process.env.BROWSER||'firefox';
  browser=await (engine==='firefox'?firefox:chromium).launch({headless:true,...(engine==='msedge'?{channel:'msedge'}:{})});
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let downloads=0;
  await page.route('**/runtime/game-manifest.json',route=>route.fulfill({json:{parts:['game.part1'],totalBytes:4}}));
  await page.route('**/runtime/game.part1',route=>{downloads++;return route.fulfill({body:'game'});});
  await page.route('**/runtime/runner.js',route=>route.fulfill({contentType:'text/javascript',body:`
   window.fixtureRoute=new URLSearchParams(location.search).get('route');
   requestAnimationFrame(()=>{window.fixtureFrame=true;});
  `}));
  await page.goto('http://127.0.0.1:4173/');
  async function startAndReady(route,button){
   await page.locator(button).click();
   await page.locator('#game-frame').waitFor({state:'attached'});
   const host=page.locator('#game-host'),loading=page.locator('#loading');
   assert.equal(await host.isVisible(),true,'iframe must render before KNIGHT_READY');
   assert.equal(await loading.isVisible(),true,'loading screen must cover the runner');
   assert.equal(await page.locator('#retry').isVisible(),false);
   const box=await host.boundingBox();
   assert.ok(box.width>0&&box.height>0);
   assert.equal(await page.evaluate(({x,y})=>document.elementFromPoint(x,y).closest('#loading')!==null,{x:box.x+box.width/2,y:box.y+box.height/2}),true);
   const frame=await (await page.locator('#game-frame').elementHandle()).contentFrame();
   await frame.waitForFunction(()=>window.fixtureFrame===true);
   assert.equal(await frame.evaluate(()=>window.fixtureRoute),route);
   await frame.evaluate(()=>gameLog('KNIGHT_READY:0'));
   await loading.waitFor({state:'hidden'});
   assert.equal(await host.isVisible(),true);
   assert.equal(await page.locator('#retry').isVisible(),true);
   return frame;
  }
  let frame=await startAndReady('normal','[data-route="normal"]');
  await frame.evaluate(()=>gameLog('KNIGHT_RESULT:DEFEAT'));
  await page.locator('#result').waitFor({state:'visible'});
  frame=await startAndReady('normal','#again');
  await page.locator('#menu').click();
  assert.equal(await page.locator('#game-frame').count(),0);
  frame=await startAndReady('weird','[data-route="weird"]');
  frame=await startAndReady('weird','#retry');
  await frame.evaluate(()=>window.dispatchEvent(new ErrorEvent('error',{message:'Fixture runtime failure'})));
  await page.locator('#error').waitFor({state:'visible'});
  assert.equal(await page.locator('#game-frame').count(),0);
  assert.equal(await page.locator('#error-text').textContent(),'Fixture runtime failure');
  await page.locator('#error-menu').click();
  assert.equal(await page.locator('#title-screen').isVisible(),true);
  assert.equal(downloads,1,'retries and route changes reuse the game download');
  assert.deepEqual(errors,[]);
 }finally{
  await browser?.close();
  server.kill();
 }
});
