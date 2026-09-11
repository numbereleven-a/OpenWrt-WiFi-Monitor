'use strict';
'require view';
'require rpc';
'require poll';

var status = rpc.declare({ object: 'wifi-monitor', method: 'status', expect: {} });
var luciLanguage = typeof L !== 'undefined' && L.env && L.env.lang;
var language = ((luciLanguage && luciLanguage !== 'auto' ? luciLanguage : '') ||
    (document.documentElement && document.documentElement.lang) ||
    (typeof navigator !== 'undefined' && navigator.language) || 'en').toLowerCase();
var russian = language.indexOf('ru') === 0;
var ru = {
    'Connected': 'Подключился', 'Device': 'Устройство', 'Band / SSID': 'Диапазон / SSID',
    'Signal': 'Сигнал', 'Online': 'В сети', 'Mbps': 'Мбит/с',
    'No devices match the selected filters.': 'Нет устройств по выбранным условиям.',
    'Total': 'Всего', 'Weak signal': 'Слабый сигнал',
    'Connected devices': 'Подключённые устройства', 'Recently connected': 'Недавно подключившиеся',
    'Only devices that are currently online. Connection time is shown in the browser time zone.': 'Только устройства, которые сейчас в сети. Время подключения показано в часовом поясе браузера.',
    'Refreshing…': 'Обновление…', 'Invalid response from the router': 'Некорректный ответ роутера',
    'Unable to list Wi-Fi interfaces': 'Не удалось получить список Wi-Fi интерфейсов',
    'Updated': 'Обновлено', 'Could not read interfaces:': 'Не удалось прочитать интерфейсы:',
    'Refresh error:': 'Ошибка обновления:', 'Previous data remains on screen.': 'На экране предыдущие данные.',
    'Refresh': 'Обновить', 'Wi-Fi Monitor': 'Wi-Fi монитор',
    'Current connections, signal strength and time online.': 'Текущие подключения, уровень сигнала и время в сети.',
    'Auto-refresh': 'Автообновление', 'Off': 'Выключено', 'seconds': 'секунд',
    'Name, IP, MAC or SSID': 'Имя, IP, MAC или SSID', 'Search devices': 'Поиск устройств',
    'Band': 'Диапазон', 'All bands': 'Все диапазоны', 'Recent': 'Недавние', 'All': 'Все',
    'RX / TX is the link rate reported by the router, not download speed. IP addresses and names come from DHCP and may be unavailable for static addresses.': 'RX / TX — скорость соединения с точки зрения роутера, не скорость скачивания. IP и имена берутся из DHCP; для статических адресов они могут отсутствовать.'
};
function t(s) { return russian && ru[s] ? ru[s] : s; }
function bandLabel(band) {
    if (band === '2.4') return russian ? '2,4 ГГц' : '2.4 GHz';
    if (band === '5') return russian ? '5 ГГц' : '5 GHz';
    if (band === '6') return russian ? '6 ГГц' : '6 GHz';
    return '—';
}
function duration(s) {
    if (s == null) return '—';
    var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    if (russian) return d ? d + ' д ' + h + ' ч' : h ? h + ' ч ' + m + ' мин' : m ? m + ' мин' : Math.floor(s) + ' с';
    return d ? d + ' d ' + h + ' h' : h ? h + ' h ' + m + ' min' : m ? m + ' min' : Math.floor(s) + ' s';
}
function cell(value) { return E('td', { 'class': 'td' }, value == null || value === '' ? '—' : String(value)); }
return view.extend({
    handleSaveApply: null, handleSave: null, handleReset: null,
    render: function() {
        var data = null, busy = false, query = '', band = '', sort = 'duration', direction = 1, limit = 10, interval = 0, last = 0;
        var summary = E('div'), tables = E('div'), message = E('p', { role: 'status' }), stamp = E('span');
        function table(devices, recent) {
            var columns = recent ? [['connected', t('Connected')], ['hostname', t('Device')], ['ip', 'IP'], ['mac', 'MAC'], ['band', t('Band / SSID')], ['duration', t('Online')]] : [['hostname', t('Device')], ['ip', 'IP'], ['mac', 'MAC'], ['band', t('Band / SSID')], ['signal', t('Signal')], ['duration', t('Online')], ['rx', 'RX / TX, ' + t('Mbps')]];
            var head = E('tr', { 'class': 'tr table-titles' }, columns.map(function(c) {
                return E('th', { 'class': 'th' }, recent ? c[1] : E('button', { 'class': 'wm-sort', click: function() { direction = sort === c[0] ? -direction : 1; sort = c[0]; draw(); } }, c[1] + (sort === c[0] ? (direction === 1 ? ' ↑' : ' ↓') : '')));
            }));
            var rows = devices.map(function(d) {
                return E('tr', { 'class': 'tr' }, columns.map(function(c) {
                    if (c[0] === 'connected') return cell(d.duration == null ? null : new Date((data.timestamp - d.duration) * 1000).toLocaleString(russian ? 'ru-RU' : 'en-US'));
                    if (c[0] === 'band') return E('td', { 'class': 'td', title: d.iface }, [E('strong', {}, bandLabel(d.band)), E('br'), E('small', {}, d.ssid || d.iface)]);
                    if (c[0] === 'duration') return cell(duration(d.duration));
                    if (c[0] === 'signal') return E('td', { 'class': 'td' }, E('span', { 'class': 'wm-signal', style: 'color:' + (d.signal == null ? 'inherit' : d.signal >= -60 ? '#248746' : d.signal >= -70 ? '#a46a00' : '#c43d3d') }, d.signal == null ? '—' : d.signal + ' dBm'));
                    if (c[0] === 'rx') return cell((d.rx == null ? '—' : d.rx.toFixed(1)) + ' / ' + (d.tx == null ? '—' : d.tx.toFixed(1)));
                    return cell(d[c[0]]);
                }));
            });
            if (!rows.length) rows.push(E('tr', { 'class': 'tr' }, E('td', { 'class': 'td', colspan: columns.length }, t('No devices match the selected filters.'))));
            return E('div', { style: 'overflow-x:auto' }, E('table', { 'class': 'table wm-table' }, [head].concat(rows)));
        }
        function draw() {
            if (!data) return;
            summary.replaceChildren(E('div', { 'class': 'wm-cards' }, [t('Total') + ': ' + data.devices.length, bandLabel('2.4') + ': ' + data.devices.filter(function(d) { return d.band === '2.4'; }).length, bandLabel('5') + ': ' + data.devices.filter(function(d) { return d.band === '5'; }).length, t('Weak signal') + ' (< −70 dBm): ' + data.devices.filter(function(d) { return d.signal != null && d.signal < -70; }).length].map(function(s) { return E('div', { 'class': 'wm-card' }, s); })));
            var filtered = data.devices.filter(function(d) { return (!band || d.band === band) && [d.hostname, d.ip, d.mac, d.ssid, d.iface].join(' ').toLowerCase().indexOf(query) !== -1; });
            var ordered = filtered.slice().sort(function(a,b) {
                var x = a[sort], y = b[sort];
                if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
                return direction * (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), russian ? 'ru' : 'en', { numeric: true }));
            });
            var recent = filtered.filter(function(d) { return d.duration != null; }).sort(function(a,b) { return a.duration - b.duration; });
            tables.replaceChildren(E('h3', {}, t('Connected devices') + ' · ' + filtered.length), table(ordered, false), E('h3', {}, t('Recently connected')), E('p', { 'class': 'wm-muted' }, t('Only devices that are currently online. Connection time is shown in the browser time zone.')), table(limit ? recent.slice(0, limit) : recent, true));
        }
        function refresh() {
            if (busy) return Promise.resolve();
            busy = true; button.disabled = true; button.textContent = t('Refreshing…');
            return status().then(function(result) {
                if (result.error || !Array.isArray(result.devices)) throw new Error(result.error ? t(result.error) : t('Invalid response from the router'));
                data = result; last = Date.now();
                stamp.textContent = t('Updated') + ': ' + new Date(data.timestamp * 1000).toLocaleTimeString(russian ? 'ru-RU' : 'en-US');
                message.textContent = result.warning ? t('Could not read interfaces:') + result.warning : '';
                draw();
            }).catch(function(error) { message.textContent = t('Refresh error:') + ' ' + error.message + (data ? ' ' + t('Previous data remains on screen.') : ''); last = Date.now();
            }).finally(function() { busy = false; button.disabled = false; button.textContent = t('Refresh'); });
        }
        var button = E('button', { 'class': 'cbi-button cbi-button-apply', click: refresh }, t('Refresh'));
        var root = E('div', { 'class': 'wm' }, [
            E('style', {}, '.wm-cards{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.wm-card{padding:16px;border:1px solid #8885;border-radius:8px;font-weight:600;flex:1;min-width:150px}.wm-controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:16px 0}.wm-controls label{display:flex;align-items:center;gap:8px}.wm-sort{background:none;border:0;color:inherit;font:inherit;font-weight:bold;cursor:pointer;padding:0;white-space:nowrap}.wm-table td{white-space:nowrap}.wm-signal{font-weight:600}.wm-muted{opacity:.75}.wm h3{margin-top:24px}'),
            E('h2', {}, t('Wi-Fi Monitor')), E('p', { 'class': 'wm-muted' }, t('Current connections, signal strength and time online.')),
            E('div', { 'class': 'wm-controls' }, [button, stamp, E('label', {}, [t('Auto-refresh'), E('select', { change: function(e) { interval = Number(e.target.value); } }, [E('option', { value: 0 }, t('Off')), E('option', { value: 10 }, '10 ' + t('seconds')), E('option', { value: 30 }, '30 ' + t('seconds')), E('option', { value: 60 }, '60 ' + t('seconds'))])])]),
            message, summary,
            E('div', { 'class': 'wm-controls' }, [E('input', { type: 'search', placeholder: t('Name, IP, MAC or SSID'), 'aria-label': t('Search devices'), input: function(e) { query = e.target.value.trim().toLowerCase(); draw(); } }), E('select', { 'aria-label': t('Band'), change: function(e) { band = e.target.value; draw(); } }, [E('option', { value: '' }, t('All bands')), E('option', { value: '2.4' }, bandLabel('2.4')), E('option', { value: '5' }, bandLabel('5')), E('option', { value: '6' }, bandLabel('6'))]), E('label', {}, [t('Recent'), E('select', { change: function(e) { limit = Number(e.target.value); draw(); } }, [E('option', { value: 10 }, '10'), E('option', { value: 20 }, '20'), E('option', { value: 0 }, t('All'))])])]),
            tables, E('p', { 'class': 'wm-muted' }, t('RX / TX is the link rate reported by the router, not download speed. IP addresses and names come from DHCP and may be unavailable for static addresses.'))
        ]);
        poll.add(function() { if (interval && !document.hidden && Date.now() - last >= interval * 1000) return refresh(); }, 1);
        refresh();
        return root;
    }
});
