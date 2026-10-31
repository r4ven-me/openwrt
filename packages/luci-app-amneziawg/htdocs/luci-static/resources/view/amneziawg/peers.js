'use strict';
'require poll';
'require ui';
'require amneziawg.qrcode as qrcode';
'require amneziawg.common as awg';

/* AmneziaWG peers, client configs (QR), per-peer exit interface (pbr) and allowed destinations.
   Licensed to the public under the Apache License 2.0.
*/

return L.view.extend({
	load() {
		return L.resolveDefault(awg.list(), {});
	},

	/* runs an rpc action, then redraws the page */
	act(promise, okText) {
		return awg.handle(promise, okText).then(() => this.refresh());
	},

	refresh() {
		return awg.list().then(data => {
			this.data = data;
			Object.keys(this.pending).forEach(n => {
				if (!(data.peers || []).some(p => p.name === n))
					delete this.pending[n];
			});
			this.root.replaceChildren(this.renderBody(data));
		});
	},

	showConfig(name) {
		return awg.getConfig(name).then(res => {
			if (res.error)
				return awg.notify(res.error, 'error');

			const text = res.config;
			/* an <img> with a data: src (unlike a <div> filled via innerHTML) gets the browser's
			   native "Copy image" / "Save image as" in its right-click menu */
			const qrUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(qrcode.make(text));
			const img = E('img', {
				'src': qrUrl,
				'alt': _('QR code for %s').format(name),
				'style': 'display:block;max-width:320px;width:100%;margin:0 auto;background:#fff'
			});

			const download = (href, filename) => {
				const a = E('a', { 'href': href, 'download': filename });
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
			};

			ui.showModal(_('Client config: %s').format(name), [
				img,
				E('pre', { 'style': 'user-select:all;overflow:auto;max-height:16em;margin-top:1em' }, text),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn cbi-button', 'click': () => download(qrUrl, name + '.svg') }, _('Download QR')),
					' ',
					E('button', {
						'class': 'btn cbi-button',
						'click': () => download(URL.createObjectURL(new Blob([ text ], { type: 'text/plain' })), name + '.conf')
					}, _('Download .conf')),
					' ',
					E('button', { 'class': 'btn cbi-button-primary', 'click': ui.hideModal }, _('Close'))
				])
			]);
		});
	},

	editDest(peer) {
		const area = E('textarea', {
			'class': 'cbi-input-textarea', 'rows': 6, 'style': 'width:100%',
			'placeholder': '1.1.1.1\n192.168.1.0/24'
		}, peer.dest.join('\n'));

		ui.showModal(_('Allowed destinations: %s').format(peer.name), [
			E('p', _('One address or network per line. Empty: no restriction. Only effective when per-client firewall is enabled on the Interface page; the client DNS servers always stay reachable.')),
			area,
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-save',
					'click': () => {
						const dest = area.value.split(/[\s,]+/).filter(x => x !== '');
						ui.hideModal();
						return this.act(awg.setPeerFilter(peer.name, dest));
					}
				}, _('Save'))
			])
		]);
	},

	editAddress(peer) {
		const input = awg.input(peer.address, { 'placeholder': '10.8.0.10' });

		ui.showModal(_('Address of %s').format(peer.name), [
			E('p', _('Any free host address of the server subnet. The client needs a new config afterwards.')),
			awg.row(_('IP address'), input),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn cbi-button', 'click': ui.hideModal }, _('Cancel')),
				' ',
				E('button', {
					'class': 'btn cbi-button-save',
					'click': () => {
						const addr = input.value.trim();
						ui.hideModal();
						return awg.handle(awg.setPeerAddress(peer.name, addr)).then(res => {
							if (res && res.client_needs_update)
								awg.notify(_('The address was changed. Download a new config for %s.').format(peer.name), 'warning');
							return this.refresh();
						});
					}
				}, _('Save'))
			])
		]);
	},

	/* the stored values with the not yet applied edits on top */
	shown(p) {
		const e = this.pending[p.name] || {};
		return { enabled: 'enabled' in e ? e.enabled : p.enabled, via: 'via' in e ? e.via : p.via };
	},

	/* remembers an edit until Save & Apply; an edit that equals the stored value is dropped again */
	stage(peer, key, value) {
		const e = this.pending[peer.name] = this.pending[peer.name] || {};
		if (value === peer[key])
			delete e[key];
		else
			e[key] = value;
		if (!Object.keys(e).length)
			delete this.pending[peer.name];
		this.root.replaceChildren(this.renderBody(this.data));
	},

	routeSelect(data, peer) {
		const via = this.shown(peer).via;
		const sel = E('select', {
			'class': 'cbi-input-select',
			'change': ev => this.stage(peer, 'via', ev.target.value)
		/* LuCI sets boolean attributes with setAttribute(): even selected=false would select the option */
		}, [ E('option', { 'value': '', 'selected': via ? null : true }, _('Default route')) ].concat(
			data.interfaces.map(i => E('option', { 'value': i, 'selected': i == via ? true : null }, i))));
		/* a stale policy may point to an interface that is gone from the list */
		if (via && data.interfaces.indexOf(via) < 0)
			sel.appendChild(E('option', { 'value': via, 'selected': true }, via));
		sel.disabled = !data.pbr;
		return sel;
	},

	renderPeers(data) {
		const cols = data.filter ? 9 : 8;
		const mark = (p, key) => (key in (this.pending[p.name] || {})) ? { 'class': 'td', 'style': 'background:rgba(255,170,0,.25)' } : { 'class': 'td' };

		const peers = data.peers.slice().sort((a, b) => awg.ip4ToInt(a.address) - awg.ip4ToInt(b.address));
		const rows = peers.map(p => E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, E('strong', p.name)),
			E('td', { 'class': 'td' }, [
				p.address, ' ',
				E('button', { 'class': 'btn cbi-button', 'click': () => this.editAddress(p) }, _('Edit'))
			]),
			E('td', { 'class': 'td' }, p.endpoint || '–'),
			E('td', { 'class': 'td' }, awg.fmtHandshake(p.handshake)),
			E('td', { 'class': 'td' }, '↓ ' + awg.fmtBytes(p.rx) + ' ↑ ' + awg.fmtBytes(p.tx)),
			E('td', mark(p, 'enabled'), E('input', {
				'type': 'checkbox',
				'checked': this.shown(p).enabled ? true : null,
				'change': ev => this.stage(p, 'enabled', ev.target.checked)
			})),
			E('td', mark(p, 'via'), this.routeSelect(data, p)),
			data.filter ? E('td', { 'class': 'td' }, [
				p.dest.length ? p.dest.join(', ') : E('em', _('any')), ' ',
				E('button', { 'class': 'btn cbi-button', 'click': () => this.editDest(p) }, _('Edit'))
			]) : null,
			E('td', { 'class': 'td nowrap' }, [
				E('button', { 'class': 'btn cbi-button', 'click': () => this.showConfig(p.name) }, _('Config / QR')),
				' ',
				E('button', {
					'class': 'btn cbi-button-negative',
					'click': () => confirm(_('Delete peer %s?').format(p.name)) && this.act(awg.removePeer(p.name))
				}, _('Delete'))
			])
		].filter(c => c !== null)));

		const head = [
			_('Name'), _('Address'), _('Endpoint'), _('Last handshake'), _('Traffic'), _('Enabled'), _('Exit interface')
		].concat(data.filter ? [ _('Allowed destinations') ] : [], [ '' ]);

		return E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, head.map(h => E('th', { 'class': 'th' }, h)))
		].concat(rows.length ? rows : [
			E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td', 'colspan': cols }, E('em', _('No peers yet.'))))
		]));
	},

	renderAdd() {
		const name = awg.input('', { 'placeholder': _('Peer name'), 'maxlength': 64 });
		const addr = awg.input('', { 'placeholder': _('IP address (optional)'), 'style': 'width:12em' });
		return E('div', { 'class': 'cbi-section' }, [
			name, ' ', addr, ' ',
			E('button', {
				'class': 'btn cbi-button-add',
				'click': () => {
					const n = name.value.trim();
					if (!/^[A-Za-z0-9._-]{1,64}$/.test(n))
						return awg.notify(_('Name may contain only letters, digits, ".", "_" and "-".'), 'error');
					return this.act(awg.addPeer(n, '', addr.value.trim()));
				}
			}, _('Add peer')),
			E('div', { 'class': 'cbi-value-description' }, _('Without an IP address the next free one of the server subnet is used.'))
		]);
	},

	renderSetup() {
		const f = {
			iface: awg.input('awg0'),
			address: awg.input('10.8.0.1/24'),
			port: awg.input(51820, { 'type': 'number', 'min': 1, 'max': 65535 }),
			host: awg.input('', { 'placeholder': 'vpn.example.com' }),
			dns: awg.input('1.1.1.1, 9.9.9.9')
		};

		return E('div', { 'class': 'cbi-section' }, [
			E('p', _('AmneziaWG is not set up yet. This creates the interface, a firewall zone with forwarding to lan and wan, and random obfuscation parameters. Everything can be changed later on the Config and Interface pages.')),
			awg.row(_('Interface'), f.iface),
			awg.row(_('Server address (CIDR)'), f.address),
			awg.row(_('UDP port'), f.port),
			awg.row(_('Public host'), f.host, _('Address or name clients connect to.')),
			awg.row(_('Client DNS'), f.dns, _('Comma separated.')),
			awg.actions([
				awg.button(_('Set up'), 'cbi-button-save', () => this.act(awg.setup(f.iface.value.trim(), f.address.value.trim(),
					parseInt(f.port.value, 10), f.host.value.trim(),
					f.dns.value.split(/[\s,]+/).filter(x => x !== ''))))
			])
		]);
	},

	renderBody(data) {
		if (!data.configured)
			return this.renderSetup();

		/* E([...]) treats every item as an element (a '' item would be createElement('')) */
		return E([
			E('p', [
				E('strong', _('Server %s').format(data.iface)), ': ',
				data.up ? _('up') : E('strong', _('down')), ', ',
				_('address %s, UDP port %d, endpoint %s.').format(data.address || '?', data.port, data.endpoint),
				' ', _('Server settings are on the Config and Interface pages.')
			]),
			E('h3', _('Peers'))
		].concat(data.pbr ? [] : [
			E('p', { 'class': 'alert-message warning' },
				_('The pbr package is not installed: per-peer exit interfaces are unavailable.'))
		], Object.keys(this.pending).length ? [
			E('p', { 'class': 'alert-message warning' }, _('Unsaved changes: press Save & Apply below to apply them or Reset to discard.'))
		] : [], [
			this.renderPeers(data),
			this.renderAdd()
		]));
	},

	render(data) {
		this.data = data;
		this.pending = {};
		this.root = E('div', {}, this.renderBody(data));

		/* keep traffic/handshake fresh unless the user is typing in a form */
		poll.add(() => {
			if (document.activeElement && [ 'INPUT', 'SELECT', 'TEXTAREA' ].includes(document.activeElement.tagName))
				return;
			return awg.list().then(d => {
				if (d.configured && this.data.configured)
					this.data = d, this.root.replaceChildren(this.renderBody(d));
			});
		}, 10);

		return E([ E('h2', _('AmneziaWG')), this.root ]);
	},

	/* applies the staged table edits (enabled / exit interface) one after the other */
	handleSaveApply() {
		const calls = [];
		Object.keys(this.pending).forEach(n => {
			const e = this.pending[n];
			if ('enabled' in e)
				calls.push(() => awg.setEnabled(n, e.enabled));
			if ('via' in e)
				calls.push(() => awg.setRoute(n, e.via));
		});
		if (!calls.length)
			return awg.notify(_('No changes to apply.'), 'info');

		let failed = false;
		return calls.reduce((p, fn) => p.then(() => awg.handle(fn()).then(r => { if (!r) failed = true; })), Promise.resolve())
			.then(() => {
				this.pending = {};
				if (!failed)
					awg.notify(_('Changes applied.'), 'info');
				return this.refresh();
			});
	},

	handleReset() {
		this.pending = {};
		this.root.replaceChildren(this.renderBody(this.data));
	},

	handleSave: null
});
