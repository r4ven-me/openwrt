#!/usr/bin/env python3
"""Generates the landing page of the apk repository: index.html with the package list and download links.

Usage: gen-index.py <dir with the *.apk files> <output index.html> [release] [arch]
Name and version come from the file names; the descriptions are in DESCRIPTIONS below.
The style follows the maintainer's sites (Nord theme, light and dark).
"""
import html
import os
import re
import sys

DESCRIPTIONS = {
    'luci-app-ocserv-r4ven-me': 'Веб-интерфейс LuCI для OpenConnect VPN (ocserv)',
    'kmod-amneziawg-r4ven-me': 'Модуль ядра AmneziaWG (под ядро 6.12.112)',
    'amneziawg-tools-r4ven-me': 'Утилита awg и протокол netifd для AmneziaWG',
    'luci-proto-amneziawg-r4ven-me': 'Поддержка протокола amneziawg в LuCI',
    'luci-app-amneziawg-r4ven-me': 'Веб-интерфейс LuCI: пиры, конфиги клиентов, маршрутизация',
    'luci-i18n-amneziawg-ru-r4ven-me': 'Русский перевод интерфейса AmneziaWG',
    'luci-theme-kornord-r4ven-me': 'Тема Kornord для LuCI (цвета Nord)',
}
ORDER = list(DESCRIPTIONS)


def human(n):
    for unit in ('Б', 'КБ', 'МБ'):
        if n < 1024 or unit == 'МБ':
            return f'{n:.0f} {unit}' if unit == 'Б' else f'{n / 1:.1f} {unit}'
        n /= 1024


def main():
    src, out = sys.argv[1], sys.argv[2]
    release = sys.argv[3] if len(sys.argv) > 3 else '25.12'
    arch = sys.argv[4] if len(sys.argv) > 4 else 'x86_64'
    pkgs = []
    for f in sorted(os.listdir(src)):
        m = re.match(r'^(.+?-r4ven-me)-(\d.*)\.apk$', f)
        if m:
            pkgs.append((m.group(1), m.group(2), f, os.path.getsize(os.path.join(src, f))))
    pkgs.sort(key=lambda p: (ORDER.index(p[0]) if p[0] in ORDER else 99, p[0]))

    rows = []
    for name, ver, fname, size in pkgs:
        desc = DESCRIPTIONS.get(name, '')
        rows.append(
            '<li class="pkg"><div class="pkg-main">'
            f'<a class="pkg-name" href="{release}/{arch}/{html.escape(fname)}">{html.escape(name)}</a>'
            f'<span class="pkg-desc">{html.escape(desc)}</span></div>'
            f'<span class="pkg-meta">{html.escape(ver)} · {human(size)}</span></li>'
        )

    page = TEMPLATE.replace('{{PACKAGES}}', '\n'.join(rows)).replace('{{RELEASE}}', release).replace('{{ARCH}}', arch)
    with open(out, 'w', encoding='utf-8') as fh:
        fh.write(page)
    print(f'{out}: {len(pkgs)} packages')


TEMPLATE = '''<!doctype html>
<html lang="ru" data-theme="nord">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Репозиторий apk для OpenWrt | Вороний блог</title>
<meta name="description" content="Подписанный apk-репозиторий для OpenWrt {{RELEASE}}: LuCI для ocserv, AmneziaWG, тема Kornord.">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<style>
:root{--primary:oklch(0.594 0.077 254.027);--bg:oklch(0.951 0.007 260.731);--fg:oklch(0.324 0.022 264.182);--muted:oklch(0.933 0.01 261.788);--muted-fg:oklch(0.452 0.035 264.131);--border:oklch(0.899 0.016 262.749);--card:oklch(0.951 0.007 260.731);--tip:oklch(0.55 0.08 150)}
@media (prefers-color-scheme:dark){:root{--primary:oklch(0.65 0.07 254.027);--bg:oklch(0.18 0.015 264.182);--fg:oklch(0.899 0.016 262.749);--muted:oklch(0.25 0.02 264.131);--muted-fg:oklch(0.70 0.035 264.131);--border:oklch(0.35 0.025 264.182);--card:oklch(0.22 0.018 264.182);--tip:oklch(0.65 0.10 150)}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font-family:ui-sans-serif,system-ui,sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
.wrap{max-width:56rem;margin:0 auto;padding:0 1rem}
header{padding:1.5rem 0}
.bar{display:flex;align-items:center;gap:.75rem;padding:1rem 1.5rem;border:1px solid var(--border);border-radius:.75rem;background:color-mix(in srgb,var(--card) 80%,transparent);box-shadow:0 1px 2px rgb(0 0 0/.05)}
.bar a{display:flex;align-items:center;gap:.75rem;color:inherit;text-decoration:none;font-weight:600}
.bar img{width:2.5rem;height:2.5rem;border-radius:9999px;object-fit:cover}
h1{font-size:1.75rem;margin:1.5rem 0 .25rem}
h2{font-size:1.125rem;margin:2rem 0 .75rem}
.lead{margin:0;color:var(--muted-fg)}
a{color:var(--primary)}
pre{margin:0;padding:1rem 1.25rem;overflow-x:auto;border:1px solid var(--border);border-radius:.75rem;background:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.875rem;line-height:1.7}
ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.75rem}
.pkg{display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1rem 1.25rem;border:1px solid var(--border);border-radius:.75rem;background:var(--card);transition:transform .2s ease-out,border-color .2s ease-out}
.pkg:hover{transform:translateY(-2px);border-color:var(--primary)}
.pkg-main{display:flex;flex-direction:column;min-width:0}
.pkg-name{font-weight:600;text-decoration:none;word-break:break-all}
.pkg-name:hover{text-decoration:underline}
.pkg-desc{font-size:.875rem;color:var(--muted-fg)}
.pkg-meta{flex-shrink:0;font-size:.8125rem;color:var(--muted-fg);text-align:right}
.note{margin-top:1.5rem;padding:1rem 1.25rem;border:1px solid var(--border);border-radius:.75rem;font-size:.9375rem;color:var(--muted-fg)}
.note b{color:var(--fg)}
footer{margin:2.5rem 0 2rem;font-size:.875rem;color:var(--muted-fg)}
@media (max-width:40rem){.pkg{flex-direction:column;align-items:flex-start;gap:.25rem}.pkg-meta{text-align:left}}
</style>
</head>
<body>
<div class="wrap">
<header><div class="bar"><a href="https://r4ven.me/"><img src="logo.jpg" alt="Вороний блог"><span>Вороний блог</span></a></div></header>
<main>
<h1>Репозиторий apk для OpenWrt</h1>
<p class="lead">OpenWrt {{RELEASE}}, архитектура {{ARCH}}. Все пакеты подписаны ключом <a href="r4ven-apk.pub">r4ven-apk</a>.</p>

<h2>Подключение</h2>
<pre>wget -O /etc/apk/keys/r4ven-apk.pub https://apk.r4ven.me/r4ven-apk.pub
echo https://apk.r4ven.me/{{RELEASE}}/{{ARCH}}/packages.adb &gt; /etc/apk/repositories.d/r4ven.list
apk update
apk add luci-app-ocserv-r4ven-me</pre>

<h2>Пакеты</h2>
<ul>
{{PACKAGES}}
</ul>

<div class="note"><b>AmneziaWG.</b> Модуль <code>kmod-amneziawg-r4ven-me</code> собран под ядро OpenWrt 25.12.6 x86/64 (6.12.112) и не загрузится на другом ядре. После установки перезагрузите роутер один раз.</div>
</main>
<footer>Обновления приходят обычным <code>apk update &amp;&amp; apk upgrade</code>. <a href="https://github.com/r4ven-me/openwrt">Исходники</a></footer>
</div>
</body>
</html>
'''

if __name__ == '__main__':
    main()
