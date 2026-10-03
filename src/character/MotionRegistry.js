export class MotionRegistry {
  constructor() { this.items = new Map(); }
  register(def) {
    if (!def?.id || typeof def.update !== "function") throw new Error("Invalid character motion");
    this.items.set(String(def.id), { duration:0, loop:false, blend:.15, ...def });
    return this.items.get(String(def.id));
  }
  get(id) { return this.items.get(String(id)); }
  has(id) { return this.items.has(String(id)); }
  list() { return [...this.items.values()].map(x => x.id); }
}