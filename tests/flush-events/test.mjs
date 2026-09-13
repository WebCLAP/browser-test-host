import {getHost, startHost, getWclap} from '../../clap-audionode/wclap-js/wclap.mjs';
import {hostImports} from '../../clap-audionode/host-imports.mjs';

export async function run() {
    const imports = hostImports();
    const received = [];
    let pluginMemory;
    imports.env.eventsOutTryPush = (_, ptr, length) => {
        received.push(new Uint8Array(pluginMemory.buffer).slice(ptr, ptr + length));
        return true;
    };
    const host = await startHost(await getHost(new URL('../../clap-audionode/host.wasm', import.meta.url).href), imports);
    const module = await host.startWclap(await getWclap({
        url: new URL('./plugin/target/wasm32-unknown-unknown/release/flush_events_fixture.wasm', import.meta.url).href,
    }));
    pluginMemory = module.memory;
    const api = host.hostInstance.exports;
    const hosted = api.makeHosted(module.ptr);
    if (!hosted) throw Error('makeHosted failed');
    const bytes = api.createBytes();
    const writeBytes = data => {
        const ptr = api.resizeBytes(bytes, data.length);
        new Uint8Array(host.hostMemory.buffer).set(data, ptr);
    };
    writeBytes(new TextEncoder().encode('test.flush-events'));
    const plugin = api.createPlugin(hosted, bytes);
    if (!plugin) throw Error('createPlugin failed');
    let active = false;
    const check = (label, expected) => {
        const actual = received.splice(0).map(bytes => {
            const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            const type = view.getUint16(10, true);
            if (type === 5) return ['param', view.getUint32(16, true), view.getFloat64(40, true)];
            if (type === 0) return ['note', view.getInt16(24, true)];
            return ['unexpected type', type];
        });
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    };
    try {
        active = !!api.pluginStart(plugin, 48000, 1, 128, bytes);
        if (!active) throw Error('pluginStart failed');

        // Queue a standard CLAP note-on before flushing parameter changes.
        const note = new Uint8Array(40);
        const view = new DataView(note.buffer);
        view.setUint32(0, 40, true); // header.size; time/space/type/flags are zero
        view.setInt32(16, -1, true); // note_id
        view.setInt16(24, 60, true); // key; port/channel are zero
        view.setFloat64(32, 1, true); // velocity
        writeBytes(note);
        if (!api.pluginAcceptEvent(plugin, bytes)) throw Error('note was rejected');

        for (const value of [0.25, 0.75]) {
            api.pluginSetParam(plugin, 0, value);
            api.pluginParamsFlush(plugin);
            check(`flush ${value}`, [['param', 0, value]]);
        }
        api.pluginParamsFlush(plugin);
        check('empty flush', []);
        api.pluginProcess(plugin, 128);
        check('process after flushes', [['note', 60]]);
        api.pluginProcess(plugin, 128);
        check('next process', []);
    } finally {
        if (active) api.pluginStop(plugin);
        api.destroyPlugin(plugin);
        api.destroyBytes(bytes);
        api.removeHosted(hosted);
    }
}
