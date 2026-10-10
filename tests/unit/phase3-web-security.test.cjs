"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const web=require("../../src/tools/web");

test("web destination classifier blocks private, loopback, link-local and reserved addresses",()=>{
 for(const address of ["127.0.0.1","10.0.0.1","172.16.0.1","192.168.1.1","169.254.169.254","100.64.0.1","224.0.0.1","::1","::","fc00::1","fe80::1","ff02::1","::ffff:127.0.0.1"]){
  assert.equal(web.isPublicAddress(address),false,address+" must not be considered public");
 }
 for(const address of ["8.8.8.8","1.1.1.1","2606:4700:4700::1111"]){
  assert.equal(web.isPublicAddress(address),true,address+" should be public");
 }
});

test("web fetch rejects local targets and credential-bearing URLs before connecting",async()=>{
 for(const url of ["http://localhost/","http://127.0.0.1/","http://169.254.169.254/latest/meta-data/","file:///etc/passwd","https://user:pass@example.com/"]){
  await assert.rejects(()=>web.assertPublicHttpUrl(url),/blocked|Only credential-free|Invalid web URL/);
 }
});

test("web tools honor cancelled conversation requests before network access",async()=>{
 const result=await web.call("web_search",{query:"should not fetch"},{isCurrent:()=>false});
 assert.equal(result.stale,true);
});

test("web tool schemas bound input lengths and reject unexpected arguments",()=>{
 const schemas=web.schemas();
 const search=schemas.find(x=>x.function.name==="web_search").function.parameters;
 assert.equal(search.properties.query.maxLength,2000);
 assert.equal(search.additionalProperties,false);
 const page=schemas.find(x=>x.function.name==="fetch_web_page").function.parameters;
 assert.equal(page.properties.url.maxLength,4096);
});
