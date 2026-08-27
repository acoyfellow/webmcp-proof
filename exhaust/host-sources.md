# Host sources

Verified on 2026-08-27.

- OpenAI challenge page: `https://openai.com/webmcp-challenge/`.
- It states that ChatGPT's in-app browser supports WebMCP out of the box.
- It states that Google Chrome supports testing through its experimental flag or origin trial.
- Chrome's public WebMCP post says the API is available for prototyping to Early Preview Program participants.
- The specification revision `webmachinelearning/webmcp@41d12f057167ccf5954dbcf49d99502cb6c84491` defines `document.modelContext.registerTool`, `getTools`, and `executeTool` in secure contexts.
- A shim or a page calling its own tool is not evidence that an agent in the challenge host discovered and called the tool.
- The dedicated host research child timed out without output. It contributed no research result and was not retried.
