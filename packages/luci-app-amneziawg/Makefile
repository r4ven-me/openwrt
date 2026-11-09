#
# This is free software, licensed under the Apache License, Version 2.0 .
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-amneziawg-r4ven-me
LUCI_TITLE:=LuCI app for AmneziaWG: peers, client configs and routing
LUCI_DEPENDS:=+luci-base +amneziawg-tools-r4ven-me +kmod-amneziawg-r4ven-me +pbr
PKG_PROVIDES:=luci-app-amneziawg

PKG_LICENSE:=Apache-2.0

include ../../luci.mk

# /etc/config/amneziawg holds the peers (incl. client private keys and PSKs), generated at
# runtime and not declared as a conffile by any package, so sysupgrade would otherwise drop it.
define Package/luci-app-amneziawg-r4ven-me/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
grep -qxF '/etc/config/amneziawg' /etc/sysupgrade.conf 2>/dev/null || echo '/etc/config/amneziawg' >> /etc/sysupgrade.conf
exit 0
endef

# call BuildPackage - OpenWrt buildroot signature
