const documents=require("./document-tools");
const office=require("./office-tools");

function schemas(){
  return [
    {type:"function",function:{name:"inspect_document",description:"Inspect a local document and extract readable content. Use this before summarizing a PDF or text document.",parameters:{type:"object",properties:{filePath:{type:"string"}},required:["filePath"]}}},
    {type:"function",function:{name:"extract_pdf_text",description:"Extract text from a local PDF for summarization or further processing.",parameters:{type:"object",properties:{filePath:{type:"string"}},required:["filePath"]}}},
    {type:"function",function:{name:"read_excel",description:"Read an Excel workbook or CSV-compatible spreadsheet and return worksheet rows for analysis.",parameters:{type:"object",properties:{filePath:{type:"string"},sheetName:{type:"string"}},required:["filePath"]}}},
    {type:"function",function:{name:"write_excel",description:"Create or update an Excel workbook from structured rows. Prefer this native tool instead of mouse/keyboard Excel automation.",parameters:{type:"object",properties:{filePath:{type:"string"},rows:{type:"array",items:{}},sheetName:{type:"string"},append:{type:"boolean"}},required:["filePath","rows"]}}}
  ];
}

async function call(name,args){
  if(name==="inspect_document")return documents.inspectDocument(args.filePath);
  if(name==="extract_pdf_text")return documents.extractPdf(args.filePath);
  if(name==="read_excel")return office.readSpreadsheet(args.filePath,args.sheetName||"");
  if(name==="write_excel")return office.writeSpreadsheet(args.filePath,args.rows,args.sheetName||"Sheet1",Boolean(args.append));
  return {ok:false,error:"Unknown document/office tool: "+name};
}

module.exports={schemas,call};
