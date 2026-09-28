import type { EmergencyContact } from '../../core/types';

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** sms: link with a prefilled body. The message is sent by the phone’s own messaging app — never by Steady. */
export function smsHref(contacts: EmergencyContact[], body: string) {
  const numbers = contacts.map((c) => c.phone.replace(/[^\d+]/g, '')).filter(Boolean);
  const isApple = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  const to = numbers.join(',');
  // iOS expects "&body=", Android expects "?body=". "?&body=" works on both for one recipient.
  return isApple ? `sms:${to}&body=${encodeURIComponent(body)}` : `sms:${to}?body=${encodeURIComponent(body)}`;
}

export function emergencyMessage(name: string, locationUrl: string | null) {
  const who = name.trim() ? `This is ${name.trim()}. ` : '';
  return `${who}I may be having a seizure or just had one and could need help.${locationUrl ? ` My location: ${locationUrl}` : ''} (Sent from my Steady rescue plan.)`;
}

export function getLocationUrl(): Promise<string | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(`https://maps.google.com/?q=${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
