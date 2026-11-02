#
# Copyright (C) 2008-2014 The LuCI Team <luci@lists.subsignal.org>
#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Support for OpenConnect VPN
LUCI_DEPENDS:=+luci-base +ocserv +certtool +openssl-util

PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Nikos Mavrogiannopoulos <n.mavrogiannopoulos@gmail.com>

# Defined before luci.mk so the package framework registers a pre-deinstall hook.
define Package/luci-app-ocserv/prerm
#!/bin/sh
[ "$${PKG_UPGRADE}" = 1 ] && exit 0
root="$${IPKG_INSTROOT}"
dst="$${root}/etc/init.d/ocserv"
backup="$${root}/usr/libexec/ocserv-stock.init"

if [ -f "$${backup}" ]; then
	cp "$${backup}" "$${dst}"
	chmod 0755 "$${dst}"
	rm -f "$${backup}"
fi
exit 0
endef

include ../../luci.mk

# /etc/ocserv holds the CA, PKI and issued client certificates, generated at runtime (not
# shipped by the ocserv package, so sysupgrade would otherwise drop them on a reflash).
define Package/luci-app-ocserv/postinst
#!/bin/sh
root="$${IPKG_INSTROOT}"
src="$${root}/usr/libexec/ocserv-multivhost.init"
dst="$${root}/etc/init.d/ocserv"
backup="$${root}/usr/libexec/ocserv-stock.init"

if [ -f "$${src}" ]; then
	if [ -f "$${dst}" ] && ! grep -qF 'Managed by luci-app-ocserv (multi-vhost capable).' "$${dst}"; then
		cp "$${dst}" "$${backup}"
		chmod 0755 "$${backup}"
	fi
	cp "$${src}" "$${dst}"
	chmod 0755 "$${dst}"
fi

grep -qxF '/etc/ocserv/' "$${root}/etc/sysupgrade.conf" 2>/dev/null || \
	echo '/etc/ocserv/' >> "$${root}/etc/sysupgrade.conf"
exit 0
endef

# call BuildPackage - OpenWrt buildroot signature
