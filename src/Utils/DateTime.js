import Configs from 'Core/Configs';

let formatter;
let activeZone;

export function displayTimeZone() {
	return Configs.get('timeZone', 'Asia/Shanghai');
}

/** Unix milliseconds; packet timestamps in seconds must be multiplied by 1000. */
export function dateParts(timestamp) {
	const timeZone = displayTimeZone();
	if (activeZone !== timeZone) {
		formatter = new Intl.DateTimeFormat('en-GB', {
			timeZone,
			year: 'numeric', month: '2-digit', day: '2-digit',
			hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
		});
		activeZone = timeZone;
	}
	return Object.fromEntries(formatter.formatToParts(new Date(timestamp)).map(({ type, value }) => [type, value]));
}

export function formatDateTime(timestamp) {
	const p = dateParts(timestamp);
	return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
