const assert=require("assert");
const {VoiceController}=require("../src/voice/voice-controller");
assert.deepEqual(VoiceController.route({realtimeEnabled:true,micPath:"realtime",realtimeProvider:"openai",apiKey:"x"},"on"),{mic:"on",stt:"realtime",tts:"realtime",realtime:"start"});
assert.equal(VoiceController.route({realtimeEnabled:false,sttProvider:"whisper"},"on").stt,"whisper");
assert.equal(VoiceController.route({},"off").stt,"disabled");
console.log("Saeed voice controller tests: PASS");