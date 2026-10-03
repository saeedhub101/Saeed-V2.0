export class PoseController {
  constructor() { this.pose = {}; this.targets = {}; }
  clear() { this.pose = {}; this.targets = {}; }
  set(slot, rotation = {}) {
    this.pose[slot] = { x:Number(rotation.x)||0, y:Number(rotation.y)||0, z:Number(rotation.z)||0 };
  }
  setMany(values = {}) { for (const [k,v] of Object.entries(values)) this.set(k,v); }
  get(slot) { return this.pose[slot] || {x:0,y:0,z:0}; }
  snapshot() { return JSON.parse(JSON.stringify(this.pose)); }
}