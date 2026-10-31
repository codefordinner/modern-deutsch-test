import { useEffect } from 'react';
import { fetchSrsWeights } from '../api/client';
import { useQuery } from '../api/queryCache';
import { setSrsWeights } from '../utils/srsWeights';

export const SRS_WEIGHTS_KEY = 'settings:srs-weights';

/**
 * Loads the admin-configured Leitner box weights and puts them into the shared
 * store (utils/srsWeights.ts). Mount once, near the app root. If the request
 * fails the defaults stay in effect — the trainers keep working.
 */
export function useSrsWeightsSync(): void {
  const { data } = useQuery(SRS_WEIGHTS_KEY, fetchSrsWeights);

  useEffect(() => {
    if (data) setSrsWeights(data.weights);
  }, [data]);
}
