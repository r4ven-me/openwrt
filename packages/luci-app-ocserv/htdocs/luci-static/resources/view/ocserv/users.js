'use strict';
'require form';
'require fs';
'require ui';
'require ocserv.base as base';

/* OpenConnect VPN JavaScript for LuCI 
   Converted from Lua to JavaScript by @systemcrash
   Copyright 2014 Nikos Mavrogiannopoulos <n.mavrogiannopoulos@gmail.com>
   Licensed to the public under the Apache License 2.0.
*/

return L.view.extend({
	load() {
		return Promise.all([
			L.resolveDefault(fs.exec('/usr/bin/occtl', ['--json', 'show', 'users']).then(res => res.stdout), ''),
			L.uci.load('ocserv'),
		]);
	},

	parseUsers(output) {
		const users = [];
		
		// Handle empty or invalid output
		if (!output || !output.trim()) {
			return users;
		}

		try {
			// Clean up the output - remove extra newlines and trim
			const cleaned = output.trim().replace(/\[\s*\n\s*\]/g, '[]');
			const json = JSON.parse(cleaned);
			
			// Handle different JSON structures
			if (Array.isArray(json)) {
				// Handle empty array like "[\n]"
				if (json.length === 0) {
					return users;
				}
				// If it's an array of users directly
				return json.map(entry => this.normalizeUser(entry));
			} else if (json && json.users && Array.isArray(json.users)) {
				// If it's wrapped in a "users" property
				return json.users.map(entry => this.normalizeUser(entry));
			}
			
			return users;
		} catch (e) {
			console.error('Failed to parse JSON:', e.message);
			return users;
		}
	},

	normalizeUser(entry) {
		return {
			id: entry.ID,
			user: entry?.Username || entry?.User,
			group: entry?.Groupname || entry?.Group,
			vhost: entry?.VHost ?? entry?.Vhost ?? entry?.vhost,
			vpn_ip: entry['vpn-ipv4'] || entry.vpn_ip || entry?.IPv4,
			vpn_ip6: entry['vpn-ipv6'] || entry.vpn_ip6 || entry?.IPv6,
			ip: entry?.['Remote IP'],
			device: entry?.Device,
			time: entry['_Connected at'] || entry?.raw_connected_at,
			cipher: entry?.Cipher || entry?.['TLS ciphersuite'],
			status: entry?.Status || entry?.State,
			tx: entry?._TX || entry?.TX || entry?.tx || entry?.raw_tx,
			rx: entry?._RX || entry?.RX || entry?.rx || entry?.raw_rx,
		};
	},

	handleDisconnect(id, ev) {
		return L.resolveDefault(
			fs.exec('/usr/bin/occtl', ['disconnect', 'id', id]),
			null
		).then(() => {
			L.ui.addNotification(null, E('p', _('User %s has been disconnected.').format(id)), 'info');
			// Reload the page to refresh the user list
			window.location.reload();
		}).catch(function(e) {
			L.ui.addNotification(null, E('p', _('Failed to disconnect user: %s').format(e.message)), 'error');
		});
	},

	formatBytes(n) {
		n = Number(n);
		if (!isFinite(n) || n < 0)
			return '';
		const units = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB' ];
		let i = 0;
		while (n >= 1024 && i < units.length - 1) {
			n /= 1024;
			i++;
		}
		return (i ? n.toFixed(1) : String(n)) + ' ' + units[i];
	},

	formatTime(value) {
		const t = Number(value);
		if (!isFinite(t) || t <= 0)
			return { text: value || '', sub: '' };
		const secs = Math.max(0, Math.floor(Date.now() / 1000 - t));
		const d = Math.floor(secs / 86400), h = Math.floor(secs % 86400 / 3600), m = Math.floor(secs % 3600 / 60);
		return {
			text: new Date(t * 1000).toLocaleString(),
			sub: (d ? d + 'd ' : '') + (d || h ? h + 'h ' : '') + m + 'm'
		};
	},

	/* byte counters of the tunnel device, which are always present (occtl may omit them) */
	readCounters(users) {
		return Promise.all(users.map(user => {
			if (!user.device || !/^[A-Za-z0-9_.-]+$/.test(user.device))
				return null;
			const base = '/sys/class/net/' + user.device + '/statistics/';
			return Promise.all([
				L.resolveDefault(fs.read(base + 'rx_bytes'), null),
				L.resolveDefault(fs.read(base + 'tx_bytes'), null)
			]).then(([ rx, tx ]) => {
				if (rx != null)
					user.rx = rx.trim();
				if (tx != null)
					user.tx = tx.trim();
			});
		}));
	},

	render([occtl_output]) {
		const users = this.parseUsers(occtl_output);
		const hasVhosts = users.some(user => user.vhost != null);

		base.loadStyles();

		return this.readCounters(users).then(() => {
			const head = E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('ID')),
				E('th', { 'class': 'th' }, _('User')),
				...(hasVhosts ? [ E('th', { 'class': 'th' }, _('VHost')) ] : []),
				E('th', { 'class': 'th' }, _('VPN address')),
				E('th', { 'class': 'th' }, _('Remote IP')),
				E('th', { 'class': 'th' }, _('Connected')),
				E('th', { 'class': 'th' }, _('Received')),
				E('th', { 'class': 'th' }, _('Sent')),
				E('th', { 'class': 'th' }, _('Cipher')),
				E('th', { 'class': 'th ocserv-actions' }, _('Actions'))
			]);

			const rows = users.map(user => {
				const time = this.formatTime(user.time);
				const addr = [ user.vpn_ip, user.vpn_ip6 ].filter(Boolean);

				return E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td', 'data-title': _('ID') }, user.id),
					E('td', { 'class': 'td', 'data-title': _('User') }, [
						user.user || '',
						E('span', { 'class': 'ocserv-sub' }, [ user.group && user.group != '(none)' ? user.group : '' ])
					]),
					...(hasVhosts ? [ E('td', { 'class': 'td', 'data-title': _('VHost') }, user.vhost || '') ] : []),
					E('td', { 'class': 'td', 'data-title': _('VPN address') },
						addr.length ? addr.map(a => E('div', a)) : ''),
					E('td', { 'class': 'td', 'data-title': _('Remote IP') }, [
						user.ip || '',
						E('span', { 'class': 'ocserv-sub' }, [ user.device || '' ])
					]),
					E('td', { 'class': 'td', 'data-title': _('Connected') }, [
						time.text,
						E('span', { 'class': 'ocserv-sub' }, [ time.sub ])
					]),
					E('td', { 'class': 'td', 'data-title': _('Received') }, this.formatBytes(user.rx)),
					E('td', { 'class': 'td', 'data-title': _('Sent') }, this.formatBytes(user.tx)),
					E('td', { 'class': 'td ocserv-wrap', 'data-title': _('Cipher') }, [
						user.cipher || '',
						E('span', { 'class': 'ocserv-sub' }, [ user.status || '' ])
					]),
					E('td', { 'class': 'td ocserv-actions' },
						E('button', {
							'class': 'cbi-button cbi-button-remove',
							'click': L.bind(this.handleDisconnect, this, user.id)
						}, _('Disconnect')))
				]);
			});

			if (!rows.length)
				rows.push(E('tr', { 'class': 'tr placeholder' },
					E('td', { 'class': 'td', 'colspan': hasVhosts ? 10 : 9 },
						E('em', _('No active sessions.')))));

			return E('div', { 'class': 'cbi-map' }, [
				E('h2', _('OpenConnect VPN')),
				E('div', { 'class': 'cbi-section' }, [
					E('h3', _('Active users')),
					E('div', { 'class': 'ocserv-scroll' },
						E('table', { 'class': 'table ocserv-table' }, [ head, ...rows ]))
				])
			]);
		});
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

});
