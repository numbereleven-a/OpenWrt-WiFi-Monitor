'use strict';
'require view';
'require rpc';
'require poll';

var status = rpc.declare({ object: 'wifi-monitor', method: 'status', expect: {} });
function duration(s) {
    if (s == null) return '—';
    var d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return d ? d + ' д ' + h + ' ч' : h ? h + ' ч ' + m + ' мин' : m ? m + ' мин' : Math.floor(s) + ' с';
}
function cell(value) { return E('td', { 'class': 'td' }, value == null || value === '' ? '—' : String(value)); }
return view.extend({
    handleSaveApply: null, handleSave: null, handleReset: null,
    render: function() {
        var data = null, busy = false, query = '', band = '', sort = 'duration', direction = 1, limit = 10, interval = 0, last = 0;
        var summary = E('div'), tables = E('div'), message = E('p', { role: 'status' }), stamp = E('span');
        function table(devices, recent) {
            var columns = recent ? [['connected', 'Подключился'], ['hostname', 'Устройство'], ['ip', 'IP'], ['mac', 'MAC'], ['band', 'Диапазон / SSID'], ['duration', 'В сети']] : [['hostname', 'Устройство'], ['ip', 'IP'], ['mac', 'MAC'], ['band', 'Диапазон / SSID'], ['signal', 'Сигнал'], ['duration', 'В сети'], ['rx', 'RX / TX, Мбит/с']];
            var head = E('tr', { 'class': 'tr table-titles' }, columns.map(function(c) {
                return E('th', { 'class': 'th' }, recent ? c[1] : E('button', { 'class': 'wm-sort', click: function() { direction = sort === c[0] ? -direction : 1; sort = c[0]; draw(); } }, c[1] + (sort === c[0] ? (direction === 1 ? ' ↑' : ' ↓') : '')));
            }));
            var rows = devices.map(function(d) {
                return E('tr', { 'class': 'tr' }, columns.map(function(c) {
                    if (c[0] === 'connected') return cell(d.duration == null ? null : new Date((data.timestamp - d.duration) * 1000).toLocaleString('ru-RU'));
                    if (c[0] === 'band') return E('td', { 'class': 'td', title: d.iface }, [E('strong', {}, d.band), E('br'), E('small', {}, d.ssid || d.iface)]);
                    if (c[0] === 'duration') return cell(duration(d.duration));
                    if (c[0] === 'signal') return E('td', { 'class': 'td' }, E('span', { 'class': 'wm-signal', style: 'color:' + (d.signal == null ? 'inherit' : d.signal >= -60 ? '#248746' : d.signal >= -70 ? '#a46a00' : '#c43d3d') }, d.signal == null ? '—' : d.signal + ' dBm'));
                    if (c[0] === 'rx') return cell((d.rx == null ? '—' : d.rx.toFixed(1)) + ' / ' + (d.tx == null ? '—' : d.tx.toFixed(1)));
                    return cell(d[c[0]]);
                }));
            });
            if (!rows.length) rows.push(E('tr', { 'class': 'tr' }, E('td', { 'class': 'td', colspan: columns.length }, 'Нет устройств по выбранным условиям.')));
            return E('div', { style: 'overflow-x:auto' }, E('table', { 'class': 'table wm-table' }, [head].concat(rows)));
        }
        function draw() {
            if (!data) return;
            summary.replaceChildren(E('div', { 'class': 'wm-cards' }, ['Всего: ' + data.devices.length, '2,4 ГГц: ' + data.devices.filter(function(d) { return d.band === '2,4 ГГц'; }).length, '5 ГГц: ' + data.devices.filter(function(d) { return d.band === '5 ГГц'; }).length, 'Слабый сигнал (< −70 dBm): ' + data.devices.filter(function(d) { return d.signal != null && d.signal < -70; }).length].map(function(s) { return E('div', { 'class': 'wm-card' }, s); })));
            var filtered = data.devices.filter(function(d) { return (!band || d.band === band) && [d.hostname, d.ip, d.mac, d.ssid, d.iface].join(' ').toLowerCase().indexOf(query) !== -1; });
            var ordered = filtered.slice().sort(function(a,b) {
                var x = a[sort], y = b[sort];
                if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
                return direction * (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'ru', { numeric: true }));
            });
            var recent = filtered.filter(function(d) { return d.duration != null; }).sort(function(a,b) { return a.duration - b.duration; });
            tables.replaceChildren(E('h3', {}, 'Подключённые устройства · ' + filtered.length), table(ordered, false), E('h3', {}, 'Недавно подключившиеся'), E('p', { 'class': 'wm-muted' }, 'Только устройства, которые сейчас в сети. Время подключения показано в часовом поясе браузера.'), table(limit ? recent.slice(0, limit) : recent, true));
        }
        function refresh() {
            if (busy) return Promise.resolve();
            busy = true; button.disabled = true; button.textContent = 'Обновление…';
            return status().then(function(result) {
                if (result.error || !Array.isArray(result.devices)) throw new Error(result.error || 'Некорректный ответ роутера');
                data = result; last = Date.now();
                stamp.textContent = 'Обновлено: ' + new Date(data.timestamp * 1000).toLocaleTimeString('ru-RU');
                message.textContent = result.warning ? 'Не удалось прочитать интерфейсы:' + result.warning : '';
                draw();
            }).catch(function(error) { message.textContent = 'Ошибка обновления: ' + error.message + (data ? '. На экране предыдущие данные.' : ''); last = Date.now();
            }).finally(function() { busy = false; button.disabled = false; button.textContent = 'Обновить'; });
        }
        var button = E('button', { 'class': 'cbi-button cbi-button-apply', click: refresh }, 'Обновить');
        var root = E('div', { 'class': 'wm' }, [
            E('style', {}, '.wm-cards{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.wm-card{padding:16px;border:1px solid #8885;border-radius:8px;font-weight:600;flex:1;min-width:150px}.wm-controls{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:16px 0}.wm-controls label{display:flex;align-items:center;gap:8px}.wm-sort{background:none;border:0;color:inherit;font:inherit;font-weight:bold;cursor:pointer;padding:0;white-space:nowrap}.wm-table td{white-space:nowrap}.wm-signal{font-weight:600}.wm-muted{opacity:.75}.wm h3{margin-top:24px}'),
            E('h2', {}, 'Wi-Fi монитор'), E('p', { 'class': 'wm-muted' }, 'Текущие подключения, уровень сигнала и время в сети.'),
            E('div', { 'class': 'wm-controls' }, [button, stamp, E('label', {}, ['Автообновление', E('select', { change: function(e) { interval = Number(e.target.value); } }, [E('option', { value: 0 }, 'Выключено'), E('option', { value: 10 }, '10 секунд'), E('option', { value: 30 }, '30 секунд'), E('option', { value: 60 }, '60 секунд')])])]),
            message, summary,
            E('div', { 'class': 'wm-controls' }, [E('input', { type: 'search', placeholder: 'Имя, IP, MAC или SSID', 'aria-label': 'Поиск устройств', input: function(e) { query = e.target.value.trim().toLowerCase(); draw(); } }), E('select', { 'aria-label': 'Диапазон', change: function(e) { band = e.target.value; draw(); } }, [E('option', { value: '' }, 'Все диапазоны'), E('option', { value: '2,4 ГГц' }, '2,4 ГГц'), E('option', { value: '5 ГГц' }, '5 ГГц'), E('option', { value: '6 ГГц' }, '6 ГГц')]), E('label', {}, ['Недавние', E('select', { change: function(e) { limit = Number(e.target.value); draw(); } }, [E('option', { value: 10 }, '10'), E('option', { value: 20 }, '20'), E('option', { value: 0 }, 'Все')])])]),
            tables, E('p', { 'class': 'wm-muted' }, 'RX / TX — скорость соединения с точки зрения роутера, не скорость скачивания. IP и имена берутся из DHCP; для статических адресов они могут отсутствовать.')
        ]);
        poll.add(function() { if (interval && !document.hidden && Date.now() - last >= interval * 1000) return refresh(); }, 1);
        refresh();
        return root;
    }
});
