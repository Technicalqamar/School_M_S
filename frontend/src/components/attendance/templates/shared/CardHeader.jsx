import { AcademicCapIcon } from '@heroicons/react/24/outline';

const CardHeader = ({ schoolName, title, primaryColor = '#2563eb', secondaryColor = '#1e40af', visibility = {} }) => {
  return (
    <div className="px-5 py-4 text-center" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}>
      {title !== undefined ? (
        <h3 className="text-white font-bold m-0" style={{ fontSize: 14, letterSpacing: '0.02em' }}>{title}</h3>
      ) : (
        <div className="flex items-center justify-center gap-2">
          {visibility?.schoolLogo && (
            <AcademicCapIcon className="h-6 w-6 text-white/90 flex-shrink-0" />
          )}
          {visibility?.schoolName && (
            <h3 className="text-white font-bold m-0" style={{ fontSize: 14, letterSpacing: '0.02em' }}>{schoolName}</h3>
          )}
        </div>
      )}
    </div>
  );
};

export default CardHeader;
