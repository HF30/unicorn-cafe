const distance = (p,a,b) => {
 const dx=b[0]-a[0],dy=b[1]-a[1],d=dx*dx+dy*dy;
 const t=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d)):0;
 return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
};
const near=(p,strokes,r)=>strokes.some(s=>s.length===1?Math.hypot(p[0]-s[0][0],p[1]-s[0][1])<=r:s.some((b,i)=>i&&distance(p,s[i-1],b)<=r));
function sample(strokes){return strokes.flatMap(s=>s.flatMap((a,i)=>{if(!i)return [a];const b=s[i-1],n=Math.max(1,Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.01));return Array.from({length:n},(_,j)=>[b[0]+(a[0]-b[0])*(j+1)/n,b[1]+(a[1]-b[1])*(j+1)/n]);}));}
export function scoreTrace(glyph,strokes,cfg){
 const points=strokes.flat(),template=sample(glyph.strokes);
 if(!points.length||!template.length)return {pass:false,coverage:0,inside:0};
 const inside=points.filter(p=>near(p,glyph.strokes,cfg.corridorRatio)).length/points.length;
 const coverage=template.filter(p=>near(p,strokes,cfg.corridorRatio)).length/template.length;
 return {pass:inside>=cfg.minInside&&coverage>=cfg.minCoverage,inside,coverage};
}

// Scale-tolerant scorer for guide steps g4-g5: her drawing is scaled uniformly so its larger side equals the template's, centred on the template's centre, then scored as scoreTrace.
export function scoreFree(glyph,strokes,cfg){
 const pts=strokes.flat();if(!pts.length)return {pass:false,inside:0,coverage:0,scale:0};
 const bb=ps=>{const xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);return {w:x1-x0,h:y1-y0,cx:(x0+x1)/2,cy:(y0+y1)/2};};
 const t=bb(glyph.strokes.flat()),h=bb(pts),hs=Math.max(h.w,h.h);
 if(hs<cfg.minSize)return {pass:false,inside:0,coverage:0,scale:0};
 const k=Math.max(t.w,t.h)/hs,m=strokes.map(s=>s.map(([x,y])=>[(x-h.cx)*k+t.cx,(y-h.cy)*k+t.cy]));
 return {...scoreTrace(glyph,m,cfg),scale:k};
}
// One numbered arrow per stroke: its number, its first point and the angle of its first segment.
export const strokeArrows=glyph=>glyph.strokes.map((s,i)=>({n:i+1,x:s[0][0],y:s[0][1],angle:Math.atan2(s[1][1]-s[0][1],s[1][0]-s[0][0])}));
