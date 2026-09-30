const fs=require("fs");
const path=require("path");

let pdfParser=null;
function getPdfParser(){
  if(pdfParser===null){
    try{pdfParser=require("pdf-parse");}
    catch(e){pdfParser=false;}
  }
  return pdfParser||null;
}

function extension(filePath){
  return path.extname(String(filePath||"")).toLowerCase();
}

function limitText(text,maxChars=400000){
  const value=String(text||"");
  return value.length>maxChars?value.slice(0,maxChars)+"\n[content truncated]":value;
}

async function extractPdf(filePath){
  const parser=getPdfParser();
  if(!parser) return {ok:false,error:"PDF support is not installed. Install the pdf-parse dependency and restart Saeed."};
  const absolute=path.resolve(String(filePath));
  if(!fs.existsSync(absolute))return{ok:false,error:"File not found: "+absolute};
  const buffer=fs.readFileSync(absolute);
  const data=await parser(buffer);
  return {ok:true,path:absolute,type:"pdf",pages:data.numpages||0,text:limitText(data.text),info:data.info||{}};
}

function readText(filePath){
  const absolute=path.resolve(String(filePath));
  if(!fs.existsSync(absolute))return{ok:false,error:"File not found: "+absolute};
  return {ok:true,path:absolute,type:"text",text:limitText(fs.readFileSync(absolute,"utf8"))};
}

async function inspectDocument(filePath){
  const ext=extension(filePath);
  if(ext===".pdf")return extractPdf(filePath);
  if([".txt",".md",".log",".json",".xml",".html",".htm"].includes(ext))return readText(filePath);
  return {ok:false,error:"Unsupported document type: "+(ext||"no extension")+". Supported: PDF, TXT, MD, LOG, JSON, XML, HTML."};
}

module.exports={extractPdf,inspectDocument};
