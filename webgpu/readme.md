# WEBGPU

Webgpu is the latest technology to develop for the gpu using the browser.
This allows to also use the gpu for compute shaders besides vertex & fragment shaders

## syntax 
install these for highlighting
https://marketplace.visualstudio.com/items?itemName=PolyMeilex.wgsl
https://marketplace.visualstudio.com/items?itemName=ggsimm.wgsl-literal

And this one for syntax validation
```cargo install cargo-wgsl```


## running
Install miniserve to host the page.
```
cargo install miniserve
```

run
```
miniserve . --index "index.html" -p 8080
```