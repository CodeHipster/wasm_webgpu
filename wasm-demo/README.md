# Rust compile to web assembly demo

docs: https://rustwasm.github.io/docs/wasm-bindgen/examples/without-a-bundler.html

Tried to use with webpack, but webpack and bindgen did not work well together due to reference types (or something)


## How to run

Install Rust   
Install wasm-pack   
Install miniserve to serve the web files   

```
cargo install miniserve
miniserve . --index "index.html" -p 8080
```

Run 
```
wasm-pack build --release --target web
```

This will generate files in /pkg 

Move the demo_bg.wasm & demo.js to the /www folder

The demo.js holds the 'glue' to interact with the wasm code.
