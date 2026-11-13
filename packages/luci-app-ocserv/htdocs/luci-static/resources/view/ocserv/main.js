'use strict';
'require form';
'require fs';
'require rpc';
'require uci';
'require ocserv.base as base';
'require ocserv.conf as conf';
'require ocserv.schema as schema';

/* OpenConnect VPN JavaScript for LuCI
   Converted from Lua to JavaScript by @systemcrash
   Copyright 2014 Nikos Mavrogiannopoulos <n.mavrogiannopoulos@gmail.com>
   Licensed to the public under the Apache License 2.0.
*/

const TEMPLATE = '/etc/ocserv/ocserv.conf.template';

const UCI_DEFAULTS = {
	ipaddr: '192.168.100.1',
	netmask: '255.255.255.0'
};

const callApplyAuth = rpc.declare({
	object: 'luci.ocserv-pki',
	method: 'apply_auth',
	params: [ 'auth', 'plain_fallback' ],
	expect: { '': {} }
});

return L.view.extend({
	load() {
		return Promise.all([
			L.resolveDefault(fs.read('/proc/net/ipv6_route'), null),
			L.resolveDefault(fs.exec('/usr/bin/certtool', ['--hash', 'sha256', '--key-id', '--infile', '/etc/ocserv/server-cert.pem']).then(res => res.stdout), null),
			L.resolveDefault(fs.read('/etc/ocserv/ca.pem'), ''),
			conf.read(TEMPLATE),
			uci.load('ocserv')
		]);
	},

	/* Option stored in UCI; the init script substitutes it into the template */
	addUciOption(s, spec) {
		const o = s.taboption(spec.tab, spec.type == 'flag' ? form.Flag : form.Value,
			spec.uci, spec.title, spec.desc);

		if (spec.type == 'flag') {
			o.default = spec.ucidef;
		}
		else {
			if (spec.datatype)
				o.datatype = spec.datatype;
			if (UCI_DEFAULTS[spec.uci])
				o.default = UCI_DEFAULTS[spec.uci];
			for (const v of spec.values || [])
				o.value(v);
		}

		return o;
	},

	/* UCI list: the init script appends "dns = <ip>" to the generated config */
	addDnsTable(s) {
		const sv = s.taboption('network', form.SectionValue, '_dns', form.TableSection, 'dns',
			_('DNS servers'),
			_('The DNS servers to be provided to clients; can be either IPv6 or IPv4. Typically you should include the address of this device'));
		const dns = sv.subsection;
		dns.anonymous = true;
		dns.addremove = true;

		const o = dns.option(form.Value, 'ip', _('IP Address'));
		o.datatype = 'ipaddr';
		o.rmempty = false;
	},

	/* UCI list: the init script appends "route = <ip>/<mask>" to the generated config */
	addRoutesTable(s) {
		const sv = s.taboption('network', form.SectionValue, '_routes', form.TableSection, 'routes',
			_('Routing table'),
			_('The routing table to be provided to clients; you can mix IPv4 and IPv6 routes, the server will send only the appropriate. Leave empty to set a default route'));
		const routes = sv.subsection;
		routes.anonymous = true;
		routes.addremove = true;

		let o = routes.option(form.Value, 'ip', _('IP Address'));
		o.datatype = 'ipaddr';
		o.rmempty = false;

		o = routes.option(form.Value, 'netmask', _('Netmask (or IPv6-prefix)'));
		o.default = '255.255.255.0';
		o.value('255.255.255.0');
		o.value('255.255.0.0');
		o.value('255.0.0.0');
	},

	render([has_ipv6, pki_hash, ca_content, model]) {
		const view = this;

		this.model = model;
		this.fileText = model.serialize();
		this.rawShown = this.fileText;
		this.pendingRaw = null;

		pki_hash = pki_hash ? 'sha256:' + pki_hash.trim() : '';

		const m = new form.Map('ocserv', _('OpenConnect VPN'));
		this.m = m;

		const s = m.section(form.TypedSection, 'ocserv', 'OpenConnect');
		s.anonymous = true;
		s.addremove = false;

		for (const [ id, title ] of schema.TABS)
			s.tab(id, title);
		s.tab('template', _('Edit Template'));
		s.tab('ca', _('CA certificate'));

		// Enable flag
		let o = s.taboption('general', form.Flag, 'enable', _('Enable server'));
		o.rmempty = false;
		o.default = '1';

		// Server's Public Key ID (read-only display)
		o = s.taboption('general', form.DummyValue, '_pkid', _("Server's Public Key ID"),
			_("The value to be communicated to the client to verify the server's certificate; this value only depends on the public key"));
		o.cfgvalue = function(section_id) {
			return pki_hash || _('Not available');
		};

		// Authentication
		o = s.taboption('general', form.ListValue, 'auth', _('User Authentication'),
			_('The authentication method for the users. The simplest is plain with a single username-password pair. Use PAM modules to authenticate using another server (e.g., LDAP, Radius). With certificate, users log in with a client certificate issued on the Client Certificates page.'));
		o.rmempty = false;
		o.default = 'plain';
		o.value('plain', 'plain');
		o.value('PAM', 'PAM');
		o.value('certificate', _('certificate'));

		o = s.taboption('general', form.Flag, 'auth_plain_fallback', _('Also allow password login'),
			_('Clients without a certificate may still log in with a username and password from Users & Groups.'));
		o.default = '0';
		o.depends('auth', 'certificate');

		for (const spec of schema.SERVER) {
			if (spec.ipv6 && !has_ipv6 && model.isManaged(spec.key))
				continue;

			// Options that exist only in UCI, placed next to the related directive
			if (spec.key == 'ipv4-network') {
				o = s.taboption('network', form.Flag, 'proxy_arp', _('Enable proxy arp'),
					_('Provide addresses to clients from a subnet of LAN; if enabled the network below must be a subnet of LAN. Note that the first address of the specified subnet will be reserved by ocserv, so it should not be in use. If you have a network in LAN covering 192.168.1.0/24 use 192.168.1.192/26 to reserve the upper 62 addresses.'));
				o.default = '0';
			}

			// dns/route are normally managed with the tables below; show the
			// template directives only if the file really contains some
			const tableManaged = (spec.key == 'dns' || spec.key == 'route') && !model.has(spec.key);

			if (spec.uci && model.isManaged(spec.key))
				this.addUciOption(s, spec);
			else if (!tableManaged)
				base.addConfOption(s, spec.tab, spec, model);

			if (spec.key == 'dns')
				this.addDnsTable(s);
			else if (spec.key == 'route')
				this.addRoutesTable(s);

			if (spec.key == 'tcp-port') {
				o = s.taboption('general', form.Flag, 'udp', _('Enable UDP'),
					_('Enable UDP channel support; this must be enabled unless you know what you are doing. Without UDP the tunnel runs over TCP, so user traffic is TCP inside TCP: use BBR (net.ipv4.tcp_congestion_control=bbr; this package sets it on this router) on every other node of the chain too, i.e. on remote servers and on client machines, and reconnect the tunnels after changing it.'));
				o.default = '1';
			}
		}

		// Template editor: shows the same file the forms above read and write
		o = s.taboption('template', form.TextValue, '_tmpl',
			_('Edit the template that is used for generating the ocserv configuration. Every directive found here is also available in the other tabs. If this text is changed, it replaces the file and form changes made in the same save are discarded.'));
		o.rows = 20;
		o.monospace = true;
		o.rmempty = false;
		o.cfgvalue = function(section_id) {
			return view.rawShown;
		};
		o.write = function(section_id, formvalue) {
			view.pendingRaw = formvalue;
		};
		o.remove = o.write;

		// CA certificate viewer
		o = s.taboption('ca', form.TextValue, '_ca',
			_('View the CA certificate used by this server. You will need to save it as \'ca.pem\' and import it into the clients.'));
		o.rows = 20;
		o.monospace = true;
		o.readonly = true;
		o.cfgvalue = function(section_id) {
			return ca_content;
		};
		o.remove = function() { return false; };
		o.write = function() { return false; };

		this.svc = base.serviceControl(enabled => {
			const found = m.lookupOption('enable', 'config');
			const ui_el = found && found[0].getUIElement(found[1]);
			if (ui_el)
				ui_el.setValue(enabled ? '1' : '0');
		});

		return m.render().then(node => E([ node, E('div', { 'class': 'cbi-section' }, this.svc) ]));
	},

	handleSave(ev) {
		this.pendingRaw = null;

		return this.super('handleSave', [ ev ]).then(() => {
			if (this.pendingRaw != null)
				this.model.setText(this.pendingRaw);

			return base.flush(TEMPLATE, this.model, this.fileText);
		}).then(text => {
			this.fileText = text;
			this.rawShown = text;

			const auth = uci.get('ocserv', 'config', 'auth') || 'plain';
			const fallback = uci.get('ocserv', 'config', 'auth_plain_fallback') == '1';
			return L.resolveDefault(callApplyAuth(auth, fallback), null);
		}).then(res => {
			if (res && res.error)
				L.ui.addNotification(null, E('p', res.error), 'error');

			return this.m.reset ? this.m.reset() : null;
		});
	},

	handleSaveApply(ev) {
		/* Save & Apply may have started, stopped or (de)activated the service: redraw its buttons */
		return base.handleSaveApply(this, ev).then(() => this.svc && this.svc.refresh());
	}
});
