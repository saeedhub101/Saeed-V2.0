const EXPRESSIONS={neutral:{},happy:{smile:1,joy:1},sad:{sad:1,frown:1},angry:{angry:1,browdown:1},surprised:{surprise:1,wideeye:1},confused:{confused:1,browup:.7},sleepy:{sleepy:.8,eyeclose:.35},thinking:{browup:.35}};
export class FaceController{
 constructor(avatar){this.avatar=avatar;this.state={expression:"neutral",intensity:0,blink:false,lookAt:null};}
 expression(name,intensity=1){const key=String(name||"neutral").toLowerCase(),profile=EXPRESSIONS[key]||EXPRESSIONS.neutral,level=Math.max(0,Math.min(1,Number(intensity)||0));this.state.expression=key;this.state.intensity=level;let changed=false;for(const names of Object.values(EXPRESSIONS))for(const m of Object.keys(names))changed=this.avatar?.setCharacterExpression?.(m,0)||changed;for(const [m,v] of Object.entries(profile))changed=this.avatar?.setCharacterExpression?.(m,v*level)||changed;return changed;}
 blink(){this.state.blink=true;const ok=Boolean(this.avatar?.blinkCharacter?.());setTimeout(()=>{this.state.blink=false},180);return ok;}
 lookAt(x=0,y=1.5,z=1){this.state.lookAt={x,y,z};return Boolean(this.avatar?.lookCharacterAt?.(x,y,z));}
 viseme(name,value=1){return Boolean(this.avatar?.setCharacterViseme?.(name,value));}
 status(){return {...this.state,availableExpressions:Object.keys(EXPRESSIONS)};}
}