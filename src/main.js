"use strict";
const {app,session}=require("electron");
const path=require("node:path");
const {isTrustedLocalMediaRequest}=require("./main/application/media-permissions");

require("./main/runtime");

// runtime.js registers its default permission handlers during its ready callback.
// This later callback replaces them before local renderer pages finish loading,
// restricting the effective policy to audio-only requests from the exact trusted app page.
app.whenReady().then(()=>{
 const appRoot=path.resolve(__dirname);
 const allowed=(webContents,permission,origin,details={})=>isTrustedLocalMediaRequest({
  webContents,permission,requestingOrigin:origin,requestingUrl:details?.requestingUrl,
  isMainFrame:details?.isMainFrame,mediaType:details?.mediaType,mediaTypes:details?.mediaTypes,appRoot
 });
 session.defaultSession.setPermissionCheckHandler((webContents,permission,origin,details)=>{
  return allowed(webContents,permission,origin,details);
 });
 session.defaultSession.setPermissionRequestHandler((webContents,permission,callback,details={})=>{
  const origin=details?.securityOrigin||details?.requestingUrl||"";
  callback(allowed(webContents,permission,origin,details));
 });
});
