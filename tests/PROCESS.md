# Small-block process regression and benchmark

`process-probe.cpp` is an independent MIT-licensed CLAP fixture with no external
DSP. It writes the current parameter to the left channel and `frames_count` to
the right. Build against standard CLAP headers:

```sh
"$WASI_SDK/bin/clang++" --target=wasm32-wasip1 -O2 -std=c++17 \
  -I "$CLAP_INCLUDE" -mexec-model=reactor tests/process-probe.cpp \
  -Wl,--export=clap_entry,--export=malloc,--export=free,--export-table,--growable-table \
  -o tests/process-probe.wasm
```

Build the host and serve the repository with WASM MIME types and COOP/COEP.
From a page on that origin:

```js
const {run} = await import('/tests/process.mjs');
console.log(await run());
// Optionally compare a host built from the base commit with the SAME toolchain:
console.log(await run(location.origin + '/baseline.wasm'));
```

Checks alternate 1/17/64/128-frame blocks, verify untouched samples past the
block boundary, interleave parameter events with empty blocks, and stop/start
then process the same block length to catch stale cached values after activation.
Benchmarks warm up 5,000 calls and measure 15 batches of 20,000 calls for each
block size. Compare medians in alternating baseline/candidate order.

This measures host dispatch plus a trivial plugin, not complete rack CPU usage,
DSP quality, or AudioWorklet deadlines. Run the regular event/transport tests too.
