// SPDX-License-Identifier: MIT
// Copyright 2026 SynthCity
import {getHost,getWclap,startHost} from '../clap-audionode/wclap-js/wclap.mjs';
import {hostImports} from '../clap-audionode/host-imports.mjs';
import CBOR from '../clap-audionode/cbor.mjs';
export async function run(){
 const host=await startHost(await getHost(new URL('../clap-audionode/host.wasm',import.meta.url).href),hostImports()),api=host.hostInstance.exports;
 const results=[];
 for(const scenario of ['process order','flush order and lifetime','flush preserves queued notes']){
  const w=await host.startWclap(await getWclap(new URL('./event-probe.wasm',import.meta.url).href)),h=api.makeHosted(w.ptr),bytes=api.createBytes();let p,active=false;
  const send=data=>{new Uint8Array(host.hostMemory.buffer,api.resizeBytes(bytes,data.length),data.length).set(data);};
  try{
   send(new TextEncoder().encode('org.example.event-probe'));p=api.createPlugin(h,bytes);if(!p)throw Error('createPlugin');
   if(scenario==='flush preserves queued notes'){
    const note=new Uint8Array(40),view=new DataView(note.buffer);view.setUint32(0,40,true);view.setInt32(16,-1,true);view.setInt16(24,60,true);view.setFloat64(32,1,true);send(note);
    if(!api.pluginAcceptEvent(p,bytes))throw Error('note rejected');
   }
   api.pluginSetParam(p,1,.5);api.pluginSetParam(p,1,.75);
   if(scenario!=='process order')api.pluginParamsFlush(p);
   if(!api.pluginStart(p,48000,1,128,bytes))throw Error('activation');active=true;
   const buffers=CBOR.decode(new Uint8Array(host.hostMemory.buffer,api.getBytesData(bytes),api.getBytesLength(bytes)).slice());
   api.pluginProcess(p,128);
   const value=new Float32Array(w.memory.buffer,buffers.outputs[0][0],1)[0],events=new Float32Array(w.memory.buffer,buffers.outputs[0][1],1)[0];
   const expected=scenario==='process order'?2:scenario==='flush preserves queued notes'?1:0;
   if(value!==.75||events!==expected)throw Error(`expected value .75 / events ${expected}; got ${value} / ${events}`);
   results.push({scenario,passed:true});
  }catch(e){results.push({scenario,passed:false,error:String(e)});}
  finally{if(active)api.pluginStop(p);api.destroyBytes(bytes);api.removeHosted(h);}
 }
 return results;
}
