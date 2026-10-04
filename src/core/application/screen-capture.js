function createScreenCapture({desktopCapturer,permissionPolicy,confirmPermission,diagnostic}){
 async function captureScreen(){
  const policy=permissionPolicy("screen");
  if(policy==="deny")return null;
  if(policy==="ask"&&!await confirmPermission("screen",{name:"screen_capture",args:{action:"capture screen"}}))return null;
  try{const sources=await desktopCapturer.getSources({types:["screen"],thumbnailSize:{width:1920,height:1080}});return sources[0]?.thumbnail.toDataURL()||null}
  catch(e){diagnostic?.("ERROR","SCREEN CAPTURE",e.message);return null}
 }
 return {captureScreen};
}
module.exports={createScreenCapture};