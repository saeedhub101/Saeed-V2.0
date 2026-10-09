export function normalizeGlbArrayBuffer(value){
 let view=null;
 if(value instanceof ArrayBuffer){
  view=new Uint8Array(value);
 }else if(ArrayBuffer.isView(value)){
  view=new Uint8Array(value.buffer,value.byteOffset,value.byteLength);
 }else if(Array.isArray(value)){
  view=Uint8Array.from(value);
 }else if(value&&Array.isArray(value.data)&&(value.type==="Buffer"||value.type==="Uint8Array"||value.type===undefined)){
  view=Uint8Array.from(value.data);
 }else if(value&&value.buffer instanceof ArrayBuffer){
  const offset=Number.isInteger(value.byteOffset)&&value.byteOffset>=0?value.byteOffset:0;
  const available=value.buffer.byteLength-offset;
  const requested=Number.isInteger(value.byteLength)&&value.byteLength>=0?value.byteLength:available;
  if(offset>value.buffer.byteLength||requested>available)throw new Error("GLB byte view is outside its backing buffer");
  view=new Uint8Array(value.buffer,offset,requested);
 }
 if(!view)throw new TypeError("Selected GLB data must be an ArrayBuffer, typed-array view, byte array, or serialized Buffer");
 if(view.byteLength<20)throw new Error("Selected GLB data is too small to contain a GLB header and chunk");
 if(view[0]!==0x67||view[1]!==0x6c||view[2]!==0x54||view[3]!==0x46)throw new Error("Selected character asset is not a GLB binary (missing glTF magic)");
 const version=(view[4]|(view[5]<<8)|(view[6]<<16)|(view[7]<<24))>>>0;
 if(version!==2)throw new Error("Unsupported GLB version: "+version);
 const declaredLength=(view[8]|(view[9]<<8)|(view[10]<<16)|(view[11]<<24))>>>0;
 if(declaredLength!==view.byteLength)throw new Error("GLB declared length "+declaredLength+" does not match received bytes "+view.byteLength);
 return view.slice().buffer;
}
