class TaskRouter{
 constructor({getSettings,getLocalBrain}={}){this.getSettings=getSettings||(()=>({}));this.getLocalBrain=getLocalBrain||(()=>null)}
 async route(text){
  const s=await this.getSettings()||{},t=String(text||"").trim(),l=t.toLowerCase();
  if(!t)return{type:"conversation",complexity:"simple",brain:"auto",reason:"empty-request"};
  const mode=["api","local","auto"].includes(String(s.brainMode||"auto"))?String(s.brainMode||"auto"):"auto";
  const conversational=/^(hi|hello|hey|thanks|thank you|good morning|good evening|how are you|who are you|what can you do|من انت|مرحبا|اهلا|شكرا|كيف حالك|ماذا تستطيع)\b/i.test(l);
  const informational=/^(what time|what's the time|what is the time|what date|what day is it|كم الساعة|ما هو تاريخ اليوم|ما هو اليوم)/i.test(l);
  const action=/\b(open|launch|start|close|show|create|delete|move|copy|rename|find|search|calculate|read|write|send|download|install|run|افتح|شغل|اغلق|انشئ|احذف|انقل|انسخ|اعد تسمية|ابحث|احسب|اقرأ|اكتب|ارسل|نزّل|ثبت|نفذ)\b/i.test(l);
  const multi=(l.match(/\b(and|then|after|also|finally|و|ثم|بعدها|أيضا|وايضا)\b/gi)||[]).length>=1;
  const complexity=multi||l.length>220?"complex":action?"moderate":"simple";
  if(mode==="local")return{type:conversational||informational?"conversation":"agent",complexity,brain:"local",reason:"forced-local"};
  if(mode==="api")return{type:conversational&&!action?"conversation":"agent",complexity,brain:"api",reason:"forced-api"};
  const local=this.getLocalBrain();
  if(conversational||informational)return{type:"conversation",complexity:"simple",brain:local?"local":"api",reason:local?"auto-local-conversation":"auto-api-no-local"};
  if(complexity==="complex")return{type:"agent",complexity,brain:"api",reason:"auto-api-complex"};
  if(local)return{type:"agent",complexity,brain:"local",reason:"auto-local-capable"};
  return{type:"agent",complexity,brain:"api",reason:"auto-api-no-local"};
 }
}
module.exports={TaskRouter};
