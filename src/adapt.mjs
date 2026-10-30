export function nextLevel(level,history,max){
 let n=level;
 if(history.length>=3&&history.slice(-3).every(x=>x==='demo'))n--;
 else if(history.length>=5&&history.slice(-5).filter(x=>x==='first').length>=4)n++;
 return Math.max(1,Math.min(max,n));
}
