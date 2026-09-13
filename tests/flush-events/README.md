# Parameter flush regression

This test calls the browser host's exported API with a small event-echo plugin.
It checks that each of two parameter flushes delivers only its new event, an
empty flush delivers nothing, and a queued note survives the flushes and is
delivered exactly once by processing. It does not require audio hardware.

Initialize the host dependencies from the repository root:

```sh
git submodule update --init --recursive clap-audionode/wclap-js clap-audionode/host-dev/modules/cbor-walker
```

Build `clap-audionode/host.wasm` from the source being tested using the
[host build instructions](../../clap-audionode/host-dev/README.md). The CMake
target is `host`. The checked-in host binary can also be used to reproduce the
failure before the fix; changing the header alone does not rebuild that binary.

For WASI SDK 34 and CMake 3.31.8, this Linux build invocation supplies two headers
that the pinned dependencies otherwise obtain through transitive includes. It
also updates the SDK toolchain's old target spelling in a temporary copy:

```sh
sed 's/wasm32-wasi-threads/wasm32-wasip1-threads/g' "$WASI_SDK/share/cmake/wasi-sdk-pthread.cmake" > /tmp/flush-test-toolchain.cmake
cmake -S clap-audionode/host-dev -B clap-audionode/host-dev/cmake-build \
  -DWASI_SDK_PREFIX="$WASI_SDK" \
  -DCMAKE_TOOLCHAIN_FILE=/tmp/flush-test-toolchain.cmake \
  -DCMAKE_BUILD_TYPE=Release '-DCMAKE_CXX_FLAGS=-include vector -include memory'
cmake --build clap-audionode/host-dev/cmake-build --target host
```

Build the test plugin with Rust and Cargo:

```sh
rustup target add wasm32-unknown-unknown
cargo rustc --manifest-path tests/flush-events/plugin/Cargo.toml --locked --release --target wasm32-unknown-unknown -- -C link-arg=--export-table -C link-arg=--growable-table
```

Serve the repository with the existing server:

```sh
python3 server.py 8000
```

Open <http://localhost:8000/tests/flush-events/> in a browser. The page reports
`PASS` or the failing assertion. Automation may await `window.testResult`, which
resolves to `{ok: true}` or `{ok: false, error: ...}`.

Before the fix, the second flush reports two parameter events instead of one.
The fixture echoes event bytes synchronously, so the assertions inspect what
the plugin received without exposing additional host diagnostics.
