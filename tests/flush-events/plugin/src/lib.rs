//! Test-only plugin: echo received events to the host so the runner can inspect them.
use clap_sys::{
    entry::*, events::*, ext::params::*, factory::plugin_factory::*, host::*, plugin::*,
    process::*, version::*,
};
use std::{
    alloc::{alloc, dealloc, Layout},
    ffi::{c_char, c_void, CStr},
    ptr,
};

const ID: &[u8] = b"test.flush-events\0";
const fn c(bytes: &'static [u8]) -> *const c_char {
    bytes.as_ptr().cast()
}

static DESCRIPTOR: clap_plugin_descriptor = clap_plugin_descriptor {
    clap_version: CLAP_VERSION,
    id: c(ID),
    name: c(b"Flush event recorder\0"),
    vendor: c(b"\0"),
    url: c(b"\0"),
    manual_url: c(b"\0"),
    support_url: c(b"\0"),
    version: c(b"1\0"),
    description: c(b"Test fixture\0"),
    features: ptr::null(),
};

unsafe extern "C" fn yes(_: *const clap_plugin) -> bool {
    true
}
unsafe extern "C" fn noop(_: *const clap_plugin) {}
unsafe extern "C" fn destroy(plugin: *const clap_plugin) {
    drop(Box::from_raw(plugin as *mut clap_plugin));
}
unsafe extern "C" fn activate(_: *const clap_plugin, _: f64, _: u32, _: u32) -> bool {
    true
}

unsafe extern "C" fn echo(
    _: *const clap_plugin,
    input: *const clap_input_events,
    output: *const clap_output_events,
) {
    for i in 0..((*input).size.unwrap())(input) {
        let event = ((*input).get.unwrap())(input, i);
        ((*output).try_push.unwrap())(output, event);
    }
}
unsafe extern "C" fn process(
    plugin: *const clap_plugin,
    block: *const clap_process,
) -> clap_process_status {
    echo(plugin, (*block).in_events, (*block).out_events);
    CLAP_PROCESS_CONTINUE
}
unsafe extern "C" fn count(_: *const clap_plugin) -> u32 {
    1
}
unsafe extern "C" fn info(_: *const clap_plugin, index: u32, out: *mut clap_param_info) -> bool {
    if index != 0 {
        return false;
    }
    *out = std::mem::zeroed();
    (*out).id = 0;
    (*out).flags = CLAP_PARAM_IS_AUTOMATABLE;
    (*out).name[0] = b'A' as c_char;
    (*out).max_value = 1.0;
    true
}
unsafe extern "C" fn value(_: *const clap_plugin, id: u32, out: *mut f64) -> bool {
    if id != 0 {
        return false;
    }
    *out = 0.0;
    true
}
unsafe extern "C" fn to_text(
    _: *const clap_plugin,
    _: u32,
    _: f64,
    _: *mut c_char,
    _: u32,
) -> bool {
    false
}
unsafe extern "C" fn from_text(
    _: *const clap_plugin,
    _: u32,
    _: *const c_char,
    _: *mut f64,
) -> bool {
    false
}
static PARAMS: clap_plugin_params = clap_plugin_params {
    count: Some(count),
    get_info: Some(info),
    get_value: Some(value),
    value_to_text: Some(to_text),
    text_to_value: Some(from_text),
    flush: Some(echo),
};
unsafe extern "C" fn extension(_: *const clap_plugin, id: *const c_char) -> *const c_void {
    if CStr::from_ptr(id) == CLAP_EXT_PARAMS {
        &PARAMS as *const _ as *const c_void
    } else {
        ptr::null()
    }
}
unsafe extern "C" fn plugin_count(_: *const clap_plugin_factory) -> u32 {
    1
}
unsafe extern "C" fn descriptor(
    _: *const clap_plugin_factory,
    index: u32,
) -> *const clap_plugin_descriptor {
    if index == 0 {
        &DESCRIPTOR
    } else {
        ptr::null()
    }
}
unsafe extern "C" fn create(
    _: *const clap_plugin_factory,
    _: *const clap_host,
    id: *const c_char,
) -> *const clap_plugin {
    if CStr::from_ptr(id).to_bytes_with_nul() != ID {
        return ptr::null();
    }
    Box::into_raw(Box::new(clap_plugin {
        desc: &DESCRIPTOR,
        plugin_data: ptr::null_mut(),
        init: Some(yes),
        destroy: Some(destroy),
        activate: Some(activate),
        deactivate: Some(noop),
        start_processing: Some(yes),
        stop_processing: Some(noop),
        reset: Some(noop),
        process: Some(process),
        get_extension: Some(extension),
        on_main_thread: Some(noop),
    }))
}
static FACTORY: clap_plugin_factory = clap_plugin_factory {
    get_plugin_count: Some(plugin_count),
    get_plugin_descriptor: Some(descriptor),
    create_plugin: Some(create),
};
unsafe extern "C" fn entry_init(_: *const c_char) -> bool {
    true
}
unsafe extern "C" fn entry_deinit() {}
unsafe extern "C" fn factory(id: *const c_char) -> *const c_void {
    if CStr::from_ptr(id) == CLAP_PLUGIN_FACTORY_ID {
        &FACTORY as *const _ as *const c_void
    } else {
        ptr::null()
    }
}
#[no_mangle]
pub static clap_entry: clap_plugin_entry = clap_plugin_entry {
    clap_version: CLAP_VERSION,
    init: Some(entry_init),
    deinit: Some(entry_deinit),
    get_factory: Some(factory),
};

// WebCLAP requires malloc/free exports. Retain the allocation size in an aligned header.
#[no_mangle]
pub unsafe extern "C" fn malloc(size: usize) -> *mut u8 {
    let Some(total) = size.checked_add(16) else {
        return ptr::null_mut();
    };
    let Ok(layout) = Layout::from_size_align(total, 16) else {
        return ptr::null_mut();
    };
    let base = alloc(layout);
    if base.is_null() {
        return base;
    }
    base.cast::<usize>().write(total);
    base.add(16)
}
#[no_mangle]
pub unsafe extern "C" fn free(ptr: *mut u8) {
    if ptr.is_null() {
        return;
    }
    let base = ptr.sub(16);
    dealloc(
        base,
        Layout::from_size_align_unchecked(base.cast::<usize>().read(), 16),
    );
}
