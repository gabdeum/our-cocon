export type Hemisphere = 'northern' | 'southern';

// Time zones south of the equator (IANA names, and the prefixes whose zones all are).
const SOUTHERN_PREFIXES = ['Australia/', 'Antarctica/', 'America/Argentina/'];
const SOUTHERN = new Set([
  'Pacific/Auckland',
  'Pacific/Chatham',
  'Pacific/Norfolk',
  'Pacific/Fiji',
  'Pacific/Tongatapu',
  'Pacific/Noumea',
  'Pacific/Efate',
  'Pacific/Apia',
  'Pacific/Rarotonga',
  'Pacific/Tahiti',
  'Pacific/Easter',
  'Pacific/Port_Moresby',
  'NZ',
  'America/Buenos_Aires',
  'America/Santiago',
  'America/Punta_Arenas',
  'America/Montevideo',
  'America/Asuncion',
  'America/La_Paz',
  'America/Lima',
  'America/Sao_Paulo',
  'America/Bahia',
  'America/Recife',
  'America/Maceio',
  'America/Fortaleza',
  'America/Campo_Grande',
  'America/Cuiaba',
  'America/Porto_Velho',
  'America/Rio_Branco',
  'Africa/Johannesburg',
  'Africa/Maseru',
  'Africa/Mbabane',
  'Africa/Windhoek',
  'Africa/Gaborone',
  'Africa/Harare',
  'Africa/Maputo',
  'Africa/Lusaka',
  'Africa/Blantyre',
  'Africa/Lubumbashi',
  'Africa/Luanda',
  'Africa/Kinshasa',
  'Africa/Dar_es_Salaam',
  'Indian/Mauritius',
  'Indian/Reunion',
  'Indian/Antananarivo',
  'Indian/Mayotte',
  'Asia/Jakarta',
  'Asia/Makassar',
  'Asia/Jayapura',
  'Asia/Dili',
]);

/** Where a family's seasons are, from its home time zone (spec 055 FR-005). Unknown or UTC: northern. */
export function hemisphereOf(timeZone: string | null | undefined): Hemisphere {
  if (!timeZone) return 'northern';
  return SOUTHERN.has(timeZone) || SOUTHERN_PREFIXES.some((p) => timeZone.startsWith(p)) ? 'southern' : 'northern';
}
