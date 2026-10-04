// Compatibility export. Brain routing is owned by AgentRouter.
const {AgentRouter}=require("./core/brain/agent-router");
class BrainLevelRouter extends AgentRouter{}
module.exports={BrainLevelRouter};