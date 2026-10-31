'use strict';
'require ui';
'require amneziawg.common as awg';

/* The server side: listen port, MTU, firewall zones, obfuscation, per-client filtering, subnet.
   Licensed to the public under the Apache License 2.0.
*/

const OBF_KEYS = [ 'jc', 'jmin', 'jmax', 's1', 's2', 's3', 's4', 'h1', 'h2', 'h3', 'h4', 'i1', 'i2', 'i3', 'i4', 'i5' ];

return L.view.extend({
	load() {
		return L.resolveDefault(awg.getSettings(), {});
	},

	reload() {
		return awg.getSettings().then(data => {
			this.data = data;
			this.root.replaceChildren(this.renderForm(data));
		});
	},

	save() {
		const f = this.fields;
		const port = parseInt(f.port.value, 10);
		const mtu = f.mtu.value.trim() === '' ? 1420 : parseInt(f.mtu.value, 10);
		if (!(port >= 1 && port <= 65535))
			return awg.notify(_('Port must be 1-65535.'), 'error');
		if (!(mtu >= 576 && mtu <= 1500))
			return awg.notify(_('MTU must be 576-1500.'), 'error');

		const obf = {};
		OBF_KEYS.forEach(k => { obf[k] = f.obf[k].value.trim(); });
		const zones = Object.keys(f.zones).filter(z => f.zones[z].checked);

		ui.showModal(_('Applying…'), [ E('p', { 'class': 'spinning' }, _('The interface is restarted, connected clients reconnect.')) ]);
		return awg.handle(awg.setInterface(port, mtu, obf, zones, f.filter.checked)).then(res => {
			ui.hideModal();
			if (!res)
				return;
			awg.notify(res.clients_need_update
				? _('Saved. The port or the S/H parameters changed: clients need new configs.')
				: _('Saved.'), res.clients_need_update ? 'warning' : 'info');
			return this.reload();
		});
	},

	generate() {
		return awg.handle(awg.genObfuscation()).then(res => {
			if (!res)
				return;
			Object.keys(res.obf).forEach(k => { this.fields.obf[k].value = res.obf[k]; });
		});
	},

	changeCidr() {
		const input = awg.input(this.data.interface.address, { 'placeholder': '10.9.0.1/24' });
		ui.showModal(_('Change CIDR'), [
			E('p', _('The server and all peers are renumbered into the new subnet: the server gets the first address, peers keep their order. pbr policies and per-client rules follow.')),
			E('p', E('strong', _('All clients need new configs afterwards and are disconnected until then.'))),
			awg.row(_('Server address (CIDR)'), input),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-negative',
					'click': () => {
						const cidr = input.value.trim();
						ui.hideModal();
						return awg.handle(awg.changeCidr(cidr), _('The subnet was changed. Clients need new configs.'))
							.then(res => res && this.reload());
					}
				}, _('Change'))
			])
		]);
	},

	restart() {
		if (!confirm(_('Restart the interface? Connected clients reconnect.')))
			return;
		return awg.handle(awg.restartInterface(), _('The interface was restarted.'));
	},

	renderForm(data) {
		if (!data.configured)
			return E('p', _('AmneziaWG is not set up yet. Open the Peers page first.'));

		const i = data.interface;
		const labels = awg.obfLabels();
		const f = this.fields = { obf: {}, zones: {} };

		f.port = awg.input(i.port, { 'type': 'number', 'min': 1, 'max': 65535 });
		f.mtu = awg.input(i.mtu, { 'type': 'number', 'min': 576, 'max': 1500, 'placeholder': '1420' });
		OBF_KEYS.forEach(k => { f.obf[k] = awg.input(i.obf[k]); });
		/* LuCI sets boolean attributes with setAttribute(): even checked=false would check the box */
		f.filter = E('input', { 'type': 'checkbox', 'checked': i.filter ? true : null });

		const zoneRows = i.zones.map(z => {
			const cb = f.zones[z.name] = E('input', { 'type': 'checkbox', 'checked': i.forward.indexOf(z.name) >= 0 ? true : null });
			return E('div', {}, E('label', {}, [
				cb, ' ', z.name,
				z.masq ? '' : E('em', ' (' + _('no masquerading') + ')')
			]));
		});

		const section = (title, rows) => E('div', { 'class': 'cbi-section' }, [ E('h3', title) ].concat(rows));

		return E([
			section(_('Interface'), [
				E('p', _('Interface %s, server address %s.').format(data.iface, i.address || '?')),
				awg.row(_('MTU'), f.mtu),
				awg.row(_('Port'), f.port, _('UDP listen port; the firewall rule follows.')),
				awg.row(_('Reach zones'), E('div', {}, zoneRows),
					_('Firewall zones the clients may go to. NAT happens in zones with masquerading (wan by default).'))
			]),
			section(_('AmneziaWG obfuscation parameters'), [
				E('p', { 'class': 'cbi-section-descr' }, _('Values depend on the MTU. S1-S4 and H1-H4 must be the same on clients.')),
				E('div', {}, awg.button(_('Generate'), 'cbi-button-action', () => this.generate()))
			].concat(OBF_KEYS.map(k => awg.row(labels[k], f.obf[k])))),
			section(_('Traffic filtering'), [
				awg.row(_('Enable per-client firewall'), f.filter,
					_('A client with allowed destinations set on the Peers page may reach only those (and the DNS servers); everything else is rejected.'))
			]),
			section(_('Actions'), [
				E('p', { 'class': 'cbi-section-descr' }, _('These act immediately, they do not wait for Save & Apply.')),
				awg.actions([
					awg.button(_('Change CIDR'), '', () => this.changeCidr()),
					awg.button(_('Restart interface'), '', () => this.restart())
				])
			])
		]);
	},

	render(data) {
		this.data = data;
		this.root = E('div', {}, this.renderForm(data));
		return E([ E('h2', _('AmneziaWG') + ' – ' + _('Interface')), this.root ]);
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
