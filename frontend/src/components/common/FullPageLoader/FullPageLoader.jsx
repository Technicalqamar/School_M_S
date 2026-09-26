import Spinner from '../Spinner/Spinner';

const FullPageLoader = ({ message }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
      <Spinner size="lg" className="text-blue-600 mb-4" />
      {message && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
      )}
    </div>
  );
};

export default FullPageLoader;
