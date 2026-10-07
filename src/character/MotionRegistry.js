export class MotionRegistry {
  constructor() { this.items = new Map(); }
  register(def) {
    if (!def?.id || typeof def.update !== "function") throw new Error("Invalid character motion");
    this.items.set(String(def.id), { duration:0, loop:false, blend:.15, enabled:true, ...def });
    return this.items.get(String(def.id));
  }
  get(id) { return this.items.get(String(id)); }
  has(id) { return this.items.has(String(id)); }
  setEnabled(id,enabled=true){const m=this.get(id);if(!m)return false;m.enabled=enabled!==false;return true;}
  list() { return [...this.items.values()].map(x => x.id); }
  definitions(){return [...this.items.values()].map(x=>({id:x.id,enabled:x.enabled!==false,layer:x.layer||"body",duration:x.duration||0,requiredCapabilities:x.requiredCapabilities||[]}));}
}