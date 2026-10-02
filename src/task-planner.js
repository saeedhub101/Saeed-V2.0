class TaskPlanner{
 async create({text,route,resumeState}={}){const complexity=route?.complexity||resumeState?.complexity||"simple";const steps=complexity==="simple"?["understand_request","answer_or_execute"]:["inspect_state","plan_actions","execute_actions","report_completion"];return{version:2,brain:route?.brain||resumeState?.brain||"auto",type:route?.type||resumeState?.type||"agent",complexity,steps,current:Number(resumeState?.current||0),status:"planned",createdAt:resumeState?.createdAt||new Date().toISOString(),request:String(text||resumeState?.request||""),completedActions:Array.isArray(resumeState?.completedActions)?resumeState.completedActions:[],failedActions:Array.isArray(resumeState?.failedActions)?resumeState.failedActions:[]}}
 advance(plan,phase){if(!plan)return null;const i=plan.steps.indexOf(phase);if(i>=0)plan.current=i;return plan}
 markAction(plan,action,result){if(!plan)return null;const key=String(action||"");if(result?.ok===false){if(key&&!plan.failedActions.includes(key))plan.failedActions.push(key)}else if(key&&!plan.completedActions.includes(key))plan.completedActions.push(key);return plan}
}
module.exports={TaskPlanner};
