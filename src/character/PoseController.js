export class PoseController {
  constructor() { this.pose = {}; this.targets = {}; }
  clear() { this.pose = {}; this.targets = {}; }
  set(slot, rotation = {}) {
    const next = { x:Number(rotation.x)||0, y:Number(rotation.y)||0, z:Number(rotation.z)||0 };
    if(rotation?.position&&typeof rotation.position==="object")next.position={x:Number(rotation.position.x)||0,y:Number(rotation.position.y)||0,z:Number(rotation.position.z)||0};
    this.pose[slot] = next;
  }
  setMany(values = {}) { for (const [k,v] of Object.entries(values)) this.set(k,v); }
  get(slot) { return this.pose[slot] || {x:0,y:0,z:0}; }
  snapshot() { return JSON.parse(JSON.stringify(this.pose)); }
}