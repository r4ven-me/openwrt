IMAGE := luci-app-ocserv-build
IMAGE_AWG := luci-app-amneziawg-build
IMAGE_SIGN := luci-app-r4ven-sign
KORNORD_THEME ?= $(CURDIR)/packages/luci-theme-kornord

KDBX ?= /home/lans/Home/Webdav/KeePass/keepasshome.kdbx
ENTRY ?= 09. CRYPT/r4ven-apk.pem
ATTACH ?= r4ven-apk.pem

# Private key lives only in KeePassXC: export it to tmpfs for the duration of the build.
define with_signing_key
set -e; \
tmp=$$(mktemp -d /dev/shm/r4ven-sign.XXXXXX); \
trap 'rm -rf "$$tmp"' EXIT; \
cp keys/r4ven-apk.pub "$$tmp/"; \
secret-tool lookup Kee Pass | keepassxc-cli attachment-export -q "$(KDBX)" "$(ENTRY)" "$(ATTACH)" "$$tmp/r4ven-apk.pem"; \
chmod 600 "$$tmp/r4ven-apk.pem"; \
$(1)
endef

.PHONY: build build-awg publish publish-push release clean

build:
	docker build -f build/Dockerfile -t $(IMAGE) .
	@$(call with_signing_key,docker run --rm -v $(CURDIR)/packages/luci-app-ocserv:/src:ro -v $(CURDIR)/build/build.sh:/build.sh:ro -v "$$tmp":/keys:ro -v $(CURDIR)/dist:/out $(IMAGE) /build.sh)

build-awg:
	test -f "$(KORNORD_THEME)/Makefile" || { echo "Kornord theme not found: $(KORNORD_THEME)" >&2; exit 1; }
	mkdir -p dist-awg
	docker build -f build/Dockerfile.awg -t $(IMAGE_AWG) .
	@$(call with_signing_key,docker run --rm -v $(CURDIR)/packages/luci-app-amneziawg:/src:ro -v $(CURDIR)/packages/luci-proto-amneziawg:/src-proto:ro -v $(CURDIR)/packages/luci-i18n-amneziawg-ru-r4ven-me:/src-i18n:ro -v $(KORNORD_THEME):/src-theme:ro -v $(CURDIR)/build/build-awg.sh:/build.sh:ro -v "$$tmp":/keys:ro -v $(CURDIR)/dist-awg:/out $(IMAGE_AWG) /build.sh)

# Builds the signed index of the latest packages into repo-out/<RELEASE>/<ARCH>/ (no push; see build/publish.sh)
RELEASE ?= 25.12
ARCH ?= x86_64

publish:
	mkdir -p repo-out/$(RELEASE)/$(ARCH)
	@$(call with_signing_key,docker run --rm -v $(CURDIR)/dist:/dist:ro -v $(CURDIR)/dist-awg:/dist-awg:ro -v $(CURDIR)/build/publish.sh:/publish.sh:ro -v "$$tmp":/keys:ro -v $(CURDIR)/repo-out/$(RELEASE)/$(ARCH):/out $(IMAGE) /publish.sh)

# Pushes repo-out/ + the landing page (build/gen-index.py, build/site/) + build/gh-pages-README.md + build/CNAME (custom domain) + the public key to the gh-pages branch of REMOTE
REMOTE ?= git@github.com:r4ven-me/openwrt.git

publish-push:
	set -e; \
	tmp=$$(mktemp -d); trap 'rm -rf "$$tmp"' EXIT; \
	if git ls-remote --exit-code --heads $(REMOTE) gh-pages >/dev/null 2>&1; then \
		git clone -q -b gh-pages $(REMOTE) "$$tmp/w"; \
	else \
		git init -q -b gh-pages "$$tmp/w"; git -C "$$tmp/w" remote add origin $(REMOTE); \
	fi; \
	rm -rf "$$tmp/w/$(RELEASE)/$(ARCH)"; mkdir -p "$$tmp/w/$(RELEASE)"; \
	cp -r repo-out/$(RELEASE)/$(ARCH) "$$tmp/w/$(RELEASE)/"; \
	cp build/gh-pages-README.md build/CNAME keys/r4ven-apk.pub build/site/logo.jpg build/site/favicon.svg "$$tmp/w/"; touch "$$tmp/w/.nojekyll"; \
	python3 build/gen-index.py repo-out/$(RELEASE)/$(ARCH) "$$tmp/w/index.html" $(RELEASE) $(ARCH); \
	git -C "$$tmp/w" add -A; \
	git -C "$$tmp/w" commit -q -m "Publish $(RELEASE)/$(ARCH)"; \
	git -C "$$tmp/w" push origin gh-pages

# CI flow: a `v*` tag makes GitHub Actions build UNSIGNED apks into a GitHub Release (.github/workflows/build.yml).
# This target downloads them, signs the apks and the index with the key from KeePassXC (the key never leaves this
# machine) and pushes gh-pages. Usage: make release TAG=v1.2.3
release:
	test -n "$(TAG)" || { echo "usage: make release TAG=vX" >&2; exit 1; }
	rm -rf dist-release release-empty; mkdir -p dist-release release-empty repo-out/$(RELEASE)/$(ARCH)
	gh release download "$(TAG)" --dir dist-release
	chmod +x dist-release/apk-host
	docker build -f build/Dockerfile.sign -t $(IMAGE_SIGN) build
	@$(call with_signing_key,docker run --rm -v $(CURDIR)/dist-release/apk-host:/usr/local/bin/apk:ro -v $(CURDIR)/dist-release:/dist -v $(CURDIR)/release-empty:/dist-awg:ro -v $(CURDIR)/build/sign.sh:/sign.sh:ro -v $(CURDIR)/build/publish.sh:/publish.sh:ro -v "$$tmp":/keys:ro -v $(CURDIR)/repo-out/$(RELEASE)/$(ARCH):/out $(IMAGE_SIGN) /sign.sh)
	$(MAKE) publish-push

clean:
	rm -rf dist/* dist-awg/* dist-release release-empty
