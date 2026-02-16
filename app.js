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

// simple admin protect with a environment token (not secure for prod)
const ADMIN_TOKEN = process.env.MELCOFFEE_ADMIN_TOKEN || 'changeme';
function requireAdmin(req,res,next){
  const t = req.headers['x-admin-token'] || req.query.token;
  if(t !== ADMIN_TOKEN) return res.status(401).json({error:'unauthorized'});
  next();
}

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
