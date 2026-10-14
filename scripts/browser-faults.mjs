import {chromium,expect} from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
await context.route('**/api/interpret*',route=>{console.log('INTERCEPT AI',route.request().url());return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'测试注入：模型限流或超时'})});});
await context.route('**/api/dataset*',route=>route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'测试注入：数据接口鉴权失败'})}));
const page=await context.newPage();const results=[];
try{await page.goto(process.env.TEST_URL??'http://127.0.0.1:5173/',{waitUntil:'networkidle'});await page.getByRole('button',{name:'解析条件'}).click();await expect(page.getByRole('alert')).toContainText('模型限流',{timeout:15000});results.push('模型故障可见');await page.getByRole('button',{name:/手动设置/}).click();results.push('手动编辑可用');await page.locator('.confirm input').check();await page.getByRole('button',{name:'执行筛选',exact:true}).click();await expect(page.getByRole('alert')).toContainText('鉴权失败');await expect(page.locator('.snapshot-line')).toHaveCount(0);results.push('数据失败无伪造结果');console.log(results);}catch(e){console.error(e.message);await page.screenshot({path:'outputs/faults-failure.png',fullPage:true});process.exitCode=1;}
fs.writeFileSync('outputs/browser-faults.json',JSON.stringify({testedAt:new Date().toISOString(),passed:!process.exitCode,results},null,2));await browser.close();
