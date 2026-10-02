class AppRuntime{
 constructor({app,ciSmoke=false}={}){this.app=app;this.ciSmoke=Boolean(ciSmoke);this.locked=false}
 acquireSingleInstance(onSecondInstance){
  if(this.ciSmoke)return true;
  if(!this.app)return true;
  this.locked=this.app.requestSingleInstanceLock();
  if(!this.locked){this.app.quit();return false}
  if(typeof onSecondInstance==="function")this.app.on("second-instance",onSecondInstance);
  return true;
 }
 isQuitting(){return Boolean(this.app?.isQuitting?.())}
 quit(){return this.app?.quit?.()}
}
module.exports={AppRuntime};