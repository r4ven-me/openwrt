# SPDX-License-Identifier: Apache-2.0

include $(TOPDIR)/rules.mk

LUCI_TITLE:=Kornord Theme (Nord colors for Bootstrap)
LUCI_DEPENDS:=+luci-base

PKG_VERSION:=2.0.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=Ivan Cherniy

define Package/luci-theme-kornord/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	current="$$(uci -q get luci.main.mediaurlbase)"
	uci -q delete luci.themes.Kornord
	uci -q delete luci.themes.KornordDark
	uci -q delete luci.themes.KornordLight
	case "$$current" in
		/luci-static/kornord*) uci -q set luci.main.mediaurlbase=/luci-static/bootstrap ;;
	esac
	uci commit luci
}
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
