const puppeteer = require('puppeteer');
const pages = [
  {url: 'http://localhost:3000/', out: 'melcoffee_index.png'},
  {url: 'http://localhost:3000/bingo.html', out: 'melcoffee_bingo.png'},
  {url: 'http://localhost:3000/recommend.html', out: 'melcoffee_recommend.png'},
  {url: 'http://localhost:3000/admin', out: 'melcoffee_admin.png'}
];
(async ()=>{
  const browser = await puppeteer.launch({args:['--no-sandbox','--disable-setuid-sandbox']});
  for(const p of pages){
    const page = await browser.newPage();
    await page.setViewport({width:1200,height:900});
    try{
      await page.goto(p.url, {waitUntil:'networkidle2', timeout:10000});
    }catch(e){console.error('goto error',p.url,e.message)}
    await page.screenshot({path:p.out, fullPage:true});
    console.log('Saved', p.out);
  }
  await browser.close();
})();
