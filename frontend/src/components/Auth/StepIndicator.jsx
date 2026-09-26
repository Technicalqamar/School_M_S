import { CheckCircleIcon } from '@heroicons/react/24/outline';

const StepIndicator = ({ steps, currentStep }) => {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all duration-300 ${
              currentStep >= s.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            {currentStep > s.id ? (
              <CheckCircleIcon className="h-4 w-4" />
            ) : (
              s.id
            )}
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-8 sm:w-12 h-0.5 mx-1 rounded transition-all duration-300 ${
                currentStep > s.id ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default StepIndicator;
