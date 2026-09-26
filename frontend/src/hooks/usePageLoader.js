import { useContext } from 'react';
import LoaderContext from '../contexts/LoaderContext';

const usePageLoader = () => {
  const ctx = useContext(LoaderContext);
  if (!ctx) {
    return { pageLoading: false, pageMessage: '', showPageLoader: () => {}, hidePageLoader: () => {} };
  }
  return ctx;
};

export default usePageLoader;
