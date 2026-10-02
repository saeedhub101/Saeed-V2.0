const fs=require("fs"),path=require("path");
function file(userData){return path.join(userData,"addons","mcp-servers.json")}
function read(userData){try{return JSON.parse(fs.readFileSync(file(userData),"utf8"))}catch{return {schemaVersion:1,servers:[]}}}
function write(userData,data){fs.mkdirSync(path.dirname(file(userData)),{recursive:true});fs.writeFileSync(file(userData),JSON.stringify(data,null,2),"utf8")}
function addServer(userData,server){if(!server?.id||!server?.transport)throw new Error("MCP server requires id and transport");const d=read(userData);d.servers=d.servers.filter(x=>x.id!==server.id);d.servers.push({id:String(server.id),name:String(server.name||server.id),transport:server.transport,command:server.command||null,args:Array.isArray(server.args)?server.args:[],url:server.url||null,enabled:server.enabled!==false,permissions:server.permissions||{},updatedAt:new Date().toISOString()});write(userData,d);return d.servers.at(-1)}
function removeServer(userData,id){const d=read(userData);d.servers=d.servers.filter(x=>x.id!==id);write(userData,d)}
function listServers(userData){return read(userData).servers}
module.exports={addServer,removeServer,listServers};
