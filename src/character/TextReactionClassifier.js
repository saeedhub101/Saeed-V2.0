import { TEXT_REACTIONS } from "./TextReactions.js";

// Classifies Arabic and English text without mutating character state.
export function classifyTextReaction(text){
  const clean=String(text||"").normalize("NFC").replace(/[\u064B-\u065F\u0670\u0640]/g,"").replace(/[إأآٱ]/g,"ا").replace(/ى/g,"ي").toLocaleLowerCase().trim();
  if(!clean)return null;
  // Avoid treating negated emotion/intent words as positive signals.
  const guarded=[
   {id:"urgency",pattern:/(?:\b(?:not urgent|no rush|don't hurry|do not hurry|not an emergency)\b|مش مستعجل|ليس عاجلا|مش ضروري)/i},
   {id:"affirmation",pattern:/(?:\b(?:not okay|not ok|not correct|not agreed|not sure)\b|مش تمام|غير موافق|مش صحيح)/i},
   {id:"disagreement",pattern:/(?:\b(?:no problem|not wrong|not disagree)\b|لا مشكلة|ما في مشكلة)/i},
   {id:"anger",pattern:/\b(?:not angry|not mad|not furious|not upset)\b|مش معصب|مش غاضب|لست غاضبا/i},
   {id:"worry",pattern:/\b(?:not worried|not anxious|not nervous|don't worry|do not worry)\b|مش قلقان|مش متوتر|لا تقلق/i},
   {id:"sadness",pattern:/\b(?:not sad|not lonely|not disappointed|not upset)\b|مش زعلان|مش حزين|لست حزينا/i},
   {id:"boredom",pattern:/\b(?:not bored|not boring|not tired of this)\b|مش طفشان|مش زهقان/i},
   {id:"excitement",pattern:/\b(?:not excited|not amazing|not awesome|not perfect)\b|مش متحمس|مش ممتاز/i},
   {id:"confusion",pattern:/\b(?:not confused|i understand now|now i understand)\b|فهمت الآن|هسا فهمت/i},
   {id:"curiosity",pattern:/\b(?:not curious|not interested|don't need details|do not need details)\b|مش مهتم|لا أحتاج تفاصيل/i}
  ];
  const blocked=new Set(guarded.filter(item=>item.pattern.test(clean)).map(item=>item.id));
  const found=TEXT_REACTIONS.find(item=>!blocked.has(item.id)&&item.pattern.test(clean));
  if(found)return found;
  // Recover common Arabic variants without diacritics or hamza differences.
  const compact=clean.replace(/\s+/g," ");
  if(/(?:^|\s)(?:اهلا|مرحبا|السلام عليكم|صباح الخير|مساء الخير)(?:\s|$)/i.test(compact))return TEXT_REACTIONS.find(x=>x.id==="greeting");
  if(/(?:^|\s)(?:شكرا|مشكور|يسلمو)(?:\s|$)/i.test(compact))return TEXT_REACTIONS.find(x=>x.id==="thanks");
  return null;
 }
