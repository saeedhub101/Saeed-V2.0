// Pure tool categorization and isolated authorization policy. Tool execution stays in ToolRegistry.
function categoryForTool(name,args={}){
  if(["system_info","diagnose_computer","active_window","list_windows","focus_window","process_list","disk_info"].includes(name))return"system";
  if(["list_directory","read_file","write_file","open_file","reveal_file","inspect_document","extract_pdf_text","read_excel","calculate_excel","write_excel"].includes(name))return"files";
  if(name==="open_application")return"applications";
  if(name==="character_motion")return"system";
  if(["open_url","web_search","fetch_web_page","network_info"].includes(name))return"network";
  if(["screenshot","ocr_image","extract_image_table","inspect_image","inspect_window_controls"].includes(name))return"screen";
  if(name==="interact_ui_element")return"mouseKeyboard";
  if(["mouse_move","mouse_click","type_text","key_press"].includes(name))return"mouseKeyboard";
  if(name==="agent_skills"&&["delete","replace_step","insert_step","remove_step","move_step"].includes(args?.operation))return"destructive";
  if(["add_task","list_tasks","complete_task","remember","recall","list_memory","forget","memory_add","memory_search","knowledge_add","agent_task_history","agent_task_details","agent_skills"].includes(name))return"tasksMemory";
  if(["mcp_list_servers","mcp_test_connection","mcp_list_tools","mcp_list_resources","mcp_read_resource","mcp_list_prompts","mcp_get_prompt","mcp_call_tool"].includes(name))return"mcp";
  if(/^addon_[a-z0-9][a-z0-9._-]{0,63}_.+/i.test(name))return"addons";
  if(["email_provider_info","email_test_connection","email_imap_folders","email_imap_search","email_imap_fetch","email_pop3_list","email_pop3_fetch"].includes(name))return"network";
  if(name==="email_send")return"credentials";
  if(name==="remove_task")return"destructive";
  return"system";
 }

async function authorizeToolRequest({category,request,isCurrent=()=>true,permissionPolicy,confirm}){
  const current=()=>{try{return typeof isCurrent==="function"?Boolean(isCurrent()):true}catch{return false}};
  if(!current())return false;
  if(String(request?.name||"")==="task_plan")return current();
  let policy="ask";
  try{policy=typeof permissionPolicy==="function"?await permissionPolicy(category,request):"ask"}catch{return false}
  if(!current()||policy==="deny")return false;
  const name=String(request?.name||"");
  const alwaysConfirm=new Set(["email_send","mcp_call_tool"]);
  if(name==="agent_skills"&&["delete","replace_step","insert_step","remove_step","move_step"].includes(request?.args?.operation))alwaysConfirm.add(name);
  const uiLabel=String(request?.args?.expectedName||"").trim(),uiId=String(request?.args?.automationId||"").trim();
  const sensitiveUiInvoke=name==="interact_ui_element"&&request?.args?.action==="invoke"&&(!uiLabel&&!uiId||/issue|send|submit|pay|delete|remove|approve|confirm|finali[sz]|publish|purchase|release|policy|إصدار|ارسال|إرسال|دفع|حذف|اعتماد|تأكيد|نهائي/i.test(uiLabel+" "+uiId));
  if(policy==="allow"&&!alwaysConfirm.has(name)&&!sensitiveUiInvoke)return current();
  try{return current()&&Boolean(await confirm({...request,permissionCategory:category}))&&current()}catch{return false}
 }

module.exports = { categoryForTool, authorizeToolRequest };
