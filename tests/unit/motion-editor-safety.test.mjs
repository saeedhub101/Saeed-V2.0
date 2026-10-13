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
