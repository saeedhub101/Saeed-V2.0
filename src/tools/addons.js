const schemas=()=>[
 {type:"function",function:{name:"memory_add",description:"Store text in Saeed local vector memory.",parameters:{type:"object",properties:{text:{type:"string"},metadata:{type:"object"}},required:["text"]}}},
 {type:"function",function:{name:"memory_search",description:"Search local memory by semantic similarity.",parameters:{type:"object",properties:{query:{type:"string"},limit:{type:"number"}},required:["query"]}}},
 {type:"function",function:{name:"knowledge_add",description:"Add a document snippet to the local knowledge base.",parameters:{type:"object",properties:{text:{type:"string"},metadata:{type:"object"}},required:["text"]}}},
 {type:"function",function:{name:"mcp_list_servers",description:"List configured MCP servers.",parameters:{type:"object",properties:{},required:[]}}},
 {type:"function",function:{name:"mcp_list_tools",description:"Discover tools exposed by an MCP server.",parameters:{type:"object",properties:{server:{type:"string"}},required:["server"]}}},
 {type:"function",function:{name:"mcp_call_tool",description:"Call an approved MCP tool after explicit confirmation.",parameters:{type:"object",properties:{server:{type:"string"},tool:{type:"string"},arguments:{type:"object"}},required:["server","tool"]}}},
];
async function call(name,args,ctx){
 const u=ctx.userDataPath;
 if(name==="memory_add"||name==="memory_search"||name==="knowledge_add"){const memory=require("../core/services/memory-service");if(name==="memory_add")return{ok:true,item:memory.add(u,args.text,args.metadata||{})};if(name==="memory_search")return{ok:true,items:memory.search(u,args.query,args.limit||5).map(x=>({id:x.id,text:x.text,score:x.score,metadata:x.metadata}))};return{ok:true,item:memory.addKnowledge(u,args.text,args.metadata||{})}}
 if(name==="mcp_list_servers"||name==="mcp_list_tools"||name==="mcp_call_tool"){const mcp=require("../addons/mcp");if(name==="mcp_list_servers")return{ok:true,servers:mcp.listServers(u)};if(name==="mcp_list_tools")return{ok:true,result:await mcp.listTools(u,args.server)};return{ok:true,result:await mcp.callTool(u,args.server,args.tool,args.arguments||{},ctx.requestPermission,{signal:ctx.signal})}}
 return null;
}
module.exports={schemas,call};
