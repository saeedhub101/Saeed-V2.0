// Shared JSON-schema validation for tool inputs. Kept independent from tool execution and permissions.
function schemaTypeMatches(value,type){
 if(type==="null")return value===null;
 if(type==="object")return value!==null&&typeof value==="object"&&!Array.isArray(value);
 if(type==="array")return Array.isArray(value);
 if(type==="integer")return Number.isInteger(value);
 if(type==="number")return typeof value==="number"&&Number.isFinite(value);
 if(type==="string")return typeof value==="string";
 if(type==="boolean")return typeof value==="boolean";
 return true;
}
function containsPrototypeSensitiveKey(value,seen=new Set()){
 if(!value||typeof value!=="object"||seen.has(value))return false;
 seen.add(value);
 if(!Array.isArray(value)){
  for(const key of Object.keys(value))if(["__proto__","prototype","constructor"].includes(key)||containsPrototypeSensitiveKey(value[key],seen))return true;
 }else{
  for(const item of value)if(containsPrototypeSensitiveKey(item,seen))return true;
 }
 return false;
}
function validateSchemaValue(value,schema,pathName){
 if(containsPrototypeSensitiveKey(value))return pathName+" contains a forbidden property name";
 if(!schema||typeof schema!=="object")return null;
 if(Array.isArray(schema.allOf))for(const child of schema.allOf){const error=validateSchemaValue(value,child,pathName);if(error)return error}
 if(Array.isArray(schema.anyOf)&&schema.anyOf.length&&!schema.anyOf.some(child=>validateSchemaValue(value,child,pathName)===null))return pathName+" does not match any allowed schema";
 if(Array.isArray(schema.oneOf)&&schema.oneOf.length&&schema.oneOf.filter(child=>validateSchemaValue(value,child,pathName)===null).length!==1)return pathName+" must match exactly one allowed schema";
 if(schema.not&&validateSchemaValue(value,schema.not,pathName)===null)return pathName+" matches a forbidden schema";
 if(Array.isArray(schema.type)?!schema.type.some(t=>schemaTypeMatches(value,t)):schema.type&&!schemaTypeMatches(value,schema.type)){
  return pathName+" must be "+(Array.isArray(schema.type)?schema.type.join(" or "):schema.type);
 }
 if(Array.isArray(schema.enum)&&!schema.enum.some(item=>Object.is(item,value)))return pathName+" must be one of: "+schema.enum.join(", ");
 if(typeof value==="string"){
  if(Number.isInteger(schema.minLength)&&value.length<schema.minLength)return pathName+" is too short";
  if(Number.isInteger(schema.maxLength)&&value.length>schema.maxLength)return pathName+" is too long";
  if(schema.pattern){try{if(!(new RegExp(schema.pattern)).test(value))return pathName+" has an invalid format"}catch{return pathName+" uses an invalid schema pattern"}}
  if(schema.format==="email"&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))return pathName+" must be a valid email address";
  if(schema.format==="uri"||schema.format==="url"){try{const parsed=new URL(value);if(schema.format==="url"&&!["http:","https:"].includes(parsed.protocol))return pathName+" must be an HTTP(S) URL"}catch{return pathName+" must be a valid URL"}}
 }
 if(typeof value==="number"){
  if(Number.isFinite(schema.minimum)&&value<schema.minimum)return pathName+" must be at least "+schema.minimum;
  if(Number.isFinite(schema.maximum)&&value>schema.maximum)return pathName+" must be at most "+schema.maximum;
  if(Number.isFinite(schema.exclusiveMinimum)&&value<=schema.exclusiveMinimum)return pathName+" must be greater than "+schema.exclusiveMinimum;
  if(Number.isFinite(schema.exclusiveMaximum)&&value>=schema.exclusiveMaximum)return pathName+" must be less than "+schema.exclusiveMaximum;
 }
 if(Array.isArray(value)){
  if(Number.isInteger(schema.minItems)&&value.length<schema.minItems)return pathName+" needs at least "+schema.minItems+" item(s)";
  if(Number.isInteger(schema.maxItems)&&value.length>schema.maxItems)return pathName+" supports at most "+schema.maxItems+" item(s)";
  if(schema.uniqueItems&&new Set(value.map(item=>JSON.stringify(item))).size!==value.length)return pathName+" must contain unique items";
  if(schema.items)for(let i=0;i<value.length;i++){const error=validateSchemaValue(value[i],schema.items,pathName+"["+(i+1)+"]");if(error)return error}
 }
 if(value&&typeof value==="object"&&!Array.isArray(value)){
  if(Number.isInteger(schema.minProperties)&&Object.keys(value).length<schema.minProperties)return pathName+" needs at least "+schema.minProperties+" properties";
  if(Number.isInteger(schema.maxProperties)&&Object.keys(value).length>schema.maxProperties)return pathName+" supports at most "+schema.maxProperties+" properties";
  for(const key of schema.required||[])if(!Object.prototype.hasOwnProperty.call(value,key)||value[key]===undefined)return pathName+" is missing required field \""+key+"\"";
  if(schema.additionalProperties===false){const allowed=new Set(Object.keys(schema.properties||{}));for(const key of Object.keys(value))if(!allowed.has(key))return pathName+" has unexpected field \""+key+"\"";}
  for(const [key,child] of Object.entries(schema.properties||{})){
   if(!Object.prototype.hasOwnProperty.call(value,key)||value[key]===undefined)continue;
   const error=validateSchemaValue(value[key],child,pathName+"."+key);if(error)return error;
  }
 }
 return null;
}
function validateToolArguments(args,schema,name){
 if(!schema)return null;
 const value=args===undefined?{}:args;
 return validateSchemaValue(value,schema,"Arguments for "+name);
}

module.exports = { validateSchemaValue, validateToolArguments, schemaTypeMatches };
