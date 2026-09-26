const SpinnerLoader = () => (
  <div className="flex flex-col items-center">
    <svg className="animate-spin h-10 w-10 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
    <p className="text-sm text-white/70 font-medium tracking-wide">Loading...</p>
  </div>
);

const PulseLoader = () => (
  <div className="flex flex-col items-center">
    <div className="flex items-center gap-1.5 mb-4">
      <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
      <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
      <span className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
    </div>
    <p className="text-sm text-white/70 font-medium tracking-wide">Loading...</p>
  </div>
);

const ProgressLoader = () => (
  <div className="flex flex-col items-center">
    <div className="w-48 h-1 bg-white/20 rounded-full overflow-hidden mb-4">
      <div className="h-full bg-white rounded-full animate-[progress_2s_ease-in-out_infinite]" style={{ width: '30%' }} />
    </div>
    <p className="text-sm text-white/70 font-medium tracking-wide">Loading...</p>
  </div>
);

const SkeletonLoader = () => (
  <div className="flex flex-col items-center gap-3">
    <div className="w-14 h-14 rounded-full bg-white/15 animate-pulse" />
    <div className="w-40 h-3 rounded bg-white/15 animate-pulse" />
    <div className="w-24 h-3 rounded bg-white/15 animate-pulse" />
  </div>
);

const LOADERS = {
  Pulse: PulseLoader,
  'Progress Bar': ProgressLoader,
  Skeleton: SkeletonLoader,
};

const SplashScreen = ({ visible, loaderStyle = '' }) => {
  const LoaderComponent = LOADERS[loaderStyle] || SpinnerLoader;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)' }}
    >
      <LoaderComponent />
    </div>
  );
};

export default SplashScreen;
