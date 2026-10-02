let provider="gmail";
const presets={
 gmail:{label:"Gmail",link:"https://support.google.com/mail/answer/7126229",info:"IMAP imap.gmail.com:993 SSL/TLS · POP3 pop.gmail.com:995 SSL/TLS · SMTP smtp.gmail.com:465 SSL/TLS or 587 STARTTLS",note:"Google does not allow ordinary username/password authentication from new third-party clients. Use Sign in with Google or a Google App Password when password-based IMAP/SMTP is available."},
 yahoo:{label:"Yahoo",link:"https://help.yahoo.com/kb/SLN4075.html",info:"IMAP imap.mail.yahoo.com:993 SSL/TLS · POP3 pop.mail.yahoo.com:995 SSL/TLS · SMTP smtp.mail.yahoo.com:465 SSL/TLS or 587 TLS",note:"Yahoo third-party mail clients commonly require an App Password."},
 hotmail:{label:"Hotmail / Outlook",link:"https://support.microsoft.com/en-us/office/pop-and-imap-email-settings-for-outlook-com-cc78b83d-0a8b-4e4a-8f7b-8f2c7f0e8c2e",info:"IMAP outlook.office365.com:993 SSL/TLS · POP3 outlook.office365.com:995 SSL/TLS · SMTP smtp-mail.outlook.com:587 STARTTLS",note:"Outlook.com requires Modern Auth/OAuth2 for IMAP/POP/SMTP. A normal password alone may be rejected."},
 others:{label:"Other",info:"Enter the provider's IMAP/POP3/SMTP servers.",note:"Use the exact settings supplied by your mail provider."}
};
function $(id){return document.getElementById(id)}
function render(){
 document.querySelectorAll("#providers button").forEach(b=>b.classList.toggle("active",b.dataset.provider===provider));
 $("providerInfo").innerHTML="<b>"+presets[provider].label+"</b><small>"+presets[provider].info+"</small>"+(presets[provider].link?"<small><a href='"+presets[provider].link+"' target='_blank'>Provider setup instructions</a></small>":"")+"<small class='note'>"+presets[provider].note+"</small>";
 $("otherFields").classList.toggle("hidden",provider!=="others");
}
async function refresh(){
 try{const list=await window.saeed.emailAccounts();$("accounts").innerHTML=list.length?list.map(a=>"<div class='account'><b>"+a.email+"</b><span>"+a.label+" · "+a.protocol.toUpperCase()+" · "+(a.connected?"Connected":"Disconnected")+"</span><span>Calendar: "+a.calendarEvents+" · Contacts: "+a.contacts+"</span><button data-sync='"+a.email+"'>Sync</button></div>").join(""):"No email accounts connected.";document.querySelectorAll("[data-sync]").forEach(b=>b.onclick=async()=>{try{const r=await window.saeed.emailSync(b.dataset.sync);$("status").textContent="Synced "+r.messages.length+" recent messages; calendar events: "+r.events+"; contacts: "+r.contacts;refresh()}catch(e){$("status").textContent=e.message}})}catch(e){$("accounts").textContent=e.message}}
document.querySelectorAll("#providers button").forEach(b=>b.onclick=()=>{provider=b.dataset.provider;render()});
$("protocol").onchange=render;
$("connect").onclick=async()=>{
 const status=$("status");status.textContent="Connecting and verifying IMAP/POP3 + SMTP…";
 try{const r=await window.saeed.emailConnect({provider,email:$("email").value.trim(),password:$("password").value,protocol:$("protocol").value,imapHost:$("imapHost").value,imapPort:$("imapPort").value,popHost:$("popHost").value,popPort:$("popPort").value,smtpHost:$("smtpHost").value,smtpPort:$("smtpPort").value});status.textContent="Connected: "+r.email+" ("+r.label+")";$("password").value="";refresh()}catch(e){status.textContent="Connection failed: "+e.message}
};
$("close").onclick=()=>window.close();render();refresh();