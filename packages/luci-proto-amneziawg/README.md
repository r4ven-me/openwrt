# luci-proto-amneziawg

Copy of the LuCI protocol package from the community repository github.com/Slava-Shchipunov/awg-openwrt
(rev 03b6226; the package Makefile declares Apache-2.0, the repository itself carries no LICENSE file).
It teaches LuCI the `amneziawg` protocol (Network -> Interfaces -> Edit, Status -> AmneziaWG) and is independent
of `luci-app-amneziawg`.

Its `po/` is left out on purpose: it uses the translation domain `amneziawg`, the same as luci-app-amneziawg,
and the two language files would overwrite each other.

Build: `make build-awg` (see ../../build/Dockerfile.awg: the layers for this package come after the kernel ones).
