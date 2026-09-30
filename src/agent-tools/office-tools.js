const fs=require("fs");
const path=require("path");

let XLSX=null;
function getXlsx(){
  if(XLSX===null){
    try{XLSX=require("xlsx");}
    catch(e){XLSX=false;}
  }
  return XLSX||null;
}

function resolveFile(filePath){
  const absolute=path.resolve(String(filePath||""));
  if(!absolute)return null;
  return absolute;
}

function readSpreadsheet(filePath,sheetName=""){
  const xlsx=getXlsx();
  if(!xlsx)return{ok:false,error:"Excel support is not installed. Install the xlsx dependency and restart Saeed."};
  const absolute=resolveFile(filePath);
  if(!fs.existsSync(absolute))return{ok:false,error:"File not found: "+absolute};
  const book=xlsx.readFile(absolute,{cellDates:true});
  const names=book.SheetNames||[];
  const selected=sheetName&&names.includes(sheetName)?sheetName:names[0];
  if(!selected)return{ok:false,error:"The workbook contains no worksheets."};
  const sheet=book.Sheets[selected];
  const rows=xlsx.utils.sheet_to_json(sheet,{header:1,defval:""});
  return {ok:true,path:absolute,type:"xlsx",sheet:selected,sheets:names,rows};
}

function writeSpreadsheet(filePath,rows,sheetName="Sheet1",append=false){
  const xlsx=getXlsx();
  if(!xlsx)return{ok:false,error:"Excel support is not installed. Install the xlsx dependency and restart Saeed."};
  if(!Array.isArray(rows))return{ok:false,error:"rows must be an array of arrays or objects."};
  const absolute=resolveFile(filePath);
  fs.mkdirSync(path.dirname(absolute),{recursive:true});
  let book;
  if(append&&fs.existsSync(absolute))book=xlsx.readFile(absolute);
  else book=xlsx.utils.book_new();
  let sheet;
  if(book.SheetNames.includes(sheetName)){
    sheet=book.Sheets[sheetName];
    const existing=xlsx.utils.sheet_to_json(sheet,{header:1,defval:""});
    const incoming=rows.map(row=>Array.isArray(row)?row:Object.values(row||{}));
    sheet=xlsx.utils.aoa_to_sheet(existing.concat(incoming));
    book.Sheets[sheetName]=sheet;
  }else{
    const aoa=rows.map(row=>Array.isArray(row)?row:Object.values(row||{}));
    sheet=xlsx.utils.aoa_to_sheet(aoa);
    xlsx.utils.book_append_sheet(book,sheet,sheetName);
  }
  xlsx.writeFile(book,absolute);
  return {ok:true,path:absolute,sheet:sheetName,rowCount:xlsx.utils.sheet_to_json(book.Sheets[sheetName],{header:1,defval:""}).length};
}

module.exports={readSpreadsheet,writeSpreadsheet};
