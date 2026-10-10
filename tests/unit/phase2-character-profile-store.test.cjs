"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");

function fakeStorage(initial=null){
 let value=initial;
 return{getItem:key=>value,setItem:(key,next)=>{value=String(next)},peek:()=>value};
}

test("character profile store verifies persistent rest-pose profile round trips",async()=>{
 const previous=globalThis.localStorage,storage=fakeStorage();
 globalThis.localStorage=storage;
 try{
  const {CharacterProfileStore}=await import("../../src/character/CharacterProfileStore.js");
  const store=new CharacterProfileStore();
  const saved=store.save("char-test",{restPose:{bones:{hips:{rotation:{x:0,y:0,z:0,qx:0,qy:0,qz:0,qw:1},position:{x:0,y:1,z:0}}}}});
  assert.equal(store.load("char-test").restPose.bones.hips.position.y,1);
  assert.equal(saved.updatedAt,store.load("char-test").updatedAt);
 }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous}
});

test("corrupt character profile storage is preserved and never replaced with an empty profile map",async()=>{
 const previous=globalThis.localStorage,storage=fakeStorage("{broken");
 globalThis.localStorage=storage;
 try{
  const {CharacterProfileStore}=await import("../../src/character/CharacterProfileStore.js");
  const store=new CharacterProfileStore();
  assert.throws(()=>store.save("char-test",{restPose:{bones:{hips:{}}}}),/invalid JSON.*refusing to overwrite saved poses/);
  assert.equal(storage.peek(),"{broken");
 }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous}
});

test("character profile store rejects non-object profile storage",async()=>{
 const previous=globalThis.localStorage,storage=fakeStorage("[]");
 globalThis.localStorage=storage;
 try{
  const {CharacterProfileStore}=await import("../../src/character/CharacterProfileStore.js");
  assert.throws(()=>new CharacterProfileStore().list(),/invalid structure/);
  assert.equal(storage.peek(),"[]");
 }finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous}
});
