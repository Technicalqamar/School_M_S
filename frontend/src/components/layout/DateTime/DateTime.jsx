import { useState, useEffect } from 'react';
import { useFormatTime } from '../../../hooks/useLocalization';

const DateTime = () => {
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const formatTime = useFormatTime();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    const datePart = date.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    return `${datePart} ${formatTime(date)}`;
  };

  return (
    <div className="text-gray-500 dark:text-gray-400 text-sm font-medium whitespace-nowrap">
      {formatDate(currentDateTime)}
    </div>
  );
};

export default DateTime;
