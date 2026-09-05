# Core packages

Published cores use `packages/<core-id>/<version>/`.

A version directory contains a signed `package.json`, its declared WebAssembly entrypoint, and only the metadata/license artifacts listed in that signed manifest. New versions are additive; do not mutate a version that has already been published.
