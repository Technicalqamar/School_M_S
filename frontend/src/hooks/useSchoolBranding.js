import { useState, useEffect } from 'react';
import api from '../api/axios';

let cachedData = null;
let cachePromise = null;

const useSchoolBranding = () => {
  const [schoolBranding, setSchoolBranding] = useState(cachedData);
  const [loading, setLoading] = useState(!cachedData);

  useEffect(() => {
    if (cachedData) return;

    if (cachePromise) {
      cachePromise.then((data) => {
        setSchoolBranding(data);
        setLoading(false);
      });
      return;
    }

    cachePromise = api.get('/school-settings/public')
      .then((res) => {
        cachedData = res.data.data;
        setSchoolBranding(cachedData);
        setLoading(false);
        return cachedData;
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return { schoolBranding, loading };
};

export default useSchoolBranding;
