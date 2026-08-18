// Convert a free-text country name from a scraped job into a flag emoji.
// Flags are the two Regional Indicator Symbol Letters for the ISO 3166-1
// alpha-2 code — no external dep needed. Returns '' if we can't map it,
// so the caller can render it inline with `{flag} {country}` without a gap.
//
// This lives in mobile and dashboard both — keep them in sync when adding names.

const NAME_TO_ISO2 = {
  // ── Direct ISO alpha-2 pass-through ──
  us: 'US', usa: 'US',
  uk: 'GB',
  uae: 'AE',

  // ── Full names (lowercased) ──
  'united states': 'US',
  'united states of america': 'US',
  'united kingdom': 'GB',
  'great britain': 'GB',
  england: 'GB', scotland: 'GB', wales: 'GB',
  canada: 'CA',
  australia: 'AU',
  'new zealand': 'NZ',
  ireland: 'IE',
  germany: 'DE',
  france: 'FR',
  spain: 'ES',
  italy: 'IT',
  portugal: 'PT',
  netherlands: 'NL',
  belgium: 'BE',
  switzerland: 'CH',
  austria: 'AT',
  sweden: 'SE',
  norway: 'NO',
  denmark: 'DK',
  finland: 'FI',
  iceland: 'IS',
  poland: 'PL',
  'czech republic': 'CZ', czechia: 'CZ',
  slovakia: 'SK',
  hungary: 'HU',
  romania: 'RO',
  bulgaria: 'BG',
  greece: 'GR',
  turkey: 'TR', turkiye: 'TR', türkiye: 'TR',
  russia: 'RU', 'russian federation': 'RU',
  ukraine: 'UA',
  belarus: 'BY',
  estonia: 'EE', latvia: 'LV', lithuania: 'LT',
  moldova: 'MD',
  georgia: 'GE',
  armenia: 'AM',
  azerbaijan: 'AZ',
  kazakhstan: 'KZ',
  uzbekistan: 'UZ',
  kyrgyzstan: 'KG',
  tajikistan: 'TJ',
  turkmenistan: 'TM',

  // ── Middle East ──
  'united arab emirates': 'AE',
  'saudi arabia': 'SA',
  qatar: 'QA',
  kuwait: 'KW',
  bahrain: 'BH',
  oman: 'OM',
  yemen: 'YE',
  jordan: 'JO',
  israel: 'IL',
  lebanon: 'LB',
  syria: 'SY',
  iraq: 'IQ',
  iran: 'IR',
  palestine: 'PS',

  // ── Africa ──
  egypt: 'EG',
  morocco: 'MA',
  tunisia: 'TN',
  algeria: 'DZ',
  libya: 'LY',
  sudan: 'SD',
  ethiopia: 'ET',
  kenya: 'KE',
  tanzania: 'TZ',
  uganda: 'UG',
  rwanda: 'RW',
  nigeria: 'NG',
  ghana: 'GH',
  'south africa': 'ZA',
  zimbabwe: 'ZW',
  senegal: 'SN',
  'ivory coast': 'CI', "côte d'ivoire": 'CI', "cote d'ivoire": 'CI',
  cameroon: 'CM',
  angola: 'AO',
  mozambique: 'MZ',

  // ── Asia ──
  india: 'IN',
  pakistan: 'PK',
  bangladesh: 'BD',
  'sri lanka': 'LK',
  nepal: 'NP',
  bhutan: 'BT',
  maldives: 'MV',
  afghanistan: 'AF',
  china: 'CN',
  'hong kong': 'HK',
  taiwan: 'TW',
  japan: 'JP',
  'south korea': 'KR', korea: 'KR',
  'north korea': 'KP',
  mongolia: 'MN',
  vietnam: 'VN',
  thailand: 'TH',
  cambodia: 'KH',
  laos: 'LA',
  myanmar: 'MM', burma: 'MM',
  malaysia: 'MY',
  singapore: 'SG',
  indonesia: 'ID',
  philippines: 'PH',
  brunei: 'BN',
  'east timor': 'TL', 'timor-leste': 'TL',

  // ── Americas ──
  mexico: 'MX',
  guatemala: 'GT',
  honduras: 'HN',
  'el salvador': 'SV',
  nicaragua: 'NI',
  'costa rica': 'CR',
  panama: 'PA',
  cuba: 'CU',
  'dominican republic': 'DO',
  haiti: 'HT',
  jamaica: 'JM',
  'puerto rico': 'PR',
  'trinidad and tobago': 'TT',
  bahamas: 'BS',
  barbados: 'BB',
  brazil: 'BR',
  argentina: 'AR',
  chile: 'CL',
  peru: 'PE',
  colombia: 'CO',
  venezuela: 'VE',
  ecuador: 'EC',
  bolivia: 'BO',
  paraguay: 'PY',
  uruguay: 'UY',
  guyana: 'GY',
  suriname: 'SR',

  // ── Oceania ──
  fiji: 'FJ',
  'papua new guinea': 'PG',
  samoa: 'WS',
  tonga: 'TO',
  vanuatu: 'VU',

  // ── European micro-states ──
  luxembourg: 'LU',
  liechtenstein: 'LI',
  monaco: 'MC',
  malta: 'MT',
  cyprus: 'CY',
  albania: 'AL',
  'north macedonia': 'MK', macedonia: 'MK',
  serbia: 'RS',
  kosovo: 'XK',
  croatia: 'HR',
  slovenia: 'SI',
  'bosnia and herzegovina': 'BA',
  montenegro: 'ME',
};

const iso2ToFlag = (iso2) => {
  if (!iso2 || iso2.length !== 2) return '';
  // Regional Indicator Symbol Letter A (U+1F1E6) + (charCode - 'A')
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + (iso2.charCodeAt(0) - 65),
    base + (iso2.charCodeAt(1) - 65),
  );
};

/**
 * countryToFlag('United States')     → '🇺🇸'
 * countryToFlag('us')                → '🇺🇸'
 * countryToFlag('Wakanda')           → ''
 */
export const countryToFlag = (name) => {
  if (!name || typeof name !== 'string') return '';
  const key = name.trim().toLowerCase();
  if (!key) return '';
  // If already a 2-letter ISO code, use it directly (uppercase)
  if (key.length === 2 && /^[a-z]{2}$/.test(key)) {
    return iso2ToFlag(key.toUpperCase());
  }
  const iso2 = NAME_TO_ISO2[key];
  return iso2 ? iso2ToFlag(iso2) : '';
};

export default countryToFlag;
