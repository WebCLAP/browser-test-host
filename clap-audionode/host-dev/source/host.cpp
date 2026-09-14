#include <iostream>
#ifndef LOG_EXPR
#	define LOG_EXPR(expr) std::cout << #expr " = " << (expr) << std::endl;
#endif

#include "./common.h"

/*
	Hosts WCLAP instances, manages plugins, and exports a simpler API for use from JS
*/
#include "./hosted-wclap.h"
#include "./hosted-plugin.h"

#include "./cbor-bytes.h"

extern "C" {
	HostedWclap * WASM_FN(makeHosted)(Instance *instance) {
		return HostedWclap::create(instance);
	}
	void WASM_FN(removeHosted)(HostedWclap *hosted) {
		delete hosted;
	}
	void WASM_FN(getInfo)(HostedWclap *hosted, Bytes *bytes) {
		auto cbor = bytes->write();
		return hosted->getInfo(cbor);
	}

	HostedPlugin * WASM_FN(createPlugin)(HostedWclap *hosted, Bytes *bytes) {
		auto pluginId = bytes->readString();
		LOG_EXPR(pluginId);
		return hosted->createPlugin(pluginId.c_str());
	}
	void WASM_FN(destroyPlugin)(HostedPlugin *plugin) {
		delete plugin;
	}
	void WASM_FN(pluginMainThread)(HostedPlugin *plugin) {
		plugin->mainThread();
	}
	bool WASM_FN(pluginTakeProcessRequest)(HostedPlugin *plugin) {
		return plugin->takeProcessRequest();
	}
	void WASM_FN(pluginAdvanceSteadyTime)(HostedPlugin *plugin, uint32_t blockLength) {
		plugin->advanceSteadyTime(blockLength);
	}
	bool WASM_FN(pluginSetProcessing)(HostedPlugin *plugin, bool processing) {
		return plugin->setProcessing(processing);
	}
	uint32_t WASM_FN(pluginGetTail)(HostedPlugin *plugin) {
		return plugin->tailSamples();
	}
	void WASM_FN(pluginGetInfo)(HostedPlugin *plugin, Bytes *bytes) {
		auto cbor = bytes->write();
		return plugin->getInfo(cbor);
	}
	void WASM_FN(pluginMessage)(HostedPlugin *plugin, Bytes *bytes) {
		plugin->message(bytes->buffer.data(), bytes->buffer.size());
	}
	bool WASM_FN(pluginGetResource)(HostedPlugin *plugin, Bytes *bytes) {
		auto pathStr = bytes->readString();
		auto cbor = bytes->write();
		return plugin->getResource(pathStr, cbor);
	}
	void WASM_FN(pluginGetParams)(HostedPlugin *plugin, Bytes *bytes) {
		auto cbor = bytes->write();
		plugin->getParams(cbor);
	}
	void WASM_FN(pluginGetParam)(HostedPlugin *plugin, uint32_t paramId, Bytes *bytes) {
		auto cbor = bytes->write();
		plugin->getParam(paramId, cbor);
	}
	void WASM_FN(pluginSetParam)(HostedPlugin *plugin, uint32_t paramId, double value) {
		plugin->setParam(paramId, value);
	}
	void WASM_FN(pluginParamsFlush)(HostedPlugin *plugin) {
		plugin->paramsFlush();
	}
	bool WASM_FN(pluginStart)(HostedPlugin *plugin, double sRate, uint32_t minFrames, uint32_t maxFrames, Bytes *bytes) {
		auto cbor = bytes->write();
		return plugin->start(sRate, minFrames, maxFrames, cbor);
	}
	void WASM_FN(pluginStop)(HostedPlugin *plugin) {
		return plugin->stop();
	}
	bool WASM_FN(pluginAcceptEvent)(HostedPlugin *plugin, Bytes *bytes) {
		return plugin->acceptEvent(bytes->buffer.data());
	}

	bool WASM_FN(pluginSaveState)(HostedPlugin *plugin, Bytes *bytes) {
		return plugin->saveState(bytes->buffer);
	}
	bool WASM_FN(pluginLoadState)(HostedPlugin *plugin, Bytes *bytes) {
		return plugin->loadState(bytes->buffer);
	}

	uint32_t WASM_FN(pluginProcess)(HostedPlugin *plugin, uint32_t blockLength) {
		return plugin->process(blockLength);
	}
}
