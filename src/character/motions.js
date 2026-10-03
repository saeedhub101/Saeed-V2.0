export function registerCoreMotions(controller){
  const r=controller.register.bind(controller);
  r({id:"idle",loop:true,duration:0,layer:"body",update:({t})=>({
    spine:{z:Math.sin(t*1.4)*.012}, chest:{z:Math.sin(t*1.4+.5)*.018},
    leftUpperArm:{z:Math.sin(t*1.1)*.025}, rightUpperArm:{z:-Math.sin(t*1.1)*.025}
  })});
  r({id:"nod",duration:.65,layer:"head",update:({p})=>({head:{x:Math.sin(p*Math.PI*2)*.11}})});
  r({id:"shake",duration:.7,layer:"head",update:({p})=>({head:{y:Math.sin(p*Math.PI*4)*.16}})});
  r({id:"wave",duration:1.8,layer:"arms",update:({p})=>({
    rightUpperArm:{y:1.55,z:.18}, rightForeArm:{z:-1.55+Math.sin(p*Math.PI*6)*.22}
  })});
  r({id:"think",duration:2.4,layer:"arms",update:({p})=>({
    head:{y:-.12}, rightUpperArm:{y:.55,z:-.25}, rightForeArm:{z:-1.1}
  })});
  r({id:"jump",duration:1.1,layer:"body",update:({p})=>{
    const q=p<.35?p/.35:p<.7?1:(1-p)/.3;
    const bend=(1-q)*.28;
    return {leftThigh:{x:bend},rightThigh:{x:bend},leftShin:{x:-bend*.7},rightShin:{x:-bend*.7},
      leftUpperArm:{z:-q*.25},rightUpperArm:{z:q*.25},spine:{x:-q*.05}};
  }});
  r({id:"clap",duration:1.0,layer:"arms",update:({p})=>{
    const q=Math.sin(p*Math.PI);
    return {leftUpperArm:{y:.55,z:-.15*q},rightUpperArm:{y:-.55,z:.15*q},
      leftForeArm:{z:.8*q},rightForeArm:{z:-.8*q}};
  }});
  r({id:"dance",duration:4.0,layer:"body",update:({t})=>({
    spine:{z:Math.sin(t*7)*.08,x:Math.sin(t*3.5)*.04},
    head:{y:Math.sin(t*3.5)*.12},
    leftUpperArm:{y:.9+Math.sin(t*4)*.35,z:-.3+Math.sin(t*6)*.15},
    rightUpperArm:{y:-.9-Math.sin(t*4)*.35,z:.3-Math.sin(t*6)*.15},
    leftForeArm:{z:-1.1+Math.sin(t*5)*.25}, rightForeArm:{z:1.1-Math.sin(t*5)*.25},
    leftThigh:{x:Math.sin(t*7)*.16}, rightThigh:{x:-Math.sin(t*7)*.16}
  })});
  r({id:"talkGesture",duration:.9,layer:"arms",update:({t})=>({
    leftUpperArm:{z:Math.sin(t*7)*.08},rightUpperArm:{z:-Math.sin(t*7+.7)*.08},
    head:{y:Math.sin(t*3)*.05}
  })});
  r({id:"adhanOpening",duration:5.2,layer:"special",update:({p})=>{
    const rise=Math.min(1,p/.18),hold=p<.82?1:Math.max(0,(1-p)/.18);
    const q=Math.min(rise,hold);
    const settle=Math.max(0,(p-.82)/.18);
    return {
      spine:{x:-.035*q,z:Math.sin(p*Math.PI)*.018},
      chest:{x:-.025*q},
      head:{x:-.025*q,y:Math.sin(p*Math.PI)*.035},
      leftUpperArm:{y:.95*q,z:-.18*q},
      rightUpperArm:{y:-.95*q,z:.18*q},
      leftForeArm:{z:1.28*q,x:-.12*q},
      rightForeArm:{z:-1.28*q,x:-.12*q},
      jaw:{x:.08*q}
    };
  }});

}