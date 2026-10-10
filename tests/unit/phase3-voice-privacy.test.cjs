"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const voice=fs.readFileSync(path.join(root,"src/renderer/voice/voice-client.js"),"utf8");
const composition=fs.readFileSync(path.join(root,"src/main/application/runtime-composition.js"),"utf8");

test("voice diagnostics never persist recognized speech or assistant response bodies",()=>{
 assert.doesNotMatch(voice, /\\{provider:sttProvider,text\\}/);
 assert.doesNotMatch(voice, /\\{text,answer:String\\(answer\\)\\.slice\\(0,300\\)\\}/);
 assert.doesNotMatch(voice, /\\{text:t\\}/);
 assert.ok(voice.includes("transcriptCharacters:text.length"));
 assert.ok(voice.includes("answerCharacters:String(answer).length"));
 assert.ok(voice.includes("characters:String(t).length"));
 assert.ok(!voice.includes('Brain returned an empty answer for microphone input",{text}'));
});

test("transcript-label preferences use atomic write and read-back verification",()=>{
 assert.ok(composition.includes('writeJsonAtomic(transcriptLabelFile'));
 assert.ok(composition.includes("getTranscriptLabelEnabled"));
 assert.ok(composition.includes("setTranscriptLabelEnabled"));
});
