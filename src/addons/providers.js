const capabilities=require("./capabilities"),memory=require("./memory"),mcp=require("./mcp"),email=require("./email"),runtime=require("./runtime");
function registerInstalled(userData,manifest){return runtime.register(userData,manifest)}
function unregisterInstalled(userData,id){return runtime.unregister(userData,id)}
module.exports={capabilities,memory,mcp,email,runtime,registerInstalled,unregisterInstalled,find:(userData,capability,preferred)=>runtime.find(userData,capability,preferred),load:(userData,id)=>runtime.load(userData,id)};
