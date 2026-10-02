const capabilities=require("./capabilities"),memory=require("./memory"),mcp=require("./mcp"),email=require("./email");
function registerInstalled(userData,manifest){return capabilities.register(userData,manifest)}
function unregisterInstalled(userData,id){return capabilities.unregister(userData,id)}
module.exports={capabilities,memory,mcp,email,registerInstalled,unregisterInstalled};
