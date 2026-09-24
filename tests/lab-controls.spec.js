const {test,expect}=require('@playwright/test');
const route=name=>`/${name}${process.env.ACS_DESIGN_STAGED?'-design':''}.html`;
test.beforeEach(async({page})=>page.route('**/widget/v1/bundle.js',r=>r.fulfill({body:''})));

test('navigation fits and opens across screen sizes on home and About',async({page})=>{
  test.setTimeout(60000);
  for(const name of ['index','about'])for(const width of [390,768,1024,1440,1600,1920]){
    await page.setViewportSize({width,height:1000});
    await page.goto(route(name));
    const menu=page.locator('#main-navigation');
    if(width<1024)await page.getByRole('button',{name:'Open menu',exact:true}).click();
    await expect(menu).toBeVisible();
    await menu.locator('summary').filter({hasText:'Expertise'}).click();
    const link=menu.getByRole('link',{name:'Smart data logger',exact:true});
    await expect(link).toBeVisible();
    await link.scrollIntoViewIfNeeded();
    const geometry=await page.evaluate(()=>[...document.querySelectorAll('header a,header button')].filter(n=>{
      const r=n.getBoundingClientRect();return r.width&&r.height&&getComputedStyle(n).visibility!=='hidden';
    }).filter(n=>{const r=n.getBoundingClientRect();return r.x<0||r.right>innerWidth+1;}).map(n=>n.textContent.trim()));
    expect(geometry,`${name} at ${width}`).toEqual([]);
    if(width===390||width===1920)await page.screenshot({path:`.scratch/nav-${name}-${width}.png`});
    await page.keyboard.press('Escape');
    if(width<1024){await page.keyboard.press('Escape');await expect(menu).toBeHidden();}
  }
});

test('About history and industry tabs work',async({page})=>{
  await page.goto(route('about'));
  await page.getByRole('tab',{name:'2014',exact:true}).click();
  await expect(page.locator('.rs-history-area .tab-pane.active')).toContainText('Siemens');
  for(const name of ['process-automation','machine-plant-automation']){
    await page.goto(route(name));
    const tabs=page.locator('.acs-industry-tabs [role=tab]');
    expect(await tabs.count()).toBeGreaterThan(1);
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected','true');
    await expect(page.locator('.tab-pane.active')).toBeVisible();
  }
});

test('contact preserves inputs on failure and resets after confirmed success',async({page})=>{
  let ok=false;
  await page.route('**/api/contact',route=>route.fulfill({status:ok?200:502,json:ok?{ok:true,message:'Message received.'}:{error:'Please try again.'}}));
  await page.goto(route('contact'));
  const values={'mf-first-name':'Test','mf-last-name':'Visitor','mf-email':'test@example.test','mf-subject':'Test request','mf-comment':'Test message'};
  for(const [name,value]of Object.entries(values))await page.locator(`[name="${name}"]`).fill(value);
  await page.getByRole('button',{name:'Send Message',exact:true}).click();
  await expect(page.locator('#acs-contact-status')).toContainText('Please try again');
  await expect(page.locator('[name="mf-email"]')).toHaveValue(values['mf-email']);
  ok=true;
  await page.getByRole('button',{name:'Send Message',exact:true}).click();
  await expect(page.locator('#acs-contact-status')).toContainText('Message received');
  await expect(page.locator('[name="mf-email"]')).toHaveValue('');
});

test('career and partner forms retain choices, validation and submission',async({page})=>{
  const job={id:'qa-job',title:'QA Automation Engineer',status:'open',location:'Ahmedabad'};
  await page.route('**/api/public*',r=>r.fulfill({json:{jobs:[job],positions:[job],partnerCategories:['Engineering'],settings:{}}}));
  await page.route('**/api/apply',r=>r.fulfill({json:{ok:true,id:'test'}}));
  await page.route('**/api/partner',r=>r.fulfill({json:{ok:true,id:'test'}}));
  await page.goto(route('career'));
  await expect(page.locator('#acs-position-select option[value="qa-job"]')).toHaveCount(1);
  await page.locator('#acs-position-select').selectOption('qa-job');
  await page.locator('#acs-job-form [name=name]').fill('Test Visitor');
  await page.locator('#acs-job-form [name=email]').fill('test@example.test');
  await page.locator('#acs-job-form [name=phone]').fill('+919876543210');
  await page.locator('#acs-submit-btn').click();
  await expect(page.locator('#acs-form-message')).toContainText('received');
  await page.goto(route('partner-with-us'));
  await expect(page.locator('#acs-partner-category option[value="Engineering"]')).toHaveCount(1);
  await page.locator('#acs-partner-category').selectOption('Engineering');
  await page.locator('#acs-partner-form [name=name]').fill('Test Visitor');
  await page.locator('#acs-partner-form [name=email]').fill('test@example.test');
  await page.locator('#acs-add-portfolio').click();
  await expect(page.locator('[name=portfolio_url]')).toHaveCount(2);
  await page.locator('.acs-portfolio-remove').last().click();
  await expect(page.locator('[name=portfolio_url]')).toHaveCount(1);
  await page.locator('#acs-partner-submit-btn').click();
  await expect(page.locator('#acs-partner-form-message')).toContainText('received');
});

test('blog renders API content in both list and article views',async({page})=>{
  const post={title:'QA automation note',slug:'qa-note',status:'published',publishedAt:'2026-09-01',content:'<p>Verified API article body.</p>',tags:[]};
  await page.route('**/api/public*',r=>r.fulfill({json:{posts:[post],settings:{}}}));
  await page.goto(route('blog'));
  await expect(page.locator('.acs-blog-card')).toContainText(post.title);
  await page.goto(route('blog')+'?post=qa-note');
  await expect(page.locator('.acs-blog-article')).toContainText('Verified API article body.');
});
