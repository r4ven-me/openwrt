'use strict';
'require ui';
'require amneziawg.common as awg';

/* What ends up in the client configs: connection, allowed IPs, DNS, MTU, keepalive, client obfuscation.
   Licensed to the public under the Apache License 2.0.
*/

const CLIENT_OBF = [ 'jc', 'jmin', 'jmax', 'i1', 'i2', 'i3', 'i4', 'i5' ];

return L.view.extend({
	load() {
		return L.resolveDefault(awg.getSettings(), {});
	},

	reload() {
		return awg.getSettings().then(data => {
			this.root.replaceChildren(this.renderForm(data));
		});
	},

	save() {
		const f = this.fields;
		const int = (v) => (v === '' ? 0 : parseInt(v, 10));
		const obf = {};
		CLIENT_OBF.forEach(k => { obf[k] = f.obf[k].value.trim(); });

		const port = parseInt(f.port.value, 10);
		if (!(port >= 1 && port <= 65535))
			return awg.notify(_('Port must be 1-65535.'), 'error');
		const mtu = int(f.mtu.value.trim());
		const keepalive = f.keepalive.value.trim() === '' ? 0 : parseInt(f.keepalive.value, 10);
		if (isNaN(mtu) || isNaN(keepalive))
			return awg.notify(_('MTU and keepalive must be numbers.'), 'error');

		return awg.handle(awg.setConfig(f.host.value.trim(), port, f.dns.getValue(), f.allowed.getValue(),
			mtu, keepalive, obf),
			_('Saved. The new values are used in client configs generated from now on; already imported configs keep the old ones.'));
	},

	renderForm(data) {
		if (!data.configured)
			return E('p', _('AmneziaWG is not set up yet. Open the Peers page first.'));

		const c = data.config;
		const labels = awg.obfLabels();
		const f = this.fields = { obf: {} };

		f.host = awg.input(c.host);
		f.port = awg.input(c.port, { 'type': 'number', 'min': 1, 'max': 65535 });
		f.allowed = new ui.DynamicList(c.allowed_ips, null, { name: 'allowed', datatype: 'ipmask', placeholder: '0.0.0.0/0' });
		f.dns = new ui.DynamicList(c.dns, null, { name: 'dns', datatype: 'ipaddr', placeholder: '9.9.9.9' });
		f.mtu = awg.input(c.mtu, { 'type': 'number', 'min': 576, 'max': 1500, 'placeholder': '1420' });
		f.keepalive = awg.input(c.keepalive, { 'type': 'number', 'min': 0 });
		CLIENT_OBF.forEach(k => { f.obf[k] = awg.input(c.obf[k]); });

		return E([
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Connection')),
				awg.row(_('Host'), f.host, _('Public address or name clients connect to.')),
				awg.row(_('Port'), f.port, _('Public UDP port clients connect to (can differ from the listen port when forwarded).'))
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Allowed IPs')),
				awg.row(_('Allowed IPs'), f.allowed.render(), _('Traffic for these networks goes through the tunnel.'))
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('DNS')),
				awg.row(_('DNS servers'), f.dns.render(), _('Handed to clients. With per-client filtering these stay reachable.'))
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Advanced')),
				awg.row(_('MTU'), f.mtu, _('Empty: the client default.')),
				awg.row(_('Persistent keepalive'), f.keepalive, _('Seconds; 0 disables it.'))
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('AmneziaWG obfuscation parameters (client)')),
				E('p', { 'class': 'cbi-section-descr' },
					_('Empty means the same value as on the server. S1-S4 and H1-H4 always match the server.'))
			].concat(CLIENT_OBF.map(k => awg.row(labels[k], f.obf[k]))))
		]);
	},

	render(data) {
		this.root = E('div', {}, this.renderForm(data));
		return E([ E('h2', _('AmneziaWG') + ' – ' + _('Config')), this.root ]);
	},

	/* the standard footer: Save & Apply sends the form, Reset reloads it from the router */
	handleSaveApply() {
		return this.save();
	},

	handleReset() {
		return this.reload();
	},

	handleSave: null
});
