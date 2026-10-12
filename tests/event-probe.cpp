// SPDX-License-Identifier: MIT
// Copyright 2026 SynthCity
#include <clap/clap.h>
#include <cstring>
static const char *features[]={"instrument",nullptr};
static const clap_plugin_descriptor_t descriptor={CLAP_VERSION,"org.example.event-probe","Event probe","SynthCity","","","","1","Host regression fixture",features};
struct State{clap_plugin_t plugin;double value=0;};
static State &self(const clap_plugin_t *p){return *static_cast<State*>(p->plugin_data);}
static void apply(const clap_plugin_t *p,const clap_input_events_t *events){
 for(uint32_t i=0;i<events->size(events);++i){auto *h=events->get(events,i);if(h->space_id==CLAP_CORE_EVENT_SPACE_ID&&h->type==CLAP_EVENT_PARAM_VALUE)self(p).value=reinterpret_cast<const clap_event_param_value_t*>(h)->value;}
}
static const clap_plugin_audio_ports_t ports={
 [](const clap_plugin_t*,bool input)->uint32_t{return input?0:1;},
 [](const clap_plugin_t*,uint32_t i,bool input,clap_audio_port_info_t *p){if(input||i)return false;*p={};p->id=0;p->channel_count=2;p->port_type=CLAP_PORT_STEREO;p->in_place_pair=CLAP_INVALID_ID;return true;}
};
static const clap_plugin_params_t params={
 [](const clap_plugin_t*)->uint32_t{return 1;},
 [](const clap_plugin_t*,uint32_t i,clap_param_info_t *p){if(i)return false;*p={};p->id=1;p->flags=CLAP_PARAM_IS_AUTOMATABLE;p->min_value=0;p->max_value=1;return true;},
 [](const clap_plugin_t *p,clap_id id,double *v){*v=self(p).value;return id==1;},nullptr,nullptr,
 [](const clap_plugin_t *p,const clap_input_events_t *in,const clap_output_events_t*){apply(p,in);}
};
static const clap_plugin_factory_t factory={
 [](const clap_plugin_factory_t*)->uint32_t{return 1;},
 [](const clap_plugin_factory_t*,uint32_t i)->const clap_plugin_descriptor_t*{return i?nullptr:&descriptor;},
 [](const clap_plugin_factory_t*,const clap_host_t*,const char *id)->const clap_plugin_t*{
 if(std::strcmp(id,descriptor.id))return nullptr;auto *s=new State;
 s->plugin={&descriptor,s,[](const clap_plugin_t*){return true;},[](const clap_plugin_t *p){delete &self(p);},
 [](const clap_plugin_t*,double,uint32_t,uint32_t){return true;},[](const clap_plugin_t*){},[](const clap_plugin_t*){return true;},[](const clap_plugin_t*){},[](const clap_plugin_t*){},
 [](const clap_plugin_t *p,const clap_process_t *b)->clap_process_status{apply(p,b->in_events);for(uint32_t i=0;i<b->frames_count;++i){b->audio_outputs[0].data32[0][i]=float(self(p).value);b->audio_outputs[0].data32[1][i]=float(b->in_events->size(b->in_events));}return CLAP_PROCESS_CONTINUE;},
 [](const clap_plugin_t*,const char *id)->const void*{if(!std::strcmp(id,CLAP_EXT_AUDIO_PORTS))return &ports;if(!std::strcmp(id,CLAP_EXT_PARAMS))return &params;return nullptr;},[](const clap_plugin_t*){}};
 return &s->plugin;}
};
extern "C" CLAP_EXPORT const clap_plugin_entry_t clap_entry={CLAP_VERSION,[](const char*){return true;},[](){},[](const char *id)->const void*{return !std::strcmp(id,CLAP_PLUGIN_FACTORY_ID)?&factory:nullptr;}};
