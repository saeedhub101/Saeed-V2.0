class TaskPlanner{
 async create({text,route}={}){const complexity=route?.complexity||"simple";const steps=complexity==="simple"?["understand_request","answer_or_execute"]:["inspect_state","plan_actions","execute_actions","verify_results","report_completion"];return{version:1,brain:route?.brain||"auto",type:route?.type||"agent",complexity,steps,current:0,status:"planned",createdAt:new Date().toISOString(),request:String(text||"")}}
 advance(plan,phase){if(!plan)return null;const i=plan.steps.indexOf(phase);if(i>=0)plan.current=i;return plan}
}
module.exports={TaskPlanner};
