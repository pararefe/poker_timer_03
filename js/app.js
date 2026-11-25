// ===== 効果音 =====
const sound1min = new Audio('1min.mp3'), soundCount = new Audio('count.mp3'), soundLevelUp = new Audio('LevelUP.mp3');
function playSE(a){ try{ a.currentTime=0; a.play().catch(()=>{}); }catch(e){} }
// スマホ等の自動再生制限対策：最初のタップで音声を解除
document.addEventListener('click', () => {
  [sound1min, soundCount, soundLevelUp].forEach(a => { a.muted=true; a.play().then(()=>{a.pause();a.currentTime=0;a.muted=false;}).catch(()=>{a.muted=false;}); });
}, { once:true });

// ===== データ =====
const DEFAULT_PRESET = 'デフォルト (100-5000)';
let presets = { [DEFAULT_PRESET]: [
  {type:'level',sb:100,bb:200,ante:200,time:15},{type:'level',sb:200,bb:400,ante:400,time:15},
  {type:'level',sb:300,bb:600,ante:600,time:15},{type:'level',sb:400,bb:800,ante:800,time:15},
  {type:'level',sb:600,bb:1200,ante:1200,time:15},{type:'level',sb:800,bb:1600,ante:1600,time:15},
  {type:'level',sb:1000,bb:2000,ante:2000,time:15},{type:'level',sb:1500,bb:3000,ante:3000,time:15},
  {type:'break',sb:0,bb:0,ante:0,time:10},
  {type:'level',sb:2000,bb:4000,ante:4000,time:15},{type:'level',sb:2500,bb:5000,ante:5000,time:15}
]};
let activePresetKey = DEFAULT_PRESET;
let structure = clone(presets[activePresetKey]);
let editingStructure = [], selectedIndex = 0;
let tournamentInfo = { startStack:10000, totalEntries:10, playersLeft:10 };

const themeColors = {
  cyan:['シアン','#14f3ff',[20,243,255]],gold:['ゴールド','#ffb703',[255,183,3]],pink:['ピンク','#ff007f',[255,0,127]],green:['ライム','#39ff14',[57,255,20]],
  red:['レッド','#ff3333',[255,51,51]],blue:['ブルー','#0066ff',[0,102,255]],purple:['パープル','#9d00ff',[157,0,255]],orange:['オレンジ','#ff6600',[255,102,0]],
  mint:['ミント','#00ffaa',[0,255,170]],magenta:['マゼンタ','#ff00aa',[255,0,170]],amber:['アンバー','#ffcc00',[255,204,0]],violet:['バイオレット','#7f00ff',[127,0,255]],
  teal:['ティール','#00e5ff',[0,229,255]],coral:['コーラル','#ff5555',[255,85,85]],ice:['アイス','#e0ffff',[224,255,255]],emerald:['エメラルド','#50c878',[80,200,120]],
  acid:['アシッド','#ccff00',[204,255,0]],blood:['ブラッド','#ff2400',[255,36,0]],lavender:['ラベンダー','#b57edc',[181,126,220]],matrix:['マトリックス','#00ff41',[0,255,65]]
};
const fontList = [
  ['Shippori Mincho','serif','高級明朝体'],['Orbitron','sans-serif','SFデジタル'],['Share Tech Mono','monospace','レトロ'],['VT323','monospace','ドット絵風'],
  ['Press Start 2P','cursive','8bit'],['Michroma','sans-serif','ワイドSF'],['Iceland','cursive','サイバーポップ'],['Wallpoet','cursive','未来派ステンシル'],
  ['Zen Dots','cursive','未来系フラット'],['Space Grotesk','sans-serif','近未来モダン'],['Rajdhani','sans-serif','モダン'],['Chakra Petch','sans-serif','ミリタリー'],
  ['Teko','sans-serif','ウルトラ縦長'],['Fira Code','monospace','等幅コード'],['Russo One','sans-serif','極太'],['Montserrat','sans-serif','モダン角'],
  ['M PLUS 1p','sans-serif','太角ゴシック'],['M PLUS Rounded 1c','sans-serif','丸ゴシック'],['Oswald','sans-serif','縦長太字'],['Bebas Neue','cursive','スタイリッシュ縦長'],
  ['Anton','sans-serif','重厚インパクト'],['Righteous','cursive','レトロフューチャー'],['Saira Stencil One','cursive','極太ステンシル'],['Graduate','cursive','カレッジカジノ'],
  ['Cinzel','serif','カジノ古典'],['Permanent Marker','cursive','手書きマーカー'],['Nico Moji','cursive','ニコモジ・ポップ'],['Dela Gothic One','cursive','極太ゴシック'],
  ['Yuji Syuku','serif','伝統書体'],[null,'sans-serif','System Default (標準)']
];
const fontCss = f => f[0] ? `'${f[0]}', ${f[1]}` : f[1];
let designConfig = { colorKey:'cyan', customGlowHex:'#14f3ff', font:"'Shippori Mincho', serif", glow:0.1, blindColor:'#ffb703', timerColor:'#ffffff', subColor:'#7a8b9e' };
let designSnapshot = null;

// ===== タイマー状態 =====
let currentLevelIdx = 0;
let timeLeft = structure[0].time * 60;   // 残り秒（小数あり）
let totalTime = timeLeft;
let endTimestamp = 0;                    // 終了予定の絶対時刻(ms)。裏タブでも狂わない
let tickInterval = null;
let lastPlayedSecond = null;
let oneMinPlayed = false;   // 1分前SEをそのレベルで鳴らしたか
let isRunning = false;
let isViewerMode = false;
let peer = null, connections = [], lastBroadcast = 0, viewerTimer = null, wakeLock = null;

const $ = id => document.getElementById(id);
const circleBar = document.querySelector('.progress-ring__circle_bar');
const circumference = circleBar.r.baseVal.value * 2 * Math.PI;
circleBar.style.strokeDasharray = `${circumference} ${circumference}`;
function clone(o){ return JSON.parse(JSON.stringify(o)); }

// ===== 保存/復元（リロード対策） =====
function persist(){
  if (isViewerMode) return;
  try {
    localStorage.setItem('pokerTimerState', JSON.stringify({ presets, activePresetKey, structure, tournamentInfo, designConfig, currentLevelIdx, timeLeft: currentTimeLeft() }));
  } catch(e){}
}
function restore(){
  try {
    const s = JSON.parse(localStorage.getItem('pokerTimerState') || 'null');
    if (!s || !s.structure || !s.structure.length) return;
    presets = s.presets || presets; activePresetKey = s.activePresetKey in presets ? s.activePresetKey : Object.keys(presets)[0];
    structure = s.structure; tournamentInfo = s.tournamentInfo || tournamentInfo; designConfig = Object.assign(designConfig, s.designConfig || {});
    currentLevelIdx = Math.min(s.currentLevelIdx || 0, structure.length - 1);
    totalTime = structure[currentLevelIdx].time * 60;
    timeLeft = Math.min(s.timeLeft ?? totalTime, totalTime);
  } catch(e){}
}
function currentTimeLeft(){ return tickInterval ? Math.max(0, (endTimestamp - Date.now())/1000) : timeLeft; }

// ===== デザイン =====
function hexToRgba(hex,a){ let c=hex.replace('#',''); if(c.length===3)c=c.split('').map(x=>x+x).join(''); const n=parseInt(c,16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }
function hexToRgbArray(hex){ let c=hex.replace('#',''); if(c.length===3)c=c.split('').map(x=>x+x).join(''); const n=parseInt(c,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(x=>parseInt(x).toString(16).padStart(2,'0')).join(''); }
function applyDesign(){
  const s = document.documentElement.style, g = designConfig.customGlowHex || '#14f3ff';
  s.setProperty('--cyan-glow', g); s.setProperty('--cyan-dim', hexToRgba(g,.25));
  s.setProperty('--timer-font', designConfig.font); s.setProperty('--glow-intensity', designConfig.glow);
  s.setProperty('--gold-accent', designConfig.blindColor); s.setProperty('--timer-text-color', designConfig.timerColor); s.setProperty('--text-sub', designConfig.subColor);
}
function initColorPalette(){
  const grid = $('color-palette'); grid.innerHTML = '';
  Object.entries(themeColors).forEach(([key,[name,glow]]) => {
    const box = document.createElement('div');
    box.className = 'color-box' + (key===designConfig.colorKey ? ' active':''); box.style.backgroundColor = glow; box.title = name;
    box.onclick = () => {
      designConfig.colorKey = key; designConfig.customGlowHex = glow;
      const [r,g,b] = themeColors[key][2]; $('rgb-r').value=r; $('rgb-g').value=g; $('rgb-b').value=b;
      document.querySelectorAll('.color-box').forEach(x=>x.classList.remove('active')); box.classList.add('active'); updateLivePreview();
    };
    grid.appendChild(box);
  });
}
function onRGBChange(){
  designConfig.customGlowHex = rgbToHex($('rgb-r').value,$('rgb-g').value,$('rgb-b').value);
  document.querySelectorAll('.color-box').forEach(b=>b.classList.remove('active')); updateLivePreview();
}
function toggleAccordion(){ const o = $('accordion-body').classList.toggle('open'); $('accordion-arrow').textContent = o ? '▲':'▼'; }
function updateLivePreview(){
  designConfig.font = $('setting-timer-font').value;
  designConfig.glow = parseFloat($('setting-glow-intensity').value) || 0.1;
  designConfig.blindColor = $('custom-blind-color').value; designConfig.timerColor = $('custom-timer-color').value; designConfig.subColor = $('custom-sub-color').value;
  $('glow-val-text').textContent = Math.round(designConfig.glow*100) + '%';
  applyDesign();
}

// ===== 表示 =====
function setProgress(p){ circleBar.style.strokeDashoffset = circumference * (1 - Math.min(1, Math.max(0, p))); }
function getLevelLabel(idx, st = structure){
  if (st[idx].type === 'break') return 'BREAK';
  let n = 0; for (let i=0;i<=idx;i++) if (st[i].type==='level') n++;
  return `LEVEL ${n}`;
}
function formatBlinds(item){
  if (item.type==='break') return { line1:'BREAK TIME', line2:'' };
  return { line1:`SB ${(item.sb||0).toLocaleString()} / BB ${(item.bb||0).toLocaleString()}`, line2: item.ante>0 ? `ANTE ${item.ante.toLocaleString()}` : '' };
}
function calculateTotalStructureTime(st = structure){
  const t = st.reduce((a,c)=>a+(parseInt(c.time)||0),0), h = Math.floor(t/60), m = t%60;
  return h>0 ? `${h}時間${m}分` : `${m}分`;
}
function fmtHMS(sec){
  const h=Math.floor(sec/3600), m=Math.floor(sec%3600/60), s=sec%60, p=n=>String(n).padStart(2,'0');
  return h>0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}
function updateDisplay(exact = timeLeft){
  const cur = structure[currentLevelIdx] || structure[0];
  const ds = Math.ceil(exact);
  $('time-minutes').textContent = String(Math.floor(ds/60)).padStart(2,'0');
  $('time-seconds').textContent = String(ds%60).padStart(2,'0');
  $('level-display').textContent = getLevelLabel(currentLevelIdx);
  const f = formatBlinds(cur);
  $('timer-sb-bb').textContent = f.line1; $('timer-ante').textContent = f.line2; $('timer-ante').style.display = f.line2 ? 'block':'none';

  const total = tournamentInfo.startStack * tournamentInfo.totalEntries;
  $('players-left-display').textContent = tournamentInfo.playersLeft;
  $('total-entries-display').textContent = tournamentInfo.totalEntries;
  $('avg-stack-display').textContent = tournamentInfo.playersLeft > 0 ? Math.floor(total / tournamentInfo.playersLeft).toLocaleString() : '0';

  const nb = $('next-blind-display');
  if (currentLevelIdx < structure.length-1) {
    const n = structure[currentLevelIdx+1];
    if (n.type==='break') nb.innerHTML = `<div>BREAK (${n.time}m)</div>`;
    else { const nf = formatBlinds(n); nb.innerHTML = `<div>${nf.line1}</div>${nf.line2 ? `<div class="next-ante">${nf.line2}</div>`:''}`; }
  } else nb.innerHTML = '<div>-</div>';

  // 次の休憩まで（休憩中は「その次」の休憩ではなく現在表示）
  const nbk = $('next-break-display');
  if (cur.type==='break') nbk.textContent = 'NOW BREAK';
  else {
    let bi = -1; for (let i=currentLevelIdx+1;i<structure.length;i++) if (structure[i].type==='break'){ bi=i; break; }
    if (bi === -1) nbk.textContent = 'None';
    else { let s = Math.max(0, ds); for (let i=currentLevelIdx+1;i<bi;i++) s += structure[i].time*60; nbk.textContent = fmtHMS(s); }
  }
  setProgress(totalTime > 0 ? exact/totalTime : 0);

  // 共有送信は1秒に1回に間引く（毎フレーム送信は重い）
  if (!isViewerMode && Date.now() - lastBroadcast > 1000) broadcastState();
}

function changePlayersLeft(d){
  if (isViewerMode) return;
  const n = tournamentInfo.playersLeft + d;
  if (n >= 0 && n <= tournamentInfo.totalEntries){ tournamentInfo.playersLeft = n; updateDisplay(currentTimeLeft()); broadcastState(); persist(); }
}
function changeTotalEntries(d){
  if (isViewerMode) return;
  const n = tournamentInfo.totalEntries + d;
  if (n >= 1){ tournamentInfo.totalEntries = n; if (tournamentInfo.playersLeft > n) tournamentInfo.playersLeft = n; updateDisplay(currentTimeLeft()); broadcastState(); persist(); }
}

// ===== 通信 =====
// 同一Wi-Fi外(モバイル回線など)でも繋がるようSTUN+TURNを指定
const PEER_OPTS = { config: { iceServers: [
  {urls:'stun:stun.l.google.com:19302'}, {urls:'stun:global.stun.twilio.com:3478'},
  {urls:'turn:openrelay.metered.ca:80', username:'openrelayproject', credential:'openrelayproject'},
  {urls:'turn:openrelay.metered.ca:443', username:'openrelayproject', credential:'openrelayproject'},
  {urls:'turn:openrelay.metered.ca:443?transport=tcp', username:'openrelayproject', credential:'openrelayproject'}
] } };
function updateViewerCount(){ const e=$('share-viewers'); if(e) e.textContent = `接続中の子機: ${connections.filter(c=>c.open).length}台`; }

function setupHostPeer(id){
  peer = id ? new Peer(id, PEER_OPTS) : new Peer(PEER_OPTS);
  peer.on('open', pid => { try{ localStorage.setItem('pokerTimerHostId', pid); }catch(e){} });
  peer.on('connection', conn => {
    connections.push(conn);
    conn.on('open', () => { broadcastState(); updateViewerCount(); });
    conn.on('close', () => { connections = connections.filter(c => c !== conn); updateViewerCount(); });
    conn.on('error', () => { connections = connections.filter(c => c !== conn); updateViewerCount(); });
  });
  peer.on('disconnected', () => { try{ peer.reconnect(); }catch(e){} });
  peer.on('error', e => { if (e.type === 'unavailable-id') { peer.destroy(); setupHostPeer(null); } });
}
function broadcastState(){
  lastBroadcast = Date.now();
  connections = connections.filter(c => c.open);
  if (!connections.length) return;
  const state = { structure, tournamentInfo, currentLevelIdx, timeLeft: currentTimeLeft(), totalTime, designConfig, isRunning };
  connections.forEach(c => c.send(state));
}
let viewerLastData = 0, viewerConn = null, viewerOpen = null;
function setStatus(t, ok){ const e=$('viewer-status'); if(!e) return; e.style.display='block'; e.textContent=t; e.style.color = ok ? '#2ed573' : '#ff9f43'; }
function connectViewer(hostId){
  setStatus('接続中…', false);
  viewerOpen = () => {
    if (viewerConn) { try{ viewerConn.close(); }catch(e){} }
    const conn = peer.connect(hostId, { reliable:true });
    viewerConn = conn;
    conn.on('data', data => {
      viewerLastData = Date.now(); setStatus('● LIVE', true);
      structure = data.structure; tournamentInfo = data.tournamentInfo; currentLevelIdx = data.currentLevelIdx; totalTime = data.totalTime;
      if (data.designConfig){ designConfig = data.designConfig; applyDesign(); }
      clearInterval(viewerTimer);
      const end = Date.now() + data.timeLeft*1000;
      if (data.isRunning) viewerTimer = setInterval(() => updateDisplay(Math.max(0,(end-Date.now())/1000)), 100);
      updateDisplay(data.timeLeft);
    });
    conn.on('close', () => { if (viewerConn !== conn) return; setStatus('切断 - 再接続中…', false); setTimeout(viewerOpen, 3000); });
  };
  peer = new Peer(PEER_OPTS);
  peer.on('open', () => viewerOpen());
  peer.on('disconnected', () => { try{ peer.reconnect(); }catch(e){} });
  peer.on('error', e => {
    setStatus(e.type === 'peer-unavailable' ? '本体に接続できません(本体が開いているか確認) 再試行中…' : '接続エラー: ' + e.type + ' 再試行中…', false);
    setTimeout(() => { if (peer.destroyed || peer.disconnected) { try{ peer.destroy(); }catch(x){} connectViewer(hostId); } else viewerOpen(); }, 4000);
  });
  if (!window._viewerWatchdog) window._viewerWatchdog = setInterval(() => {   // 10秒更新がなければ再接続
    if (viewerLastData && Date.now() - viewerLastData > 10000){ setStatus('更新待ち…', false); viewerLastData = Date.now(); if (peer && peer.open) viewerOpen(); }
  }, 5000);
}

window.addEventListener('DOMContentLoaded', () => {
  const hostId = new URLSearchParams(location.search).get('host');
  if (hostId){ isViewerMode = true; document.body.classList.add('view-only-mode'); connectViewer(hostId); }
  else { restore(); let id = null; try{ id = localStorage.getItem('pokerTimerHostId'); }catch(e){} setupHostPeer(id); setInterval(broadcastState, 3000); }
  buildFontOptions(); applyDesign(); updateDisplay(timeLeft); updateButton();
});
window.addEventListener('click', e => {
  if (e.target === $('settings-modal')) closeSettings();
  if (e.target === $('share-modal')) $('share-modal').style.display = 'none';
});
window.addEventListener('beforeunload', persist);
document.addEventListener('visibilitychange', () => { if (!document.hidden && isRunning) requestWakeLock(); });

// キーボード操作：Space=開始/停止, ←/→=レベル移動
document.addEventListener('keydown', e => {
  if (isViewerMode || e.target.matches('input,select,textarea')) return;
  if ($('settings-modal').style.display === 'flex') return;
  if (e.code === 'Space'){ e.preventDefault(); toggleTimer(); }
  else if (e.code === 'ArrowRight') nextLevel();
  else if (e.code === 'ArrowLeft') prevLevel();
});

// ===== タイマー進行（終了時刻ベース） =====
function tick(){
  const exact = Math.max(0, (endTimestamp - Date.now())/1000);
  timeLeft = exact;
  const sec = Math.ceil(exact);
  if (sec !== lastPlayedSecond){
    if (sec === 3) playSE(soundCount);
    lastPlayedSecond = sec;
  }
  // ブラインドアップ1分前の告知SE（1min.mp3）。レベルごとに1回だけ
  if (exact <= 60 && exact > 0 && !oneMinPlayed && totalTime > 60){ oneMinPlayed = true; playSE(sound1min); }
  updateDisplay(exact);
  if (exact <= 0){
    playSE(soundLevelUp);
    if (currentLevelIdx < structure.length - 1){
      currentLevelIdx++;
      totalTime = structure[currentLevelIdx].time * 60; timeLeft = totalTime;
      endTimestamp = Date.now() + totalTime*1000; lastPlayedSecond = null; oneMinPlayed = false;
      updateDisplay(timeLeft); broadcastState(); persist();
    } else { pauseTimer(); isRunning = false; updateButton(); broadcastState(); persist(); }
  }
}
function startTimer(){
  if (tickInterval || isViewerMode) return;
  totalTime = structure[currentLevelIdx].time * 60;
  endTimestamp = Date.now() + timeLeft*1000;
  oneMinPlayed = timeLeft <= 60;   // 残り1分以内から再開した場合は鳴らさない
  tickInterval = setInterval(tick, 100);
  requestWakeLock();
}
function pauseTimer(){
  if (tickInterval){ timeLeft = Math.max(0,(endTimestamp-Date.now())/1000); clearInterval(tickInterval); tickInterval = null; }
  if (wakeLock){ wakeLock.release().catch(()=>{}); wakeLock = null; }
}
async function requestWakeLock(){ try{ if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); }catch(e){} }
function updateButton(){
  if (isViewerMode) return;
  const b = $('start-stop-btn');
  b.textContent = isRunning ? 'PAUSE' : (timeLeft < totalTime ? 'RESUME' : 'START');
  b.classList.toggle('running', isRunning);
}
function toggleTimer(){
  if (isViewerMode) return;
  if (isRunning){ pauseTimer(); isRunning = false; } else { startTimer(); isRunning = true; }
  updateButton(); updateDisplay(currentTimeLeft()); broadcastState(); persist();
}
function setLevel(idx, keepRunning = false){
  if (isViewerMode) return;
  const was = isRunning;
  pauseTimer(); isRunning = false;
  currentLevelIdx = idx; timeLeft = structure[idx].time*60; totalTime = timeLeft; lastPlayedSecond = null;
  if (keepRunning && was){ startTimer(); isRunning = true; }
  updateDisplay(timeLeft); updateButton(); broadcastState(); persist();
}
function nextLevel(){ if (currentLevelIdx < structure.length-1) { playSE(soundLevelUp); setLevel(currentLevelIdx+1, true); } }
function prevLevel(){ if (currentLevelIdx > 0) setLevel(currentLevelIdx-1, true); }
function resetTimer(){ setLevel(0); }

// ===== 設定画面 =====
function buildFontOptions(){
  const sel = $('setting-timer-font'); sel.innerHTML = '';
  fontList.forEach((f,i) => { const o = document.createElement('option'); o.value = fontCss(f); o.textContent = `${String(i+1).padStart(2,'0')}. ${f[0] || ''} ${f[2]}`.replace('  ',' '); if (f[0]) o.style.fontFamily = `'${f[0]}'`; sel.appendChild(o); });
}
function switchTab(id, btn){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active'); $(id).classList.add('active');
}
function renderPresetDropdown(){
  const sel = $('preset-select'); sel.innerHTML = '';
  Object.keys(presets).forEach(k => { const o = document.createElement('option'); o.value = o.textContent = k; o.selected = k === activePresetKey; sel.appendChild(o); });
}
function loadSelectedPreset(){ activePresetKey = $('preset-select').value; editingStructure = clone(presets[activePresetKey]); selectedIndex = 0; renderBlindsList(); }
function saveAsNewPreset(){
  const name = prompt('保存するプリセット名を入力してください:', 'カスタム設定 ' + (Object.keys(presets).length + 1));
  if (!name) return;
  presets[name] = clone(editingStructure); activePresetKey = name; renderPresetDropdown(); persist();
}
function deletePreset(){
  if (Object.keys(presets).length <= 1){ alert('プリセットは最低1つ残す必要があります。'); return; }
  if (confirm(`プリセット「${activePresetKey}」を削除しますか？`)){
    delete presets[activePresetKey]; activePresetKey = Object.keys(presets)[0]; renderPresetDropdown(); loadSelectedPreset(); persist();
  }
}
// 一覧のみ再描画（入力中の欄を上書きしないため詳細パネルとは分離）
function renderListOnly(){
  const c = $('blinds-list-scroll'), sc = c.scrollTop; c.innerHTML = '';
  $('total-structure-time-text').textContent = calculateTotalStructureTime(editingStructure);
  editingStructure.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'blind-card' + (item.type==='break' ? ' break-card':'') + (i===selectedIndex ? ' active':'');
    card.onclick = () => { selectedIndex = i; renderBlindsList(); };
    card.innerHTML = `<span class="blind-card-title">${getLevelLabel(i, editingStructure)}</span><span class="blind-card-info">${item.type==='break' ? item.time+'分' : `${item.sb.toLocaleString()}/${item.bb.toLocaleString()} (${item.time}分)`}</span>`;
    c.appendChild(card);
  });
  c.scrollTop = sc;
}
function renderBlindsList(){ renderListOnly(); renderDetailPanel(); }
const calcStep = sb => (sb/100 >= 20) ? 500 : 100;
function updateStepAttributes(sb){
  const s = calcStep(sb); $('detail-sb').step = s; $('detail-bb').step = s*2; $('detail-ante').step = s*2; $('sb-step-hint').textContent = `(ステップ: ${s})`;
}
function renderDetailPanel(){
  const panel = $('blind-detail-panel');
  if (!editingStructure.length){ panel.style.display = 'none'; return; }
  panel.style.display = 'flex';
  const item = editingStructure[selectedIndex];
  $('detail-title').textContent = getLevelLabel(selectedIndex, editingStructure);
  const isBreak = item.type === 'break';
  ['group-sb','group-bb','group-ante'].forEach(id => $(id).style.display = isBreak ? 'none':'flex');
  if (!isBreak){ $('detail-sb').value = item.sb; $('detail-bb').value = item.bb; $('detail-ante').value = item.ante; updateStepAttributes(item.sb); }
  $('detail-time').value = item.time;
}
// 入力ハンドラは1回だけ登録。選択中の行を都度参照する
function initDetailInputs(){
  const cur = () => editingStructure[selectedIndex];
  $('detail-sb').oninput = e => {
    const it = cur(); if (!it) return;
    const sb = parseInt(e.target.value) || 0; it.sb = sb; it.bb = sb*2; it.ante = sb*2;
    $('detail-bb').value = it.bb; $('detail-ante').value = it.ante; updateStepAttributes(sb); renderListOnly();
  };
  $('detail-bb').oninput = e => { const it = cur(); if (it){ it.bb = parseInt(e.target.value) || 0; renderListOnly(); } };
  $('detail-ante').oninput = e => { const it = cur(); if (it){ it.ante = parseInt(e.target.value) || 0; renderListOnly(); } };
  $('detail-time').oninput = e => { const it = cur(), v = parseInt(e.target.value); if (it && v > 0){ it.time = v; renderListOnly(); } };
  $('detail-time').onblur = () => { const it = cur(); if (it) $('detail-time').value = it.time; };
}
initDetailInputs();

function moveSelectedRow(d){
  const n = selectedIndex + d; if (n < 0 || n >= editingStructure.length) return;
  [editingStructure[selectedIndex], editingStructure[n]] = [editingStructure[n], editingStructure[selectedIndex]]; selectedIndex = n; renderBlindsList();
}
function deleteSelectedRow(){
  if (editingStructure.length <= 1){ alert('最低1つのレベルは必要です。'); return; }
  editingStructure.splice(selectedIndex, 1); selectedIndex = Math.min(selectedIndex, editingStructure.length-1); renderBlindsList();
}
function addLevelRow(isBreak = false){
  const lastTime = editingStructure.length ? editingStructure[editingStructure.length-1].time : 15;
  if (isBreak) editingStructure.push({type:'break',sb:0,bb:0,ante:0,time:10});
  else {
    let lastSB = 100; editingStructure.forEach(i => { if (i.type==='level') lastSB = i.sb; });
    const nsb = lastSB + calcStep(lastSB);
    editingStructure.push({type:'level',sb:nsb,bb:nsb*2,ante:nsb*2,time:lastTime});
  }
  selectedIndex = editingStructure.length - 1; renderBlindsList();
}
function openSettings(){
  designSnapshot = clone(designConfig);
  renderPresetDropdown(); editingStructure = clone(structure); selectedIndex = 0; renderBlindsList();
  $('setting-start-stack').value = tournamentInfo.startStack; $('setting-total-entries').value = tournamentInfo.totalEntries;
  initColorPalette();
  $('setting-timer-font').value = designConfig.font; $('setting-glow-intensity').value = designConfig.glow ?? 0.1;
  const rgb = hexToRgbArray(designConfig.customGlowHex || '#14f3ff'); $('rgb-r').value = rgb[0]; $('rgb-g').value = rgb[1]; $('rgb-b').value = rgb[2];
  $('custom-blind-color').value = designConfig.blindColor; $('custom-timer-color').value = designConfig.timerColor; $('custom-sub-color').value = designConfig.subColor;
  updateLivePreview();
  $('settings-modal').style.display = 'flex';
}
function closeSettings(){
  // 保存せず閉じた場合はデザインを元に戻す
  if (designSnapshot){ designConfig = designSnapshot; designSnapshot = null; applyDesign(); }
  $('settings-modal').style.display = 'none';
}
function showFlashNotice(){ const n = $('flash-notice'); n.style.opacity = '1'; setTimeout(() => n.style.opacity = '0', 1500); }
function saveSettings(){
  presets[activePresetKey] = clone(editingStructure);
  let stack = Math.round((parseInt($('setting-start-stack').value) || 10000) / 5000) * 5000; if (stack < 0) stack = 0;
  const entries = Math.max(1, parseInt($('setting-total-entries').value) || 10);
  if (tournamentInfo.playersLeft > entries) tournamentInfo.playersLeft = entries;
  tournamentInfo.startStack = stack; tournamentInfo.totalEntries = entries;
  designSnapshot = null; applyDesign();
  const changed = JSON.stringify(structure) !== JSON.stringify(editingStructure);
  structure = clone(editingStructure);
  $('settings-modal').style.display = 'none';
  if (changed) setLevel(0); else { updateDisplay(currentTimeLeft()); broadcastState(); persist(); }
  showFlashNotice();
}

// ===== JSON / Excel =====
function exportConfig(){
  presets[activePresetKey] = clone(editingStructure);
  const blob = new Blob([JSON.stringify({ presets, activePresetKey, tournamentInfo, designConfig }, null, 2)], { type:'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `poker_timer_config_${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function handleImportFile(event){
  const file = event.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    try {
      const d = JSON.parse(e.target.result);
      if (!(d.presets && d.tournamentInfo && d.designConfig)){ alert('ファイル形式が正しくありません。'); return; }
      presets = d.presets; activePresetKey = d.activePresetKey in presets ? d.activePresetKey : Object.keys(presets)[0];
      tournamentInfo = d.tournamentInfo; designConfig = Object.assign(designConfig, d.designConfig);
      structure = clone(presets[activePresetKey]); designSnapshot = null;
      $('settings-modal').style.display = 'none';
      applyDesign(); setLevel(0); showFlashNotice(); alert('設定の読み込みが完了しました！');
    } catch(err){ alert('JSONファイルの読み込みに失敗しました: ' + err.message); }
  };
  r.readAsText(file); event.target.value = '';
}
function exportBlindsToExcel(){
  if (!editingStructure.length){ alert('出力するブラインドデータがありません。'); return; }
  const data = [['タイプ','SB','BB','ANTE','時間(分)']];
  editingStructure.forEach(i => { const b = i.type==='break'; data.push([i.type, b?0:i.sb, b?0:i.bb, b?0:i.ante, i.time]); });
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), 'Blinds');
  XLSX.writeFile(wb, `blinds_${activePresetKey.replace(/[^a-zA-Z0-9あ-んア-ンー-龠]/g,'_')}.xlsx`);
}
function handleExcelImport(event){
  const file = event.target.files[0]; if (!file) return;
  const r = new FileReader();
  r.onload = e => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type:'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header:1 });
      if (rows.length < 2){ alert('データが見つかりませんでした。ヘッダー行＋1行以上のデータが必要です。'); return; }
      const ns = [];
      for (let i=1;i<rows.length;i++){
        const row = rows[i]; if (!row || !row.length) continue;
        const t = String(row[0] || '').toLowerCase().trim();
        const time = parseInt(row[4]) > 0 ? parseInt(row[4]) : 15;
        if (t === 'break' || t === '休憩') ns.push({type:'break',sb:0,bb:0,ante:0,time});
        else {
          const sb = parseInt(row[1]) || 0, bbRaw = parseInt(row[2]), anteRaw = parseInt(row[3]);
          ns.push({type:'level', sb, bb: isNaN(bbRaw) ? sb*2 : bbRaw, ante: isNaN(anteRaw) ? sb*2 : anteRaw, time});   // 旧: NaNになる不具合を修正
        }
      }
      if (!ns.length){ alert('有効なブラインドデータがインポートできませんでした。'); return; }
      editingStructure = ns; selectedIndex = 0; renderBlindsList(); alert('Excelからブラインド設定を読み込みました！');
    } catch(err){ alert('Excelファイルの読み込みに失敗しました: ' + err.message); }
  };
  r.readAsArrayBuffer(file); event.target.value = '';
}

// ===== 共有URL =====
function generateViewerURL(){
  if (!peer || !peer.id){ alert('通信初期化中です。数秒待ってからもう一度お試しください。'); return; }
  let base = ''; try{ base = localStorage.getItem('pokerTimerBaseUrl') || ''; }catch(e){}
  if (!base) base = location.href.split('?')[0].split('#')[0];
  $('share-base-input').value = base;
  updateViewerCount(); renderShare();
  $('share-modal').style.display = 'flex';
}
function renderShare(){
  const typed = $('share-base-input').value.trim();
  try{ localStorage.setItem('pokerTimerBaseUrl', typed); }catch(e){}
  const base = typed || location.href.split('?')[0].split('#')[0];   // 未入力でも必ずQRを表示
  const qr = $('qrcode-display'); qr.innerHTML = '';
  const warn = $('share-warn');
  const url = `${base}${base.includes('?') ? '&' : '?'}host=${peer.id}`;
  $('share-url-input').value = url;
  warn.textContent = /^(file:|https?:\/\/(localhost|127\.|0\.0\.0\.0))/i.test(base)
    ? '⚠ このURLはスマホからは開けません。PCのIPアドレス(例 http://192.168.x.x:8000/index.html)か、公開したhttps URLを入力してください。' : '';
  if (typeof QRCode === 'undefined'){ qr.textContent = 'QRコードを生成できません(ライブラリ読込失敗)。下のURLをスマホに送って開いてください。'; qr.style.color = '#000'; return; }
  new QRCode(qr, { text:url, width:240, height:240, colorDark:'#0a0d12', colorLight:'#ffffff', correctLevel:QRCode.CorrectLevel.M });
}
function copyShareUrl(){
  const inp = $('share-url-input'); if (!inp.value) return;
  const done = () => { const m = $('copy-status-msg'); m.style.opacity = '1'; setTimeout(() => m.style.opacity = '0', 2000); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(done).catch(() => { inp.select(); document.execCommand('copy'); done(); });
  else { inp.select(); document.execCommand('copy'); done(); }
}

// ===== Service Worker（PWA・オフライン対応。https/localhostのみ有効） =====
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
