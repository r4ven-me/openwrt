include $(TOPDIR)/rules.mk

PKG_NAME:=luci-proto-amneziawg-r4ven-me
LUCI_TITLE:=Support for AmneziaWG VPN
LUCI_DESCRIPTION:=Provides support and Web UI for AmneziaWG VPN
PKG_VERSION:=3.1.0
LUCI_DEPENDS:=+amneziawg-tools-r4ven-me +ucode +luci-lib-uqr +resolveip
PKG_PROVIDES:=luci-proto-amneziawg
LUCI_PKGARCH:=all
PKGARCH:=all

PKG_LICENSE:=Apache-2.0

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
