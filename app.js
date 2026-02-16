const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');

const DATA_FILE = path.join(__dirname,'data','coffee.json');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname,'public')));

function readData(){
  if(!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));
}
function writeData(d){
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(d,null,2),'utf8');
}

// API: list
app.get('/api/coffee', (req,res)=>{
  res.json(readData());
});

// Recommendation endpoint
app.post('/api/recommend', (req, res) => {
  const answers = req.body || {};
  const items = readData();
  // simple scoring by matching preferences -> tag map
  // expected answers: {milk: 'light'|'normal'|'rich', strength: 'mild'|'regular'|'strong', price: 'cheap'|'mid'|'expensive', iced: true/false, vibe: 'quiet'|'trendy'|'cozy'}
  function scoreItem(item){
    let score = 0;
    const tags = (item.tags || []).map(t=>t.toLowerCase());
    if(answers.milk){
      if(answers.milk==='rich' && tags.includes('flat white')) score+=2;
      if(answers.milk==='light' && tags.includes('long black')) score+=2;
    }
    if(answers.strength){
      if(answers.strength==='strong' && tags.includes('strong')) score+=2;
      if(answers.strength==='mild' && tags.includes('smooth')) score+=2;
    }
    if(answers.price){
      if(answers.price==='cheap' && tags.includes('affordable')) score+=1;
      if(answers.price==='expensive' && tags.includes('premium')) score+=1;
    }
    if(typeof answers.iced==='boolean'){
      if(answers.iced && tags.includes('iced')) score+=1;
      if(!answers.iced && tags.includes('hot')) score+=1;
    }
    if(answers.vibe){
      if(tags.includes(answers.vibe)) score+=1;
    }
    // small popularity boost
    if(item.popularity) score += Math.min(2, item.popularity/50);
    return score;
  }
  const scored = items.map(i=>({item:i, score: scoreItem(i)}));
  scored.sort((a,b)=>b.score-a.score);
  res.json(scored.slice(0,8).map(s=>({score:s.score, item:s.item})));
});

// simple admin protect with a environment token (not secure for prod)
const session = require('express-session');
const bcrypt = require('bcrypt');

// session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'melcoffee_secret_change',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24*60*60*1000 }
}));

// admin password (plaintext in env) - hashed on startup
const ADMIN_PASSWORD = process.env.MELCOFFEE_ADMIN_PASSWORD || 'changeme';
const ADMIN_TOKEN = process.env.MELCOFFEE_ADMIN_TOKEN || 'changeme';
let ADMIN_HASH = null;
(async ()=>{ ADMIN_HASH = await bcrypt.hash(ADMIN_PASSWORD, 10); })();

function requireAdmin(req,res,next){
  // allow x-admin-token or session
  const t = req.headers['x-admin-token'] || req.query.token;
  if(t && t === ADMIN_TOKEN) return next();
  if(req.session && req.session.isAdmin) return next();
  return res.status(401).json({error:'unauthorized'});
}

// login endpoint
app.post('/api/login', async (req, res)=>{
  const pw = req.body && req.body.password;
  if(!pw) return res.status(400).json({error:'password required'});
  const ok = await bcrypt.compare(pw, ADMIN_HASH);
  if(ok){ req.session.isAdmin = true; return res.json({ok:true}); }
  return res.status(401).json({error:'invalid'});
});

// logout
app.post('/api/logout', (req,res)=>{ req.session.destroy(()=>res.json({ok:true})); });

// API: create
app.post('/api/coffee', requireAdmin, (req,res)=>{
  const entries = readData();
  const id = Date.now();
  const item = Object.assign({id}, req.body);
  entries.push(item);
  writeData(entries);
  res.json(item);
});

// API: update
app.put('/api/coffee/:id', requireAdmin, (req,res)=>{
  const id = Number(req.params.id);
  const entries = readData();
  const idx = entries.findIndex(e=>e.id===id);
  if(idx===-1) return res.status(404).json({error:'not found'});
  entries[idx] = Object.assign(entries[idx], req.body);
  writeData(entries);
  res.json(entries[idx]);
});

// API: delete
app.delete('/api/coffee/:id', requireAdmin, (req,res)=>{
  const id = Number(req.params.id);
  let entries = readData();
  entries = entries.filter(e=>e.id!==id);
  writeData(entries);
  res.json({ok:true});
});

// serve index
app.get('/', (req,res)=>{
  res.sendFile(path.join(__dirname,'public','index.html'));
});
app.get('/admin', (req,res)=>{
  res.sendFile(path.join(__dirname,'public','admin.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>{
  console.log('melcoffee app listening on', PORT);
});
