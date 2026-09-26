const CardInfoRow = ({ label, value, detailsFontSize = 11, fontWeight = 600, textColor = '#1f2937' }) => (
  <div className="flex justify-start items-center py-1" style={{ fontSize: detailsFontSize, lineHeight: 1.5 }}>
    <span className="text-gray-400 flex-shrink-0" style={{ width: 80, fontSize: detailsFontSize }}>{label}</span>
    <span className="font-semibold" style={{ fontSize: detailsFontSize, fontWeight, color: textColor }}>
      {value || '—'}
    </span>
  </div>
);

export default CardInfoRow;
