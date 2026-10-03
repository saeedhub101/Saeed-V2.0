(()=>{
  // Compatibility facade only. CharacterController is the single motion engine.
  const aliases={explain:"talkGesture",talk:"talkGesture",speak:"talkGesture",greet:"wave",gestureup:"wave",acknowledge:"nod",pleased:"nod",confused:"shake",uncertain:"shake",alert:"shake",lookleft:"turnBody",lookright:"turnBody",lookup:"lookCloser",lookdown:"lookCloser",doMagic1:"wave",congratulate:"nod",sad:"sleep",surprised:"nod"};
  const get=()=>window.saeedCharacterController;
  const normalize=n=>String(n||"").replace(/[^a-z0-9]/gi,"").toLowerCase();
  function resolve(n){const c=get();if(!c)return null;const raw=String(n||"");if(c.animation?.registry?.has?.(raw))return raw;const key=normalize(raw);if(c.animation?.registry?.has?.(key))return key;return aliases[key]||null}
  function play(name,options={}){const c=get();const id=resolve(name);return c&&id?c.play(id,options):false}
  function start(){return true} function stop(){try{return get()?.stopAll?.()}catch{return false}} function touch(){return true}
  function setIntent(intent){window.saeedCharacterIntent=String(intent||"idle");return window.saeedCharacterIntent}
  function setVisible(v){if(String(v)==="hidden")stop();return true}
  function onEvent(e){const t=String(e?.type||"");if(t==="speech-start"||t==="answer")return play("talkGesture",{duration:900,layer:"arms"});if(t==="thinking")return play("think",{duration:1200});if(t==="tool_error")return play("shake",{duration:700});if(t==="tool_result")return play("nod",{duration:650});if(t==="motion")return play(e.motion||e.name||"idle",{duration:1400});return false}
  window.saeedAnimationController={start,stop,touch,setIntent,getIntent:()=>window.saeedCharacterIntent||"idle",getEnergy:()=>0,getRenderWakeMs:()=>1200,onEvent,setVisible,state:()=>({intent:window.saeedCharacterIntent||"idle",engine:"CharacterController",active:get()?.status?.().active||[]}),play,has:n=>Boolean(resolve(n))};
  window.saeed?.onEvent?.(onEvent);window.saeed?.onCharacterVisibility?.(setVisible);
})();