class CoreRuntime{
 constructor(options={}){this.options=options;this.agent=null;this.registry=null;this.rawRegistry=null;this.executor=null;this.localBrain=null;this.brainSupervisor=null;this.started=false;}
 async start(){
  if(this.started)return this.agent;
  const {Agent}=require("../agent"),{ToolRegistry}=require("../tools"),{ToolExecutor}=require("./tool-executor"),{LocalBrain}=require("../local-brain"),{BrainSupervisor}=require("../autonomous/brain-supervisor");
  const o=this.options;
  this.rawRegistry=new ToolRegistry({captureScreen:o.captureScreen,userDataPath:o.userDataPath,characterController:o.characterController,recordHook:o.recordHook,permissionPolicy:o.permissionPolicy,confirm:o.confirm});
  this.executor=new ToolExecutor(this.rawRegistry,{onEvent:o.onEvent});this.registry=this.executor;
  this.agent=new Agent({registry:this.executor,onEvent:o.onEvent,requestStepIncrease:o.requestStepIncrease});
  this.localBrain=new LocalBrain(this.executor,e=>o.onEvent?.(e));this.agent.localBrain=this.localBrain;
  this.brainSupervisor=new BrainSupervisor({registry:this.executor,getSettings:async()=>this.agent?.publicSettings()||{},setSettings:async s=>{if(this.agent)this.agent.settings={...this.agent.settings,...s};return this.agent?.publicSettings()||{}},emit:e=>{if(e?.type==="idle-thought")o.onEvent?.({type:"character:behavior",...e});else o.onCharacterBehavior?.(e)}});
  await this.brainSupervisor.start();this.started=true;return this.agent;
 }
 stop(){try{this.brainSupervisor?.stop?.()}catch{}this.brainSupervisor=null;this.localBrain=null;this.executor=null;this.rawRegistry=null;this.registry=null;this.agent=null;this.started=false;}
}
module.exports={CoreRuntime};
