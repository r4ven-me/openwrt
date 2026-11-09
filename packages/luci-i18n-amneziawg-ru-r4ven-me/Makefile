include $(TOPDIR)/rules.mk

PKG_NAME:=luci-i18n-amneziawg-ru-r4ven-me
PKG_VERSION:=1
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKG_BUILD_DEPENDS:=luci-base/host

include $(INCLUDE_DIR)/package.mk

define Package/luci-i18n-amneziawg-ru-r4ven-me
  SECTION:=luci
  CATEGORY:=LuCI
  TITLE:=luci-app-amneziawg-r4ven-me - Russian translation
  DEPENDS:=+luci-app-amneziawg-r4ven-me
  PROVIDES:=luci-i18n-amneziawg-ru
  CONFLICTS:=luci-i18n-amneziawg-ru
  REPLACES:=luci-i18n-amneziawg-ru
  PKGARCH:=all
endef

define Build/Compile
endef

define Package/luci-i18n-amneziawg-ru-r4ven-me/install
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	echo "uci set luci.languages.ru='Русский (Russian)'; uci commit luci" > $(1)/etc/uci-defaults/luci-i18n-amneziawg-ru-r4ven-me
	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/i18n
	po2lmo ./files/amneziawg.po $(1)/usr/lib/lua/luci/i18n/amneziawg.ru.lmo
endef

$(eval $(call BuildPackage,luci-i18n-amneziawg-ru-r4ven-me))
