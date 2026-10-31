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

include ../../luci.mk

# /etc/ocserv holds the CA, PKI and issued client certificates, generated at runtime (not
# shipped by the ocserv package, so sysupgrade would otherwise drop them on a reflash).
define Package/luci-app-ocserv/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
grep -qxF '/etc/ocserv/' /etc/sysupgrade.conf 2>/dev/null || echo '/etc/ocserv/' >> /etc/sysupgrade.conf
exit 0
endef

# call BuildPackage - OpenWrt buildroot signature
