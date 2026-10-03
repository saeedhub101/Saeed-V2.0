(()=>{
const KEY="saeed.prayer.times.v1";
const API="https://api.aladhan.com/v1/calendarByCity";
const prayers=[
  ["Fajr","الفجر"],["Dhuhr","الظهر"],["Asr","العصر"],["Maghrib","المغرب"],["Isha","العشاء"]
];
let timer=0,active=true,city="Amman",country="Jordan";

function cacheKey(city,country,year,month){return `${KEY}:${city}:${country}:${year}-${String(month).padStart(2,"0")}`}
function parseTime(value){
  const m=String(value||"").match(/(\\d{1,2}):(\\d{2})/);
  return m?{hour:Number(m[1]),minute:Number(m[2])}:null;
}
function readCache(city,country,year,month){
  try{
    const x=JSON.parse(localStorage.getItem(cacheKey(city,country,year,month))||"null");
    if(!x?.days?.length)return null;
    const age=Date.now()-Number(x.savedAt||0);
    return age>31*24*60*60*1000?null:x;
  }catch{return null}
}
function writeCache(city,country,year,month,data){
  try{localStorage.setItem(cacheKey(city,country,year,month),JSON.stringify({savedAt:Date.now(),city,country,year,month,days:data}))}catch{}
}
async function fetchMonth(city,country,year,month){
  const url=`${API}/${year}/${month}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}`;
  const r=await fetch(url,{cache:"no-store"});if(!r.ok)throw new Error("Prayer-times HTTP "+r.status);
  const json=await r.json();if(json?.code!==200||!Array.isArray(json.data))throw new Error("Prayer-times API returned invalid data");
  const days=json.data.map(d=>({date:d?.date?.gregorian?.date,timings:d.timings||{}})).filter(d=>d.date);
  if(!days.length)throw new Error("Prayer-times API returned no days");
  writeCache(city,country,year,month,days);return days;
}
async function loadMonth(city,country,year,month){
  return readCache(city,country,year,month)||await fetchMonth(city,country,year,month);
}
function nextPrayer(events){
  const now=Date.now();
  return events.filter(e=>e.at>now).sort((a,b)=>a.at-b.at)[0]||null;
}
async function buildEvents(city,country){
  const now=new Date(),year=now.getFullYear(),month=now.getMonth()+1;
  let days=await loadMonth(city,country,year,month);
  if(now.getDate()>days.length-2){
    try{
      const next=await loadMonth(city,country,year+(month===12?1:0),month===12?1:month+1);
      days=days.concat(next);
    }catch{}
  }
  const events=[];
  for(const d of days){
    const parts=String(d.date).split("-");
    if(parts.length!==3)continue;
    const [day,mo,yr]=parts.map(Number);
    for(const [key,ar] of prayers){
      const t=parseTime(d.timings[key]);if(!t)continue;
      const at=new Date(yr,mo-1,day,t.hour,t.minute,0,0).getTime();
      if(at>Date.now()-30000)events.push({key,ar,at});
    }
  }
  return events;
}
async function trigger(e){
  if(!active)return;
  window.saeedAnimationController?.setIntent?.("doing");
  window.saeedCharacterController?.play?.("adhanOpening",{duration:5200,layer:"special",priority:60,intensity:1});
  window.saeedShowMessageBubble?.("حان وقت صلاة "+e.ar,false);
  window.saeedPrayerSpeak?.("الله أكبر... الله أكبر...");
  setTimeout(()=>{if(active){window.saeedCharacterController?.stop?.("adhanOpening");window.saeedAnimationController?.setIntent?.("idle")}},5600);
}
async function schedule(nextCity=city,nextCountry=country){
  city=String(nextCity||"Amman");country=String(nextCountry||"Jordan");
  if(timer)clearTimeout(timer);
  try{
    const events=await buildEvents(city,country),next=nextPrayer(events);
    if(!next)return;
    const delay=Math.max(1000,Math.min(next.at-Date.now(),2147483647));
    timer=setTimeout(async()=>{timer=0;await trigger(next);await schedule(city,country)},delay);
    window.saeed?.reportDiagnostic?.("INFO","PRAYER TIMES","Next prayer scheduled",{prayer:next.key,at:new Date(next.at).toISOString(),city,country,cached:true});
  }catch(e){
    window.saeed?.reportDiagnostic?.("ERROR","PRAYER TIMES",e.message);
    timer=setTimeout(()=>schedule(city,country),6*60*60*1000);
  }
}
window.saeedPrayerTimes={
 start:(options={})=>{active=true;city=String(options.city||city);country=String(options.country||country);return schedule(city,country)},
 refresh:async(options={})=>{active=true;city=String(options.city||city);country=String(options.country||country);try{const now=new Date();localStorage.removeItem(cacheKey(city,country,now.getFullYear(),now.getMonth()+1))}catch{}return schedule(city,country)},
 stop:()=>{active=false;if(timer)clearTimeout(timer);timer=0},
 status:()=>({active,city,country,nextScheduledAt:timer?true:false})
};
window.addEventListener("load",()=>schedule(city,country));
})();