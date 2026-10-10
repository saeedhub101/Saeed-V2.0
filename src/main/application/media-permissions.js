"use strict";
const path=require("node:path");
const {fileURLToPath}=require("node:url");
function localFilePath(value){
 try{const url=new URL(String(value||""));if(url.protocol!=="file:")return null;return path.resolve(fileURLToPath(url))}catch{return null}
}
function isInside(root,candidate){
 const relative=path.relative(path.resolve(root),path.resolve(candidate));
 return relative===""||(relative!==".."&&!relative.startsWith(".."+path.sep)&&!path.isAbsolute(relative));
}
function isTrustedLocalMediaRequest({webContents,permission,requestingOrigin,requestingUrl,isMainFrame,mediaType,mediaTypes,appRoot}={}){
 if(permission!=="media"||!webContents||webContents.isDestroyed?.()||isMainFrame===false)return false;
 try{if(new URL(String(requestingOrigin||"")).protocol!=="file:")return false}catch{return false}
 const root=path.resolve(String(appRoot||""));
 const requested=localFilePath(requestingUrl);
 let current=null;try{current=localFilePath(webContents.getURL?.())}catch{return false}
 if(!requested||!current||!isInside(root,requested)||!isInside(root,current)||requested!==current)return false;
 const types=Array.isArray(mediaTypes)?mediaTypes:(mediaType?[mediaType]:[]);
 return types.length>0&&types.every(type=>type==="audio");
}
module.exports={isTrustedLocalMediaRequest};
