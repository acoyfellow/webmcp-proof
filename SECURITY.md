# Security

`webmcp-proof` launches a caller-selected Chrome binary with an isolated profile and uses its DevTools endpoint.

Do not point it at managed employee Chrome. Do not include credentials in committed proof. Request headers are sent to the target page but are never copied into the receipt.

Tool output is untrusted page content. A passing transport receipt does not prove that the tool itself is safe.

Report vulnerabilities privately to the repository owner before public disclosure.
