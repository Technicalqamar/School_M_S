import { createContext, useContext } from 'react';

const PortalContext = createContext(null);

export const PortalProvider = ({ children, value }) => (
  <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
);

// eslint-disable-next-line react-refresh/only-export-components
export const usePortal = () => useContext(PortalContext);

export default PortalContext;