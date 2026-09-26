import { QRCodeSVG } from 'qrcode.react';
import QRCodePlaceholder from './QRCodePlaceholder';

/**
 * Real, scannable QR code rendered with qrcode.react (QRCodeSVG).
 * When no value is provided it falls back to the placeholder box so the card
 * layout stays intact for students whose card hasn't been generated yet.
 */
const QRCodeComponent = ({ value, size = 140, level = 'M', className = '' }) => {
  if (!value) {
    return <QRCodePlaceholder size={size} />;
  }

  // Leave a quiet-zone margin around the modules so scanners can read it.
  const padding = Math.max(4, Math.round(size * 0.04));

  return (
    <div
      className={`mx-auto flex items-center justify-center bg-white rounded-lg ${className}`}
      style={{
        width: size,
        height: size,
        padding,
        border: '1px solid #e5e7eb',
        boxSizing: 'border-box',
      }}
      title={`QR: ${value}`}
    >
      <QRCodeSVG
        value={value}
        size={size - padding * 2}
        level={level}
        bgColor="#ffffff"
        fgColor="#000000"
      />
    </div>
  );
};

export default QRCodeComponent;