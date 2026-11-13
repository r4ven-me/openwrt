'use strict';
'require rpc';
'require ui';
'require uci';
'require ocserv.base as base';

/* Client certificate management for OpenConnect VPN.
   Licensed to the public under the Apache License 2.0.
*/

const callList = rpc.declare({
	object: 'luci.ocserv-pki',
	method: 'list',
	params: [ 'vhost' ],
	expect: { '': {} }
});

const callIssue = rpc.declare({
	object: 'luci.ocserv-pki',
	method: 'issue',
	params: [ 'cn', 'days', 'password', 'ip', 'via', 'vhost' ],
	expect: { '': {} }
});

const callSetUser = rpc.declare({
	object: 'luci.ocserv-pki',
	method: 'set_user',
	params: [ 'cn', 'ip', 'via', 'vhost' ],
	expect: { '': {} }
});

const callGetFile = rpc.declare({
	object: 'luci.ocserv-pki',
	method: 'get_file',
	params: [ 'cn', 'kind', 'vhost' ],
	expect: { '': {} }
});

const callRevoke = rpc.declare({
	object: 'luci.ocserv-pki',
	method: 'revoke',
	params: [ 'serial', 'vhost' ],
	expect: { '': {} }
});

return L.view.extend({
	load() {
		return uci.load('ocserv').then(() => {
			this.vhosts = uci.sections('ocserv', 'vhost');
			const requested = new URLSearchParams(window.location.search).get('vhost') || '';
			this.vhost = this.vhosts.some(s => s['.name'] == requested) ? requested : '';
			return callList(this.vhost).catch(e => ({ error: e.message }));
		});
	},

	vhostLabel(section) {
		return section.domain || section.hostname || section.name || section['.name'];
	},

	handleVhostChange(ev) {
		const url = new URL(window.location.href);
		const vhost = ev.target.value;

		if (vhost)
			url.searchParams.set('vhost', vhost);
		else
			url.searchParams.delete('vhost');

		window.location.assign(url.toString());
	},

	renderVhostSelector() {
		const options = [ E('option', { 'value': '', 'selected': this.vhost ? null : '' }, _('Default')) ];

		for (const section of this.vhosts || []) {
			const id = section['.name'];
			options.push(E('option', {
				'value': id,
				'selected': id == this.vhost ? '' : null
			}, this.vhostLabel(section)));
		}

		return E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _('VHost')),
			E('div', { 'class': 'cbi-value-field' },
				E('select', {
					'class': 'cbi-input-select',
					'change': ui.createHandlerFn(this, 'handleVhostChange')
				}, options))
		]);
	},

	handleIssue() {
		const cn = this.cnInput.value.trim();
		const days = parseInt(this.daysInput.value, 10);
		const pw = this.pwInput.value;

		if (!/^[A-Za-z0-9._-]{1,64}$/.test(cn))
			return ui.addNotification(null, E('p', _('Name may contain only letters, digits, ".", "_" and "-".')), 'error');
		if (!(days >= 1 && days <= 36500))
			return ui.addNotification(null, E('p', _('Invalid validity period.')), 'error');
		if (!pw)
			return ui.addNotification(null, E('p', _('The PKCS#12 password must not be empty.')), 'error');

		ui.showModal(_('Generating certificate…'), [ E('p', { 'class': 'spinning' }, _('Please wait.')) ]);

		return callIssue(cn, days, pw, this.ipInput.value.trim(), this.viaSelect.value, this.vhost).then(res => {
			ui.hideModal();
			if (res.error)
				ui.addNotification(null, E('p', res.error), 'error');
			else {
				if (res.warning)
					ui.addNotification(null, E('p', res.warning), 'warning');
				return this.reload();
			}
		}).catch(e => {
			ui.hideModal();
			ui.addNotification(null, E('p', e.message), 'error');
		});
	},

	handleRevoke(cert) {
		if (!confirm(_('Revoke certificate "%s"?').format(cert.cn)))
			return;

		return callRevoke(cert.serial, this.vhost).then(res => {
			if (res.error)
				ui.addNotification(null, E('p', res.error), 'error');
			else
				return this.reload();
		});
	},

	handleDownload(cert, kind) {
		return callGetFile(cert.cn, kind, this.vhost).then(res => {
			if (res.error)
				throw new Error(res.error);
			const bin = atob(res.data);
			const bytes = new Uint8Array(bin.length);
			for (let i = 0; i < bin.length; i++)
				bytes[i] = bin.charCodeAt(i);
			const url = URL.createObjectURL(new Blob([ bytes ], { type: 'application/octet-stream' }));
			const a = E('a', { href: url, download: res.name });
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}).catch(e => {
			ui.addNotification(null, E('p', _('Download failed: %s').format(e.message)), 'error');
		});
	},

	handleSetUser(cert, ipInput, viaSelect) {
		return callSetUser(cert.cn, ipInput.value.trim(), viaSelect.value, this.vhost).then(res => {
			if (res.error)
				ui.addNotification(null, E('p', res.error), 'error');
			else {
				if (res.warning)
					ui.addNotification(null, E('p', res.warning), 'warning');
				return this.reload();
			}
		});
	},

	/* self: the name of the user the select belongs to (a client cannot exit through itself) */
	viaSelectEl(selected, self) {
		const opts = [ E('option', { 'value': '' }, _('Default route')) ];
		const names = this.ifaces.slice();
		if (selected && selected.indexOf('client:') != 0 && names.indexOf(selected) < 0)
			names.push(selected);
		names.forEach(n => opts.push(E('option', {
			'value': n, 'selected': n == selected ? '' : null, 'disabled': this.pbr ? null : ''
		}, n)));

		const clients = (this.clients || []).filter(cn => cn != self);
		if (selected && selected.indexOf('client:') == 0 && clients.indexOf(selected.substr(7)) < 0)
			clients.push(selected.substr(7));
		if (clients.length)
			opts.push(E('optgroup', { 'label': _('Connected clients') }, clients.map(cn => E('option', {
				'value': 'client:' + cn, 'selected': ('client:' + cn) == selected ? '' : null
			}, cn))));
		return E('select', { 'class': 'cbi-input-select' }, opts);
	},

	setClients(data) {
		this.clients = (data.certs || []).filter(c => c.status == 'valid').map(c => c.cn);
	},

	reload() {
		return callList(this.vhost).catch(e => ({ error: e.message })).then(data => {
			this.showError(data);
			this.ifaces = data.ifaces || [];
			this.pbr = data.pbr !== false;
			this.setClients(data);
			this.fillTable(data);
		});
	},

	/* a failed call must not look like "no certificates" */
	showError(data) {
		if (this.errorBox)
			this.errorBox.replaceChildren(data.error
				? E('div', { 'class': 'alert-message error' }, _('Failed to load the certificate list: %s').format(data.error))
				: '');
	},

	fillTable(data) {
		const certs = data.certs || [];
		const rows = certs.map(c => {
			const valid = c.status == 'valid';
			const ip = E('input', { 'type': 'text', 'class': 'cbi-input-text ocserv-ip', 'value': c.ip, 'disabled': valid ? null : '' });
			const via = this.viaSelectEl(c.via, c.cn);
			via.disabled = !valid;
			const dl = (kind, label, has) => has ? E('button', {
				'class': 'cbi-button cbi-button-action',
				'click': ui.createHandlerFn(this, 'handleDownload', c, kind)
			}, label) : '';

			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, c.cn),
				E('td', { 'class': 'td' }, valid ? ip : c.ip),
				E('td', { 'class': 'td' }, valid ? via : ''),
				E('td', { 'class': 'td' }, c.expires),
				E('td', { 'class': 'td' }, c.status == 'revoked' ? _('Revoked') + ' (' + c.revoked + ')' : _('Valid')),
				E('td', { 'class': 'td ocserv-actions' }, valid ? [
					E('button', {
						'class': 'cbi-button cbi-button-save',
						'click': ui.createHandlerFn(this, 'handleSetUser', c, ip, via)
					}, _('Save')),
					' ', dl('crt', _('Certificate'), c.has_crt),
					' ', dl('key', _('Private key'), c.has_key),
					' ', dl('p12', '.p12', c.has_p12),
					' ', E('button', {
						'class': 'cbi-button cbi-button-negative',
						'click': ui.createHandlerFn(this, 'handleRevoke', c)
					}, _('Revoke'))
				] : '')
			]);
		});

		const head = E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, _('Name')),
			E('th', { 'class': 'th' }, _('IPv4 address')),
			E('th', { 'class': 'th' }, _('Exit interface')),
			E('th', { 'class': 'th' }, _('Expires')),
			E('th', { 'class': 'th' }, _('Status')),
			E('th', { 'class': 'th ocserv-actions' }, '')
		]);

		if (!rows.length)
			rows.push(E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td', 'colspan': 6 },
				E('em', _('No certificates have been issued yet.')))));

		this.table.replaceChildren(head, ...rows);
	},

	render(data) {
		this.ifaces = data.ifaces || [];
		this.pbr = data.pbr !== false;
		this.setClients(data);
		this.cnInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': 'alice' });
		this.daysInput = E('input', { 'type': 'number', 'class': 'cbi-input-text', 'value': 365, 'min': 1 });
		this.pwInput = E('input', { 'type': 'password', 'class': 'cbi-input-password', 'autocomplete': 'new-password' });
		this.ipInput = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': _('automatic') });
		this.viaSelect = this.viaSelectEl('');
		this.table = E('table', { 'class': 'table ocserv-table' });
		this.errorBox = E('div');
		base.loadStyles();
		this.fillTable(data);
		this.showError(data);

		return E('div', [
			E('h2', _('OpenConnect VPN: client certificates')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Certificates are signed by the server CA and exported as a password-protected PKCS#12 (.p12) file for import into the client. Enable "certificate" authentication on the Server Settings page to use them.')),
			this.renderVhostSelector(),
			this.errorBox,
			data.pbr === false ? E('div', { 'class': 'alert-message warning' },
				_('The pbr package is not installed: only another client can be chosen as the exit.')) : '',
			data.ca === false ? E('div', { 'class': 'alert-message warning' },
				_('The CA certificate was not found in /etc/ocserv. Start the ocserv service once so that it is created.')) : '',

			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Issue a new certificate')),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Name (CN / user name)')),
					E('div', { 'class': 'cbi-value-field' }, this.cnInput)
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Valid for (days)')),
					E('div', { 'class': 'cbi-value-field' }, this.daysInput)
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('PKCS#12 password')),
					E('div', { 'class': 'cbi-value-field' }, this.pwInput)
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('IPv4 address')),
					E('div', { 'class': 'cbi-value-field' }, this.ipInput)
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('label', { 'class': 'cbi-value-title' }, _('Exit interface')),
					E('div', { 'class': 'cbi-value-field' }, this.viaSelect)
				]),
				E('button', {
					'class': 'cbi-button cbi-button-add',
					'click': ui.createHandlerFn(this, 'handleIssue')
				}, _('Generate'))
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Issued certificates')),
				E('div', { 'class': 'ocserv-scroll' }, this.table)
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
