FROM debian:13-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gawk gettext git libncurses-dev python3 python3-setuptools \
    rsync unzip zstd wget curl ca-certificates file xz-utils swig libssl-dev \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m builder
USER builder
WORKDIR /home/builder
ARG SDK_URL=https://downloads.openwrt.org/releases/25.12.6/targets/x86/64/openwrt-sdk-25.12.6-x86-64_gcc-14.3.0_musl.Linux-x86_64.tar.zst
RUN curl -fsSL "$SDK_URL" | tar --zstd -x && mv openwrt-sdk-* sdk
# Heavy, rarely changing part: feeds and dependencies are built once into the image
RUN cd sdk \
    && ./scripts/feeds update base packages luci \
    && ./scripts/feeds install -p luci luci-base \
    && ./scripts/feeds install ocserv openssl-util \
    && make defconfig \
    && printf 'CONFIG_PACKAGE_ocserv=m\nCONFIG_PACKAGE_openssl-util=m\n' >> .config \
    && make defconfig \
    && make package/feeds/packages/ocserv/compile -j"$(nproc)"
# Final .config including our package, so that the real build does not change it
# (any .config change makes the kernel modules rebuild). Only the Makefile is
# needed for that; sources are copied in at build time.
COPY --chown=builder packages/luci-app-ocserv/Makefile /home/builder/pkgseed/Makefile
RUN cd sdk \
    && mkdir -p package/luci-app-ocserv \
    && cp ~/pkgseed/Makefile package/luci-app-ocserv/ \
    && sed -i 's#\.\./\.\./luci\.mk#$(TOPDIR)/feeds/luci/luci.mk#' package/luci-app-ocserv/Makefile \
    && echo 'CONFIG_PACKAGE_luci-app-ocserv=m' >> .config \
    && make defconfig \
    && make package/luci-app-ocserv/compile -j"$(nproc)"
