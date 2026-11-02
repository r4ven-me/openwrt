'use strict';
'require form';
'require fs';
'require rpc';
'require ui';
'require uci';
'require ocserv.base as base';
'require ocserv.conf as conf';
'require ocserv.schema as schema';

/* Virtual hosts for the OpenConnect VPN server.
   Licensed to the public under the Apache License 2.0. */

const VHOST_DIR = '/etc/ocserv/vhosts';
const ID_RE = /^[A-Za-z0-9_]{1,64}$/;
const MANAGED_KEYS = [
	'server-cert', 'server-key', 'ca-cert', 'crl', 'cert-user-oid',
	'config-per-user', 'config-per-group'
];

const callCreateVhost = rpc.declare({
	object: 'luci.ocserv-pki',
	method: 'create_vhost',
	params: [ 'domain' ],
	expect: { '': {} }
});

const callDeleteVhost = rpc.declare({
	object: 'luci.ocserv-pki',
	method: 'delete_vhost',
	params: [ 'id', 'purge' ],
	expect: { '': {} }
});

function queryId() {
	const params = new URLSearchParams(window.location.search);
	return params.has('id') ? params.get('id') : null;
}

function editUrl(id) {
	return L.url('admin/vpn/ocserv/vhosts') + '?id=' + encodeURIComponent(id);
}

function stripVhostHeader(text) {
	return String(text || '').split(/\r?\n/)
		.filter(line => !/^\s*\[vhost(?::[^\]]*)?\]\s*$/i.test(line))
		.join('\n');
}

return L.view.extend({
	load() {
		const id = queryId();

		return uci.load('ocserv').then(() => {
			const vhosts = uci.sections('ocserv', 'vhost');

			if (id == null)
				return { id: null, vhosts };

			if (!ID_RE.test(id))
				return { id, error: _('Invalid virtual host identifier.') };

			const section = vhosts.find(vhost => vhost['.name'] == id);
			if (!section)
				return { id, error: _('The requested virtual host does not exist.') };

			const path = '%s/%s/ocserv.conf'.format(VHOST_DIR, id);
			return L.resolveDefault(fs.read(path), '').then(text => ({
				id,
				section,
				path,
				original: text,
				model: conf.parse(stripVhostHeader(text))
			}));
		});
	},

	render(data) {
		if (data.error)
			return this.renderError(data.error);

		if (data.id == null)
			return this.renderList(data.vhosts);

		return this.renderEditor(data);
	},

	renderError(message) {
		return E('div', { 'class': 'cbi-map' }, [
			E('h2', _('Virtual Hosts')),
			E('div', { 'class': 'alert-message error' }, message),
			E('div', { 'class': 'right' }, E('a', {
				'class': 'cbi-button cbi-button-action',
				'href': L.url('admin/vpn/ocserv/vhosts')
			}, _('Back to overview')))
		]);
	},

	renderList(vhosts) {
		const rows = vhosts.slice().sort((a, b) =>
			String(a.domain || a['.name']).localeCompare(String(b.domain || b['.name']))
		).map(vhost => {
			const id = vhost['.name'];
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td' }, vhost.domain || id),
				E('td', { 'class': 'td' }, vhost.enabled == '0' ? _('No') : _('Yes')),
				E('td', { 'class': 'td' }, vhost.auth || 'plain'),
				E('td', { 'class': 'td cbi-section-actions' }, [
					E('a', {
						'class': 'cbi-button cbi-button-edit',
						'href': editUrl(id)
					}, _('Edit')),
					' ',
					E('button', {
						'class': 'cbi-button cbi-button-remove',
						'click': ui.createHandlerFn(this, 'handleDelete', id)
					}, _('Delete'))
				])
			]);
		});

		if (!rows.length)
			rows.push(E('tr', { 'class': 'tr placeholder' }, E('td', {
				'class': 'td',
				'colspan': 4
			}, E('em', _('No virtual hosts configured.')))));

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', _('Virtual Hosts')),
			E('div', { 'class': 'cbi-map-descr' },
				_('Configure domain-specific ocserv settings and certificates.')),
			E('div', { 'class': 'cbi-section' }, [
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, _('Domain')),
						E('th', { 'class': 'th' }, _('Enabled')),
						E('th', { 'class': 'th' }, _('Authentication')),
						E('th', { 'class': 'th cbi-section-actions' }, '')
					]),
					...rows
				]),
				E('div', { 'class': 'cbi-section-create' }, E('button', {
					'class': 'cbi-button cbi-button-add',
					'click': ui.createHandlerFn(this, 'handleAdd')
				}, _('Add')))
			])
		]);
	},

	renderEditor(data) {
		this.model = data.model;
		this.fileText = data.original;
		this.confPath = data.path;

		const m = new form.Map('ocserv', _('Virtual Host: %s').format(data.section.domain || data.id),
			_('Settings stored here apply only to this virtual host.'));
		this.m = m;

		const s = m.section(form.NamedSection, data.id, 'vhost');
		s.addremove = false;

		for (const [ id, title ] of schema.TABS)
			s.tab(id, title);

		let o = s.taboption('general', form.Flag, 'enabled', _('Enable virtual host'));
		o.rmempty = false;
		o.default = '1';

		o = s.taboption('general', form.Value, 'domain', _('Domain'));
		o.rmempty = false;
		o.datatype = 'hostname';
		o.validate = (sectionId, value) => {
			if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value))
				return _('Use a lowercase DNS hostname.');
			if (uci.sections('ocserv', 'vhost').some(vhost =>
				vhost['.name'] != sectionId && String(vhost.domain).toLowerCase() == value))
				return _('A virtual host for this domain already exists.');
			return true;
		};

		o = s.taboption('general', form.ListValue, 'auth', _('User Authentication'));
		o.rmempty = false;
		o.default = 'plain';
		o.value('plain', 'plain');
		o.value('PAM', 'PAM');
		o.value('certificate', _('certificate'));

		o = s.taboption('general', form.Flag, 'auth_plain_fallback', _('Also allow password login'),
			_('Clients without a certificate may still log in with a username and password from Users & Groups.'));
		o.default = '0';
		o.depends('auth', 'certificate');

		o = s.taboption('auth', form.Value, 'server_cert', _('Server certificate'),
			_('Path to a certificate matching this virtual host, for example an ACME-managed fullchain.pem.'));
		o.rmempty = false;

		o = s.taboption('auth', form.Value, 'server_key', _('Server private key'),
			_('Path to the private key matching the server certificate.'));
		o.rmempty = false;

		for (const spec of schema.SERVER)
			if (schema.scope(spec) == 'vhost' && !MANAGED_KEYS.includes(spec.key))
				base.addConfOption(s, spec.tab, spec, this.model);

		return m.render();
	},

	handleAdd() {
		const domain = prompt(_('Domain name for the new virtual host:'));
		if (domain == null)
			return;

		const value = domain.trim();
		if (!value)
			return ui.addNotification(null, E('p', _('The domain name must not be empty.')), 'error');

		return callCreateVhost(value).then(res => {
			if (res.error)
				throw new Error(res.error);
			window.location.reload();
		}).catch(e => {
			ui.addNotification(null, E('p', _('Failed to create virtual host: %s').format(e.message)), 'error');
		});
	},

	handleDelete(id) {
		if (!ID_RE.test(id))
			return ui.addNotification(null, E('p', _('Invalid virtual host identifier.')), 'error');

		if (!confirm(_('Delete this virtual host? All of its PKI material and configuration files will be permanently removed.')))
			return;

		return callDeleteVhost(id, true).then(res => {
			if (res.error)
				throw new Error(res.error);
			window.location.reload();
		}).catch(e => {
			ui.addNotification(null, E('p', _('Failed to delete virtual host: %s').format(e.message)), 'error');
		});
	},

	handleSave(ev) {
		if (!this.m || !this.model)
			return Promise.resolve();

		return this.super('handleSave', [ ev ]).then(() => {
			return base.flush(this.confPath, this.model, this.fileText);
		}).then(text => {
			this.fileText = text;
			return this.m.reset ? this.m.reset() : null;
		});
	},

	handleSaveApply(ev) {
		return base.handleSaveApply(this, ev);
	}
});
