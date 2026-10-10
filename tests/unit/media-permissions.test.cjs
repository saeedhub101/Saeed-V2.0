"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const os=require("node:os");
const {pathToFileURL}=require("node:url");
const {isTrustedLocalMediaRequest}=require("../../src/main/application/media-permissions");
const appRoot=path.join(os.tmpdir(),"saeed-media-policy-test","src");
const page=pathToFileURL(path.join(appRoot,"index.html")).href;
const webContents={getURL:()=>page,isDestroyed:()=>false};
const valid={webContents,permission:"media",requestingOrigin:"file://",requestingUrl:page,isMainFrame:true,mediaType:"audio",appRoot};
test("allows audio-only media from the matching local app page",()=>{
 assert.equal(isTrustedLocalMediaRequest(valid),true);
 assert.equal(isTrustedLocalMediaRequest({...valid,mediaTypes:["audio"]}),true);
});
test("denies video, mixed audio/video, and unknown media types",()=>{
 assert.equal(isTrustedLocalMediaRequest({...valid,mediaType:"video"}),false);
 assert.equal(isTrustedLocalMediaRequest({...valid,mediaTypes:["audio","video"]}),false);
 assert.equal(isTrustedLocalMediaRequest({...valid,mediaType:undefined,mediaTypes:undefined}),false);
});
test("denies non-media permissions, remote origins, and remote pages",()=>{
 assert.equal(isTrustedLocalMediaRequest({...valid,permission:"notifications"}),false);
 assert.equal(isTrustedLocalMediaRequest({...valid,requestingOrigin:"https://example.com"}),false);
 assert.equal(isTrustedLocalMediaRequest({...valid,requestingUrl:"https://example.com"}),false);
});
test("denies subframes, stale URLs, destroyed renderers, and files outside app root",()=>{
 assert.equal(isTrustedLocalMediaRequest({...valid,isMainFrame:false}),false);
 assert.equal(isTrustedLocalMediaRequest({...valid,requestingUrl:pathToFileURL(path.join(appRoot,"other.html")).href}),false);
 assert.equal(isTrustedLocalMediaRequest({...valid,webContents:{getURL:()=>page,isDestroyed:()=>true}}),false);
 assert.equal(isTrustedLocalMediaRequest({...valid,requestingUrl:pathToFileURL(path.join(os.tmpdir(),"outside.html")).href}),false);
});
