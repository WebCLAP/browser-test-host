# Host event regressions

Build `event-probe.cpp` against the standard CLAP headers with a WASI compiler.
It has no third-party DSP, state extension or application dependency:

```sh
"$WASI_SDK/bin/clang++" --target=wasm32-wasip1 -O2 -std=c++17 \
  -I "$CLAP_INCLUDE" -mexec-model=reactor tests/event-probe.cpp \
  -Wl,--export=clap_entry,--export=malloc,--export=free,--export-table,--growable-table \
  -o tests/event-probe.wasm
```

Build the host and serve the repository with WASM MIME types (and COOP/COEP if
using shared memory). From a page on that origin:

```js
const {run} = await import('/tests/events.mjs');
console.table(await run());
```

All three cases must pass. The fixture outputs the final parameter value on the
left and the number of process input events on the right. Checks cover equal-time
parameter order during process, equal-time order during flush, no replay of
flushed events, and preservation of a queued note across parameter flush.
