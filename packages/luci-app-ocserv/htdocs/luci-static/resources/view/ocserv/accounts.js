'use strict';
'require form';
'require fs';
'require ui';
'require uci';
'require ocserv.base as base';
'require ocserv.conf as conf';
'require ocserv.schema as schema';

/* Users & groups: plain-auth accounts and the per-user / per-group ocserv
   configuration files. Licensed to the public under the Apache License 2.0.
*/

const KINDS = {
	user: {
		dir: 'config-per-user',
		title: _('Per-user configuration'),
		nameTitle: _('User name')
	},
	group: {
		dir: 'config-per-group',
		title: _('Per-group configuration'),
		nameTitle: _('Group name')
	}
};

return L.view.extend({
	load() {
		return uci.load('ocserv').then(() => {
			this.vhosts = uci.sections('ocserv', 'vhost');
			const requested = new URLSearchParams(window.location.search).get('vhost') || '';
			this.vhost = this.vhosts.some(s => s['.name'] == requested) ? requested : '';

			const root = this.vhost ? '/etc/ocserv/vhosts/' + this.vhost : '/etc/ocserv';
			this.dirs = {
				user: root + '/' + KINDS.user.dir,
				group: root + '/' + KINDS.group.dir
			};

			return Promise.all([
				L.resolveDefault(fs.list(this.dirs.user), []),
				L.resolveDefault(fs.list(this.dirs.group), [])
			]);
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

		return E('div', { 'class': 'cbi-map' }, [
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('VHost')),
				E('div', { 'class': 'cbi-value-field' },
					E('select', {
						'class': 'cbi-input-select',
						'change': ui.createHandlerFn(this, 'handleVhostChange')
					}, options))
			])
		]);
	},

	selectedAuth() {
		return (this.vhost && uci.get('ocserv', this.vhost, 'auth')) ||
			uci.get('ocserv', 'config', 'auth') || 'plain';
	},

	render([ userFiles, groupFiles ]) {
		this.files = { user: userFiles, group: groupFiles };
		this.tables = {};

		const nodes = [ this.renderVhostSelector() ];
		const auth = this.selectedAuth();

		const plainFallback = this.vhost
			? uci.get('ocserv', this.vhost, 'auth_plain_fallback') == '1'
			: uci.get('ocserv', 'config', 'auth_plain_fallback') == '1';

		if (auth === 'plain' || (auth === 'certificate' && plainFallback)) {
			const m = new form.Map('ocserv', _('OpenConnect VPN'));
			const s = m.section(form.TableSection, 'ocservusers', _('Accounts'),
				_('Users that log in with a password (plain authentication). The group is matched with the per-group configuration below; "*" means any.'));
			s.anonymous = true;
			s.addremove = true;
			s.cfgsections = () => uci.sections('ocserv', 'ocservusers')
				.filter(section => (section.vhost || '') === this.vhost)
				.map(section => section['.name']);

			let o = s.option(form.Value, 'name', _('Name'));
			o.rmempty = false;
			o.datatype = 'uciname';

			o = s.option(form.Value, 'group', _('Group'));
			o.default = '*';

			o = s.option(form.Value, 'password', _('Password'));
			o.password = true;
			o.rmempty = false;

			o = s.option(form.ListValue, 'vhost', _('VHost'));
			o.value('', _('Default'));
			for (const section of this.vhosts || [])
				o.value(section['.name'], this.vhostLabel(section));
			o.default = this.vhost;
			o.rmempty = true;

			nodes.push(m.render());
		}
		else {
			nodes.push(E('div', { 'class': 'cbi-map' }, [
				E('h2', _('OpenConnect VPN')),
				E('div', { 'class': 'cbi-map-descr' },
					_('Accounts with passwords are only used with "plain" authentication; the current method is "%s".').format(auth))
			]));
		}

		for (const kind of Object.keys(KINDS))
			nodes.push(this.renderFiles(kind));

		return Promise.all(nodes).then(res => E('div', res));
	},

	renderFiles(kind) {
		const k = KINDS[kind];
		const dir = this.dirs[kind];
		const table = E('table', { 'class': 'table' });
		const input = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': k.nameTitle });
		const descr = kind === 'user'
			? _('Each file in %s is applied to the user whose name matches the file name.').format(dir)
			: _('Each file in %s is applied to the group whose name matches the file name.').format(dir);

		this.tables[kind] = table;
		this.fillFiles(kind);

		return E('div', { 'class': 'cbi-section' }, [
			E('h3', k.title),
			E('div', { 'class': 'cbi-section-descr' }, descr),
			table,
			E('div', { 'class': 'cbi-section-create' }, [
				input, ' ',
				E('button', {
					'class': 'cbi-button cbi-button-add',
					'click': ui.createHandlerFn(this, 'handleAdd', kind, input)
				}, _('Add'))
			])
		]);
	},

	fillFiles(kind) {
		const k = KINDS[kind];
		const names = this.files[kind].filter(f => f.type == 'file').map(f => f.name).sort();

		const rows = names.map(name => E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, name),
			E('td', { 'class': 'td cbi-section-actions' }, [
				E('button', {
					'class': 'cbi-button cbi-button-edit',
					'click': ui.createHandlerFn(this, 'handleEdit', kind, name)
				}, _('Edit')),
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-remove',
					'click': ui.createHandlerFn(this, 'handleDelete', kind, name)
				}, _('Delete'))
			])
		]));

		if (!rows.length)
			rows.push(E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td', 'colspan': 2 },
				E('em', _('No configuration files.')))));

		this.tables[kind].replaceChildren(
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, k.nameTitle),
				E('th', { 'class': 'th cbi-section-actions' }, '')
			]), ...rows);
	},

	refreshFiles(kind) {
		return L.resolveDefault(fs.list(this.dirs[kind]), []).then(files => {
			this.files[kind] = files;
			this.fillFiles(kind);
		});
	},

	handleAdd(kind, input) {
		const name = input.value.trim();

		if (!/^[A-Za-z0-9_@][A-Za-z0-9._@-]*$/.test(name))
			return ui.addNotification(null, E('p', _('Invalid name: use letters, digits, ".", "_", "-" and "@".')), 'error');

		input.value = '';
		return this.handleEdit(kind, name);
	},

	handleDelete(kind, name) {
		if (!confirm(_('Delete the configuration file "%s"?').format(name)))
			return;

		return fs.remove(this.dirs[kind] + '/' + name)
			.then(() => this.refreshFiles(kind))
			.catch(e => ui.addNotification(null, E('p', _('Failed to delete: %s').format(e.message)), 'error'));
	},

	handleEdit(kind, name) {
		const k = KINDS[kind];
		const dir = this.dirs[kind];
		const path = dir + '/' + name;

		return conf.read(path).then(model => {
			const state = { text: model.serialize(), shown: model.serialize(), pendingRaw: null };
			const fm = new form.JSONMap({ cfg: {} }, null);
			const s = fm.section(form.NamedSection, 'cfg', 'cfg');

			s.tab('form', _('Settings'));
			s.tab('raw', _('Edit Template'));

			for (const spec of schema.PER_USER)
				base.addConfOption(s, 'form', spec, model);

			const o = s.taboption('raw', form.TextValue, '_raw',
				_('The configuration file as text. If this text is changed, it replaces the file and changes made in the Settings tab are discarded.'));
			o.rows = 15;
			o.monospace = true;
			o.rmempty = false;
			o.cfgvalue = () => state.shown;
			o.write = (sid, v) => { state.pendingRaw = v; };
			o.remove = o.write;

			const save = () => {
				state.pendingRaw = null;

				return fm.save().then(() => {
					if (state.pendingRaw != null)
						model.setText(state.pendingRaw);

					return L.resolveDefault(fs.exec('/bin/mkdir', [ '-p', dir ]), null)
						.then(() => base.flush(path, model, state.text));
				}).then(() => {
					ui.hideModal();
					return this.refreshFiles(kind);
				}).catch(e => ui.addNotification(null, E('p', _('Failed to save: %s').format(e.message)), 'error'));
			};

			return fm.render().then(node => {
				ui.showModal('%s: %s'.format(k.title, name), [
					node,
					E('div', { 'class': 'right' }, [
						E('button', { 'class': 'cbi-button', 'click': ui.hideModal }, _('Dismiss')),
						' ',
						E('button', { 'class': 'cbi-button cbi-button-positive important', 'click': ui.createHandlerFn(this, save) }, _('Save'))
					])
				], 'cbi-modal');
			});
		});
	},

	handleSaveApply(ev) {
		return base.handleSaveApply(this, ev);
	}
});
