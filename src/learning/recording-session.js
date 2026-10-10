"use strict";
let active=null;
function setActiveSession({learning,userData,session}={}){
 if(active?.session?.recording)throw new Error("A learning recording session is already active");
 if(!learning||typeof learning.recordStep!=="function"||!session?.recording)throw new Error("A valid active learning recording session is required");
 active={learning,userData:String(userData||""),session};
 return true;
}
function recordToolStep(step){
 const current=active;
 if(!current?.session?.recording)return false;
 const tool=String(step?.tool||"").trim();
 if(!tool)return false;
 try{current.learning.recordStep(current.session,tool,step?.args&&typeof step.args==="object"&&!Array.isArray(step.args)?step.args:{});return true}catch{return false}
}
function clearActiveSession(session){
 if(!active)return false;
 if(session&&active.session!==session)return false;
 active=null;
 return true;
}
function getActiveSession(){return active?{userData:active.userData,session:active.session}:null}
module.exports={setActiveSession,recordToolStep,clearActiveSession,getActiveSession};
