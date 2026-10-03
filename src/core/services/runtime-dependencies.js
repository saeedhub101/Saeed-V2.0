// Lazy runtime dependency container. Heavy subsystems are created only when their domain is used.
const {createApiHealth}=require("./api-health");
const {createVoiceRuntime}=require("../voice/voice-runtime");
const {createResourceService}=require("./resource-service");

function createRuntimeDependencies({app,BrowserWindow,process,getAgent,diagnostic,voiceBroadcast}){
 let addonService,learning,learningRecorder,apiHealth,voiceRuntime,resourceService,autoUpdater;
 return {
  getAddonService(){return addonService||(addonService=require("./addon-service"));},
  getLearning(){return learning||(learning=require("../../learning"));},
  getLearningRecorder(){return learningRecorder||(learningRecorder=require("../../learning/windows-recorder"));},
  getApiHealth(){return apiHealth||(apiHealth=createApiHealth({getAgent}));},
  getVoiceRuntime(){return voiceRuntime||(voiceRuntime=createVoiceRuntime({getAgent,diagnostic,voiceBroadcast}));},
  getResourceService(){return resourceService||(resourceService=createResourceService({app,BrowserWindow,process}));},
  getAutoUpdater(){return autoUpdater||(autoUpdater=require("electron-updater").autoUpdater);}
 };
}

module.exports={createRuntimeDependencies};
