import { createContext, useState, useCallback } from 'react';

const LoaderContext = createContext(null);

export const LoaderProvider = ({ children }) => {
  const [pageLoading, setPageLoading] = useState(false);
  const [pageMessage, setPageMessage] = useState('');

  const showPageLoader = useCallback((message = '') => {
    setPageMessage(message);
    setPageLoading(true);
  }, []);

  const hidePageLoader = useCallback(() => {
    setPageLoading(false);
    setPageMessage('');
  }, []);

  return (
    <LoaderContext.Provider value={{ pageLoading, pageMessage, showPageLoader, hidePageLoader }}>
      {children}
    </LoaderContext.Provider>
  );
};

export default LoaderContext;
