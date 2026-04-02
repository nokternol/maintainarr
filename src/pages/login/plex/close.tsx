import { useEffect } from 'react';

/**
 * This page is navigated to by the Plex auth popup after authentication completes.
 * It immediately self-closes, which works because it's same-origin as the opener.
 */
export default function PlexClose() {
  useEffect(() => {
    window.close();
  }, []);

  return null;
}
