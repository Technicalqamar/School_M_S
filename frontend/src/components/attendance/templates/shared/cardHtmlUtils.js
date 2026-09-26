import QRCode from 'qrcode';
import { getImageUrl } from '../../../../utils/imageUrl';

export function getInitials(name) {
  return name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

export function formatClassName(cls) {
  return cls.replace('KG ', 'KG-');
}

export function frontHeaderHtml(schoolName, primaryColor = '#2563eb', secondaryColor = '#1e40af') {
  return `<div style="background:linear-gradient(135deg,${primaryColor},${secondaryColor});padding:16px 20px;text-align:center;">
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="1.5" style="display:inline-block;vertical-align:middle;margin-right:8px;">
      <path d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342"/>
    </svg>
    <span style="color:white;font-size:14px;font-weight:700;display:inline-block;vertical-align:middle;">${schoolName}</span>
  </div>`;
}

export function backHeaderHtml(primaryColor = '#2563eb', secondaryColor = '#1e40af') {
  return `<div style="background:linear-gradient(135deg,${primaryColor},${secondaryColor});padding:16px 20px;text-align:center;">
    <span style="color:white;font-size:14px;font-weight:700;">QR Scanner</span>
  </div>`;
}

export function photoHtml(initials, photoSize = 80, photoShape = 'circle', image = null) {
  const br = photoShape === 'circle' ? '50%' : photoShape === 'rounded' ? '12px' : '0';
  const imageUrl = getImageUrl(image);

  if (imageUrl) {
    return `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${br};overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f3f4f6;border:2px solid rgba(251,191,36,0.5);margin:0 auto 10px;box-shadow:0 3px 10px rgba(0,0,0,0.08);"><img src="${imageUrl}" alt="Profile" style="width:100%;height:100%;object-fit:cover;display:block;" /></div>`;
  }

  return `<div style="width:${photoSize}px;height:${photoSize}px;border-radius:${br};background:linear-gradient(135deg,#3b82f6,#7c3aed);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:${Math.round(photoSize * 0.35)}px;border:2px solid rgba(251,191,36,0.5);margin:0 auto 10px;box-shadow:0 3px 10px rgba(0,0,0,0.08);">${initials}</div>`;
}

export function detailRowHtml(label, value, detailsFontSize = 11, fontWeight = 600, textColor = '#1f2937') {
  return `<div style="display:flex;padding:3px 0;font-size:${detailsFontSize}px;line-height:1.5;">
    <span style="color:#9ca3af;width:80px;flex-shrink:0;">${label}</span>
    <span style="font-weight:${fontWeight};color:${textColor};">${value}</span>
  </div>`;
}

export function qrPlaceholderHtml(size = 140) {
  return `<div style="width:${size}px;height:${size}px;border:2px dashed #d1d5db;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#f9fafb;margin:0 auto;">
    <div style="text-align:center;">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"/>
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z"/>
      </svg>
      <p style="margin:4px 0 0;font-size:9px;color:#9ca3af;">QR Code</p>
    </div>
  </div>`;
}

/**
 * Generates a real, scannable QR code as an inline <img> (PNG data URL) so
 * printed cards and the downloaded PDF contain the actual QR value.
 * Falls back to the placeholder if no value is available.
 */
export async function qrImageHtml(value, size = 140, fgColor = '#000000', bgColor = '#ffffff') {
  if (!value) {
    return qrPlaceholderHtml(size);
  }
  try {
    const dataUrl = await QRCode.toDataURL(value, {
      margin: 1,
      width: Math.round(size * 2),
      color: { dark: fgColor, light: bgColor },
    });
    return `<img src="${dataUrl}" alt="QR Code" width="${size}" height="${size}" style="display:block;margin:0 auto;background:#ffffff;padding:4px;border-radius:6px;box-sizing:border-box;" />`;
  } catch {
    return qrPlaceholderHtml(size);
  }
}

export function frontFooterHtml() {
  return `<div style="text-align:center;padding:8px 16px 10px;border-top:1px solid #e5e7eb;margin-top:6px;">
    <span style="font-size:9px;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">Academic Year</span>
  </div>`;
}

export function cropMarksHtml() {
  const len = 10;
  const off = 3;
  return `
    <div style="position:absolute;top:-${off}px;left:-${off}px;width:${len}px;height:1px;background:#aaa;"></div>
    <div style="position:absolute;top:-${off}px;left:-${off}px;width:1px;height:${len}px;background:#aaa;"></div>
    <div style="position:absolute;top:-${off}px;right:-${off}px;width:${len}px;height:1px;background:#aaa;"></div>
    <div style="position:absolute;top:-${off}px;right:-${off}px;width:1px;height:${len}px;background:#aaa;"></div>
    <div style="position:absolute;bottom:-${off}px;left:-${off}px;width:${len}px;height:1px;background:#aaa;"></div>
    <div style="position:absolute;bottom:-${off}px;left:-${off}px;width:1px;height:${len}px;background:#aaa;"></div>
    <div style="position:absolute;bottom:-${off}px;right:-${off}px;width:${len}px;height:1px;background:#aaa;"></div>
    <div style="position:absolute;bottom:-${off}px;right:-${off}px;width:1px;height:${len}px;background:#aaa;"></div>`;
}

export function backFooterHtml() {
  return `<div style="padding:10px 16px 12px;border-top:1px solid #e5e7eb;margin-top:6px;">
    <p style="margin:0;font-size:8px;color:#9ca3af;line-height:1.5;text-align:center;">
      This ID card must be carried daily while attending school. Loss of this card should be reported immediately to the school administration.
    </p>
  </div>`;
}

export function cardWrapperHtml(innerHtml, cardWidth, borderRadius, cardBgColor, heightStyle = '') {
  return `<div style="border-radius:${borderRadius}px;overflow:hidden;background:${cardBgColor};${heightStyle}border:1px solid #e5e7eb;box-shadow:0 1px 4px rgba(0,0,0,0.04);">${innerHtml}</div>`;
}

export function frontBodyHtml(photo, name, details) {
  return `<div style="padding:16px 20px;text-align:center;">
    ${photo}
    ${name}
    ${details ? `<div style="margin-top:10px;text-align:left;display:inline-block;">${details}</div>` : ''}
  </div>`;
}

export function backBodyHtml(qr, details) {
  return `<div style="padding:20px 20px 12px;text-align:center;">
    ${qr}
    ${details ? `<div style="margin-top:14px;text-align:left;display:inline-block;">${details}</div>` : ''}
  </div>`;
}
