const fs=require("fs"),path=require("path");

let Tesseract=null;
function tesseract(){
  if(Tesseract!==null)return Tesseract||null;
  try{Tesseract=require("tesseract.js");}
  catch{Tesseract=false;}
  return Tesseract||null;
}
function abs(p){return path.resolve(String(p||""));}
function supported(p){return [".png",".jpg",".jpeg",".webp",".bmp",".tif",".tiff"].includes(path.extname(p).toLowerCase());}
function clamp(n,min,max){return Math.max(min,Math.min(max,n));}

function schemas(){return[
 {type:"function",function:{name:"ocr_image",description:"Extract text from a local image using OCR. Supports English and Arabic language packs and loads the OCR engine only when this tool is called.",parameters:{type:"object",properties:{filePath:{type:"string"},language:{type:"string",description:"OCR language, for example eng, ara, or eng+ara."},maxChars:{type:"integer"}},required:["filePath"]}}},
 {type:"function",function:{name:"extract_image_table",description:"Detect a table in a local image with OCR word positions and return rows and columns as structured data.",parameters:{type:"object",properties:{filePath:{type:"string"},language:{type:"string"},maxRows:{type:"integer"},maxCols:{type:"integer"}},required:["filePath"]}}},
 {type:"function",function:{name:"inspect_image",description:"Inspect a local image and extract its dimensions, OCR text, and detected table data when requested.",parameters:{type:"object",properties:{filePath:{type:"string"},language:{type:"string"},includeTable:{type:"boolean"}},required:["filePath"]}}}
]}

async function recognize(filePath,language){
 const lib=tesseract();
 if(!lib)return{ok:false,error:"OCR support is not installed. Install tesseract.js first."};
 const lang=String(language||"eng").trim()||"eng";
 let worker;
 try{
   worker=await lib.createWorker(lang);
   const result=await worker.recognize(filePath);
   return {ok:true,language:lang,data:result.data||{}};
 }catch(e){return{ok:false,error:"OCR failed: "+e.message};}
 finally{if(worker){try{await worker.terminate();}catch{}}}
}

function wordsToTable(words,maxRows,maxCols){
 const clean=(Array.isArray(words)?words:[]).filter(w=>String(w?.text||"").trim() && w?.bbox);
 if(!clean.length)return{rows:[],rowCount:0,columnCount:0};
 const heights=clean.map(w=>Math.max(1,(w.bbox.y1-w.bbox.y0))).sort((a,b)=>a-b);
 const median=heights[Math.floor(heights.length/2)]||12;
 const tolerance=Math.max(8,median*0.65);
 const groups=[];
 for(const w of clean){
   const cy=(w.bbox.y0+w.bbox.y1)/2;
   let row=groups.find(r=>Math.abs(r.cy-cy)<=tolerance);
   if(!row){row={cy,words:[]};groups.push(row);}
   row.words.push(w);
 }
 groups.sort((a,b)=>a.cy-b.cy);
 const rows=groups.slice(0,clamp(Number(maxRows)||100,1,200)).map(r=>{
   r.words.sort((a,b)=>a.bbox.x0-b.bbox.x0);
   const cells=[];
   for(const w of r.words){
     const x=w.bbox.x0;
     let cell=cells.length?cells[cells.length-1]:null;
     const gap=cell?x-cell.lastX:Infinity;
     const threshold=Math.max(18,median*1.5);
     if(!cell||gap>threshold){cell={text:String(w.text).trim(),lastX:w.bbox.x1};cells.push(cell);}
     else{cell.text+=" "+String(w.text).trim();cell.lastX=w.bbox.x1;}
   }
   return cells.map(c=>c.text);
 });
 const columnCount=Math.max(0,...rows.map(r=>r.length));
 return{rows:rows.map(r=>{const x=r.slice(0,clamp(Number(maxCols)||30,1,50));while(x.length<Math.min(columnCount,clamp(Number(maxCols)||30,1,50)))x.push("");return x;}),rowCount:rows.length,columnCount:Math.min(columnCount,clamp(Number(maxCols)||30,1,50))};
}

async function call(name,a={}){
 const p=abs(a.filePath);
 if(!fs.existsSync(p))return{ok:false,error:"File not found: "+p};
 if(!supported(p))return{ok:false,error:"Unsupported image type: "+path.extname(p)+". Supported: png, jpg, jpeg, webp, bmp, tif, tiff."};
 const r=await recognize(p,a.language);
 if(!r.ok)return r;
 const text=String(r.data.text||"");
 if(name==="ocr_image")return{ok:true,path:p,type:"image",language:r.language,text:text.slice(0,clamp(Number(a.maxChars)||400000,1,1000000)),confidence:r.data.confidence??null};
 const table=wordsToTable(r.data.words,a.maxRows,a.maxCols);
 if(name==="extract_image_table")return{ok:true,path:p,type:"image-table",language:r.language,table:table.rows,rowCount:table.rowCount,columnCount:table.columnCount,confidence:r.data.confidence??null};
 return{ok:true,path:p,type:"image",language:r.language,width:r.data?.blocks?.length?null:null,text:text.slice(0,400000),confidence:r.data.confidence??null,table:a.includeTable===false?undefined:table.rows,rowCount:table.rowCount,columnCount:table.columnCount};
}
module.exports={schemas,call};
