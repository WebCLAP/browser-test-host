// SPDX-License-Identifier: MIT
// Copyright 2026 SynthCity
import {getHost,getWclap,startHost} from '../clap-audionode/wclap-js/wclap.mjs';
import {hostImports} from '../clap-audionode/host-imports.mjs';
import CBOR from '../clap-audionode/cbor.mjs';
export async function run(hostUrl=new URL('../clap-audionode/host.wasm',import.meta.url).href){
 const host=await startHost(await getHost(hostUrl),hostImports()),api=host.hostInstance.exports;
 const w=await host.startWclap(await getWclap(new URL('./process-probe.wasm',import.meta.url).href)),h=api.makeHosted(w.ptr),bytes=api.createBytes();let p,active=false;
 const send=data=>new Uint8Array(host.hostMemory.buffer,api.resizeBytes(bytes,data.length),data.length).set(data);
 let buffers;
 const start=()=>{if(!api.pluginStart(p,48000,1,128,bytes))throw Error('activation');active=true;buffers=CBOR.decode(new Uint8Array(host.hostMemory.buffer,api.getBytesData(bytes),api.getBytesLength(bytes)).slice());};
 const assert=(ok,message)=>{if(!ok)throw Error(message);};
 const check=(n,value)=>{
  const left=new Float32Array(w.memory.buffer,buffers.outputs[0][0],128),right=new Float32Array(w.memory.buffer,buffers.outputs[0][1],128);left.fill(-123);right.fill(-123);
  assert(api.pluginProcess(p,n)===1,'process status');
  assert(left.slice(0,n).every(x=>x===value)&&right.slice(0,n).every(x=>x===n),'wrong output / frame count');
  assert(left.slice(n).every(x=>x===-123)&&right.slice(n).every(x=>x===-123),'wrote beyond block');
 };
 try{
  send(new TextEncoder().encode('org.example.process-probe'));p=api.createPlugin(h,bytes);assert(p,'createPlugin');start();
  for(const n of [1,1,17,128,128,1,64,1])check(n,0);
  api.pluginSetParam(p,1,.75);check(1,.75);check(1,.75);check(128,.75);
  api.pluginStop(p);active=false;start();check(128,.75);check(1,.75);
  const scenarios=[];
  for(const n of [1,128]){
   for(let i=0;i<5000;i++)api.pluginProcess(p,n);
   const samples=[];
   for(let round=0;round<15;round++){
    const begin=performance.now();for(let i=0;i<20000;i++)api.pluginProcess(p,n);
    samples.push((performance.now()-begin)/20000*1000);
   }
   samples.sort((a,b)=>a-b);scenarios.push({frames:n,medianMicroseconds:samples[7],p90Microseconds:samples[13],samples});
  }
  return {passed:true,scenarios};
 }finally{if(active)api.pluginStop(p);api.destroyBytes(bytes);api.removeHosted(h);}
}
