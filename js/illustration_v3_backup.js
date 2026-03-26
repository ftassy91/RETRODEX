/* ═══════════════════════════════════════════════════════════════
   RETRODEX ILLUSTRATION ENGINE v3
   Palette stricte Game Boy LCD:
     D=#0F380F  M=#306230  L=#8BAC0F  B=#9BBC0F
   Canvas 320×240 — 4 couches : BG / ENV / HERO / TITLE
   ═══════════════════════════════════════════════════════════════ */
const ILLUSTRATOR = (() => {

  const C = { D:'#0F380F', M:'#306230', L:'#8BAC0F', B:'#9BBC0F' };

  /* ── primitives ─────────────────────────────────────────────── */
  const r = (ctx,x,y,w,h,c) => { ctx.fillStyle=c; ctx.fillRect(x,y,w,h); };

  function dither(ctx,x,y,w,h,ca,cb,dens=0.45){
    r(ctx,x,y,w,h,ca);
    ctx.fillStyle=cb;
    for(let dy=0;dy<h;dy++)
      for(let dx=(dy%2);dx<w;dx+=2)
        if(((dx*3+dy*5)%7)/7<dens) ctx.fillRect(x+dx,y+dy,1,1);
  }

  function hline(ctx,x,y,w,c){ ctx.fillStyle=c; ctx.fillRect(x,y,w,1); }
  function vline(ctx,x,y,h,c){ ctx.fillStyle=c; ctx.fillRect(x,y,1,h); }

  /* pixel-font text using canvas (monospace, scaled) */
  function txt(ctx,s,x,y,size,c,shadow=false){
    if(shadow){ ctx.fillStyle=C.D; ctx.font=`bold ${size}px "Courier New"`; ctx.fillText(s,x+1,y+1); }
    ctx.fillStyle=c; ctx.font=`bold ${size}px "Courier New"`;
    ctx.textBaseline='top'; ctx.fillText(s,x,y);
  }

  function scanlines(ctx,W,H){
    for(let y=0;y<H;y+=2){ ctx.fillStyle='rgba(0,0,0,0.13)'; ctx.fillRect(0,y,W,1); }
  }

  /* ── cloud (pixel art) ──────────────────────────────────────── */
  function cloud(ctx,x,y,s,c){
    // s=scale (1-3)
    const shape=[[1,1,1,1,1,0],[0,1,1,1,1,1],[1,1,1,1,1,1],[1,1,1,1,1,0]];
    shape.forEach((row,dy)=>row.forEach((v,dx)=>{ if(v) r(ctx,x+dx*s,y+dy*s,s,s,c); }));
  }

  /* ── tree (pixel art, varied) ───────────────────────────────── */
  function tree(ctx,x,y,h,c1,c2){
    // trunk
    r(ctx,x+3,y+h-6,2,6,C.D);
    // foliage layered
    r(ctx,x,y+4,8,h-8,c1);
    r(ctx,x+1,y+1,6,4,c1);
    r(ctx,x+2,y,4,3,c2);
    // shadow side
    vline(ctx,x+7,y+3,h-9,c1);
  }

  /* ── mountain outline ───────────────────────────────────────── */
  function mountain(ctx,px,py,w,h,col){
    ctx.fillStyle=col;
    ctx.beginPath();
    ctx.moveTo(px,py+h);
    ctx.lineTo(px+w/2,py);
    ctx.lineTo(px+w,py+h);
    ctx.closePath();
    ctx.fill();
  }

  /* ── brick block ────────────────────────────────────────────── */
  function block(ctx,x,y,s,type='?'){
    r(ctx,x,y,s,s,C.M);
    r(ctx,x+1,y+1,s-2,s-2,C.L);
    r(ctx,x+2,y+2,s-4,s-4,C.M);
    if(type==='?'){ ctx.fillStyle=C.B; ctx.font=`bold ${s-4}px "Courier New"`; ctx.fillText('?',x+2,y+1); }
    if(type==='brick'){
      hline(ctx,x,y,s,C.D); hline(ctx,x,y+s/2,s,C.D);
      vline(ctx,x+s/4,y,s/2,C.D); vline(ctx,x+3*s/4,y+s/2,s/2,C.D);
    }
  }

  /* ══ SCENES ════════════════════════════════════════════════════ */

  /* PLATFORM (Mario, Sonic, Kirby…) */
  function genPlatform(ctx,W,H,game){
    // Sky — dithered bright
    dither(ctx,0,0,W,H*.6,C.B,C.L,0.3);
    // Clouds
    cloud(ctx,20,18,3,C.B); cloud(ctx,80,10,3,C.B); cloud(ctx,160,20,2,C.B); cloud(ctx,230,12,3,C.B);
    // Distant hills
    dither(ctx,0,H*.55,40,H*.45,C.L,C.M,0.5);
    dither(ctx,35,H*.48,60,H*.52,C.L,C.M,0.45);
    dither(ctx,90,H*.52,50,H*.48,C.L,C.M,0.5);
    dither(ctx,200,H*.5,80,H*.5,C.L,C.M,0.45);
    dither(ctx,270,H*.55,W,H*.45,C.L,C.M,0.5);
    // Ground
    r(ctx,0,H*.72,W,H*.28,C.M);
    r(ctx,0,H*.72,W,4,C.L);
    dither(ctx,0,H*.72+4,W,6,C.M,C.L,0.4);
    // Blocks row
    [55,85,115,145,175].forEach((bx,i)=>{
      block(ctx,bx,H*.46,14,i%2===0?'?':'brick');
    });
    // Pipes
    r(ctx,30,H*.52,14,H*.2,C.M); r(ctx,28,H*.52,18,5,C.L);
    r(ctx,240,H*.60,14,H*.12,C.M); r(ctx,238,H*.60,18,5,C.L);
    // Coins
    [95,110,125].forEach(cx=>{ r(ctx,cx,H*.38,6,8,C.B); r(ctx,cx+2,H*.36,2,3,C.B); });
    // Mario silhouette (8-bit style)
    const mx=52, my=H*.57;
    r(ctx,mx+2,my-10,8,4,C.D);   // hat
    r(ctx,mx,my-8,12,4,C.D);     // hat brim
    r(ctx,mx+2,my-4,8,8,C.D);    // body
    r(ctx,mx,my,4,6,C.D);        // legs
    r(ctx,mx+8,my,4,6,C.D);
    r(ctx,mx-4,my-5,4,4,C.D);    // arm
    // Goomba
    r(ctx,180,H*.68,10,8,C.M); r(ctx,178,H*.67,14,5,C.D); r(ctx,180,H*.75,3,3,C.D); r(ctx,188,H*.75,3,3,C.D);
  }

  /* ADVENTURE (Zelda, Metroid, Castlevania…) */
  function genAdventure(ctx,W,H,game){
    const isZelda = game.title.toLowerCase().includes('zelda');
    const isCastle = game.title.toLowerCase().includes('castlevania');

    if(isCastle){
      // Dark gothic sky
      dither(ctx,0,0,W,H,C.D,C.M,0.2);
      // Moon
      ctx.fillStyle=C.B; ctx.beginPath(); ctx.arc(W*.75,35,20,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=C.D; ctx.beginPath(); ctx.arc(W*.78,30,17,0,Math.PI*2); ctx.fill();
      // Castle
      [0,40,100,160,220].forEach((cx,i)=>{
        const ch=40+i%2*20;
        r(ctx,cx,H*.5-ch,30,ch+H*.5,C.M);
        r(ctx,cx,H*.5-ch-10,30,12,C.D);
        r(ctx,cx+4,H*.5-ch-20,6,12,C.M);
        r(ctx,cx+20,H*.5-ch-18,6,10,C.M);
      });
      // Windows glow
      [[45,H*.35],[75,H*.45],[165,H*.38],[195,H*.5]].forEach(([wx,wy])=>{
        r(ctx,wx,wy,6,8,C.L); r(ctx,wx+1,wy+1,4,6,C.B);
      });
      // Ground
      r(ctx,0,H*.75,W,H*.25,C.D); dither(ctx,0,H*.75,W,4,C.M,C.D,0.5);
      // Hero silhouette
      const hx=40,hy=H*.62;
      r(ctx,hx+2,hy-8,6,6,C.L); r(ctx,hx,hy,10,14,C.M);
      r(ctx,hx-6,hy+2,8,2,C.B); // whip
      for(let i=0;i<5;i++) r(ctx,hx-6-i*4,hy+2+i*2,3,2,C.B);
    } else {
      // Zelda / generic Adventure — island scene
      // Sky gradient
      dither(ctx,0,0,W,H*.55,C.B,C.L,0.25);
      dither(ctx,0,H*.3,W,H*.25,C.L,C.M,0.3);
      // Sun
      ctx.fillStyle=C.B; ctx.beginPath(); ctx.arc(W*.8,28,16,0,Math.PI*2); ctx.fill();
      // Clouds
      cloud(ctx,10,15,3,C.B); cloud(ctx,100,8,3,C.B); cloud(ctx,200,18,3,C.B);
      // Sea with wave pattern
      r(ctx,0,H*.52,W,H*.2,C.M);
      for(let wx=0;wx<W;wx+=8){
        r(ctx,wx,H*.52,4,2,C.L); r(ctx,wx+4,H*.54,4,2,C.B);
      }
      for(let wx=4;wx<W;wx+=8){
        r(ctx,wx,H*.58,4,2,C.L); r(ctx,wx+4,H*.60,4,2,C.B);
      }
      // Island
      ctx.fillStyle=C.M;
      ctx.beginPath(); ctx.ellipse(W*.58,H*.65,62,22,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=C.L;
      ctx.beginPath(); ctx.ellipse(W*.58,H*.63,58,18,0,0,Math.PI*2); ctx.fill();
      // Volcano
      mountain(ctx,W*.62,H*.35,55,H*.3,C.D);
      r(ctx,W*.62+20,H*.35-4,15,8,C.M); // snow/lava
      // Island trees
      tree(ctx,W*.4,H*.46,24,C.D,C.M);
      tree(ctx,W*.5,H*.44,28,C.M,C.D);
      tree(ctx,W*.7,H*.48,20,C.D,C.M);
      // Shore + hero
      r(ctx,0,H*.7,W*.28,H*.3,C.M);
      dither(ctx,0,H*.7,W*.28,8,C.L,C.M,0.5);
      for(let gx=0;gx<W*.28;gx+=5) r(ctx,gx,H*.7-2,3,4,C.L); // grass
      // Link silhouette
      const lx=22, ly=H*.55;
      r(ctx,lx+3,ly-9,7,7,C.D);  // head + hat
      r(ctx,lx+3,ly-12,5,4,C.L); // hat point
      r(ctx,lx+1,ly,10,14,C.D);  // body/tunic
      r(ctx,lx-3,ly+3,6,2,C.D);  // shield
      r(ctx,lx+11,ly+2,2,8,C.L); // sword up
    }
  }

  /* RPG (FF, Chrono, Dragon Quest…) */
  function genRPG(ctx,W,H,game){
    const isChrono = game.title.toLowerCase().includes('chrono');
    // Night sky
    r(ctx,0,0,W,H,C.D);
    dither(ctx,0,0,W,H*.65,C.D,C.M,0.18);
    // Stars — dense field
    const stars=[];
    for(let i=0;i<60;i++) stars.push([(i*47+i*i)%W,(i*31+7*i)%Math.floor(H*.6)]);
    stars.forEach(([sx,sy],i)=>{
      const s=i%5===0?2:1;
      r(ctx,sx,sy,s,s,i%8===0?C.B:C.L);
    });
    // Moon / planet
    ctx.fillStyle=C.L; ctx.beginPath(); ctx.arc(W*.15,40,22,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=C.M; ctx.beginPath(); ctx.arc(W*.12,36,19,0,Math.PI*2); ctx.fill();
    // Mountains silhouette
    const mpts=[[0,H],[40,H*.45],[90,H*.58],[150,H*.38],[210,H*.52],[260,H*.42],[W,H*.55],[W,H]];
    ctx.fillStyle=C.M;
    ctx.beginPath(); ctx.moveTo(mpts[0][0],mpts[0][1]);
    mpts.forEach(p=>ctx.lineTo(p[0],p[1])); ctx.closePath(); ctx.fill();
    // Snow caps
    [[40,H*.45,12],[150,H*.38,14],[260,H*.42,11]].forEach(([mx,my,sw])=>{
      r(ctx,mx-sw/2,my,sw,6,C.B); r(ctx,mx-sw/4,my-4,sw/2,5,C.B);
    });
    // Castle
    const cx2=W*.4, cy2=H*.5;
    r(ctx,cx2,cy2,65,H*.35,C.D);
    [[cx2,cy2-16],[cx2+14,cy2-20],[cx2+28,cy2-12],[cx2+42,cy2-18],[cx2+56,cy2-10]].forEach(([tx,ty])=>{
      r(ctx,tx,ty,10,18,C.D);
      r(ctx,tx+2,ty-5,6,6,C.M);
    });
    // Windows
    [[cx2+5,cy2+4],[cx2+20,cy2+4],[cx2+35,cy2+4],[cx2+50,cy2+4],
     [cx2+12,cy2+16],[cx2+42,cy2+16]].forEach(([wx,wy])=>{
      r(ctx,wx,wy,5,7,C.L); r(ctx,wx+1,wy+1,3,5,C.B);
    });
    // Ground
    r(ctx,0,H*.78,W,H*.22,C.D);
    dither(ctx,0,H*.78,W,5,C.M,C.D,0.5);
    // Party silhouettes
    if(isChrono){
      [[50,H*.7],[64,H*.68],[78,H*.7]].forEach(([px,py],i)=>{
        r(ctx,px,py-12,8,12,C.M); r(ctx,px+1,py-18,6,6,C.L);
        if(i===0){ r(ctx,px-4,py-10,6,2,C.B); } // sword
        if(i===1){ r(ctx,px+8,py-8,2,16,C.L); }  // staff
      });
    } else {
      [[48,H*.7],[62,H*.68],[76,H*.71]].forEach(([px,py])=>{
        r(ctx,px,py-14,8,14,C.M); r(ctx,px+1,py-20,6,6,C.L);
      });
    }
  }

  /* FIGHTING (Street Fighter, KoF, Tekken…) */
  function genFighting(ctx,W,H,game){
    // Arena floor
    dither(ctx,0,H*.68,W,H*.32,C.M,C.L,0.4);
    r(ctx,0,H*.68,W,2,C.B);
    // Audience bg
    dither(ctx,0,0,W,H*.68,C.D,C.M,0.25);
    // Crowd silhouettes
    for(let cx=0;cx<W;cx+=9){
      const ch=14+((cx*7)%12);
      r(ctx,cx,H*.68-ch,7,ch,C.M);
      r(ctx,cx+1,H*.68-ch-6,5,7,C.D); // head
    }
    // Stage elements
    r(ctx,W*.35,H*.3,W*.3,H*.38,C.M); // platform center
    dither(ctx,W*.35,H*.3,W*.3,8,C.L,C.M,0.5);
    // Fighter LEFT — more detailed
    const lx=45, ly=H*.5;
    r(ctx,lx+2,ly-16,9,9,C.L);    // head
    r(ctx,lx,ly-7,13,18,C.D);     // body+gi
    r(ctx,lx+2,ly+11,4,8,C.D);    // legs
    r(ctx,lx+8,ly+11,4,8,C.D);
    r(ctx,lx-8,ly-4,10,4,C.M);    // extended arm
    r(ctx,lx+13,ly-2,4,8,C.D);    // back arm
    // Fighter RIGHT (mirrored stance)
    const rx=225, ry=H*.52;
    r(ctx,rx+2,ry-16,9,9,C.L);
    r(ctx,rx,ry-7,13,18,C.D);
    r(ctx,rx+2,ry+11,4,8,C.D);
    r(ctx,rx+8,ry+11,4,8,C.D);
    r(ctx,rx+13,ry-4,10,4,C.M);   // extended punch
    // Impact flash
    r(ctx,rx-18,ry-8,16,16,C.B);
    r(ctx,rx-14,ry-12,8,8,C.B);
    [[rx-20,ry-14],[rx-10,ry-18],[rx-24,ry-6],[rx-6,ry-14]].forEach(([ix,iy])=>{
      r(ctx,ix,iy,4,4,C.B);
    });
    // Health bars
    r(ctx,10,8,120,7,C.D); r(ctx,10,8,95,7,C.L); r(ctx,10,8,90,7,C.B); // P1
    r(ctx,W-130,8,120,7,C.D); r(ctx,W-130+5,8,80,7,C.L); r(ctx,W-130+5,8,75,7,C.B); // P2
    txt(ctx,'P1',10,16,7,C.L); txt(ctx,'P2',W-30,16,7,C.L);
  }

  /* SHOOTER (Gradius, R-Type, Ikaruga…) */
  function genShooter(ctx,W,H,game){
    r(ctx,0,0,W,H,C.D);
    // Nebula layers
    dither(ctx,0,20,100,60,C.D,C.M,0.3);
    dither(ctx,150,40,90,50,C.D,C.M,0.35);
    dither(ctx,60,100,80,40,C.D,C.M,0.28);
    // Stars — parallax layers
    for(let i=0;i<80;i++){
      const sx=(i*73+i*i*3)%W, sy=(i*41+i*17)%H;
      const s=i%10===0?2:1;
      const bright=i%4===0?C.B:C.L;
      r(ctx,sx,sy,s,s,bright);
    }
    // Planet
    ctx.fillStyle=C.M; ctx.beginPath(); ctx.arc(W*.15,H*.25,28,0,Math.PI*2); ctx.fill();
    dither(ctx,W*.15-28,H*.25-6,56,14,C.M,C.L,0.4); // bands
    ctx.fillStyle=C.D; ctx.beginPath(); ctx.arc(W*.15-5,H*.25-5,12,0,Math.PI*2); ctx.fill(); // crater
    // Player ship — detailed
    const sx=W/2-12, sy=H*.65;
    r(ctx,sx+10,sy-4,4,22,C.B);   // nose/body
    r(ctx,sx+4,sy+4,16,10,C.L);   // fuselage
    r(ctx,sx,sy+8,24,6,C.M);      // wings
    r(ctx,sx+2,sy+14,5,6,C.D);    // engine L
    r(ctx,sx+17,sy+14,5,6,C.D);   // engine R
    r(ctx,sx+4,sy+20,4,3,C.B);    // exhaust L
    r(ctx,sx+16,sy+20,4,3,C.B);   // exhaust R
    // Laser beams
    for(let i=0;i<3;i++) r(ctx,sx+10+i*2,sy-24-i*8,2,20,i%2===0?C.B:C.L);
    // Enemies
    [[70,40],[130,25],[190,55],[245,35],[W-20,70]].forEach(([ex,ey])=>{
      r(ctx,ex,ey,16,10,C.M);
      r(ctx,ex+2,ey-4,12,5,C.D);
      r(ctx,ex+4,ey+10,4,4,C.M);
      r(ctx,ex+8,ey+10,4,4,C.M);
    });
    // Enemy lasers
    r(ctx,80,50,2,18,C.L); r(ctx,200,65,2,22,C.L);
  }

  /* RACING (F-Zero, Gran Turismo, Mario Kart…) */
  function genRacing(ctx,W,H,game){
    const isF0 = game.title.toLowerCase().includes('f-zero');
    // Sky
    dither(ctx,0,0,W,H*.45,C.B,C.L,0.2);
    if(isF0){
      // F-Zero futuristic — night neon
      r(ctx,0,0,W,H,C.D);
      dither(ctx,0,0,W,H*.5,C.D,C.M,0.15);
      for(let i=0;i<30;i++) r(ctx,(i*61)%W,(i*43)%Math.floor(H*.4),2,1,i%5===0?C.B:C.L);
    } else {
      // Horizon mountains
      dither(ctx,0,H*.35,W,H*.1,C.L,C.M,0.5);
    }
    // Road perspective
    ctx.fillStyle=C.M;
    ctx.beginPath(); ctx.moveTo(W*.38,H*.42); ctx.lineTo(W*.62,H*.42); ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.closePath(); ctx.fill();
    // Road edge stripes
    hline(ctx,0,H*.42,W,C.D);
    // Center dashes
    for(let i=0;i<6;i++){
      const py=H*.45+i*(H*.55/6);
      const pw=4+i*7;
      r(ctx,W/2-pw/2,py,pw,2+(i/2),C.L);
    }
    // Kerbs (alternating)
    for(let i=0;i<10;i++){
      const cy=H*.45+i*(H*.55/10);
      const cw=3+i*4;
      r(ctx,W*.4-cw,cy,cw,3,i%2===0?C.B:C.D);
      r(ctx,W*.6,cy,cw,3,i%2===0?C.B:C.D);
    }
    // Grass sides
    dither(ctx,0,H*.42,W*.38,H*.58,C.L,C.M,0.35);
    dither(ctx,W*.62,H*.42,W*.38,H*.58,C.L,C.M,0.35);
    // Player car — top view
    const cx2=W/2-10, cy2=H*.7;
    r(ctx,cx2,cy2,20,32,C.D);
    r(ctx,cx2+2,cy2+2,16,26,C.M);
    r(ctx,cx2+4,cy2+1,12,6,C.L);  // windscreen
    r(ctx,cx2+1,cy2+3,3,6,C.D);   // wheel FL
    r(ctx,cx2+16,cy2+3,3,6,C.D);  // wheel FR
    r(ctx,cx2+1,cy2+22,3,7,C.D);  // wheel RL
    r(ctx,cx2+16,cy2+22,3,7,C.D); // wheel RR
    // Opponent car
    r(ctx,W/2-8,H*.52,16,24,C.M);
    r(ctx,W/2-6,H*.53,12,4,C.L);
    r(ctx,W/2-7,H*.56,3,5,C.D); r(ctx,W/2+4,H*.56,3,5,C.D);
  }

  /* STRATEGY (Fire Emblem, Advance Wars…) */
  function genStrategy(ctx,W,H,game){
    r(ctx,0,0,W,H,C.D);
    // Isometric grid
    const gw=28,gh=14,cols=10,rows=8;
    const ox=W/2, oy=30;
    for(let row=0;row<rows;row++){
      for(let col=0;col<cols;col++){
        const px=ox+(col-row)*gw/2;
        const py=oy+(col+row)*gh/2;
        const v=(row+col)%4;
        const tc=v===0?C.M:v===1?C.L:v===2?C.D:C.M;
        ctx.fillStyle=tc;
        ctx.beginPath();
        ctx.moveTo(px,py); ctx.lineTo(px+gw/2,py+gh/2);
        ctx.lineTo(px,py+gh); ctx.lineTo(px-gw/2,py+gh/2);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle=C.D; ctx.lineWidth=0.5; ctx.stroke();
      }
    }
    // Units on grid
    [[W/2-14,62,C.B],[W/2+14,76,C.L],[W/2,90,C.M],[W/2+28,62,C.D]].forEach(([ux,uy,uc])=>{
      r(ctx,ux-4,uy-8,8,8,C.D);  // body
      r(ctx,ux-2,uy-14,4,6,uc);  // head/flag
    });
    // Battle preview panel bottom
    r(ctx,0,H*.78,W,H*.22,C.M);
    hline(ctx,0,H*.78,W,C.B);
    txt(ctx,'BATTLE FORECAST',8,H*.78+4,7,C.B);
    txt(ctx,'ATK:28  DEF:14  HIT:85%',8,H*.78+14,6,C.L);
  }

  /* GENERIC fallback */
  function genDefault(ctx,W,H,game){
    dither(ctx,0,0,W,H*.55,C.B,C.L,0.22);
    ctx.fillStyle=C.B; ctx.beginPath(); ctx.arc(W*.78,32,16,0,Math.PI*2); ctx.fill();
    // Rays
    for(let a=0;a<8;a++){
      const rad=a*Math.PI/4;
      ctx.fillStyle=C.L;
      ctx.fillRect(W*.78+Math.cos(rad)*20,32+Math.sin(rad)*20,2,10);
    }
    cloud(ctx,15,18,3,C.B); cloud(ctx,120,12,3,C.B); cloud(ctx,230,20,2,C.B);
    // Hills
    [[0,H*.68,60],[70,H*.6,80],[160,H*.65,70],[230,H*.62,80],[290,H*.68,50]].forEach(([hx,hy,hr])=>{
      ctx.fillStyle=C.M; ctx.beginPath(); ctx.arc(hx+hr/2,hy,hr/2,Math.PI,0,false); ctx.fill();
    });
    // Ground
    r(ctx,0,H*.73,W,H*.27,C.D); r(ctx,0,H*.73,W,3,C.M);
    // Trees row
    for(let tx=8;tx<W;tx+=32) tree(ctx,tx,H*.55,22,C.D,C.M);
  }

  /* ══ TITLE OVERLAY ═════════════════════════════════════════════ */
  function renderTitle(ctx,W,H,game){
    // Semi-transparent strip
    ctx.fillStyle='rgba(15,56,15,0.85)';
    ctx.fillRect(0,H-44,W,44);
    hline(ctx,0,H-44,W,C.M);
    hline(ctx,0,H-45,W,C.L);

    // Game title — truncated
    const title = game.title.length>22 ? game.title.slice(0,21)+'…' : game.title;
    txt(ctx,title,5,H-39,10,C.B,true);

    // Console
    txt(ctx,game.console,5,H-25,7,C.L);

    // Year + dev on right
    if(game.year){
      ctx.textAlign='right';
      txt(ctx,String(game.year),W-5,H-39,9,C.L);
      ctx.textAlign='left';
    }
    // RETRODEX watermark
    ctx.fillStyle=C.M; ctx.font='bold 6px "Courier New"';
    ctx.textAlign='right'; ctx.fillText('RETRODEX',W-4,H-8); ctx.textAlign='left';
  }

  /* ══ SCENE SELECTOR ════════════════════════════════════════════ */
  function pickScene(game){
    const t=(game.title+' '+(game.developer||'')).toLowerCase();
    const con=(game.console||'').toLowerCase();
    // By title keywords
    if(['mario ','donkey kong','kirby','crash','sonic','yoshi','wario',
        'mega man','metroid','contra','ducktales','rayman','banjo','spyro'].some(k=>t.includes(k))) return genPlatform;
    if(['zelda','tomb raider','alundra','castlevania','silent hill',
        'ico','metroid','oddworld'].some(k=>t.includes(k))) return genAdventure;
    if(['final fantasy','dragon quest','chrono','breath of fire','suikoden',
        'xenogears','wild arms','lufia','phantasy','secret of mana','tales ',
        'earthbound','legend ii','star ocean','grandia','vagrant','persona',
        'ys '].some(k=>t.includes(k))) return genRPG;
    if(['street fighter','mortal kombat','king of fighters','fatal fury',
        'samurai shodown','tekken','soul','garou','virtua fighter','last blade',
        'guilty gear'].some(k=>t.includes(k))) return genFighting;
    if(['ikaruga','gradius','r-type','thunder force','radiant','giga wing',
        'galaga','darius','twinbee','1942','gunstar'].some(k=>t.includes(k))) return genShooter;
    if(['mario kart','f-zero','ridge racer','gran turismo','wipeout',
        'rally','daytona','burnout','road rash'].some(k=>t.includes(k))) return genRacing;
    if(['fire emblem','advance wars','tactics','disgaea','shining force',
        'ogre battle','vandal hearts'].some(k=>t.includes(k))) return genStrategy;
    // By console
    if(con.includes('neo geo')) return genFighting;
    if(con.includes('saturn')||con.includes('dreamcast')) return genShooter;
    if(con.includes('game boy')) return genAdventure;
    return genDefault;
  }

  /* ══ PUBLIC API ════════════════════════════════════════════════ */
  return {
    generate(canvas, game, _scale){
      const W=canvas.width||320, H=canvas.height||240;
      const ctx=canvas.getContext('2d');
      if(!ctx) return;
      ctx.clearRect(0,0,W,H);
      r(ctx,0,0,W,H,C.D); // base
      try {
        pickScene(game)(ctx,W,H,game);
        renderTitle(ctx,W,H,game);
        scanlines(ctx,W,H);
      } catch(e){
        r(ctx,0,0,W,H,C.D);
        txt(ctx,game.title.slice(0,20),6,20,10,C.B);
        txt(ctx,game.console,6,36,8,C.L);
      }
    }
  };
})();
