import { getInitials } from './cardHtmlUtils';
import { getImageUrl } from '../../../../utils/imageUrl';

const shapeClasses = { circle: 'rounded-full', rounded: 'rounded-xl', square: 'rounded-none' };

const CardPhoto = ({ fullName, photoSize = 80, photoShape = 'circle', image = null }) => {
  const imageUrl = getImageUrl(image);

  return (
    <div
      className={`${shapeClasses[photoShape] || shapeClasses.circle} bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold ring-2 ring-yellow-400 mb-3 overflow-hidden`}
      style={{ width: photoSize, height: photoSize, fontSize: Math.round(photoSize * 0.3) }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={fullName || 'Profile'} className="w-full h-full object-cover" onError={(event) => { event.currentTarget.style.display = 'none'; }} />
      ) : (
        getInitials(fullName)
      )}
    </div>
  );
};

export default CardPhoto;
