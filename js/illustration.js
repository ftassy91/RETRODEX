/* ═══════════════════════════════════════════════════════════════════
   RETRODEX ILLUSTRATION ENGINE v5
   17 palettes · 9 scènes · rendu authentique par console + genre

   Ères visuelles :
     MONO   — Game Boy (LCD 4 verts), WonderSwan (4 gris)
     HOME8  — NES, SMS, Lynx, Game Gear
     ARC8   — Neo Geo, TG-16 (arcade pixel perfection)
     S16    — Super Nintendo (Mode 7-style, 16-bit riche)
     G16    — Sega Genesis (16-bit sombre, saturé)
     P32    — PlayStation, Saturn (polygones, Bayer dithering)
     N64    — Nintendo 64, Dreamcast (early 3D, fog)
     GBA    — Game Boy Advance (32-bit handheld, vibrant)
     NDS    — Nintendo DS (hybride 2D/3D)
   ═══════════════════════════════════════════════════════════════════ */
const ILLUSTRATOR = (() => {
'use strict';

/* ── PALETTES ─────────────────────────────────────────────────────── */
const PAL = {
  GB:  {d:RDX_PALETTE.dark,m:RDX_PALETTE.mid,l:RDX_PALETTE.light,b:RDX_PALETTE.bright,sky:RDX_PALETTE.light,_mono:true,
        white:RDX_PALETTE.bright,gray:RDX_PALETTE.mid,gold:RDX_PALETTE.light,dark:RDX_PALETTE.dark,bg:RDX_PALETTE.bright},
  WS:  {d:'#000000',m:'#303030',l:'#909090',b:'#F0F0F0',sky:'#C0C0C0',_mono:true,
        white:'#F0F0F0',gray:'#909090',gold:'#D0D0D0',dark:'#000000',bg:'#E8E8E8'},
  NES: {bg:'#000018',dark:'#000018',sky:'#6888FC',d:'#000018',m:'#0038CE',l:'#6888FC',b:'#BCBCBC',
        red:'#B82000',orange:'#FC7460',green:'#009400',dgreen:'#006600',brown:'#503000',
        tan:'#FCBCB0',yellow:'#F8D878',white:'#FCFCFC',gray:'#7C7C7C',blue:'#1D2BAD',gold:'#F8D878'},
  SMS: {bg:'#000000',dark:'#000044',sky:'#5555FF',d:'#000044',m:'#0000AA',l:'#5555FF',b:'#FFFFFF',
        red:'#AA0000',orange:'#FF5500',green:'#00AA00',dgreen:'#005500',brown:'#552200',
        tan:'#FFAA55',yellow:'#FFFF00',white:'#FFFFFF',gray:'#AAAAAA',blue:'#0000AA',gold:'#FFDD00'},
  TG16:{bg:'#000022',dark:'#000022',sky:'#44AAFF',d:'#001144',m:'#0044DD',l:'#44AAFF',b:'#FFFFFF',
        red:'#DD2200',orange:'#FF8800',green:'#00BB44',dgreen:'#005522',brown:'#773311',
        tan:'#FFDDAA',yellow:'#FFEE00',white:'#FFFFFF',gray:'#888888',blue:'#0044DD',gold:'#FFCC00'},
  NEO: {bg:'#000011',dark:'#000011',sky:'#3399FF',d:'#001133',m:'#0033CC',l:'#3399FF',b:'#FFFFFF',
        red:'#CC0000',orange:'#FF6600',green:'#009933',dgreen:'#005522',brown:'#663300',
        tan:'#FFCC99',yellow:'#FFCC00',white:'#FFFFFF',gray:'#999999',blue:'#0033CC',gold:'#FFAA00',cyan:'#00CCFF'},
  LYNX:{bg:'#0D0D1A',dark:'#0D0D1A',sky:'#5599DD',d:'#1A1A33',m:'#1144BB',l:'#5599DD',b:'#DDDDEE',
        red:'#AA1111',orange:'#DD7700',green:'#116633',dgreen:'#0A4422',brown:'#775533',
        tan:'#DDAA77',yellow:'#DDCC00',white:'#DDDDEE',gray:'#778899',blue:'#1144BB',gold:'#DDAA00'},
  GG:  {bg:'#000000',dark:'#001155',sky:'#66AAFF',d:'#001155',m:'#1155CC',l:'#66AAFF',b:'#FFFFFF',
        red:'#CC1100',orange:'#FF7711',green:'#00AA33',dgreen:'#005522',brown:'#663322',
        tan:'#FFBB77',yellow:'#FFDD00',white:'#FFFFFF',gray:'#99AABB',blue:'#1155CC',gold:'#FFCC00'},
  SNES:{bg:'#1A2A4A',dark:'#1A2A4A',sky:'#87CEEB',d:'#1565C0',m:'#2E86C1',l:'#87CEEB',b:'#F5F5F5',
        red:'#C0392B',orange:'#E67E22',green:'#27AE60',dgreen:'#1B5E20',brown:'#6D4C41',
        tan:'#FFCC80',yellow:'#F9CA24',white:'#F5F5F5',gray:'#90A4AE',blue:'#1565C0',gold:'#FFD700'},
  GEN: {bg:'#000011',dark:'#000011',sky:'#1A4466',d:'#0A0A1E',m:'#0033AA',l:'#2266BB',b:'#EEEEFF',
        red:'#CC2200',orange:'#EE6622',green:'#008833',dgreen:'#004411',brown:'#442200',
        tan:'#BB8833',yellow:'#DDAA00',white:'#EEEEFF',gray:'#445566',blue:'#0000CC',gold:'#CC9900',cyan:'#00AACC',bright:'#4499CC'},
  PS1: {bg:'#050508',dark:'#050508',sky:'#0F1A30',d:'#0D0D18',m:'#1A1A2E',l:'#404060',b:'#9090C0',
        red:'#700000',green:'#003300',blue:'#000055',brown:'#2D1E14',tan:'#6B5344',
        white:'#C0C0D8',gray:'#505070',mid:'#252540',fog:'rgba(80,80,130,0.28)',
        light:'#6060A0',pale:'#9090C0',dgreen:'#002200',gold:'#887730',orange:'#553322'},
  SAT: {bg:'#0D1B2A',dark:'#0D1B2A',sky:'#4FC3F7',d:'#16213E',m:'#1565C0',l:'#4FC3F7',b:'#ECEFF1',
        red:'#C62828',orange:'#E65100',green:'#2E7D32',dgreen:'#1B5E20',brown:'#4E342E',
        tan:'#BCAAA4',yellow:'#F9A825',white:'#ECEFF1',gray:'#546E7A',blue:'#1565C0',gold:'#FFB300',
        fog:'rgba(60,80,120,0.22)',light:'#6090C0',pale:'#AACCEE',mid:'#2A3A5A'},
  N64: {bg:'#0D1117',dark:'#0D1117',sky:'#4A7FA5',d:'#1A2838',m:'#2C3E50',l:'#5D8AA8',b:'#ECF0F1',
        red:'#C0392B',orange:'#D35400',green:'#1E8449',dgreen:'#145A32',brown:'#6E4B30',
        tan:'#C9A96E',yellow:'#F9A825',white:'#ECF0F1',gray:'#707B7C',blue:'#1B4F72',
        fog:'rgba(150,180,210,0.28)',gold:'#F9A825',light:'#7AAAC8',pale:'#C0D8E8'},
  DC:  {bg:'#0A0A1A',dark:'#0A0A1A',sky:'#85C1E9',d:'#16213E',m:'#2471A3',l:'#85C1E9',b:'#FDFEFE',
        red:'#CB4335',orange:'#CA6F1E',green:'#239B56',dgreen:'#1D6A34',brown:'#7D5A30',
        tan:'#D4AC0D',yellow:'#F4D03F',white:'#FDFEFE',gray:'#717D7E',blue:'#2471A3',gold:'#F4D03F',
        fog:'rgba(130,160,200,0.22)',light:'#8ABCDE',pale:'#C8E0F0'},
  GBA: {bg:'#1A1A2E',dark:'#1A1A2E',sky:'#87CEEB',d:'#1E3A5F',m:'#2E86C1',l:'#87CEEB',b:'#ECF0F1',
        red:'#E74C3C',orange:'#E67E22',green:'#2ECC71',dgreen:'#1ABC9C',brown:'#873600',
        tan:'#F0A500',yellow:'#F1C40F',white:'#ECF0F1',gray:'#95A5A6',blue:'#1E90FF',gold:'#F39C12'},
  NDS: {bg:'#1A1A2E',dark:'#1A1A2E',sky:'#AED6F1',d:'#212F3D',m:'#2980B9',l:'#AED6F1',b:'#FAFAFA',
        red:'#E74C3C',orange:'#F39C12',green:'#27AE60',dgreen:'#1E8449',brown:'#784212',
        tan:'#FAD7A0',yellow:'#F1C40F',white:'#FAFAFA',gray:'#7F8C8D',blue:'#2980B9',gold:'#F1C40F'},
};

const CONSOLE_PAL = {
  'Game Boy':PAL.GB,'WonderSwan':PAL.WS,
  'Nintendo Entertainment System':PAL.NES,'Sega Master System':PAL.SMS,
  'Atari Lynx':PAL.LYNX,'Game Gear':PAL.GG,
  'TurboGrafx-16':PAL.TG16,'Neo Geo':PAL.NEO,
  'Super Nintendo':PAL.SNES,'Sega Genesis':PAL.GEN,
  'PlayStation':PAL.PS1,'Sega Saturn':PAL.SAT,
  'Nintendo 64':PAL.N64,'Dreamcast':PAL.DC,
  'Game Boy Advance':PAL.GBA,'Nintendo DS':PAL.NDS,
};
const ERA_MAP = {
  'Game Boy':'MONO','WonderSwan':'MONO',
  'Nintendo Entertainment System':'HOME8','Sega Master System':'HOME8',
  'Atari Lynx':'HOME8','Game Gear':'HOME8',
  'TurboGrafx-16':'ARC8','Neo Geo':'ARC8',
  'Super Nintendo':'S16','Sega Genesis':'G16',
  'PlayStation':'P32','Sega Saturn':'P32',
  'Nintendo 64':'N64','Dreamcast':'N64',
  'Game Boy Advance':'GBA','Nintendo DS':'NDS',
};

/* ── PRIMITIVES ───────────────────────────────────────────────────── */
const r  = (c,x,y,w,h,col)=>{c.fillStyle=col;c.fillRect(x,y,w,h);};
const hl = (c,x,y,w,col)  =>{c.fillStyle=col;c.fillRect(x,y,w,1);};
const vl = (c,x,y,h,col)  =>{c.fillStyle=col;c.fillRect(x,y,1,h);};

function dither(c,x,y,w,h,ca,cb,d){
  d=d||0.45; r(c,x,y,w,h,ca); c.fillStyle=cb;
  for(let dy=0;dy<h;dy++) for(let dx=(dy%2);dx<w;dx+=2)
    if(((dx*3+dy*5)%7)/7<d) c.fillRect(x+dx,y+dy,1,1);
}
function bayer(c,x,y,w,h,ca,cb,d){
  d=d||0.5;
  const M=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
  r(c,x,y,w,h,ca); c.fillStyle=cb;
  for(let dy=0;dy<h;dy++) for(let dx=0;dx<w;dx++)
    if(M[dy%4][dx%4]/16<d) c.fillRect(x+dx,y+dy,1,1);
}
function tri(c,x1,y1,x2,y2,x3,y3,col){
  c.fillStyle=col; c.beginPath();
  c.moveTo(x1,y1); c.lineTo(x2,y2); c.lineTo(x3,y3); c.closePath(); c.fill();
}
function txt(c,s,x,y,sz,col,sh){
  c.font='bold '+sz+'px "Courier New"'; c.textBaseline='top';
  if(sh){c.fillStyle='rgba(0,0,0,0.85)';c.fillText(s,x+1,y+1);}
  c.fillStyle=col; c.fillText(s,x,y);
}

/* ── COMPOSANTS PIXEL ART ─────────────────────────────────────────── */
function cloud(c,x,y,s,ca,cb){
  var p=[[2,0],[3,0],[4,0],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],
         [0,2],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],
         [0,3],[1,3],[2,3],[3,3],[4,3],[5,3],[6,3],[1,4],[2,4],[3,4],[4,4],[5,4]];
  p.forEach(function(q){r(c,x+q[0]*s,y+q[1]*s,s,s,q[1]<2?(cb||ca):ca);});
}
function tree(c,x,y,h,c1,c2,ct){
  r(c,x+3,y+h-5,2,5,ct||c2);
  r(c,x,y+5,8,h-9,c1); r(c,x+1,y+2,6,5,c1); r(c,x+2,y,4,4,c2); vl(c,x+7,y+4,h-9,c2);
}
function mtn(c,px,py,w,h,col,snow){
  c.fillStyle=col; c.beginPath(); c.moveTo(px,py+h);
  c.lineTo(px+w/2,py); c.lineTo(px+w,py+h); c.closePath(); c.fill();
  if(snow){var sw=w*.2; c.fillStyle=snow; c.beginPath();
    c.moveTo(px+w/2-sw,py+sw*2); c.lineTo(px+w/2,py); c.lineTo(px+w/2+sw,py+sw*2);
    c.closePath(); c.fill();}
}
function blk(c,x,y,s,t,c1,c2,c3){
  r(c,x,y,s,s,c1); r(c,x+1,y+1,s-2,s-2,c2); r(c,x+2,y+2,s-4,s-4,c1);
  if(t==='?'){c.fillStyle=c3||c2;c.font='bold '+(s-3)+'px "Courier New"';c.textBaseline='top';c.fillText('?',x+3,y+2);}
  else if(t==='b'){hl(c,x,y,s,c3||'#000');hl(c,x,y+Math.floor(s/2),s,c3||'#000');
    vl(c,x+Math.floor(s/4),y,Math.floor(s/2),c3||'#000');vl(c,x+Math.floor(3*s/4),y+Math.floor(s/2),Math.floor(s/2),c3||'#000');}
}
function starsF(c,W,H,ph,ca,cb,n){
  for(var i=0;i<n;i++){
    var sx=(i*73+i*i*3)%W, sy=(i*41+i*17)%Math.floor(H*ph);
    r(c,sx,sy,i%8===0?2:1,i%8===0?2:1,i%5===0?ca:cb);
  }
}
function hero(c,x,y,sc,ch,cb,cl){
  r(c,x+3*sc,y,5*sc,5*sc,ch);
  r(c,x+1*sc,y+5*sc,9*sc,8*sc,cb);
  r(c,x,y+7*sc,4*sc,6*sc,ch);
  r(c,x+8*sc,y+7*sc,4*sc,6*sc,ch);
  r(c,x+2*sc,y+13*sc,4*sc,7*sc,cl);
  r(c,x+6*sc,y+13*sc,4*sc,7*sc,cl);
}

/* ── POST-PROCESSING ──────────────────────────────────────────────── */
function postMONO(c,W,H){
  c.fillStyle='rgba(15,56,15,0.14)'; for(var y=0;y<H;y+=2)c.fillRect(0,y,W,1);
  c.fillStyle='rgba(15,56,15,0.05)'; for(var x=0;x<W;x+=2)c.fillRect(x,0,1,H);
}
function postCRT(c,W,H,a){
  c.fillStyle='rgba(0,0,0,'+(a||0.1)+')'; for(var y=0;y<H;y+=2)c.fillRect(0,y,W,1);
  var vg=c.createRadialGradient(W/2,H/2,H*.15,W/2,H/2,W*.65);
  vg.addColorStop(0,'transparent'); vg.addColorStop(1,'rgba(0,0,0,0.35)');
  c.fillStyle=vg; c.fillRect(0,0,W,H);
}
function postGEN(c,W,H){
  for(var y=1;y<H;y+=4){c.fillStyle='rgba(0,0,30,0.07)';c.fillRect(0,y,W,1);}
  c.fillStyle='rgba(0,0,20,0.05)'; c.fillRect(0,0,W,H);
}
function postPS1(c,W,H){
  c.fillStyle='rgba(0,0,30,0.10)';
  for(var y=0;y<H;y+=2) for(var x=y%4;x<W;x+=4) c.fillRect(x,y,1,1);
}
function postN64(c,W,H,fc){
  var g=c.createLinearGradient(0,H*.3,0,H);
  g.addColorStop(0,'transparent'); g.addColorStop(1,fc||'rgba(150,180,210,0.32)');
  c.fillStyle=g; c.fillRect(0,H*.3,W,H*.7);
}

/* ════════════════════════════════════════════════════════════════════
   SCÈNE : PLATFORM
   ════════════════════════════════════════════════════════════════════ */
function scenePlatform(c,W,H,game,p,era){
  var t=game.title.toLowerCase();
  var isSonic=t.indexOf('sonic')>=0;

  if(era==='MONO'){
    r(c,0,0,W,H,p.b);
    cloud(c,10,10,3,p.l,p.b); cloud(c,100,6,3,p.l,p.b); cloud(c,200,12,2,p.l,p.b);
    c.fillStyle=p.l; c.beginPath(); c.arc(50,H*.72,38,Math.PI,0); c.fill();
    c.fillStyle=p.m; c.beginPath(); c.arc(158,H*.70,50,Math.PI,0); c.fill();
    r(c,0,H*.75,W,H*.25,p.m); hl(c,0,H*.75,W,p.d);
    for(var gx=0;gx<W;gx+=6)r(c,gx,H*.75-2,3,3,p.l);
    [60,84,108].forEach(function(bx,i){blk(c,bx,H*.48,13,i===1?'?':'b',p.m,p.l,p.d);});
    r(c,20,H*.55,12,H*.2,p.m); r(c,18,H*.55,16,5,p.d); r(c,19,H*.56,14,3,p.l);
    var hx=45,hy=Math.floor(H*.59);
    r(c,hx+3,hy-10,7,4,p.d); r(c,hx,hy-7,13,4,p.d);
    r(c,hx+2,hy-3,9,8,p.m); r(c,hx,hy+5,4,6,p.m); r(c,hx+9,hy+5,4,6,p.m);

  } else if(era==='HOME8'){
    r(c,0,0,W,H*.6,p.sky);
    dither(c,0,H*.5,W,H*.1,p.sky,p.green,0.5);
    cloud(c,15,14,3,p.white,p.sky); cloud(c,100,8,3,p.white,p.sky); cloud(c,210,16,2,p.white,p.sky);
    r(c,0,H*.6,W,H*.4,p.green); hl(c,0,H*.6,W,p.brown);
    r(c,0,H*.73,W,H*.27,p.brown); dither(c,0,H*.73,W,5,p.green,p.brown,0.4);
    [52,68,84,100,116].forEach(function(bx,i){blk(c,bx,H*.42,14,i%2?'b':'?',p.orange||p.red,p.yellow||p.tan,p.dark);});
    r(c,22,H*.5,13,H*.23,p.green); r(c,20,H*.5,17,6,p.dgreen);
    var mx=45,my=Math.floor(H*.57);
    r(c,mx+3,my-11,8,5,p.red); r(c,mx,my-9,14,5,p.red);
    r(c,mx+3,my-5,8,9,p.tan); r(c,mx+1,my-3,3,3,p.tan); r(c,mx+10,my-3,3,3,p.tan);
    r(c,mx+1,my+4,5,7,p.blue); r(c,mx+8,my+4,5,7,p.blue);

  } else if(era==='ARC8'){
    [p.sky,p.l,p.m,p.d].forEach(function(col,i){r(c,0,H*i/4,W,H/4+1,col);});
    cloud(c,5,15,4,p.white,p.b); cloud(c,170,10,4,p.white,p.b);
    r(c,0,H*.65,W,H*.35,p.tan); dither(c,0,H*.65,W,6,p.tan,p.brown,0.4);
    hl(c,0,H*.65,W,p.dark);
    for(var tx=0;tx<W;tx+=22){hl(c,tx,H*.65,W,p.d);vl(c,tx,H*.65,H*.35,p.d);}
    var hxA=40,hyA=Math.floor(H*.38);
    r(c,hxA+4,hyA,10,10,p.tan); r(c,hxA+2,hyA+10,14,18,p.orange||p.red);
    r(c,hxA,hyA+13,5,9,p.tan); r(c,hxA+14,hyA+13,5,9,p.tan);
    r(c,hxA+3,hyA+28,6,8,p.brown); r(c,hxA+10,hyA+28,6,8,p.brown);

  } else if(era==='S16'){
    dither(c,0,0,W,H*.18,p.sky,p.l,0.15); dither(c,0,H*.18,W,H*.22,p.l,p.sky,0.25);
    cloud(c,8,12,3,p.white,p.sky); cloud(c,110,6,4,p.white,p.sky); cloud(c,220,14,3,p.white,p.sky);
    c.fillStyle=p.dgreen; c.beginPath(); c.arc(60,H*.72,55,Math.PI,0); c.fill();
    c.fillStyle=p.green;  c.beginPath(); c.arc(130,H*.7,50,Math.PI,0); c.fill();
    c.fillStyle=p.dgreen; c.beginPath(); c.arc(190,H*.68,65,Math.PI,0); c.fill();
    for(var tx2=0;tx2<W;tx2+=26)tree(c,tx2,H*.52,26,p.dgreen,p.green,p.brown);
    r(c,0,H*.7,W,H*.3,p.green); hl(c,0,H*.7,W,p.dgreen);
    r(c,0,H*.78,W,H*.22,p.brown);
    [55,74,93,112].forEach(function(bx,i){blk(c,bx,H*.45,16,i===1?'?':'b',p.orange,p.yellow||p.gold,p.brown);});
    var hxS=42,hyS=Math.floor(H*.55);
    r(c,hxS+4,hyS-12,9,6,p.red); r(c,hxS+1,hyS-9,15,6,p.red);
    r(c,hxS+4,hyS-3,9,10,p.tan); r(c,hxS,hyS+7,6,7,p.blue); r(c,hxS+11,hyS+7,6,7,p.blue);

  } else if(era==='G16'){
    if(isSonic){
      r(c,0,0,W,H*.6,p.bg);
      dither(c,0,0,W,H*.4,p.sky,p.dark,0.2);
      c.fillStyle=p.orange; c.beginPath(); c.arc(W*.78,H*.35,22,0,Math.PI*2); c.fill();
      c.fillStyle=p.yellow; c.beginPath(); c.arc(W*.78,H*.35,16,0,Math.PI*2); c.fill();
      c.strokeStyle=p.bright||p.l; c.lineWidth=3;
      c.beginPath(); c.arc(W*.2,H*.65,28,0,Math.PI*2); c.stroke();
      c.beginPath(); c.arc(W*.75,H*.7,20,0,Math.PI*2); c.stroke();
      c.fillStyle=p.green; c.beginPath(); c.arc(40,H*.72,45,Math.PI,0); c.fill();
      c.beginPath(); c.arc(180,H*.7,55,Math.PI,0); c.fill();
      r(c,0,H*.72,W,H*.28,p.green); r(c,0,H*.8,W,H*.2,p.brown);
      var sx=50,sy=Math.floor(H*.58);
      r(c,sx+4,sy-12,12,12,p.blue); r(c,sx+2,sy,12,10,p.blue);
      r(c,sx+5,sy-8,6,5,p.tan); r(c,sx+4,sy+10,4,6,p.tan); r(c,sx+9,sy+10,4,6,p.tan);
    } else {
      dither(c,0,0,W,H*.55,p.sky,p.dark,0.25);
      cloud(c,20,12,3,p.b,p.l); cloud(c,160,8,3,p.b,p.l);
      c.fillStyle=p.dgreen; c.beginPath(); c.arc(80,H*.7,50,Math.PI,0); c.fill();
      c.beginPath(); c.arc(220,H*.68,60,Math.PI,0); c.fill();
      r(c,0,H*.7,W,H*.3,p.dgreen); r(c,0,H*.78,W,H*.22,p.brown);
      [50,72,94].forEach(function(bx,i){blk(c,bx,H*.47,14,i===1?'?':'b',p.orange||p.red,p.yellow||p.gold,p.d);});
      var hxG=40,hyG=Math.floor(H*.58);
      r(c,hxG+3,hyG-12,8,6,p.b); r(c,hxG,hyG-7,14,7,p.cyan||p.blue);
      r(c,hxG+2,hyG,10,10,p.cyan||p.blue); r(c,hxG+1,hyG+10,4,7,p.d); r(c,hxG+8,hyG+10,4,7,p.d);
    }

  } else if(era==='P32'){
    bayer(c,0,0,W,H*.5,p.sky||p.m,p.dark,0.3);
    tri(c,0,H,W*.38,H*.5,W*.62,H*.5,p.m); tri(c,W*.62,H*.5,W,H,0,H,p.m);
    r(c,W*.38,H*.5,W*.24,H*.5,p.l);
    c.strokeStyle=p.gray; c.lineWidth=0.5;
    for(var i=1;i<5;i++){var tp=i/5,y2=H*.5+tp*H*.5,xL=W*.38*(1-tp),xR=W-W*.38*(1-tp);
      c.beginPath();c.moveTo(xL,y2);c.lineTo(xR,y2);c.stroke();}
    for(var j=-3;j<=3;j++){c.beginPath();c.moveTo(W/2+j*W*.06,H*.5);c.lineTo(W/2+j*W*.3,H);c.stroke();}
    var hxP=70,hyP=Math.floor(H*.32);
    tri(c,hxP+4,hyP,hxP,hyP+12,hxP+8,hyP+12,p.b);
    r(c,hxP,hyP+12,8,14,p.light||p.l); r(c,hxP-2,hyP+14,4,8,p.b); r(c,hxP+6,hyP+14,4,8,p.b);
    r(c,hxP+1,hyP+26,3,7,p.gray); r(c,hxP+4,hyP+26,3,7,p.gray);
    if(p.fog){c.fillStyle=p.fog;c.fillRect(0,H*.3,W,H*.25);}

  } else {
    /* N64/GBA/NDS */
    var vm=era==='GBA'||era==='NDS';
    if(vm){dither(c,0,0,W,H*.5,p.sky,p.b,0.2);}
    else{dither(c,0,0,W,H*.5,p.sky,p.d,0.25);}
    cloud(c,15,14,4,p.b,p.sky); cloud(c,190,10,4,p.b,p.sky);
    r(c,0,H*.55,W,H*.45,p.green); hl(c,0,H*.55,W,p.dgreen); r(c,0,H*.7,W,H*.3,p.brown);
    [5,55,110,200,255].forEach(function(tx){tree(c,tx,H*.42,28,p.dgreen,p.green,p.brown);});
    [75,94,113].forEach(function(bx,i){blk(c,bx,H*.37,16,i===1?'?':'b',p.orange||p.red,p.yellow||p.gold,p.d||p.dark);});
    var hxN=44,hyN=Math.floor(H*.44);
    r(c,hxN+4,hyN-12,10,7,p.red||p.m); r(c,hxN+1,hyN-8,16,7,p.red||p.m);
    r(c,hxN+3,hyN-1,10,12,p.tan||p.b); r(c,hxN+2,hyN+11,5,8,p.blue||p.m); r(c,hxN+9,hyN+11,5,8,p.blue||p.m);
    if(p.fog){c.fillStyle=p.fog;c.fillRect(0,H*.35,W,H*.25);}
  }
}

/* ════════════════════════════════════════════════════════════════════
   SCÈNE : RPG
   ════════════════════════════════════════════════════════════════════ */
function sceneRPG(c,W,H,game,p,era){

  if(era==='MONO'){
    r(c,0,0,W,H,p.b);
    c.fillStyle=p.l; c.beginPath(); c.arc(55,H*.8,55,Math.PI,0); c.fill();
    c.fillStyle=p.m; c.beginPath(); c.arc(175,H*.78,68,Math.PI,0); c.fill();
    r(c,0,H*.72,W,H*.28,p.m); hl(c,0,H*.72,W,p.d);
    for(var px=Math.floor(W*.38);px<W*.62;px+=4) r(c,px,H*.72,3,H*.28,p.l);
    r(c,8,H*.36,30,H*.36,p.m); [8,14,20,26,32].forEach(function(cx){r(c,cx,H*.33,5,6,p.m);});
    r(c,15,H*.5,8,6,p.l);
    var hxR=Math.floor(W*.47),hyR=Math.floor(H*.67);
    r(c,hxR+2,hyR-8,5,5,p.l); r(c,hxR,hyR-3,9,8,p.m); r(c,hxR+1,hyR+5,3,5,p.m); r(c,hxR+5,hyR+5,3,5,p.m);
    r(c,0,H*.82,W,H*.18,p.d); hl(c,0,H*.82,W,p.m);
    r(c,2,H*.85,W*.44,H*.13,p.m);
    txt(c,'FIGHT',5,H*.86,7,p.b); txt(c,'MAGIC',5,H*.86+9,7,p.b);
    txt(c,'RUN',W*.26,H*.86,7,p.b); txt(c,'ITEM',W*.26,H*.86+9,7,p.b);

  } else if(era==='HOME8'||era==='ARC8'){
    r(c,0,0,W,H*.55,p.sky);
    cloud(c,20,12,3,p.white,p.sky); cloud(c,155,8,3,p.white,p.sky);
    [0,45,90,145,200].forEach(function(mx){mtn(c,mx,H*.18,58,H*.37,p.m,null);});
    r(c,0,H*.6,W,H*.4,p.green); r(c,0,H*.73,W,H*.27,p.brown);
    [130,154,178,202].forEach(function(tx){r(c,tx,H*.55,16,18,p.dgreen);r(c,tx+1,H*.53,14,8,p.green);});
    r(c,5,H*.22,28,H*.38,p.dark||p.d);[5,12,20,27].forEach(function(cx){r(c,cx,H*.2,6,6,p.dark||p.d);});
    r(c,9,H*.37,8,7,p.orange||p.yellow);
    var hxH=70,hyH=Math.floor(H*.56);
    r(c,hxH+3,hyH-10,7,6,p.tan); r(c,hxH,hyH-5,13,10,p.blue||p.m);
    r(c,hxH+1,hyH+5,4,7,p.brown||p.d); r(c,hxH+8,hyH+5,4,7,p.brown||p.d);
    r(c,0,H*.8,W,H*.2,p.dark||p.d); hl(c,0,H*.8,W,p.yellow||p.gold||p.tan);
    r(c,3,H*.83,W*.42,H*.15,p.m);
    txt(c,'FIGHT',6,H*.85,7,p.tan||p.white,'sh'); txt(c,'MAGIC',6,H*.85+9,7,p.tan||p.white);
    r(c,W*.5,H*.83,W*.5,5,p.dark||p.d); r(c,W*.5,H*.83,W*.35,5,p.green);
    txt(c,'HP',W*.51,H*.83+6,6,p.white||p.b);

  } else if(era==='S16'||era==='G16'){
    dither(c,0,0,W,H*.5,p.sky,p.l,0.15);
    cloud(c,12,10,4,p.white||p.b,p.sky); cloud(c,195,7,4,p.white||p.b,p.sky);
    c.fillStyle=p.dgreen; c.beginPath(); c.arc(42,H*.72,65,Math.PI,0); c.fill();
    c.fillStyle=p.green;  c.beginPath(); c.arc(145,H*.70,72,Math.PI,0); c.fill();
    r(c,0,H*.68,W,H*.32,p.green); r(c,0,H*.76,W,H*.24,p.brown);
    r(c,4,H*.13,40,H*.55,p.gray||p.b);
    [4,11,18,26,34].forEach(function(cx){r(c,cx,H*.11,7,7,p.gray||p.b);});
    r(c,8,H*.3,10,8,p.orange||p.yellow); r(c,22,H*.35,10,8,p.orange||p.yellow);
    [112,136,158].forEach(function(tx){tree(c,tx,H*.56,24,p.dgreen,p.green,p.brown);});
    var hxS2=Math.floor(W*.47),hyS2=Math.floor(H*.62);
    r(c,hxS2+3,hyS2-14,8,8,p.tan); r(c,hxS2,hyS2-8,14,12,p.blue||p.m);
    r(c,hxS2-2,hyS2-4,4,8,p.tan); r(c,hxS2+12,hyS2-4,4,8,p.tan);
    r(c,hxS2+2,hyS2+4,4,8,p.brown); r(c,hxS2+8,hyS2+4,4,8,p.brown);

  } else if(era==='P32'){
    r(c,0,0,W,H,p.dark||p.bg);
    bayer(c,0,0,W,H*.42,p.sky||p.m,p.dark,0.22);
    starsF(c,W,H,0.45,p.pale||p.b,p.light||p.l,28);
    c.fillStyle=p.m||p.mid; c.beginPath(); c.moveTo(0,H*.65);
    c.lineTo(W*.3,H*.45); c.lineTo(W*.62,H*.5); c.lineTo(W,H*.42);
    c.lineTo(W,H); c.lineTo(0,H); c.closePath(); c.fill();
    if(p.fog){c.fillStyle=p.fog;c.fillRect(0,H*.35,W,H*.2);}
    [0,48,96,164,218].forEach(function(sx){
      var sh=(sx%96===0?H*.27:H*.22);
      r(c,sx,H*.4-sh,8,sh,p.light||p.l);
      hl(c,sx-2,H*.4-sh,12,p.pale||p.b);
    });
    r(c,0,H*.76,W,H*.24,p.dark||p.bg); hl(c,0,H*.76,W,p.gray||p.l);
    r(c,4,H*.79,58,H*.18,p.m||p.mid);
    txt(c,'FIGHT',7,H*.81,7,p.white||p.pale,'sh'); txt(c,'MAGIC',7,H*.81+9,7,p.white||p.pale);
    r(c,W*.45,H*.78,W*.5,5,p.dark); r(c,W*.45,H*.78,W*.38,5,p.green);
    r(c,W*.45,H*.85,W*.5,5,p.dark); r(c,W*.45,H*.85,W*.28,5,p.blue||p.m);
    txt(c,'HP',W*.46,H*.78+6,6,p.white||p.pale); txt(c,'MP',W*.46,H*.85+6,6,p.white||p.pale);

  } else {
    /* N64/GBA/NDS */
    var vm=era==='GBA'||era==='NDS';
    if(vm)dither(c,0,0,W,H*.5,p.sky,p.b,0.18); else dither(c,0,0,W,H*.5,p.sky,p.d,0.22);
    cloud(c,22,12,4,p.white||p.b,p.sky); cloud(c,183,8,4,p.white||p.b,p.sky);
    r(c,0,H*.55,W,H*.45,p.green); r(c,0,H*.7,W,H*.3,p.brown);
    [0,38,68,202,238].forEach(function(tx){tree(c,tx,H*.45,26,p.dgreen,p.green,p.brown);});
    mtn(c,W*.55,H*.1,92,H*.44,p.gray||p.m,p.white||p.b);
    r(c,W*.38,H*.55,W*.24,H*.45,p.tan||p.yellow);
    var hxN2=Math.floor(W*.44),hyN2=Math.floor(H*.5);
    r(c,hxN2+4,hyN2-12,10,8,p.tan||p.b); r(c,hxN2+1,hyN2-7,16,8,p.red||p.m);
    r(c,hxN2+3,hyN2+1,10,12,p.tan||p.b);
    r(c,hxN2+2,hyN2+13,5,8,p.blue||p.m); r(c,hxN2+9,hyN2+13,5,8,p.blue||p.m);
    if(p.fog){c.fillStyle=p.fog;c.fillRect(0,H*.4,W,H*.2);}
  }
}

/* ════════════════════════════════════════════════════════════════════
   SCÈNE : SHOOTER (shmup)
   ════════════════════════════════════════════════════════════════════ */
function sceneShooter(c,W,H,game,p,era){

  function ship(c,x,y,c1,c2,sc){
    sc=sc||1;
    r(c,x+4*sc,y,3*sc,6*sc,c1);
    r(c,x+2*sc,y+3*sc,7*sc,4*sc,c1);
    r(c,x,y+5*sc,11*sc,3*sc,c1);
    r(c,x+4*sc,y+7*sc,3*sc,3*sc,c2||c1);
  }
  function enemy(c,x,y,col,sc){
    sc=sc||1;
    r(c,x+2*sc,y,7*sc,2*sc,col); r(c,x,y+2*sc,11*sc,4*sc,col);
    r(c,x+3*sc,y+6*sc,5*sc,2*sc,col);
    r(c,x+1*sc,y+2*sc,2*sc,3*sc,col); r(c,x+8*sc,y+2*sc,2*sc,3*sc,col);
  }

  r(c,0,0,W,H,era==='MONO'?p.d:p.dark||p.bg);

  if(era==='MONO'){
    starsF(c,W,H,0.9,p.b,p.l,40);
    [0,1,2,3,4].forEach(function(col){[0,1].forEach(function(row){
      var ex=col*44+24,ey=row*22+12;
      r(c,ex+2,ey,7,2,p.m); r(c,ex,ey+2,11,4,p.m);
    });});
    ship(c,W/2-6,H*.72,p.m,p.l,1);
    r(c,W/2,H*.55,2,H*.18,p.l);
    hl(c,0,H*.62,W,p.m);
  } else {
    /* nebula */
    c.fillStyle=(p.blue||p.m)+'30';
    c.beginPath();c.arc(W*.62,H*.4,68,0,Math.PI*2);c.fill();
    c.fillStyle=(p.purple||p.red||p.m)+'28';
    c.beginPath();c.arc(W*.25,H*.55,55,0,Math.PI*2);c.fill();
    starsF(c,W,H,0.9,p.white||p.b,p.gray||p.l,55);

    var ec=p.red||'#CC2200', ec2=p.gray||p.m;
    [0,1,2,3,4,5].forEach(function(i){
      enemy(c,i*40+12,14,ec,1);
      enemy(c,i*40+20,32,ec2,1);
    });
    /* explosion */
    r(c,160,22,8,8,p.orange||p.yellow||'#FF8800');
    r(c,156,20,16,4,p.yellow||'#FFFF00');
    r(c,160,18,8,3,p.white||'#FFFFFF');

    var sc2=era==='P32'||era==='N64'||era==='S16'||era==='G16'?2:1;
    ship(c,W/2-5*sc2,H*.68,p.cyan||p.blue||p.l,p.yellow||p.gold,sc2);
    r(c,W/2,H*.45,sc2*2,H*.24,p.cyan||p.blue||p.l);
    /* exhaust */
    r(c,W/2-sc2,H*.68+10*sc2,sc2*3,sc2*4,p.orange||p.yellow);
    r(c,W/2,H*.68+13*sc2,sc2,sc2*3,p.white||'#FFF');
    if(era==='P32'&&p.fog){c.fillStyle=p.fog;c.fillRect(0,H*.85,W,H*.15);}
  }
}

/* ════════════════════════════════════════════════════════════════════
   SCÈNE : FIGHTING
   ════════════════════════════════════════════════════════════════════ */
function sceneFighting(c,W,H,game,p,era){

  function drawHPBars(){
    r(c,0,0,W,H*.1,p.dark||p.d);
    r(c,4,3,W*.42,7,p.d||p.dark); r(c,4,3,W*.34,7,p.green);
    r(c,W*.54,3,W*.42,7,p.d||p.dark); r(c,W*.56,3,W*.3,7,p.red);
    txt(c,'60',W/2-7,1,9,p.yellow||p.gold,'sh');
  }

  if(era==='MONO'){
    r(c,0,0,W,H,p.b);
    for(var cx=0;cx<W;cx+=8){
      c.fillStyle=cx%16===0?p.d:p.m; c.beginPath(); c.arc(cx+4,H*.38,5,Math.PI,0); c.fill();
      r(c,cx,H*.38,8,H*.1,cx%16===0?p.d:p.m);
    }
    r(c,0,H*.48,W,3,p.d);
    r(c,0,H*.68,W,H*.32,p.m); hl(c,0,H*.68,W,p.d);
    for(var fx=0;fx<W;fx+=8) r(c,fx,H*.68,4,H*.32,fx%16===0?p.d:p.m);
    hero(c,Math.floor(W*.18),Math.floor(H*.45),2,p.d,p.m,p.l);
    hero(c,Math.floor(W*.64),Math.floor(H*.45),2,p.d,p.l,p.m);
    r(c,2,2,W*.44,5,p.d); r(c,2,2,W*.38,5,p.m);
    r(c,W*.56,2,W*.44,5,p.d); r(c,W*.58,2,W*.36,5,p.l);
    txt(c,'VS',W/2-7,H*.28,9,p.d);

  } else if(era==='HOME8'||era==='ARC8'){
    r(c,0,0,W,H*.5,p.sky);
    if(era==='ARC8')[p.sky,p.l,p.m].forEach(function(col,i){r(c,0,H*i*.17,W,H*.17+1,col);});
    for(var cx2=0;cx2<W;cx2+=10){
      c.fillStyle=(Math.floor(cx2/10))%3===0?p.orange:p.gray||p.m;
      c.beginPath(); c.arc(cx2+5,H*.42,6,Math.PI,0); c.fill();
      r(c,cx2,H*.42,10,H*.1,c.fillStyle);
    }
    r(c,0,H*.68,W,H*.32,p.brown||p.tan);
    for(var fx2=0;fx2<W;fx2+=12) r(c,fx2,H*.68,6,H*.32,Math.floor(fx2/12)%2===0?(p.tan||p.brown):(p.brown||p.tan));
    hl(c,0,H*.68,W,p.dark||p.d);
    hero(c,Math.floor(W*.16),Math.floor(H*.36),3,p.tan,p.red,p.brown);
    hero(c,Math.floor(W*.64),Math.floor(H*.36),3,p.tan,p.blue||p.m,p.dark||p.d);
    drawHPBars();

  } else if(era==='S16'||era==='G16'){
    var g=c.createLinearGradient(0,0,0,H*.55);
    g.addColorStop(0,era==='S16'?(p.deep||p.d):p.dark); g.addColorStop(1,p.sky||p.l);
    c.fillStyle=g; c.fillRect(0,0,W,H*.55);
    r(c,0,H*.38,W,H*.12,p.m); dither(c,0,H*.38,W,H*.12,p.m,p.dark||p.d,0.35);
    for(var cx3=0;cx3<W;cx3+=7){
      c.fillStyle=Math.floor(cx3/7)%2===0?p.orange:p.blue||p.m;
      c.beginPath(); c.arc(cx3+3,H*.4,4,Math.PI,0); c.fill();
    }
    for(var fx3=0;fx3<W;fx3+=10) for(var fy=0;fy<H*.35;fy+=10){
      if((Math.floor(fx3/10)+Math.floor(fy/10))%2===0) r(c,fx3,H*.65+fy,10,10,p.tan||p.brown);
    }
    r(c,0,H*.65,W,H*.35,p.brown||p.tan); hl(c,0,H*.65,W,p.gold||p.yellow);
    hero(c,Math.floor(W*.14),Math.floor(H*.32),4,p.tan,p.red,p.brown);
    hero(c,Math.floor(W*.62),Math.floor(H*.32),4,p.tan,p.blue||p.m,p.dark||p.d);
    drawHPBars();

  } else if(era==='P32'){
    bayer(c,0,0,W,H*.55,p.sky||p.m,p.dark,0.28);
    r(c,0,H*.55,W,H*.1,p.m||p.gray);
    bayer(c,0,H*.65,W,H*.35,p.light||p.l,p.dark,0.45);
    if(p.fog){c.fillStyle=p.fog;c.fillRect(0,H*.45,W,H*.2);}
    hero(c,Math.floor(W*.15),Math.floor(H*.3),4,p.pale||p.b,p.blue||p.m,p.gray||p.d);
    hero(c,Math.floor(W*.6),Math.floor(H*.3),4,p.pale||p.b,p.red,p.gray||p.d);
    drawHPBars();

  } else {
    /* N64/GBA/NDS */
    var vm=era==='GBA'||era==='NDS';
    if(vm){dither(c,0,0,W,H*.55,p.sky,p.b,0.2);}
    else{var g2=c.createLinearGradient(0,0,0,H*.55);g2.addColorStop(0,p.dark);g2.addColorStop(1,p.sky);c.fillStyle=g2;c.fillRect(0,0,W,H*.55);}
    for(var cx4=0;cx4<W;cx4+=8){
      c.fillStyle=Math.floor(cx4/8)%2===0?p.orange:p.blue||p.m;
      c.beginPath(); c.arc(cx4+4,H*.42,5,Math.PI,0); c.fill();
      r(c,cx4,H*.42,8,H*.1,c.fillStyle);
    }
    r(c,0,H*.65,W,H*.35,p.tan||p.brown); hl(c,0,H*.65,W,p.gold||p.yellow);
    hero(c,Math.floor(W*.15),Math.floor(H*.3),4,p.tan||p.b,p.red,p.brown);
    hero(c,Math.floor(W*.62),Math.floor(H*.3),4,p.tan||p.b,p.blue||p.m,p.dgreen);
    drawHPBars();
  }
}

/* ════════════════════════════════════════════════════════════════════
   SCÈNE : ACTION / CASTLEVANIA / CONTRA-STYLE
   ════════════════════════════════════════════════════════════════════ */
function sceneAction(c,W,H,game,p,era){

  function torch(c,x,y){
    r(c,x-1,y,3,8,p.gray||p.m);
    r(c,x-1,y-5,3,5,p.orange||p.red||'#EE6600');
    r(c,x,y-7,2,3,p.yellow||p.gold||'#FFCC00');
  }

  r(c,0,0,W,H,p.dark||p.d);

  /* brick wall bg */
  var brickC=era==='MONO'?p.m:p.m, brickH=era==='MONO'?p.l:(p.light||p.pale||p.l);
  for(var row=0;row<8;row++) for(var col=0;col<Math.ceil(W/20);col++){
    var bx=col*20+(row%2)*10, by=row*12;
    r(c,bx+1,by+1,18,10,brickC);
    hl(c,bx,by,20,p.dark||p.d); vl(c,bx,by,12,p.dark||p.d);
    if(era!=='MONO') hl(c,bx+1,by+1,18,brickH+'40');
  }

  /* floor */
  r(c,0,H*.68,W,H*.32,p.m||p.brown);
  hl(c,0,H*.68,W,p.l||p.tan||p.gold);

  /* torches */
  [15,100,200].forEach(function(tx){torch(c,tx,Math.floor(H*.4));});

  /* platforms */
  [[0,H*.58,48],[82,H*.52,40],[148,H*.58,50],[214,H*.54,42]].forEach(function(pl){
    r(c,pl[0],pl[1],pl[2],5,p.gray||p.l);
    hl(c,pl[0],pl[1],pl[2],p.white||p.b);
  });

  /* hero */
  var hxA=70,hyA=Math.floor(H*.46);
  hero(c,hxA,hyA,3,p.tan||p.b||p.l,p.red||p.orange,p.brown||p.d);

  /* enemy */
  var ex=188,ey=Math.floor(H*.42);
  r(c,ex+3,ey,10,10,p.gray||p.m);
  r(c,ex,ey+10,16,16,p.dark||p.d);
  r(c,ex-3,ey+12,6,8,p.gray||p.m); r(c,ex+13,ey+12,6,8,p.gray||p.m);
  r(c,ex+5,ey+3,4,3,p.red||'#AA0000');
  r(c,ex+5,ey+6,4,3,p.orange||p.yellow||'#FF8800');

  if(era==='P32'&&p.fog){c.fillStyle=p.fog;c.fillRect(0,H*.45,W,H*.28);}
  if(era==='N64'&&p.fog){c.fillStyle=p.fog;c.fillRect(0,H*.42,W,H*.3);}
}

/* ════════════════════════════════════════════════════════════════════
   SCÈNE : RACING
   ════════════════════════════════════════════════════════════════════ */
function sceneRacing(c,W,H,game,p,era){

  function roadMarkings(){
    [[H*.55,W*.47,W*.06,3],[H*.64,W*.43,W*.13,5],[H*.74,W*.39,W*.21,7],[H*.86,W*.35,W*.29,8]]
    .forEach(function(m){r(c,m[1],m[0],m[2],m[3],p.yellow||p.white||p.b);});
  }

  if(era==='MONO'){
    r(c,0,0,W,H*.55,p.b);
    cloud(c,30,8,2,p.l,p.b); cloud(c,170,5,2,p.l,p.b);
    r(c,0,H*.55,W,H*.45,p.m); hl(c,0,H*.55,W,p.d);
    r(c,W*.3,H*.55,W*.4,H*.45,p.l);
    hl(c,W*.3,H*.55,W*.4,p.d); vl(c,W*.3,H*.55,H*.45,p.d); vl(c,W*.7,H*.55,H*.45,p.d);
    [H*.6,H*.68,H*.76,H*.84].forEach(function(dy){r(c,W*.47,dy,W*.06,3,p.d);});
    r(c,W*.42,H*.72,W*.16,6,p.d); r(c,W*.44,H*.68,W*.12,5,p.m);

  } else {
    /* sky */
    if(era==='S16'||era==='GBA'||era==='NDS'){
      dither(c,0,0,W,H*.45,p.sky,p.l,0.15);
    } else if(era==='P32'){
      bayer(c,0,0,W,H*.45,p.sky||p.m,p.dark,0.25);
    } else {
      r(c,0,0,W,H*.45,p.sky);
    }
    cloud(c,18,10,3,p.white||p.b,p.sky); cloud(c,175,6,3,p.white||p.b,p.sky);

    /* grass */
    r(c,0,H*.45,W,H*.55,p.green||p.dgreen);
    hl(c,0,H*.45,W,p.dgreen);
    /* side trees */
    [0,12,260,248].forEach(function(tx){tree(c,tx,H*.36,24,p.dgreen,p.green,p.brown);});
    /* mountain */
    if(era==='N64'||era==='GBA'||era==='NDS') mtn(c,W*.5,H*.08,95,H*.37,p.gray||p.m,p.white||p.b);

    /* road perspective */
    c.fillStyle=p.gray||p.m;
    c.beginPath(); c.moveTo(W*.28,H*.45); c.lineTo(W*.72,H*.45); c.lineTo(W,H); c.lineTo(0,H); c.closePath(); c.fill();
    if(era==='P32') bayer(c,W*.28,H*.45,W*.44,H*.55,p.light||p.l,p.gray||p.m,0.45);
    hl(c,0,H*.45,W,p.dark||p.d);

    roadMarkings();

    /* car */
    r(c,W*.37,H*.75,W*.26,11,p.red||p.orange);
    r(c,W*.4,H*.69,W*.2,9,p.tan||p.b||p.pale||p.white);
    r(c,W*.36,H*.83,W*.09,8,p.dark||p.d); r(c,W*.54,H*.83,W*.09,8,p.dark||p.d);

    if(era==='G16'){
      for(var y=H*.08;y<H*.42;y+=5){c.fillStyle='rgba(0,170,204,0.08)';c.fillRect(0,y,W,2);}
    }
    if(p.fog&&(era==='P32'||era==='N64')){c.fillStyle=p.fog;c.fillRect(0,H*.38,W,H*.12);}
  }
}

/* ════════════════════════════════════════════════════════════════════
   SCÈNE : SPORTS
   ════════════════════════════════════════════════════════════════════ */
function sceneSports(c,W,H,game,p,era){
  var t=game.title.toLowerCase();
  var isBasket=t.indexOf('nba')>=0||t.indexOf('basket')>=0;
  var fieldC=isBasket?(p.brown||'#8B4513'):(p.green||'#228B22');
  var lineC=p.white||p.b||'#FFFFFF';

  r(c,0,0,W,H,fieldC);
  c.strokeStyle=lineC+'70'; c.lineWidth=era==='MONO'?2:1;
  c.strokeRect(W*.1,H*.08,W*.8,H*.84);
  c.beginPath(); c.moveTo(W*.1,H*.5); c.lineTo(W*.9,H*.5); c.stroke();
  c.beginPath(); c.arc(W*.5,H*.5,H*.18,0,Math.PI*2); c.stroke();
  c.strokeRect(W*.32,H*.08,W*.36,H*.2);
  c.strokeRect(W*.32,H*.72,W*.36,H*.2);

  var ps=era==='MONO'?3:era==='HOME8'||era==='ARC8'?4:5;
  [[.24,.28],[.3,.5],[.24,.72],[.36,.38],[.36,.62]].forEach(function(s){
    r(c,W*s[0]-ps/2,H*s[1]-ps/2,ps,ps,p.red||p.orange||'#DD2200');
  });
  [[.64,.28],[.7,.5],[.64,.72],[.72,.38],[.72,.62]].forEach(function(s){
    r(c,W*s[0]-ps/2,H*s[1]-ps/2,ps,ps,p.blue||p.m||'#0033CC');
  });
  c.fillStyle=p.yellow||p.gold||'#F8D878';
  c.beginPath(); c.arc(W*.5,H*.5,ps,0,Math.PI*2); c.fill();

  r(c,0,0,W,H*.1,p.dark||p.d||'#000010');
  hl(c,0,H*.1,W,p.gold||p.yellow||'#FFCC00');
  txt(c,'P1:3',5,3,8,p.white||p.b||'#FFF');
  txt(c,'P2:2',W-38,3,8,p.white||p.b||'#FFF');
  txt(c,'00:45',W/2-18,2,8,p.yellow||p.gold||'#FFD700','sh');
}

/* ════════════════════════════════════════════════════════════════════
   SCÈNE : PUZZLE (Tetris / Dr. Mario / Puyo)
   ════════════════════════════════════════════════════════════════════ */
function scenePuzzle(c,W,H,game,p,era){
  r(c,0,0,W,H,era==='MONO'?p.d:p.dark||p.bg);

  var cW=14, cols=10, rows=16;
  var gX=Math.floor(W*.27), gY=Math.floor(H*.06);

  /* grid lines */
  c.strokeStyle=(era==='MONO'?p.l:p.gray||p.l)+'50'; c.lineWidth=1;
  for(var rr=0;rr<=rows;rr++){c.beginPath();c.moveTo(gX,gY+rr*cW);c.lineTo(gX+cols*cW,gY+rr*cW);c.stroke();}
  for(var cc=0;cc<=cols;cc++){c.beginPath();c.moveTo(gX+cc*cW,gY);c.lineTo(gX+cc*cW,gY+rows*cW);c.stroke();}

  /* block colours */
  var BC=era==='MONO'
    ? [p.m,p.l,p.d,p.b,p.m]
    : [p.red||'#CC2200',p.blue||p.m,p.green,p.yellow||p.gold,p.orange||p.tan||p.purple||p.blue];

  function cell(col,row,ci){
    var bx=gX+col*cW+1,by=gY+row*cW+1,bc=BC[ci%BC.length];
    r(c,bx,by,cW-2,cW-2,bc);
    hl(c,bx,by,cW-2,era==='MONO'?p.b:(p.white||p.b)+'70');
    vl(c,bx,by,cW-2,era==='MONO'?p.b:(p.white||p.b)+'50');
  }

  /* placed rows */
  var placed=[
    [0,14,0],[1,14,1],[2,14,2],[3,14,3],[4,14,4],[5,14,0],[6,14,1],[7,14,2],[8,14,3],[9,14,4],
    [0,13,1],[1,13,0],[2,13,2],[3,13,1],[4,13,3],[5,13,2],[6,13,4],[7,13,0],[8,13,1],[9,13,3],
    [0,12,2],[1,12,3],[2,12,0],[3,12,2],[4,12,1],[5,12,4],[6,12,2],[7,12,1],[8,12,0],[9,12,3],
    [0,11,0],[1,11,1],[2,11,2],[3,11,3],[4,11,0],[5,11,1],[6,11,2],[7,11,4],[8,11,3],[9,11,0],
    [1,10,3],[2,10,2],[3,10,4],[4,10,1],[5,10,3],[6,10,0],[7,10,2],[8,10,1],[9,10,4],
    [0,9,1],[1,9,0],[3,9,3],[5,9,2],[6,9,0],[8,9,4],
  ];
  placed.forEach(function(b){cell(b[0],b[1],b[2]);});

  /* falling piece (S-shape) */
  [[3,7],[4,7],[4,8],[5,8]].forEach(function(b){cell(b[0],b[1],0);});
  /* ghost */
  c.strokeStyle=BC[0]+'60'; c.lineWidth=1;
  [[3,12],[4,12],[4,13],[5,13]].forEach(function(b){c.strokeRect(gX+b[0]*cW+1,gY+b[1]*cW+1,cW-2,cW-2);});

  /* sidebar */
  var sx=4, sc=era==='MONO'?p.l:(p.yellow||p.gold||'#FFD700'), sw=era==='MONO'?p.m:(p.white||p.b||'#FAFAFA');
  txt(c,'SCORE',sx,H*.08,7,sc);
  txt(c,String((game.metascore||75)*980+12340),sx,H*.08+10,7,sw);
  txt(c,'LEVEL',sx,H*.3,7,sc); txt(c,' 08',sx,H*.3+10,7,sw);
  txt(c,'LINES',sx,H*.5,7,sc); txt(c,' 72',sx,H*.5+10,7,sw);
  txt(c,'NEXT',sx,H*.68,7,sc);
  [[0,0],[1,0],[1,1],[1,2]].forEach(function(d){
    if(era==='MONO') r(c,sx+d[0]*cW,H*.76+d[1]*cW,cW-1,cW-1,p.m);
    else {r(c,sx+d[0]*cW,H*.76+d[1]*cW,cW-1,cW-1,BC[1]);}
  });
}

/* ════════════════════════════════════════════════════════════════════
   SCÈNE : DEFAULT (paysage générique + identité console)
   ════════════════════════════════════════════════════════════════════ */
function sceneDefault(c,W,H,game,p,era){

  if(era==='MONO'){
    r(c,0,0,W,H,p.b);
    c.fillStyle=p.l; c.beginPath(); c.arc(W*.78,H*.22,18,0,Math.PI*2); c.fill();
    c.fillStyle=p.m; c.beginPath(); c.arc(W*.82,H*.18,14,0,Math.PI*2); c.fill();
    c.fillStyle=p.l; c.beginPath(); c.arc(50,H*.8,52,Math.PI,0); c.fill();
    c.fillStyle=p.m; c.beginPath(); c.arc(155,H*.78,64,Math.PI,0); c.fill();
    r(c,0,H*.72,W,H*.28,p.m); hl(c,0,H*.72,W,p.d);
    starsF(c,W,H,0.7,p.d,p.l,20);

  } else if(era==='HOME8'||era==='ARC8'){
    r(c,0,0,W,H*.6,p.sky);
    cloud(c,25,10,3,p.white,p.sky); cloud(c,150,6,3,p.white,p.sky); cloud(c,230,14,2,p.white,p.sky);
    [0,50,95,160,215].forEach(function(mx){mtn(c,mx,H*.16,60,H*.44,p.m,p.white);});
    r(c,0,H*.62,W,H*.38,p.green); r(c,0,H*.75,W,H*.25,p.brown);
    [20,70,155,215,258].forEach(function(tx){tree(c,tx,H*.5,22,p.dgreen,p.green,p.brown);});

  } else if(era==='S16'||era==='G16'){
    dither(c,0,0,W,H*.5,p.sky,p.l,0.12);
    cloud(c,10,10,4,p.white||p.b,p.sky); cloud(c,190,6,4,p.white||p.b,p.sky);
    c.fillStyle=p.dgreen; c.beginPath(); c.arc(55,H*.72,65,Math.PI,0); c.fill();
    c.fillStyle=p.green;  c.beginPath(); c.arc(155,H*.7,72,Math.PI,0); c.fill();
    c.fillStyle=p.dgreen; c.beginPath(); c.arc(248,H*.68,70,Math.PI,0); c.fill();
    r(c,0,H*.68,W,H*.32,p.green); r(c,0,H*.76,W,H*.24,p.brown);
    mtn(c,W*.5,H*.08,110,H*.42,p.gray||p.m,p.white||p.b);
    [5,50,220,265].forEach(function(tx){tree(c,tx,H*.53,26,p.dgreen,p.green,p.brown);});

  } else if(era==='P32'){
    r(c,0,0,W,H,p.dark);
    bayer(c,0,0,W,H*.42,p.sky||p.m,p.dark,0.2);
    starsF(c,W,H,0.42,p.pale||p.b,p.light||p.l,35);
    c.fillStyle=p.m||p.mid;
    c.beginPath(); c.moveTo(0,H*.7); c.lineTo(W*.32,H*.48); c.lineTo(W*.65,H*.52);
    c.lineTo(W,H*.45); c.lineTo(W,H); c.lineTo(0,H); c.closePath(); c.fill();
    if(p.fog){c.fillStyle=p.fog;c.fillRect(0,H*.38,W,H*.2);}

  } else {
    /* N64/GBA/NDS */
    var vm=era==='GBA'||era==='NDS';
    if(vm){dither(c,0,0,W,H*.5,p.sky,p.b,0.18);}
    else{var g=c.createLinearGradient(0,0,0,H*.5);g.addColorStop(0,p.dark);g.addColorStop(1,p.sky);c.fillStyle=g;c.fillRect(0,0,W,H*.5);}
    cloud(c,20,12,4,p.white||p.b,p.sky); cloud(c,185,8,4,p.white||p.b,p.sky);
    mtn(c,W*.48,H*.08,100,H*.42,p.gray||p.m,p.white||p.b);
    r(c,0,H*.55,W,H*.45,p.green); r(c,0,H*.7,W,H*.3,p.brown);
    [5,55,215,265].forEach(function(tx){tree(c,tx,H*.44,28,p.dgreen,p.green,p.brown);});
    if(p.fog){c.fillStyle=p.fog;c.fillRect(0,H*.42,W,H*.22);}
  }
}

/* ════════════════════════════════════════════════════════════════════
   DÉTECTION DE GENRE
   ════════════════════════════════════════════════════════════════════ */
function detectScene(game){
  var t=(game.title+' '+(game.developer||'')).toLowerCase();
  if(/mario|sonic|kirby|crash|spyro|rayman|donkey kong|yoshi|banjo|conker|klonoa|earthworm jim|bonk|wonder boy|alex kidd|wario land/.test(t)) return 'platform';
  if(/final fantasy|chrono|dragon quest|xenogears|earthbound|secret of mana|wild arms|suikoden|breath of fire|vagrant|lufia|phantasy star|tales of|golden sun|fire emblem|harvest moon|pokemon|ogre battle|tactics|grandia|lunar|shining|albert odyssey|disgaea|etrian|layton|hotel dusk|ghost trick|zero escape|phoenix wright/.test(t)) return 'rpg';
  if(/street fighter|mortal kombat|king of fighters|tekken|virtua fighter|samurai shodown|fatal fury|soul cal|art of fighting|darkstalkers|dead or alive|marvel vs|capcom vs|real bout|last blade|garou|power stone|fighters megamix|killer instinct/.test(t)) return 'fighting';
  if(/gradius|r-type|ikaruga|thunder force|radiant silver|darius|galaga|raiden|pulstar|blazing star|soldier blade|air zonk|life force|space harrier|axelay|parodius|aerofighters/.test(t)) return 'shooter';
  if(/castlevania|contra|metroid|ninja gaiden|battletoads|bionic|gunstar|shinobi|ghosts.n.goblins|batman|double dragon|tmnt|turtles|strider|alien soldier|hard corps|comix zone|dynamite head|vectorman|sparkster|landstalker/.test(t)) return 'action';
  if(/mario kart|gran turismo|ridge racer|need for speed|wipeout|f-zero|wave race|sega rally|daytona|racing|driver|outrun|top gear|rock n roll racing/.test(t)) return 'racing';
  if(/nba|nfl|fifa|madden|baseball|hockey|tennis|golf|soccer|basketball|tecmo bowl|slam/.test(t)) return 'sports';
  if(/tetris|puzzle|dr mario|puyo|columns|klax|panel de pon|meteos|bust.a.move|lumines|magical drop|bomberman/.test(t)) return 'puzzle';
  return 'default';
}

/* ── TITRE + OVERLAYS ─────────────────────────────────────────────── */
function drawTitleBar(c,W,H,game,p,era){
  var bc=era==='MONO'?p.d:(p.dark||p.bg||'#050508');
  var lc=era==='MONO'?p.m:(p.gold||p.yellow||p.tan||'#F8D878');
  var tc=era==='MONO'?p.b:(p.white||p.pale||p.b||'#F8F8F8');
  var sc=era==='MONO'?p.l:(p.gray||p.l||'#888888');

  c.fillStyle=bc+'EE'; c.fillRect(0,H-36,W,36);
  hl(c,0,H-37,W,lc);
  hl(c,0,H-38,W,lc+'60');

  var ttl=game.title.length>26?game.title.slice(0,25)+'\u2026':game.title;
  c.font='bold 10px "Courier New"'; c.textBaseline='top';
  c.fillStyle='rgba(0,0,0,0.8)'; c.fillText(ttl,6,H-31);
  c.fillStyle=tc; c.fillText(ttl,5,H-32);

  c.font='7px "Courier New"';
  c.fillStyle=sc; c.fillText(game.console,5,H-19);
  if(game.year){c.textAlign='right';c.fillStyle=sc+'CC';c.fillText(String(game.year),W-5,H-19);c.textAlign='left';}
  c.textAlign='right'; c.fillStyle=lc+'55'; c.font='6px "Courier New"'; c.fillText('RETRODEX',W-4,H-9);
  c.textAlign='left';
}

function applyPost(c,W,H,p,era){
  if(era==='MONO')     postMONO(c,W,H);
  else if(era==='G16') postGEN(c,W,H);
  else if(era==='P32') postPS1(c,W,H);
  else if(era==='N64') postN64(c,W,H,p.fog);
  else if(era==='HOME8'||era==='ARC8'||era==='GBA') postCRT(c,W,H,0.08);
  else if(era==='S16') postCRT(c,W,H,0.06);
}

/* ════════════════════════════════════════════════════════════════════
   POINT D'ENTRÉE PUBLIC
   ════════════════════════════════════════════════════════════════════ */
function draw(ctx,W,H,game){
  var p   = CONSOLE_PAL[game.console] || PAL.NES;
  var era = ERA_MAP[game.console]     || 'HOME8';
  var scene = detectScene(game);

  switch(scene){
    case 'platform': scenePlatform(ctx,W,H,game,p,era); break;
    case 'rpg':      sceneRPG(ctx,W,H,game,p,era);      break;
    case 'fighting': sceneFighting(ctx,W,H,game,p,era); break;
    case 'shooter':  sceneShooter(ctx,W,H,game,p,era);  break;
    case 'action':   sceneAction(ctx,W,H,game,p,era);   break;
    case 'racing':   sceneRacing(ctx,W,H,game,p,era);   break;
    case 'sports':   sceneSports(ctx,W,H,game,p,era);   break;
    case 'puzzle':   scenePuzzle(ctx,W,H,game,p,era);   break;
    default:         sceneDefault(ctx,W,H,game,p,era);  break;
  }

  applyPost(ctx,W,H,p,era);
  drawTitleBar(ctx,W,H,game,p,era);
}

return { draw: draw };
})();
