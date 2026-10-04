import {sequence} from "./MotionSequence.js";

export function registerCoreMotions(controller){
  const r=controller.register.bind(controller);
  r({id:"nod",duration:.65,layer:"head",update:({p})=>({head:{x:Math.sin(p*Math.PI*2)*.11}})});
  r({id:"shake",duration:.7,layer:"head",update:({p})=>({head:{y:Math.sin(p*Math.PI*4)*.16}})});
  r({id:"wave",duration:1.8,layer:"arms",update:({p})=>({rightUpperArm:{y:1.55,z:.18},rightForeArm:{z:-1.55+Math.sin(p*Math.PI*6)*.22}})});
  r({id:"think",duration:2.4,layer:"arms",update:({p})=>({head:{y:-.12},rightUpperArm:{y:.55,z:-.25},rightForeArm:{z:-1.1}})});
  r({id:"jump",duration:1.1,layer:"body",update:({p})=>{const q=p<.35?p/.35:p<.7?1:(1-p)/.3,bend=(1-q)*.28;return{leftThigh:{x:bend},rightThigh:{x:bend},leftShin:{x:-bend*.7},rightShin:{x:-bend*.7},leftUpperArm:{z:-q*.25},rightUpperArm:{z:q*.25},spine:{x:-q*.05}}}});
  r({id:"clap",duration:1,layer:"arms",update:({p})=>{const q=Math.sin(p*Math.PI);return{leftUpperArm:{y:.55,z:-.15*q},rightUpperArm:{y:-.55,z:.15*q},leftForeArm:{z:.8*q},rightForeArm:{z:-.8*q}}}});
  r({id:"dance",duration:4,layer:"body",update:({t})=>({spine:{z:Math.sin(t*7)*.08,x:Math.sin(t*3.5)*.04},head:{y:Math.sin(t*3.5)*.12},leftUpperArm:{y:.9+Math.sin(t*4)*.35,z:-.3+Math.sin(t*6)*.15},rightUpperArm:{y:-.9-Math.sin(t*4)*.35,z:.3-Math.sin(t*6)*.15},leftForeArm:{z:-1.1+Math.sin(t*5)*.25},rightForeArm:{z:1.1-Math.sin(t*5)*.25},leftThigh:{x:Math.sin(t*7)*.16},rightThigh:{x:-Math.sin(t*7)*.16}})});
  r({id:"talkGesture",duration:.9,layer:"arms",update:({t})=>({leftUpperArm:{z:Math.sin(t*7)*.08},rightUpperArm:{z:-Math.sin(t*7+.7)*.08},head:{y:Math.sin(t*3)*.05}})});
  r(sequence("lookCloser",2.2,"body",[
    {at:0,pose:{}},{at:.35,pose:{spine:{x:.03},chest:{x:.025},head:{x:-.03}}},
    {at:.65,pose:{spine:{x:.08},chest:{x:.06},head:{x:-.08},leftUpperArm:{z:-.12},rightUpperArm:{z:.12}}},
    {at:.82,pose:{spine:{x:.08},chest:{x:.06},head:{x:-.08}}},{at:1,pose:{spine:{x:.02},chest:{x:.015},head:{x:-.02}}}
  ]));
  r(sequence("sitKnee",3.6,"body",[
    {at:0,pose:{spine:{x:.02}}},
    {at:.18,pose:{spine:{x:-.12},leftThigh:{x:.35},rightThigh:{x:.5},leftShin:{x:-.18},rightShin:{x:-.35}}},
    {at:.42,pose:{spine:{x:-.28},chest:{x:-.12},leftThigh:{x:.75},rightThigh:{x:.95},leftShin:{x:-.85},rightShin:{x:-1.05},leftUpperArm:{z:-.2},rightUpperArm:{z:.2}}},
    {at:.62,pose:{spine:{x:-.22},chest:{x:-.1},leftThigh:{x:.62},rightThigh:{x:.82},leftShin:{x:-.72},rightShin:{x:-.9}}},
    {at:.8,pose:{spine:{x:-.12},leftThigh:{x:.3},rightThigh:{x:.45},leftShin:{x:-.35},rightShin:{x:-.5}}},{at:1,pose:{}}
  ]));
  r(sequence("standUp",2.8,"body",[
    {at:0,pose:{spine:{x:-.22},chest:{x:-.1},leftThigh:{x:.62},rightThigh:{x:.82},leftShin:{x:-.72},rightShin:{x:-.9}}},
    {at:.28,pose:{spine:{x:-.12},leftThigh:{x:.38},rightThigh:{x:.5},leftShin:{x:-.42},rightShin:{x:-.55}}},
    {at:.58,pose:{spine:{x:.06},leftThigh:{x:.12},rightThigh:{x:.16},leftShin:{x:-.12},rightShin:{x:-.16}}},
    {at:.82,pose:{spine:{x:-.02},chest:{x:.01},leftThigh:{x:.04},rightThigh:{x:.05}}},{at:1,pose:{}}
  ]));
  r(sequence("stretch",3.4,"body",[
    {at:0,pose:{}},{at:.25,pose:{spine:{x:-.08},chest:{x:-.06},leftUpperArm:{z:-.5},rightUpperArm:{z:.5}}},
    {at:.5,pose:{spine:{x:-.18},chest:{x:-.12},head:{x:-.06},leftUpperArm:{z:-1,y:.15},rightUpperArm:{z:1,y:-.15}}},
    {at:.72,pose:{spine:{x:-.1},chest:{x:-.07},leftUpperArm:{z:-.55},rightUpperArm:{z:.55}}},{at:1,pose:{}}
  ]));
  r(sequence("yawn",3.8,"body",[
    {at:0,pose:{}},{at:.22,pose:{head:{x:-.05},jaw:{x:.02},leftUpperArm:{z:-.25},rightUpperArm:{z:.25}}},
    {at:.5,pose:{head:{x:-.12},jaw:{x:.12},leftUpperArm:{z:-.55,y:.2},rightUpperArm:{z:.55,y:-.2}}},
    {at:.72,pose:{head:{x:-.06},jaw:{x:.05},leftUpperArm:{z:-.2},rightUpperArm:{z:.2}}},{at:1,pose:{}}
  ]));
  r(sequence("crackBack",3.2,"body",[
    {at:0,pose:{}},{at:.3,pose:{spine:{x:-.12,z:-.08},chest:{z:-.04}}},
    {at:.48,pose:{spine:{x:.06,z:.12},chest:{z:.08},head:{y:.08}}},
    {at:.56,pose:{spine:{x:.1,z:-.1},chest:{z:-.06},head:{y:-.08}}},
    {at:.7,pose:{spine:{x:-.06},chest:{x:-.03}}},{at:1,pose:{}}
  ]));
  r(sequence("crackFingers",2.4,"hands",[
    {at:0,pose:{leftForeArm:{z:.35},rightForeArm:{z:-.35}}},
    {at:.35,pose:{leftForeArm:{z:.8},rightForeArm:{z:-.8}}},
    {at:.48,pose:{leftForeArm:{z:.72},rightForeArm:{z:-.72}}},
    {at:.6,pose:{leftForeArm:{z:.15},rightForeArm:{z:-.15}}},
    {at:.82,pose:{leftForeArm:{z:.45},rightForeArm:{z:-.45}}},{at:1,pose:{}}
  ]));
  r(sequence("turnBody",2.2,"body",[
    {at:0,pose:{}},{at:.35,pose:{spine:{y:-.3},head:{y:-.12}}},
    {at:.62,pose:{spine:{y:-.62},chest:{y:-.25},head:{y:-.18}}},
    {at:.8,pose:{spine:{y:-.45},head:{y:-.12}}},{at:1,pose:{}}
  ]));
  r(sequence("walk",3.2,"body",[
    {at:0,pose:{leftThigh:{x:.18},rightThigh:{x:-.18},leftShin:{x:-.06},rightShin:{x:.06},leftUpperArm:{z:-.12},rightUpperArm:{z:.12}}},
    {at:.25,pose:{leftThigh:{x:-.22},rightThigh:{x:.22},leftShin:{x:.1},rightShin:{x:-.1},leftUpperArm:{z:.12},rightUpperArm:{z:-.12}}},
    {at:.5,pose:{leftThigh:{x:.18},rightThigh:{x:-.18},leftShin:{x:-.06},rightShin:{x:.06},leftUpperArm:{z:-.12},rightUpperArm:{z:.12}}},
    {at:.75,pose:{leftThigh:{x:-.22},rightThigh:{x:.22},leftShin:{x:.1},rightShin:{x:-.1},leftUpperArm:{z:.12},rightUpperArm:{z:-.12}}},{at:1,pose:{}}
  ],{blend:.12}));
  r(sequence("sleep",3.6,"body",[
    {at:0,pose:{}},{at:.3,pose:{head:{x:.08},spine:{x:.06}}},
    {at:.55,pose:{head:{x:.18},spine:{x:.14},chest:{x:.08},jaw:{x:.03}}},
    {at:.78,pose:{head:{x:.15},spine:{x:.12}}},{at:1,pose:{head:{x:.12},spine:{x:.1}}}
  ]));
  r(sequence("wake",2.8,"body",[
    {at:0,pose:{head:{x:.12},spine:{x:.1}}},{at:.3,pose:{head:{x:.06},spine:{x:.04}}},
    {at:.58,pose:{spine:{x:-.02},head:{x:-.02}}},{at:.78,pose:{head:{y:.08}}},{at:1,pose:{}}
  ]));
  r({id:"adhanOpening",duration:5.2,layer:"special",update:({p})=>{const q=Math.min(Math.min(1,p/.18),p<.82?1:Math.max(0,(1-p)/.18));return{spine:{x:-.035*q,z:Math.sin(p*Math.PI)*.018},chest:{x:-.025*q},head:{x:-.025*q,y:Math.sin(p*Math.PI)*.035},leftUpperArm:{y:.95*q,z:-.18*q},rightUpperArm:{y:-.95*q,z:.18*q},leftForeArm:{z:1.28*q,x:-.12*q},rightForeArm:{z:-1.28*q,x:-.12*q},jaw:{x:.08*q}}}});
}