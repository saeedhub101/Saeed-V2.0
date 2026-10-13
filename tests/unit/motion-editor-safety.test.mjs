import test from "node:test";
import assert from "node:assert/strict";
import { MotionEditor } from "../../src/character/MotionEditor.js";
import { MotionRegistry } from "../../src/character/MotionRegistry.js";

const motion=(id)=>({id,duration:1,layer:"body",loop:false,keyframes:[{time:0,pose:{hips:{x:0,y:0,z:0}}}]});

test("built-in motions cannot be overwritten by custom motion definitions",()=>{
 const registry=new MotionRegistry();
 registry.register({id:"wave",duration:1,update:()=>{}});
 const editor=new MotionEditor(registry);
 assert.throws(()=>editor.define(motion("wave")),/conflicts with an existing built-in motion/);
 assert.equal(registry.has("wave"),true);
 assert.equal(editor.list().length,0);
});

test("delete refuses built-in or missing motion IDs and preserves registry entries",()=>{
 const registry=new MotionRegistry();
 registry.register({id:"wave",duration:1,update:()=>{}});
 const editor=new MotionEditor(registry);
 assert.equal(editor.remove("wave"),false);
 assert.equal(registry.has("wave"),true);
 assert.equal(editor.remove("missing"),false);
 assert.equal(registry.has("wave"),true);
});

test("custom motion can be created, edited, and deleted without affecting built-ins",()=>{
 const registry=new MotionRegistry();
 registry.register({id:"wave",duration:1,update:()=>{}});
 const editor=new MotionEditor(registry);
 assert.equal(editor.define(motion("custom-wave")).id,"custom-wave");
 assert.equal(editor.define({...motion("custom-wave"),duration:2}).duration,2);
 assert.equal(registry.has("custom-wave"),true);
 assert.equal(editor.remove("custom-wave"),true);
 assert.equal(registry.has("custom-wave"),false);
 assert.equal(registry.has("wave"),true);
 assert.equal(editor.remove("custom-wave"),false);
});

test("motion IDs reject whitespace and unsafe separators",()=>{
 const editor=new MotionEditor(new MotionRegistry());
 assert.throws(()=>editor.define(motion("two motions")),/Motion ID must be/);
 assert.throws(()=>editor.define(motion("../wave")),/Motion ID must be/);
});

test("restoring a character profile replaces old custom motions and skips invalid definitions",()=>{
 const registry=new MotionRegistry();
 registry.register({id:"wave",duration:1,update:()=>{}});
 const editor=new MotionEditor(registry);
 editor.define(motion("previous-character-motion"));
 const result=editor.restore([motion("saved-character-motion"),motion("wave"),motion("../unsafe")]);
 assert.deepEqual(editor.list().map(x=>x.id),["saved-character-motion"]);
 assert.deepEqual(result.restored,["saved-character-motion"]);
 assert.equal(result.errors.length,2);
 assert.equal(registry.has("wave"),true);
 assert.equal(registry.has("previous-character-motion"),false);
});

test("motion definitions reject malformed and unbounded keyframes safely",()=>{
 const editor=new MotionEditor(new MotionRegistry());
 assert.throws(()=>editor.define({...motion("bad-frame"),keyframes:[null]}),/Keyframe 0 must be an object/);
 assert.throws(()=>editor.define({...motion("too-many"),keyframes:Array.from({length:501},(_,time)=>({time,pose:{}}))}),/more than 500 keyframes/);
 assert.throws(()=>editor.define({...motion("bad-duration"),duration:Infinity}),/duration must be greater than 0/);
 assert.throws(()=>editor.define({...motion("bad-time"),keyframes:[{time:601,pose:{}}]}),/time must be between 0 and 600/);
});

test("motion duration extends to cover the final keyframe",()=>{
 const editor=new MotionEditor(new MotionRegistry());
 const created=editor.define({id:"duration-covers-keys",duration:1,loop:false,keyframes:[{time:0,pose:{hips:{x:0}}},{time:3,pose:{hips:{x:1}}}]});
 assert.equal(created.duration,3);
 assert.deepEqual(editor.sample(created,3).hips,{x:1,y:0,z:0});
});
