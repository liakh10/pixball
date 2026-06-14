/* ====================================================================
   $PIXBALL — pixel football engine (vanilla canvas)
   ==================================================================== */
(() => {
  const cv = document.getElementById("game");
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const W = cv.width, H = cv.height;

  // ---- field constants ----
  const GOAL_X1 = 125, GOAL_X2 = 235;
  const PR = 15, KR = 16, BR = 7;
  const TOP_GOAL = { x: 180, y: -16 };   // you attack here
  const BOT_GOAL = { x: 180, y: 556 };   // cpu attacks here

  // ---- tuning ----
  const SPD_YOU = 2.45, SPD_AI = 1.15, SPD_KEEP = 1.55;
  const FRIC = 0.968;
  const DRIBBLE = 2.5, KICK = 6.2, AI_KICK = 1.7, KEEP_CLEAR = 3.6;
  const BALL_MAX = 6.4;
  // CPU react delay: AI only updates target every N frames
  const AI_REACT = 18;

  // ---- state ----
  let scoreYou = 0, scoreCpu = 0;
  let state = "menu";            // menu | play | celebrate
  let celebrateT = 0, frame = 0;
  let teamName = "YOU";

  const ball = { x: W/2, y: H/2, vx: 0, vy: 0 };

  function mk(x, y, team, role){ return { x, y, vx:0, vy:0, team, role, run:0, face:1 }; }
  let players = [];
  function formation(){
    players = [
      mk(W/2, H-70,  "you", "out"),   // YOU (index 0)
      mk(110, H-150, "you", "out"),   // teammate
      mk(W/2, H-26,  "you", "keep"),
      mk(W/2, 96,    "cpu", "out"),
      mk(250, 170,   "cpu", "out"),
      mk(W/2, 26,    "cpu", "keep"),
    ];
  }
  const YOU = () => players[0];

  // commentary
  const goalLines = {
    you:["GOLAZO.","the keeper was thinking about lunch.","that net never saw it coming.","nutmeg. somewhere a blob wept.","keeper: 0 reflexes, 100 vibes.","top bins. no notes."],
    cpu:["the CPU did that. embarrassing for you.","you watched it happen. live.","your keeper waved it in.","conceded. happens to legends too. allegedly.","the blobs are laughing at you."]
  };
  const kickLines = ["kick off.","game on.","ball is rolling.","here we go.","second ball, same blobs."];
  function say(t){ document.getElementById("commentary").textContent = t; }
  function rand(a){ return a[Math.floor(Math.random()*a.length)]; }

  function kickoff(firstTouch){
    formation(); cpuTargets = {};
    ball.x = W/2; ball.y = H/2; ball.vx = 0;
    // nudge ball toward whoever should get possession
    ball.vy = firstTouch === "you" ? 1.3 : -1.3;
    say(rand(kickLines));
  }

  // ===================== INPUT =====================
  const keys = {};
  addEventListener("keydown", e => {
    keys[e.key.toLowerCase()] = true;
    if ([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(e.key.toLowerCase())) e.preventDefault();
  });
  addEventListener("keyup", e => { keys[e.key.toLowerCase()] = false; });

  const joy = { active:false, dx:0, dy:0 };
  function moveAxis(){
    let x=0,y=0;
    if (keys["a"]||keys["arrowleft"])  x-=1;
    if (keys["d"]||keys["arrowright"]) x+=1;
    if (keys["w"]||keys["arrowup"])    y-=1;
    if (keys["s"]||keys["arrowdown"])  y+=1;
    if (joy.active){ x+=joy.dx; y+=joy.dy; }
    const m = Math.hypot(x,y);
    return m>1 ? {x:x/m, y:y/m, m:1} : {x, y, m};
  }
  let kickHeld = false;
  function kickPressed(){ return keys[" "]||keys["j"]||kickHeld; }

  // touch
  const stick = document.getElementById("stick");
  const nub = document.getElementById("nub");
  const kickBtn = document.getElementById("kick");
  const touchWrap = document.getElementById("touch");
  if ("ontouchstart" in window || navigator.maxTouchPoints>0) touchWrap.classList.add("on");
  function stickMove(e){
    const t = e.touches ? e.touches[0] : e;
    const r = stick.getBoundingClientRect();
    let dx = t.clientX - (r.left+r.width/2), dy = t.clientY - (r.top+r.height/2);
    const max=r.width/2, m=Math.hypot(dx,dy)||1, cl=Math.min(m,max);
    dx=dx/m*cl; dy=dy/m*cl;
    nub.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joy.dx=dx/max; joy.dy=dy/max;
  }
  function stickEnd(){ joy.active=false; joy.dx=0; joy.dy=0; nub.style.transform="translate(-50%,-50%)"; }
  stick.addEventListener("touchstart",e=>{e.preventDefault();joy.active=true;stickMove(e);},{passive:false});
  stick.addEventListener("touchmove", e=>{e.preventDefault();stickMove(e);},{passive:false});
  stick.addEventListener("touchend",  e=>{e.preventDefault();stickEnd();},{passive:false});
  kickBtn.addEventListener("touchstart",e=>{e.preventDefault();kickHeld=true;},{passive:false});
  kickBtn.addEventListener("touchend",  e=>{e.preventDefault();kickHeld=false;},{passive:false});

  // ===================== AUDIO =====================
  let AC=null, sndOn=true;
  const sndBtn = document.getElementById("snd");
  function ac(){ if(!AC){ try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){} } return AC; }
  function beep(freq,dur,type="square",vol=.06){
    if(!sndOn||!ac())return;
    const o=AC.createOscillator(),g=AC.createGain();
    o.type=type;o.frequency.value=freq;g.gain.value=vol;
    o.connect(g);g.connect(AC.destination);
    o.start();g.gain.exponentialRampToValueAtTime(.0001,AC.currentTime+dur);o.stop(AC.currentTime+dur);
  }
  function doKickSound(){ beep(220,.07,"square",.06); }
  function goalSound(){ [523,659,784,1046].forEach((f,i)=>setTimeout(()=>beep(f,.18,"triangle",.08),i*90)); }
  function whistle(){ beep(1800,.12,"sine",.05); setTimeout(()=>beep(2100,.18,"sine",.05),120); }
  sndBtn.addEventListener("click", ()=>{ sndOn=!sndOn; sndBtn.classList.toggle("off",!sndOn); });

  // ===================== AI / PHYSICS =====================
  function nearestToBall(team){
    let best=null,bd=1e9;
    for(const p of players){
      if(p.team!==team||p.role==="keep")continue;
      const d=Math.hypot(p.x-ball.x,p.y-ball.y);
      if(d<bd){bd=d;best=p;}
    }
    return best;
  }
  function clamp(v,a,b){ return v<a?a:v>b?b:v; }

  // CPU frozen targets — updated only every AI_REACT frames
  let cpuTargets = {};
  function updatePlayers(){
    const yourChaser = nearestToBall("you");
    const cpuChaser  = nearestToBall("cpu");
    const updateCpu  = frame % AI_REACT === 0;

    for(const p of players){
      if(p===YOU()){
        const a=moveAxis();
        p.vx=a.x*SPD_YOU; p.vy=a.y*SPD_YOU;
        if(a.x)p.face=Math.sign(a.x);
        if(a.m>0.05)p.run+=0.3;
        clampMove(p); continue;
      }

      let tx=p.x, ty=p.y, spd=SPD_AI;
      const pid = players.indexOf(p);
      if(p.role==="keep"){
        spd=SPD_KEEP;
        ty = p.team==="you" ? H-26 : 26;
        // keeper also reacts with delay
        if(updateCpu||p.team==="you"){
          tx = clamp(ball.x, GOAL_X1+10, GOAL_X2-10);
          cpuTargets[pid] = { tx, ty };
        } else if(cpuTargets[pid]){ tx=cpuTargets[pid].tx; ty=cpuTargets[pid].ty; }
      } else if(p.team==="you"){
        if(p===yourChaser){ tx=ball.x; ty=ball.y-4; }
        else { tx=(ball.x+W/2)/2; ty=Math.max(ball.y-90,90); }
      } else {
        // cpu outfield with delayed reaction
        if(updateCpu){
          let ntx, nty;
          if(p===cpuChaser){ ntx=ball.x; nty=ball.y; }
          else { ntx=(ball.x+W/2)/2; nty=Math.min(ball.y+80,H-120); }
          cpuTargets[pid]={ tx:ntx, ty:nty };
        }
        if(cpuTargets[pid]){ tx=cpuTargets[pid].tx; ty=cpuTargets[pid].ty; }
      }
      const dx=tx-p.x, dy=ty-p.y, m=Math.hypot(dx,dy);
      if(m>2){ p.vx=dx/m*spd; p.vy=dy/m*spd; p.run+=0.25; if(Math.abs(dx)>0.5)p.face=Math.sign(dx); }
      else { p.vx*=0.6; p.vy*=0.6; }
      clampMove(p);
    }
  }
  function clampMove(p){
    p.x+=p.vx; p.y+=p.vy;
    const r = p.role==="keep"?KR:PR;
    p.x=clamp(p.x,r,W-r);
    if(p.role==="keep"){
      const a = p.team==="you" ? H-46 : 12;
      const b = p.team==="you" ? H-12 : 46;
      p.y=clamp(p.y,a,b);
    } else p.y=clamp(p.y,r,H-r);
  }

  function ang(from,to){ const dx=to.x-from.x,dy=to.y-from.y,m=Math.hypot(dx,dy)||1; return {x:dx/m,y:dy/m}; }
  function resolveBall(){
    for(const p of players){
      const r=(p.role==="keep"?KR:PR)+BR;
      let dx=ball.x-p.x, dy=ball.y-p.y, d=Math.hypot(dx,dy);
      if(d<r){
        const nx=dx/(d||1), ny=dy/(d||1);
        ball.x=p.x+nx*r; ball.y=p.y+ny*r;
        let aim, pow;
        if(p===YOU()){
          if(kickPressed()){ aim=ang(ball,TOP_GOAL); pow=KICK; doKickSound(); }
          else { const a=moveAxis(); aim=a.m>0.1?{x:a.x,y:a.y}:{x:nx,y:ny}; pow=DRIBBLE; }
        } else if(p.role==="keep"){
          aim=ang(ball, p.team==="you"?{x:180,y:240}:{x:180,y:300}); pow=KEEP_CLEAR;
          if(frame%6===0)doKickSound();
        } else if(p.team==="you"){ aim=ang(ball,TOP_GOAL); pow=AI_KICK; }
        else { aim=ang(ball,BOT_GOAL); pow=AI_KICK; }
        ball.vx=aim.x*pow + p.vx*0.4;
        ball.vy=aim.y*pow + p.vy*0.4;
      }
    }
  }

  function updateBall(){
    // cap speed (prevents tunneling through keepers)
    const sp=Math.hypot(ball.vx,ball.vy);
    if(sp>BALL_MAX){ ball.vx=ball.vx/sp*BALL_MAX; ball.vy=ball.vy/sp*BALL_MAX; }
    ball.x+=ball.vx; ball.y+=ball.vy;
    ball.vx*=FRIC; ball.vy*=FRIC;
    if(Math.abs(ball.vx)<0.02)ball.vx=0;
    if(Math.abs(ball.vy)<0.02)ball.vy=0;

    if(ball.y<6){ if(ball.x>GOAL_X1&&ball.x<GOAL_X2){ goal("you"); return; } ball.y=6; ball.vy*=-0.6; }
    if(ball.y>H-6){ if(ball.x>GOAL_X1&&ball.x<GOAL_X2){ goal("cpu"); return; } ball.y=H-6; ball.vy*=-0.6; }
    if(ball.x<BR){ ball.x=BR; ball.vx*=-0.7; }
    if(ball.x>W-BR){ ball.x=W-BR; ball.vx*=-0.7; }
  }

  function goal(who){
    if(who==="you")scoreYou++; else scoreCpu++;
    document.getElementById("scoreYou").textContent=scoreYou;
    document.getElementById("scoreCpu").textContent=scoreCpu;
    say(rand(goalLines[who]));
    goalSound();
    const f=document.getElementById("goalFlash");
    f.classList.remove("show"); void f.offsetWidth; f.classList.add("show");
    state="celebrate"; celebrateT=72; ball.vx=0; ball.vy=0;
  }

  // ===================== RENDER =====================
  function drawField(){
    for(let i=0;i<10;i++){ ctx.fillStyle=i%2?"#3aa14a":"#349240"; ctx.fillRect(0,i*(H/10),W,H/10); }
    drawCrowd(0); drawCrowd(H-22);
    ctx.strokeStyle="rgba(230,255,235,.55)";ctx.lineWidth=2;
    ctx.strokeRect(8,24,W-16,H-48);
    ctx.beginPath();ctx.moveTo(8,H/2);ctx.lineTo(W-8,H/2);ctx.stroke();
    ctx.beginPath();ctx.arc(W/2,H/2,42,0,7);ctx.stroke();
    ctx.fillStyle="rgba(230,255,235,.55)";ctx.fillRect(W/2-2,H/2-2,4,4);
    ctx.strokeRect(W/2-58,24,116,52); ctx.strokeRect(W/2-58,H-76,116,52);
    drawGoal(24); drawGoal(H-24);
  }
  function drawCrowd(y){
    const cols=["#d94f4f","#4f7fd9","#e0b13a","#5fb35f","#b15fd9","#d9d9d9"];
    for(let i=0;i<W;i+=6){ ctx.fillStyle=cols[(i/6|0)%cols.length]; ctx.fillRect(i,y,5,(i%12<6?22:18)); }
    ctx.fillStyle="#1b1b1b";ctx.fillRect(0,y+(y===0?22:-1),W,3);
  }
  function drawGoal(y){
    const top=y<H/2, ny=top?y-14:y;
    ctx.fillStyle="#f4f4f4";ctx.fillRect(GOAL_X1,top?y:y-3,GOAL_X2-GOAL_X1,3);
    ctx.fillStyle="#eaeaea";ctx.fillRect(GOAL_X1,ny,3,14);ctx.fillRect(GOAL_X2-3,ny,3,14);
    ctx.strokeStyle="rgba(255,255,255,.35)";ctx.lineWidth=1;
    for(let gx=GOAL_X1;gx<=GOAL_X2;gx+=8){ctx.beginPath();ctx.moveTo(gx,ny);ctx.lineTo(gx,ny+14);ctx.stroke();}
    for(let gy=ny;gy<=ny+14;gy+=5){ctx.beginPath();ctx.moveTo(GOAL_X1,gy);ctx.lineTo(GOAL_X2,gy);ctx.stroke();}
  }
  function drawBlob(p){
    const x=Math.round(p.x), y=Math.round(p.y);
    const moving=Math.hypot(p.vx,p.vy)>0.3;
    const leg=moving?(Math.floor(p.run)%2?3:-3):0;
    const col=p.team==="you"?"#4fc3ff":"#ff5b5b";
    ctx.fillStyle="rgba(0,0,0,.22)";ctx.beginPath();ctx.ellipse(x,y+13,11,4,0,0,7);ctx.fill();
    ctx.fillStyle="#f4f4f4";ctx.fillRect(x-6,y+6,4,8+leg);ctx.fillRect(x+2,y+6,4,8-leg);
    ctx.fillStyle="#1a1a1a";ctx.fillRect(x-6,y+13+leg,4,2);ctx.fillRect(x+2,y+13-leg,4,2);
    ctx.fillStyle="#1a1a1a";ctx.beginPath();ctx.arc(x,y-2,12,0,7);ctx.fill();
    ctx.fillStyle="#f4f4f4";ctx.beginPath();ctx.arc(x,y-2,10,0,7);ctx.fill();
    ctx.fillStyle=col;ctx.fillRect(x-9,y+1,18,3);
    ctx.fillStyle="#1a1a1a";
    ctx.fillRect(x-5+(p.face>0?1:-1),y-5,2,3);ctx.fillRect(x+3+(p.face>0?1:-1),y-5,2,3);
    ctx.fillRect(x-3,y,6,1);
    if(p.role==="keep"){ ctx.fillStyle=col; ctx.fillRect(x-12,y-3,3,6); ctx.fillRect(x+9,y-3,3,6); }
  }
  function drawBall(){
    const x=Math.round(ball.x),y=Math.round(ball.y);
    ctx.fillStyle="rgba(0,0,0,.22)";ctx.beginPath();ctx.ellipse(x,y+6,7,3,0,0,7);ctx.fill();
    ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(x,y,BR,0,7);ctx.fill();
    ctx.fillStyle="#1a1a1a";ctx.fillRect(x-2,y-2,4,4);ctx.fillRect(x-6,y-1,2,2);ctx.fillRect(x+4,y-1,2,2);
  }
  function render(){
    drawField();
    [...players].sort((a,b)=>a.y-b.y).forEach(drawBlob);
    drawBall();
  }

  // ===================== LOOP =====================
  function loop(){
    frame++;
    if(state==="play"){ updatePlayers(); resolveBall(); updateBall(); }
    else if(state==="celebrate"){
      celebrateT--;
      if(celebrateT<=0){ state="play"; kickoff(scoreYou>scoreCpu?"cpu":"you"); whistle(); }
    }
    render();
    requestAnimationFrame(loop);
  }

  // ===================== FLOW =====================
  const intro=document.getElementById("intro");
  const gameWrap=document.getElementById("gameWrap");
  const nameInput=document.getElementById("teamName");

  function startGame(){
    let n=(nameInput.value||"").trim().toUpperCase();
    teamName = n ? n.slice(0,12) : "THE BLOBS";
    document.getElementById("teamLabel").textContent=teamName;
    scoreYou=0; scoreCpu=0;
    document.getElementById("scoreYou").textContent=0;
    document.getElementById("scoreCpu").textContent=0;
    intro.classList.add("hidden");
    gameWrap.classList.remove("hidden");
    ac(); if(AC&&AC.state==="suspended")AC.resume();
    state="play"; kickoff("you"); whistle();
  }
  function toMenu(){
    state="menu";
    gameWrap.classList.add("hidden");
    intro.classList.remove("hidden");
  }
  document.getElementById("playBtn").addEventListener("click", startGame);
  nameInput.addEventListener("keydown", e=>{ if(e.key==="Enter")startGame(); });
  document.getElementById("quitBtn").addEventListener("click", toMenu);

  // build LED ticker (links use config vars)
  const led=document.getElementById("ledTrack");
  const items=[
    `<a href="${PUMP_URL}" target="_blank" rel="noopener">PUMP.FUN</a>`,
    `<span>$PIXBALL</span>`,
    `<a href="${DEX_URL}" target="_blank" rel="noopener">DEXSCREENER</a>`,
    `<span>$PIXBALL</span>`,
    `<a href="${X_URL}" target="_blank" rel="noopener">X · @SOON</a>`,
    `<span>$PIXBALL</span>`,
    `<span>SIX BLOBS · ONE BALL</span>`,
    `<span>$PIXBALL</span>`,
  ];
  led.innerHTML = (items.join("")).repeat(2); // duplicate for seamless loop

  formation(); render(); loop();
})();
