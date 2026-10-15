// Multilingual semantic patterns mapped to neutral character reactions.
const TEXT_REACTIONS=[
 {id:"worry",pattern:/(?:\b(worried|anxious|nervous|scared|afraid|concerned|i am stressed|i'm stressed)\b|قلقان|قلقة|متوتر|متوترة|خائف|خايف|خايفة|أشعر بالقلق|اشعر بالقلق|حاسس بضغط)/i,mood:"thoughtful",motion:"think",expression:"sad"},
 {id:"anger",pattern:/(?:\b(i am angry|i'm angry|furious|pissed off|fed up|this is ridiculous)\b|أنا غاضب|انا غاضب|معصب|مستفز|طفح الكيل|هذا سخيف)/i,mood:"thoughtful",motion:"think",expression:"confused"},
 {id:"empathy",pattern:/(?:\b(having a hard time|rough day|i feel terrible|i feel bad|i am struggling|i'm struggling)\b|يوم صعب|أشعر بالسوء|اشعر بالسوء|تعبان نفسيا|أعاني|اعاني|الأمور صعبة|الامور صعبة)/i,mood:"thoughtful",motion:"nod",expression:"sad"},
 {id:"celebration",pattern:/(?:\b(i did it|we did it|finally worked|it worked|problem solved|we made it)\b|نجحت|زبطت|اشتغل|انحلت المشكلة|حليناها|أخيرا نجح|اخيرا نجح)/i,mood:"cheerful",motion:"clap",expression:"happy"},
 {id:"curiosity",pattern:/(?:\b(i wonder|interesting|tell me more|i am curious|i'm curious)\b|مثير للاهتمام|احكيلي أكثر|احكيلي اكثر|أخبرني المزيد|اخبرني المزيد|عندي فضول|غريب فعلا)/i,mood:"curious",motion:"lookCloser",expression:"surprised"},

 {id:"urgency",pattern:/(?:\b(urgent|asap|emergency|quickly|hurry|right now)\b|بسرعة|مستعجل|ضروري جدا|ضروري|حالا|فورا|مستعجل جدا)/i,mood:"puzzled",motion:"lookCloser",expression:"surprised"},
 {id:"apology",pattern:/(?:\b(i am sorry|i'm sorry|my apologies|forgive me|sorry about that)\b|آسف|اسف|أعتذر|اعتذر|سامحني|حقك علي)/i,mood:"thoughtful",motion:"nod",expression:"sad"},
 {id:"encouragement",pattern:/(?:\b(you can do it|keep going|don't give up|well try again|you've got this)\b|تقدر|استمر|لا تستسلم|حاول مرة أخرى|أنت قادر)/i,mood:"cheerful",motion:"nod",expression:"happy"},
 {id:"affection",pattern:/(?:\b(i appreciate you|you are the best|love you|proud of you)\b|أحبك|بحبك|أقدرك|فخور بك|انت الأفضل|أنت الأفضل)/i,mood:"pleased",motion:"wave",expression:"happy"},
 {id:"boredom",pattern:/(?:\b(bored|boring|nothing to do|i'm tired of this)\b|طفشان|مللت|ممل|زهقان|لا يوجد شيء أفعله)/i,mood:"sleepy",motion:"stretch",expression:"sleepy"},
 {id:"confusion",pattern:/(?:\b(i don't understand|i do not understand|confused|what do you mean)\b|مش فاهم|مش فاهمة|لم أفهم|ماذا تقصد)/i,mood:"curious",motion:"think",expression:"confused"},
 {id:"question",pattern:/(?:\b(why|how|what|when|where|who|which|can you|could you|would you|is it|are you|explain|what do you think)\b|كيف|لماذا|ليش|شو|ماذا|متى|أين|اين|وين|ازاي|شلون|اشلون|هل|اشرح)/i,mood:"curious",motion:"lookCloser",expression:"surprised"},
 {id:"excitement",pattern:/(?:\b(wow|awesome|fantastic|amazing|excited|love it|perfect|yes!)\b|واو|رائع جدا|ممتاز جدا|يا سلام|مذهل|متحمس)/i,mood:"cheerful",motion:"dance",expression:"happy"},
 {id:"sadness",pattern:/(?:\b(sad|upset|lonely|bad day|disappointed|sorry to hear)\b|حزين|زعلان|متضايق|وحيد|يوم سيء|آسف)/i,mood:"thoughtful",motion:"nod",expression:"sad"},
 {id:"affirmation",pattern:/(?:\b(yes|yeah|yep|correct|exactly|agreed|sure|okay|ok)\b|نعم|اه|آه|تمام|صحيح|بالضبط|موافق)/i,mood:"pleased",motion:"nod",expression:"happy"},
 {id:"disagreement",pattern:/(?:\b(no|nope|not really|disagree|incorrect|that's wrong)\b|لا|مش صحيح|غير صحيح|بالعكس|خطأ)/i,mood:"puzzled",motion:"shake",expression:"confused"},
 {id:"greeting",pattern:/(?:\b(hello|hi|hey|good morning|good evening)\b|مرحبا|اهلا|أهلا|السلام عليكم|صباح الخير|مساء الخير)/i,mood:"cheerful",motion:"wave",expression:"happy"},
 {id:"thanks",pattern:/(?:\b(thanks|thank you|thx|much appreciated)\b|شكرا|شكرًا|يسلمو|مشكور)/i,mood:"pleased",motion:"nod",expression:"happy"},
 {id:"praise",pattern:/(?:\b(great job|well done|amazing|awesome|brilliant|you are great)\b|رائع|مبدع|أحسنت|احسنت|ممتاز جدا)/i,mood:"mischievous",motion:"dance",expression:"happy"},
 {id:"frustration",pattern:/(?:\b(doesn't work|does not work|broken|wrong|annoying|frustrated|failed|error)\b|ما اشتغل|لا يعمل|خطأ|غلط|فاشل|مزعج)/i,mood:"thoughtful",motion:"think",expression:"confused"},
 {id:"farewell",pattern:/(?:\b(bye|goodbye|see you|good night)\b|تصبح على خير|مع السلامة|الى اللقاء|إلى اللقاء)/i,mood:"pleased",motion:"wave",expression:"happy"},
];
export { TEXT_REACTIONS };
