export class FaceController{
 constructor(avatar){this.avatar=avatar;this.state={expression:"neutral",blink:false,lookAt:null};}
 expression(name,intensity=1){this.state.expression=String(name||"neutral");return Boolean(this.avatar?.setCharacterExpression?.(name,intensity));}
 blink(){this.state.blink=true;const ok=Boolean(this.avatar?.blinkCharacter?.());setTimeout(()=>{this.state.blink=false},180);return ok;}
 lookAt(x=0,y=1.5,z=1){this.state.lookAt={x,y,z};return Boolean(this.avatar?.lookCharacterAt?.(x,y,z));}
 viseme(name,value=1){return Boolean(this.avatar?.setCharacterViseme?.(name,value));}
 status(){return {...this.state};}
}
