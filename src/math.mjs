const integer=(max,rng)=>1+Math.floor(rng()*max);
export function makeCount(level,rng=Math.random){return {n:integer(level===1?5:10,rng)};}
export function makeAddition(level,rng=Math.random){const sum=1+integer(level===3?4:9,rng),a=integer(sum-1,rng);return {a,b:sum-a,sum};}
export function makeBudget(level=5,rng=Math.random){const budget=integer(10,rng),count=integer(budget,rng);return {budget,items:Array.from({length:count},()=>({price:1}))};}
