const {BrainLevelRouter}=require("./brain-levels");
class BrainController{
 constructor({settings,getLocalBrain}){this.router=new BrainLevelRouter({settings,getLocalBrain})}
 async route(input){
  const text=typeof input==="string"?input:String(input?.text||"");
  const result=await this.router.classify(text);
  return {...result,controller:"brain",future:{memory:"ready-for-domain-routing",tools:"ready-for-capability-routing",email:"ready-for-provider-routing",calendar:"ready-for-calendar-routing"}};
 }
 async classify(text){return this.route(text)}
}
module.exports={BrainController};
