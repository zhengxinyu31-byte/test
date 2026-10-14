import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const results=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
const base=process.env.TEST_URL??'http://127.0.0.1:5173';
const record=(name)=>{results.push({name,passed:true});console.log('PASS',name);};
try{
await page.goto(base,{waitUntil:'networkidle'});
await page.getByRole('button',{name:'解析条件'}).click();
await expect(page.locator('.clarification')).toBeVisible({timeout:60000});
await expect(page.locator('.valuation-choice')).toBeVisible();
await page.getByLabel('自定义PE上限').fill('25');
await page.getByRole('button',{name:'采用',exact:true}).click();
await page.locator('.confirm input').check();
await page.getByRole('button',{name:'执行筛选',exact:true}).click();
await expect(page.locator('.snapshot-line')).toBeVisible({timeout:180000});
await expect(page.locator('.table-footer')).toContainText('共 50 只');record('real AI clarification + user-defined PE + real 50-stock screening');
await page.screenshot({path:'outputs/workbench-results.png',fullPage:true});
await page.locator('.reason-button').first().click();await expect(page.getByRole('dialog')).toBeVisible();
await page.locator('.proof-card details').first().locator('summary').click();await expect(page.locator('.proof-card pre').first()).toBeVisible();record('pass evidence raw fields and calculation');
await page.getByRole('button',{name:'关闭',exact:true}).click();
await page.locator('.tabs button').filter({hasText:'未通过'}).click();await page.locator('.reason-button').first().click();await expect(page.locator('.proof-card')).not.toHaveCount(0);record('exclusion retains per-condition evidence');await page.getByRole('button',{name:'关闭',exact:true}).click();
const peSelect=page.locator('.condition-card').filter({has:page.locator('select[aria-label^="指标"] option:checked',{hasText:'市盈率'})});
// Inputs are addressed via the selected field, not the position returned by the model.
const peIndex=await page.locator('.condition-card>select').evaluateAll(nodes=>nodes.findIndex(n=>n.value==='pe'));
await page.getByLabel(`阈值${peIndex+1}`,{exact:true}).fill('15');await expect(page.locator('.run-banner')).toContainText('条件已修改');await page.locator('.confirm input').check();await page.getByRole('button',{name:'执行筛选',exact:true}).click();await expect(page.locator('.delta')).toBeVisible();record('threshold change preserves snapshot and shows added/removed');
await page.locator('.tabs button').filter({hasText:'全部'}).click();await page.locator('tbody input[type=checkbox]').nth(0).check();await page.locator('tbody input[type=checkbox]').nth(1).check();await page.locator('tbody input[type=checkbox]').nth(2).check();await expect(page.locator('tbody input[type=checkbox]').nth(3)).toBeDisabled();await page.getByRole('button',{name:/对比所选/}).click();await expect(page.locator('.compare-grid article')).toHaveCount(3);record('compare maximum three');await page.getByRole('button',{name:'关闭',exact:true}).click();
await page.getByRole('button',{name:'保存方案',exact:true}).click();await page.getByLabel('方案名称').fill('浏览器验证研究');await page.getByRole('button',{name:'保存本次结果'}).click();await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/已保存/}).click();await page.getByRole('button',{name:'打开',exact:true}).first().click();await expect(page.locator('.run-banner')).toContainText('历史结果');record('save/reload/restore explicitly historical');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'outputs/workbench-mobile.png',fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);record('mobile no document overflow');
// Deterministic fault injection exercises UI behavior, not real vendor reliability.
await page.goto(base,{waitUntil:'networkidle'});await page.route('**/api/interpret*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'测试注入：模型限流或超时'})}));await page.getByRole('button',{name:'解析条件'}).click();await expect(page.getByRole('alert')).toContainText('模型限流');await page.getByRole('button',{name:/手动设置/}).click();record('model failure visible and manual editing remains');
await page.route('**/api/dataset*',route=>route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'测试注入：数据接口鉴权失败'})}));await page.locator('.confirm input').check();await page.getByRole('button',{name:'执行筛选',exact:true}).click();await expect(page.getByRole('alert')).toContainText('鉴权失败');await expect(page.locator('.snapshot-line')).toHaveCount(0);record('data failure does not fabricate results');
expect(errors).toEqual([]);record('no uncaught browser errors');
}catch(e){results.push({name:'flow failure',passed:false,error:e.message});console.error(e.message);await page.screenshot({path:'outputs/e2e-failure.png',fullPage:true});process.exitCode=1;}
fs.writeFileSync('outputs/browser-e2e.json',JSON.stringify({base,testedAt:new Date().toISOString(),results,errors},null,2));await browser.close();
