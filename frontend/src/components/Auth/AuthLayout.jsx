import { useState, useEffect } from 'react';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { getImageUrl } from '../../utils/imageUrl';

const ROLE_STYLES = {
  admin: {
    fallbackIcon: ShieldCheckIcon,
    description: 'Administrator Portal — Manage your institution with confidence and efficiency.',
    leftBg: 'from-blue-900 via-blue-800 to-blue-900',
    accentBar: 'bg-yellow-400',
    mobileAccent: 'from-blue-600 to-blue-800',
    mobileRing: 'ring-yellow-400/50',
  },
  teacher: {
    fallbackIcon: ShieldCheckIcon,
    description: 'Teacher Portal — Access your classes, track progress, and manage student learning.',
    leftBg: 'from-emerald-900 via-emerald-800 to-emerald-900',
    accentBar: 'bg-emerald-400',
    mobileAccent: 'from-emerald-600 to-emerald-800',
    mobileRing: 'ring-emerald-400/50',
  },
  student: {
    fallbackIcon: ShieldCheckIcon,
    description: 'Student Portal — View your assignments, grades, and academic progress.',
    leftBg: 'from-violet-900 via-violet-800 to-violet-900',
    accentBar: 'bg-violet-400',
    mobileAccent: 'from-violet-600 to-violet-800',
    mobileRing: 'ring-violet-400/50',
  },
};

const AuthLayout = ({ children, title, subtitle, role = 'admin', description }) => {
  const [schoolData, setSchoolData] = useState(null);
  const [loading, setLoading] = useState(true);

  const style = ROLE_STYLES[role] || ROLE_STYLES.admin;
  const FallbackIcon = style.fallbackIcon;
  const displayDescription = description || style.description;

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace('/api/v1', '');
        const res = await fetch(`${base}/api/v1/school-settings/public`);
        const json = await res.json();
        setSchoolData(json.data || {});
      } catch {
        setSchoolData({});
      } finally {
        setLoading(false);
      }
    };
    fetchBranding();
  }, []);

  const schoolName = schoolData?.schoolName || 'School Management System';
  const schoolLogo = schoolData?.logo ? getImageUrl(schoolData.logo) : null;
  const principalName = schoolData?.principalName || '';

  return (
    <div className="min-h-screen flex">
      <div className={`hidden lg:flex lg:w-1/2 xl:w-[55%] relative bg-gradient-to-br ${style.leftBg} overflow-hidden`}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-white rounded-full translate-x-1/3 translate-y-1/3" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2 opacity-30" />
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12 xl:px-20">
          <div className="flex flex-col items-center text-center">
            {schoolLogo ? (
              <div className="w-28 h-28 xl:w-36 xl:h-36 rounded-2xl bg-white/10 backdrop-blur-sm border-2 border-white/20 shadow-2xl overflow-hidden flex items-center justify-center p-3">
                <img
                  src={schoolLogo}
                  alt={schoolName}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-28 h-28 xl:w-36 xl:h-36 rounded-2xl bg-white/10 backdrop-blur-sm border-2 border-white/20 shadow-2xl flex items-center justify-center">
                <FallbackIcon className="w-14 h-14 xl:w-18 xl:h-18 text-white" />
              </div>
            )}

            <h1 className="mt-6 text-2xl xl:text-3xl font-bold text-white leading-tight">
              {schoolName}
            </h1>

            <div className={`mt-3 w-16 h-1 ${style.accentBar} rounded-full`} />

            <p className="mt-5 text-blue-200 text-sm xl:text-base leading-relaxed max-w-sm">
              {displayDescription}
            </p>

            {principalName && (
              <p className="mt-4 text-blue-300/80 text-xs xl:text-sm">
                {principalName}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 xl:w-[45%] flex flex-col min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-10 lg:px-14 xl:px-20 py-10">
          <div className="lg:hidden flex flex-col items-center mb-8">
            {schoolLogo ? (
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${style.mobileAccent} shadow-lg overflow-hidden flex items-center justify-center p-1.5 ring-2 ${style.mobileRing}`}>
                <img
                  src={schoolLogo}
                  alt={schoolName}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${style.mobileAccent} shadow-lg flex items-center justify-center ring-2 ${style.mobileRing}`}>
                <FallbackIcon className="w-8 h-8 text-white" />
              </div>
            )}
            <h2 className="mt-3 text-lg font-bold text-gray-900 text-center">
              {schoolName}
            </h2>
          </div>

          {title && (
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
              {subtitle && (
                <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
              )}
            </div>
          )}

          {children}
        </div>

        <div className="hidden lg:block px-10 xl:px-14 pb-6">
          <p className="text-xs text-gray-400 text-center">
            © {new Date().getFullYear()} {schoolName}. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
