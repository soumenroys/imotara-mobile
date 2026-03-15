export type CrisisResource = {
    id: string;
    label: string;
    contact: string;
    note?: string;
};

export type CountryCrisisResources = {
    countryCode: string;
    emergency?: CrisisResource;
    primary: CrisisResource[];
};

// ─── Asia ────────────────────────────────────────────────────────────────────

export const INDIA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "IN",
    emergency: { id: "in-emergency-112", label: "Emergency", contact: "112", note: "For immediate danger or urgent medical / police assistance." },
    primary: [
        { id: "in-tele-manas-14416", label: "Tele-MANAS", contact: "14416 / 1800-891-4416", note: "24/7 free government mental health support in multiple Indian languages." },
        { id: "in-kiran", label: "KIRAN", contact: "1800-599-0019", note: "24/7 mental health support helpline." },
        { id: "in-nimhans", label: "NIMHANS", contact: "080-46110007", note: "24/7 psychosocial support." },
    ],
};

export const JAPAN_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "JP",
    emergency: { id: "jp-emergency-110", label: "Emergency", contact: "110 / 119", note: "Police (110) or Ambulance/Fire (119)." },
    primary: [
        { id: "jp-inochi-no-denwa", label: "Inochi no Denwa", contact: "0120-783-556", note: "24/7 free suicide prevention hotline." },
        { id: "jp-yorisoi-hotline", label: "Yorisoi Hotline", contact: "0120-279-338", note: "24/7 free comprehensive support hotline." },
    ],
};

export const SOUTH_KOREA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "KR",
    emergency: { id: "kr-emergency-112", label: "Emergency", contact: "112 / 119", note: "Police (112) or Ambulance (119)." },
    primary: [
        { id: "kr-suicide-prevention-1393", label: "Korea Suicide Prevention Hotline", contact: "1393", note: "24/7 free suicide prevention and crisis counseling." },
        { id: "kr-mental-health-crisis-1577", label: "Mental Health Crisis Line", contact: "1577-0199", note: "24/7 free mental health crisis support." },
    ],
};

export const CHINA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "CN",
    emergency: { id: "cn-emergency-120", label: "Emergency", contact: "120 / 110", note: "Ambulance (120) or Police (110)." },
    primary: [
        { id: "cn-beijing-crisis", label: "Beijing Suicide Research & Prevention Center", contact: "010-82951332", note: "24/7 crisis support." },
        { id: "cn-hope-24", label: "Hope 24 Hotline", contact: "400-161-9995", note: "24/7 psychological crisis intervention." },
    ],
};

export const SINGAPORE_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "SG",
    emergency: { id: "sg-emergency-999", label: "Emergency", contact: "999", note: "Police and ambulance." },
    primary: [
        { id: "sg-samaritans-1767", label: "Samaritans of Singapore (SOS)", contact: "1767", note: "24/7 free crisis support." },
        { id: "sg-imh-6389-2222", label: "Institute of Mental Health", contact: "6389 2222", note: "24/7 mental health helpline." },
    ],
};

export const MALAYSIA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "MY",
    emergency: { id: "my-emergency-999", label: "Emergency", contact: "999", note: "Police and ambulance." },
    primary: [
        { id: "my-befrienders-kl", label: "Befrienders Kuala Lumpur", contact: "03-7627 2929", note: "24/7 free emotional support." },
        { id: "my-mental-health-hotline", label: "Talian Kasih", contact: "15999", note: "24/7 welfare and crisis hotline." },
    ],
};

export const PHILIPPINES_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "PH",
    emergency: { id: "ph-emergency-911", label: "Emergency", contact: "911", note: "National emergency number." },
    primary: [
        { id: "ph-hopeline-2919", label: "Hopeline Philippines", contact: "2919", note: "24/7 free crisis support." },
        { id: "ph-ncmh-1553", label: "NCMH Crisis Hotline", contact: "1553", note: "24/7 mental health crisis line." },
    ],
};

export const THAILAND_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "TH",
    emergency: { id: "th-emergency-1669", label: "Emergency", contact: "1669 / 191", note: "Ambulance (1669) or Police (191)." },
    primary: [
        { id: "th-dmh-1323", label: "Department of Mental Health Hotline", contact: "1323", note: "24/7 free mental health crisis support." },
        { id: "th-samaritans", label: "Samaritans of Thailand", contact: "02-713-6793", note: "24/7 emotional support." },
    ],
};

export const INDONESIA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "ID",
    emergency: { id: "id-emergency-119", label: "Emergency", contact: "119", note: "National emergency number." },
    primary: [
        { id: "id-into-the-light", label: "Crisis Hotline (Kemenkes)", contact: "119 ext 8", note: "24/7 free mental health crisis line." },
        { id: "id-yayasan-pulih", label: "Yayasan Pulih", contact: "021-788-42580", note: "Crisis counseling and support." },
    ],
};

export const HONG_KONG_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "HK",
    emergency: { id: "hk-emergency-999", label: "Emergency", contact: "999", note: "Police and ambulance." },
    primary: [
        { id: "hk-samaritans-2382-0000", label: "Samaritans Hong Kong", contact: "2382 0000", note: "24/7 free multilingual crisis support." },
        { id: "hk-sane-2382-0000", label: "SANE Helpline", contact: "2382 0000", note: "24/7 mental health support." },
    ],
};

export const TAIWAN_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "TW",
    emergency: { id: "tw-emergency-119", label: "Emergency", contact: "119 / 110", note: "Ambulance (119) or Police (110)." },
    primary: [
        { id: "tw-1925", label: "Taiwan Suicide Prevention Hotline", contact: "1925", note: "24/7 free suicide prevention line." },
    ],
};

export const SRI_LANKA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "LK",
    emergency: { id: "lk-emergency-1990", label: "Emergency", contact: "1990 / 119", note: "Suwa Seriya ambulance (1990) or Police (119)." },
    primary: [
        { id: "lk-sumithrayo", label: "Sumithrayo", contact: "011-057-6555", note: "24/7 free emotional support." },
    ],
};

export const PAKISTAN_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "PK",
    emergency: { id: "pk-emergency-115", label: "Emergency", contact: "115 / 1122", note: "Ambulance (115) or Rescue (1122)." },
    primary: [
        { id: "pk-umang", label: "Umang Mental Health Helpline", contact: "0317-4288665", note: "Mental health crisis support." },
        { id: "pk-rozan", label: "Rozan Counseling", contact: "051-2890505", note: "Psychosocial support helpline." },
    ],
};

export const BANGLADESH_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "BD",
    emergency: { id: "bd-emergency-999", label: "Emergency", contact: "999", note: "National emergency number." },
    primary: [
        { id: "bd-kaan-pete-roi", label: "Kaan Pete Roi", contact: "01779-554391", note: "Emotional support helpline." },
    ],
};

// ─── Middle East ──────────────────────────────────────────────────────────────

export const ISRAEL_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "IL",
    emergency: { id: "il-emergency-101", label: "Emergency", contact: "101 / 100", note: "Ambulance (101) or Police (100)." },
    primary: [
        { id: "il-eran-1201", label: "ERAN Emotional First Aid", contact: "1201", note: "24/7 free emotional support and crisis intervention. Also available in Arabic and Russian." },
    ],
};

export const TURKEY_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "TR",
    emergency: { id: "tr-emergency-112", label: "Emergency", contact: "112", note: "National emergency number." },
    primary: [
        { id: "tr-mental-health-182", label: "ALO Mental Health Line", contact: "182", note: "24/7 free mental health support." },
    ],
};

export const UAE_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "AE",
    emergency: { id: "ae-emergency-999", label: "Emergency", contact: "999", note: "Police and ambulance." },
    primary: [
        { id: "ae-estijaba-8004673", label: "Estijaba Social Support", contact: "800-HOPE (4673)", note: "24/7 social and emotional support." },
    ],
};

export const SAUDI_ARABIA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "SA",
    emergency: { id: "sa-emergency-911", label: "Emergency", contact: "911", note: "National emergency number." },
    primary: [
        { id: "sa-mental-health-920033360", label: "Mental Health Support Line", contact: "920033360", note: "National mental health support." },
    ],
};

// ─── Europe ───────────────────────────────────────────────────────────────────

export const UK_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "GB",
    emergency: { id: "gb-emergency-999", label: "Emergency", contact: "999", note: "Police, ambulance and fire." },
    primary: [
        { id: "gb-samaritans-116123", label: "Samaritans", contact: "116 123", note: "24/7 free emotional support — call or email jo@samaritans.org." },
        { id: "gb-crisis-text-line", label: "Shout Crisis Text Line", contact: "Text SHOUT to 85258", note: "24/7 free crisis text support." },
    ],
};

export const GERMANY_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "DE",
    emergency: { id: "de-emergency-112", label: "Emergency", contact: "112", note: "Police (110) or Ambulance/Fire (112)." },
    primary: [
        { id: "de-telefonseelsorge-0800-111-0-111", label: "Telefonseelsorge", contact: "0800 111 0 111", note: "24/7 free crisis support (kostenlos, rund um die Uhr)." },
        { id: "de-telefonseelsorge-0800-111-0-222", label: "Telefonseelsorge (alt)", contact: "0800 111 0 222", note: "24/7 free — alternative number." },
    ],
};

export const FRANCE_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "FR",
    emergency: { id: "fr-emergency-15", label: "Emergency", contact: "15 / 17 / 18", note: "SAMU (15), Police (17), Fire (18)." },
    primary: [
        { id: "fr-3114", label: "Numéro National de Prévention du Suicide", contact: "3114", note: "24/7 free national suicide prevention line." },
    ],
};

export const SPAIN_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "ES",
    emergency: { id: "es-emergency-112", label: "Emergency", contact: "112", note: "National emergency number." },
    primary: [
        { id: "es-telefono-esperanza", label: "Teléfono de la Esperanza", contact: "717 003 717", note: "24/7 crisis support." },
        { id: "es-suicidio-024", label: "Línea de Atención a Conducta Suicida", contact: "024", note: "24/7 free national suicide prevention line." },
    ],
};

export const ITALY_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "IT",
    emergency: { id: "it-emergency-112", label: "Emergency", contact: "112 / 118", note: "Emergency (112) or Ambulance (118)." },
    primary: [
        { id: "it-telefono-amico", label: "Telefono Amico", contact: "02 2327 2327", note: "Emotional support helpline." },
        { id: "it-telefono-azzurro", label: "Telefono Azzurro", contact: "19696", note: "24/7 crisis support." },
    ],
};

export const NETHERLANDS_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "NL",
    emergency: { id: "nl-emergency-112", label: "Emergency", contact: "112", note: "National emergency number." },
    primary: [
        { id: "nl-113-zelfmoordpreventie", label: "113 Zelfmoordpreventie", contact: "0800 0113", note: "24/7 free suicide prevention line." },
    ],
};

export const PORTUGAL_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "PT",
    emergency: { id: "pt-emergency-112", label: "Emergency", contact: "112", note: "National emergency number." },
    primary: [
        { id: "pt-sos-voz-amiga", label: "SOS Voz Amiga", contact: "213 544 545", note: "24/7 emotional support." },
        { id: "pt-voz-de-apoio", label: "Voz de Apoio", contact: "225 506 070", note: "24/7 crisis support." },
    ],
};

export const SWEDEN_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "SE",
    emergency: { id: "se-emergency-112", label: "Emergency", contact: "112", note: "National emergency number." },
    primary: [
        { id: "se-mind-90101", label: "Mind Självmordslinjen", contact: "90101", note: "24/7 free suicide prevention line." },
    ],
};

export const NORWAY_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "NO",
    emergency: { id: "no-emergency-112", label: "Emergency", contact: "112 / 113", note: "Police (112) or Ambulance (113)." },
    primary: [
        { id: "no-mental-helse-116123", label: "Mental Helse", contact: "116 123", note: "24/7 free crisis helpline." },
    ],
};

export const DENMARK_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "DK",
    emergency: { id: "dk-emergency-112", label: "Emergency", contact: "112", note: "National emergency number." },
    primary: [
        { id: "dk-livslinien", label: "Livslinien", contact: "70 201 201", note: "24/7 free crisis support." },
    ],
};

export const FINLAND_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "FI",
    emergency: { id: "fi-emergency-112", label: "Emergency", contact: "112", note: "National emergency number." },
    primary: [
        { id: "fi-mieli-09-2525-0111", label: "Mieli Crisis Helpline", contact: "09 2525 0111", note: "24/7 crisis support." },
    ],
};

export const SWITZERLAND_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "CH",
    emergency: { id: "ch-emergency-144", label: "Emergency", contact: "144 / 117", note: "Ambulance (144) or Police (117)." },
    primary: [
        { id: "ch-dargebotene-hand-143", label: "Die Dargebotene Hand", contact: "143", note: "24/7 free crisis support (DE/FR/IT)." },
    ],
};

export const AUSTRIA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "AT",
    emergency: { id: "at-emergency-144", label: "Emergency", contact: "144 / 133", note: "Ambulance (144) or Police (133)." },
    primary: [
        { id: "at-telefonseelsorge-142", label: "Telefonseelsorge", contact: "142", note: "24/7 free crisis support." },
    ],
};

export const BELGIUM_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "BE",
    emergency: { id: "be-emergency-112", label: "Emergency", contact: "112 / 101", note: "Ambulance/Fire (112) or Police (101)." },
    primary: [
        { id: "be-centre-prevention-0800-32123", label: "Centre de Prévention du Suicide", contact: "0800 32 123", note: "24/7 free suicide prevention (FR)." },
        { id: "be-zelfmoordlijn-0800-32123", label: "Zelfmoordlijn 1813", contact: "0800 32 123", note: "24/7 free crisis support (NL)." },
    ],
};

export const POLAND_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "PL",
    emergency: { id: "pl-emergency-112", label: "Emergency", contact: "112", note: "National emergency number." },
    primary: [
        { id: "pl-telefon-zaufania-116123", label: "Telefon Zaufania dla Dorosłych", contact: "116 123", note: "24/7 free crisis support." },
    ],
};

export const IRELAND_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "IE",
    emergency: { id: "ie-emergency-999", label: "Emergency", contact: "999 / 112", note: "Police, ambulance and fire." },
    primary: [
        { id: "ie-samaritans-116123", label: "Samaritans Ireland", contact: "116 123", note: "24/7 free emotional support." },
        { id: "ie-pieta-1800-247-247", label: "Pieta House", contact: "1800 247 247", note: "24/7 free crisis support." },
    ],
};

export const GREECE_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "GR",
    emergency: { id: "gr-emergency-112", label: "Emergency", contact: "112 / 100", note: "Emergency (112) or Police (100)." },
    primary: [
        { id: "gr-klimaka-1018", label: "KLIMAKA Suicide Helpline", contact: "1018", note: "24/7 free suicide prevention." },
    ],
};

export const ROMANIA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "RO",
    emergency: { id: "ro-emergency-112", label: "Emergency", contact: "112", note: "National emergency number." },
    primary: [
        { id: "ro-antisuicid-0800-801-200", label: "Antisuicid Helpline", contact: "0800 801 200", note: "24/7 free crisis support." },
    ],
};

export const CZECH_REPUBLIC_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "CZ",
    emergency: { id: "cz-emergency-112", label: "Emergency", contact: "112 / 155", note: "Emergency (112) or Ambulance (155)." },
    primary: [
        { id: "cz-linka-bezpeci-116111", label: "Linka bezpečí", contact: "116 111", note: "24/7 free crisis line." },
    ],
};

export const HUNGARY_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "HU",
    emergency: { id: "hu-emergency-112", label: "Emergency", contact: "112", note: "National emergency number." },
    primary: [
        { id: "hu-lelki-elsosegely-116123", label: "Lelki Elsősegély Telefonszolgálat", contact: "116 123", note: "24/7 free crisis support." },
    ],
};

export const RUSSIA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "RU",
    emergency: { id: "ru-emergency-112", label: "Emergency", contact: "112", note: "National emergency number." },
    primary: [
        { id: "ru-trust-hotline-8800-2000-122", label: "Trust Hotline (Доверие)", contact: "8-800-2000-122", note: "24/7 free psychological support." },
    ],
};

// ─── North America ────────────────────────────────────────────────────────────

export const USA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "US",
    emergency: { id: "us-emergency-911", label: "Emergency", contact: "911", note: "Police, ambulance and fire." },
    primary: [
        { id: "us-988-lifeline", label: "988 Suicide & Crisis Lifeline", contact: "988", note: "24/7 free call or text — also available in Spanish." },
        { id: "us-crisis-text-line", label: "Crisis Text Line", contact: "Text HOME to 741741", note: "24/7 free crisis text support." },
    ],
};

export const CANADA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "CA",
    emergency: { id: "ca-emergency-911", label: "Emergency", contact: "911", note: "Police, ambulance and fire." },
    primary: [
        { id: "ca-talk-suicide-1833-456-4566", label: "Talk Suicide Canada", contact: "1-833-456-4566", note: "24/7 free crisis support — also text 45645 (4pm–midnight ET)." },
    ],
};

export const MEXICO_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "MX",
    emergency: { id: "mx-emergency-911", label: "Emergency", contact: "911", note: "National emergency number." },
    primary: [
        { id: "mx-saptel-55-5259-8121", label: "SAPTEL", contact: "55 5259-8121", note: "24/7 crisis intervention and emotional support." },
    ],
};

// ─── Latin America ────────────────────────────────────────────────────────────

export const BRAZIL_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "BR",
    emergency: { id: "br-emergency-192", label: "Emergency", contact: "192 / 190", note: "SAMU ambulance (192) or Police (190)." },
    primary: [
        { id: "br-cvv-188", label: "CVV — Centro de Valorização da Vida", contact: "188", note: "24/7 free suicide prevention and emotional support." },
    ],
};

export const ARGENTINA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "AR",
    emergency: { id: "ar-emergency-911", label: "Emergency", contact: "911 / 107", note: "Police/Emergency (911) or Ambulance (107)." },
    primary: [
        { id: "ar-cas-135", label: "Centro de Asistencia al Suicida", contact: "135", note: "24/7 free crisis support." },
    ],
};

export const CHILE_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "CL",
    emergency: { id: "cl-emergency-131", label: "Emergency", contact: "131 / 133", note: "Ambulance (131) or Police (133)." },
    primary: [
        { id: "cl-salud-responde-800-360-777", label: "Salud Responde", contact: "800 360 777", note: "24/7 free mental health support." },
    ],
};

export const COLOMBIA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "CO",
    emergency: { id: "co-emergency-123", label: "Emergency", contact: "123", note: "National emergency number." },
    primary: [
        { id: "co-linea-106", label: "Línea 106 de Salud Mental", contact: "106", note: "24/7 free mental health crisis line." },
    ],
};

export const PERU_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "PE",
    emergency: { id: "pe-emergency-116", label: "Emergency", contact: "116 / 105", note: "Ambulance (116) or Police (105)." },
    primary: [
        { id: "pe-salud-mental-113", label: "Línea 113 Salud Mental", contact: "113", note: "24/7 free mental health support." },
    ],
};

// ─── Oceania ──────────────────────────────────────────────────────────────────

export const AUSTRALIA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "AU",
    emergency: { id: "au-emergency-000", label: "Emergency", contact: "000", note: "Police, ambulance and fire." },
    primary: [
        { id: "au-lifeline-13-11-14", label: "Lifeline", contact: "13 11 14", note: "24/7 free crisis support — also text 0477 13 11 14." },
        { id: "au-beyond-blue-1300-22-4636", label: "Beyond Blue", contact: "1300 22 4636", note: "24/7 free mental health support." },
    ],
};

export const NEW_ZEALAND_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "NZ",
    emergency: { id: "nz-emergency-111", label: "Emergency", contact: "111", note: "Police, ambulance and fire." },
    primary: [
        { id: "nz-lifeline-0800-543-354", label: "Lifeline Aotearoa", contact: "0800 543 354", note: "24/7 free crisis support." },
        { id: "nz-1737", label: "1737 Need to Talk?", contact: "1737", note: "24/7 free call or text with a trained counselor." },
    ],
};

// ─── Africa ───────────────────────────────────────────────────────────────────

export const SOUTH_AFRICA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "ZA",
    emergency: { id: "za-emergency-10111", label: "Emergency", contact: "10111 / 10177", note: "Police (10111) or Ambulance (10177)." },
    primary: [
        { id: "za-sadag-0800-456-789", label: "SADAG Suicide Crisis Line", contact: "0800 456 789", note: "24/7 free crisis support." },
        { id: "za-lifeline-0861-322-322", label: "Lifeline South Africa", contact: "0861 322 322", note: "24/7 crisis counseling." },
    ],
};

export const NIGERIA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "NG",
    emergency: { id: "ng-emergency-199", label: "Emergency", contact: "199 / 112", note: "Ambulance (199) or Emergency (112)." },
    primary: [
        { id: "ng-cassa-08009111111", label: "CASSA Helpline", contact: "0800 9111 111", note: "Crisis and suicide support helpline." },
    ],
};

export const KENYA_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "KE",
    emergency: { id: "ke-emergency-999", label: "Emergency", contact: "999 / 112", note: "National emergency numbers." },
    primary: [
        { id: "ke-befrienders-0722-178-177", label: "Befrienders Kenya", contact: "0722 178 177", note: "Emotional support helpline." },
    ],
};

export const EGYPT_CRISIS_RESOURCES: CountryCrisisResources = {
    countryCode: "EG",
    emergency: { id: "eg-emergency-123", label: "Emergency", contact: "123", note: "Ambulance and emergency." },
    primary: [
        { id: "eg-noshpa-08008880700", label: "Mental Health Hotline (NOSHPA)", contact: "08008880700", note: "Free mental health support line." },
    ],
};

// ─── Lookup map ───────────────────────────────────────────────────────────────

const COUNTRY_RESOURCES_MAP: Record<string, CountryCrisisResources> = {
    // Asia
    IN: INDIA_CRISIS_RESOURCES,
    JP: JAPAN_CRISIS_RESOURCES,
    KR: SOUTH_KOREA_CRISIS_RESOURCES,
    CN: CHINA_CRISIS_RESOURCES,
    SG: SINGAPORE_CRISIS_RESOURCES,
    MY: MALAYSIA_CRISIS_RESOURCES,
    PH: PHILIPPINES_CRISIS_RESOURCES,
    TH: THAILAND_CRISIS_RESOURCES,
    ID: INDONESIA_CRISIS_RESOURCES,
    HK: HONG_KONG_CRISIS_RESOURCES,
    TW: TAIWAN_CRISIS_RESOURCES,
    LK: SRI_LANKA_CRISIS_RESOURCES,
    PK: PAKISTAN_CRISIS_RESOURCES,
    BD: BANGLADESH_CRISIS_RESOURCES,
    // Middle East
    IL: ISRAEL_CRISIS_RESOURCES,
    TR: TURKEY_CRISIS_RESOURCES,
    AE: UAE_CRISIS_RESOURCES,
    SA: SAUDI_ARABIA_CRISIS_RESOURCES,
    // Europe
    GB: UK_CRISIS_RESOURCES,
    DE: GERMANY_CRISIS_RESOURCES,
    FR: FRANCE_CRISIS_RESOURCES,
    ES: SPAIN_CRISIS_RESOURCES,
    IT: ITALY_CRISIS_RESOURCES,
    NL: NETHERLANDS_CRISIS_RESOURCES,
    PT: PORTUGAL_CRISIS_RESOURCES,
    SE: SWEDEN_CRISIS_RESOURCES,
    NO: NORWAY_CRISIS_RESOURCES,
    DK: DENMARK_CRISIS_RESOURCES,
    FI: FINLAND_CRISIS_RESOURCES,
    CH: SWITZERLAND_CRISIS_RESOURCES,
    AT: AUSTRIA_CRISIS_RESOURCES,
    BE: BELGIUM_CRISIS_RESOURCES,
    PL: POLAND_CRISIS_RESOURCES,
    IE: IRELAND_CRISIS_RESOURCES,
    GR: GREECE_CRISIS_RESOURCES,
    RO: ROMANIA_CRISIS_RESOURCES,
    CZ: CZECH_REPUBLIC_CRISIS_RESOURCES,
    HU: HUNGARY_CRISIS_RESOURCES,
    RU: RUSSIA_CRISIS_RESOURCES,
    // North America
    US: USA_CRISIS_RESOURCES,
    CA: CANADA_CRISIS_RESOURCES,
    MX: MEXICO_CRISIS_RESOURCES,
    // Latin America
    BR: BRAZIL_CRISIS_RESOURCES,
    AR: ARGENTINA_CRISIS_RESOURCES,
    CL: CHILE_CRISIS_RESOURCES,
    CO: COLOMBIA_CRISIS_RESOURCES,
    PE: PERU_CRISIS_RESOURCES,
    // Oceania
    AU: AUSTRALIA_CRISIS_RESOURCES,
    NZ: NEW_ZEALAND_CRISIS_RESOURCES,
    // Africa
    ZA: SOUTH_AFRICA_CRISIS_RESOURCES,
    NG: NIGERIA_CRISIS_RESOURCES,
    KE: KENYA_CRISIS_RESOURCES,
    EG: EGYPT_CRISIS_RESOURCES,
};

/**
 * Returns crisis resources for the given ISO 3166-1 alpha-2 country code.
 * Falls back to India resources if no country code is provided.
 * Returns null if the country has no configured resources.
 */
export function getCrisisResourcesForCountry(
    countryCode?: string | null,
): CountryCrisisResources | null {
    const code = String(countryCode ?? "").trim().toUpperCase();
    if (!code) return INDIA_CRISIS_RESOURCES;
    return COUNTRY_RESOURCES_MAP[code] ?? null;
}
