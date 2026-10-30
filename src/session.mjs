// Session limit. limitMinutes 0 = Off = always 'play'. With a limit L: 'play' before L - windDown, 'winddown' from then,
// 'end' at >= L only when no task is in progress (a task in progress stays 'winddown': there is no hard cap, never mid-task).
export function sessionPhase(elapsedMs,{limitMinutes=0,windDownMinutes=2}={},{taskInProgress=false}={}){
 if(!limitMinutes)return 'play';
 const minutes=elapsedMs/60000;
 if(minutes>=limitMinutes&&!taskInProgress)return 'end';
 return minutes>=limitMinutes-windDownMinutes?'winddown':'play';
}
