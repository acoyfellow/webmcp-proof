# Native host proof

Chrome source maps `chrome://flags/#enable-webmcp-testing` to `blink::features::kWebMCP`. The DevTools protocol exposes `WebMCP.enable`, `toolsAdded`, `invokeTool`, `toolInvoked`, `toolResponded`, and `toolsRemoved`.

An isolated Chrome for Testing 151 process ran with `WebMCP` and `DevToolsWebMCPSupport`. The controller supplied HTTP Basic authentication through CDP, enabled the WebMCP domain before navigation, and invoked the registered tool through `WebMCP.invokeTool`.

Observed invocation: `29B776B0465D66A52200DE838D5367BD`.

The page changed to `chrome-native-ok`. Its visible receipt call ID matched the DevTools response. Aborting the registration emitted `toolsRemoved`; a second invocation failed with `Tool not found`; the visible signal did not change.

This is native Chrome WebMCP proof. It is not a shim, page self-test, synthetic call, or cmux WKWebView result.
