'use strict';
'require baseclass';
'require rpc';
'require ui';

/* Shared rpc calls and helpers of the AmneziaWG views.
   Licensed to the public under the Apache License 2.0.
*/

const OBJ = 'luci.amneziawg-peers';

function decl(method, params) {
	return rpc.declare({ object: OBJ, method: method, params: params || [], expect: { '': {} } });
}

return baseclass.extend({
	list: decl('list'),
	getSettings: decl('get_settings'),
	genObfuscation: decl('gen_obfuscation'),
	setup: decl('setup', [ 'iface', 'address', 'port', 'host', 'dns' ]),
	setConfig: decl('set_config', [ 'host', 'port', 'dns', 'allowed_ips', 'mtu', 'keepalive', 'obf' ]),
	setInterface: decl('set_interface', [ 'port', 'mtu', 'obf', 'zones', 'filter' ]),
	restartInterface: decl('restart_interface'),
	service: decl('service', [ 'action' ]),
	changeCidr: decl('change_cidr', [ 'cidr' ]),
	addPeer: decl('add_peer', [ 'name', 'via', 'address' ]),
	setPeerAddress: decl('set_peer_address', [ 'name', 'address' ]),
	removePeer: decl('remove_peer', [ 'name' ]),
	setEnabled: decl('set_enabled', [ 'name', 'enabled' ]),
	setRoute: decl('set_route', [ 'name', 'via' ]),
	setPeerFilter: decl('set_peer_filter', [ 'name', 'dest' ]),
	getConfig: decl('get_config', [ 'name' ]),

	/* the obfuscation fields shared by the Config (client) and Interface (server) pages */
	obfLabels: function() { return {
		jc: _('Junk packet count (Jc)'),
		jmin: _('Junk packet min size (Jmin)'),
		jmax: _('Junk packet max size (Jmax)'),
		s1: _('Init packet junk size (S1)'),
		s2: _('Response packet junk size (S2)'),
		s3: _('Cookie reply packet junk size (S3)'),
		s4: _('Transport packet junk size (S4)'),
		h1: _('Init magic header (H1)'),
		h2: _('Response magic header (H2)'),
		h3: _('Cookie reply magic header (H3)'),
		h4: _('Transport magic header (H4)'),
		i1: _('Special junk packet 1 (I1)'),
		i2: _('Special junk packet 2 (I2)'),
		i3: _('Special junk packet 3 (I3)'),
		i4: _('Special junk packet 4 (I4)'),
		i5: _('Special junk packet 5 (I5)')
	}; },

	/* a label + field row in the LuCI style */
	row: function(label, field, hint) {
		return E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, label),
			E('div', { 'class': 'cbi-value-field' }, hint ? [ field, E('div', { 'class': 'cbi-value-description' }, hint) ] : field)
		]);
	},

	input: function(value, attrs) {
		const a = Object.assign({ 'class': 'cbi-input-text', 'type': 'text' }, attrs || {});
		a.value = (value == null) ? '' : value;
		return E('input', a);
	},

	/* the action row below a form */
	actions: function(buttons) {
		return E('div', { 'class': 'right', 'style': 'margin:1em 0' },
			buttons.reduce((acc, b) => acc.concat(acc.length ? [ ' ', b ] : [ b ]), []));
	},

	button: function(label, cls, fn) {
		return E('button', { 'class': 'btn cbi-button ' + (cls || ''), 'click': fn }, label);
	},

	/* the peer table styles, loaded once per page */
	loadStyles: function() {
		if (document.getElementById('awg-css'))
			return;
		document.head.appendChild(E('link', {
			'id': 'awg-css', 'rel': 'stylesheet', 'href': L.resource('amneziawg/amneziawg.css')
		}));
	},

	/* "Service Control" row: Start / Restart / Stop and Enable / Disable (start on boot), like the pbr page.
	   state = { running, enabled }; run(action) performs the call. Stop and Restart cut the tunnels. */
	serviceRow: function(state, run) {
		const btn = (action, label, cls, off, warn) => E('button', {
			'class': 'btn cbi-button ' + cls,
			'disabled': off ? '' : null,
			'click': ui.createHandlerFn(this, () => {
				if (warn && !confirm(warn))
					return;
				return run(action);
			})
		}, label);

		return this.row(_('Service Control'), E('div', {}, [
			btn('start', _('Start'), 'cbi-button-positive', state.running),
			' ', btn('restart', _('Restart'), 'cbi-button-action', !state.running,
				_('Restart the interface? Connected clients lose the tunnel for a moment.')),
			' ', btn('stop', _('Stop'), 'cbi-button-negative', !state.running,
				_('Stop the interface? Connected clients lose the tunnel until it is started again.')),
			E('span', { 'style': 'display:inline-block;width:2em' }),
			btn('enable', _('Enable'), 'cbi-button-neutral', state.enabled),
			' ', btn('disable', _('Disable'), 'cbi-button-negative', !state.enabled)
		]));
	},

	notify: function(text, level) {
		ui.addNotification(null, E('p', text), level || 'info');
	},

	/* turns a promise of an rpc reply into a notification; resolves to the reply, or null on error */
	handle: function(promise, okText) {
		return promise.then(res => {
			if (res && res.error) {
				this.notify(res.error, 'error');
				return null;
			}
			if (okText)
				this.notify(okText, 'info');
			if (res && res.warning)
				this.notify(res.warning, 'warning');
			return res;
		}).catch(e => {
			this.notify(e.message, 'error');
			return null;
		});
	},

	/* '10.100.0.2' -> 169869314, for numeric address sorting; invalid input sorts last */
	ip4ToInt: function(addr) {
		const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(addr || '');
		if (!m || m.slice(1).some(o => +o > 255))
			return Infinity;
		return m.slice(1).reduce((acc, o) => acc * 256 + (+o), 0);
	},

	fmtBytes: function(n) {
		if (!n)
			return '0 B';
		const u = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB' ];
		let i = 0;
		while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
		return n.toFixed(i ? 1 : 0) + ' ' + u[i];
	},

	fmtHandshake: function(ts) {
		if (!ts)
			return _('never');
		const d = Math.max(0, Math.floor(Date.now() / 1000) - ts);
		if (d < 60) return _('%d s ago').format(d);
		if (d < 3600) return _('%d min ago').format(Math.floor(d / 60));
		if (d < 86400) return _('%d h ago').format(Math.floor(d / 3600));
		return _('%d d ago').format(Math.floor(d / 86400));
	}
});
