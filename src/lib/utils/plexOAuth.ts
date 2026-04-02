import axios from 'axios';

interface PlexPin {
  id: number;
  code: string;
}

export class PlexOAuth {
  private plexHeaders: Record<string, string>;
  private pin?: PlexPin;
  private popup?: Window | null;

  constructor() {
    this.plexHeaders = this.initializeHeaders();
  }

  private initializeHeaders(): Record<string, string> {
    let clientId = localStorage.getItem('plex-client-id');
    if (!clientId) {
      clientId = crypto.randomUUID();
      localStorage.setItem('plex-client-id', clientId);
    }

    return {
      Accept: 'application/json',
      'X-Plex-Product': 'Maintainarr',
      'X-Plex-Version': '1.0',
      'X-Plex-Client-Identifier': clientId,
      'X-Plex-Platform': 'Web',
      'X-Plex-Device': 'Browser',
      'X-Plex-Device-Name': 'Maintainarr (Web)',
    };
  }

  async getPin(): Promise<PlexPin> {
    const response = await axios.post('https://plex.tv/api/v2/pins?strong=true', undefined, {
      headers: this.plexHeaders,
    });

    this.pin = { id: response.data.id, code: response.data.code };
    return this.pin;
  }

  openPopup(): void {
    if (!this.pin) return;

    const params = new URLSearchParams({
      clientID: this.plexHeaders['X-Plex-Client-Identifier'],
      code: this.pin.code,
      'context[device][product]': this.plexHeaders['X-Plex-Product'],
    });

    const url = `https://app.plex.tv/auth/#!?${params.toString()}`;
    // Open directly to the Plex URL so the Window reference is a cross-origin
    // proxy from the start. Opening to about:blank first then navigating causes
    // a same→cross-origin transition that incorrectly sets popup.closed = true.
    this.popup = window.open(url, 'Plex-Auth', 'width=600,height=700');
  }

  async pollForToken(): Promise<string> {
    if (!this.pin) {
      throw new Error('No PIN. Call getPin() first.');
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 300000); // 5 minutes

      const poll = async () => {
        try {
          const response = await axios.get(`https://plex.tv/api/v2/pins/${this.pin!.id}`, {
            headers: this.plexHeaders,
          });

          if (response.data.authToken) {
            clearTimeout(timeoutId);
            // Call close() unconditionally — popup.closed is unreliable for cross-origin
            // windows in Chrome (always returns true), so we can't use it as a guard.
            try { this.popup?.close(); } catch { /* ignore cross-origin close errors */ }
            resolve(response.data.authToken);
            return;
          }
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
          return;
        }

        setTimeout(poll, 1000);
      };

      setTimeout(poll, 1000);
    });
  }

  async login(): Promise<string> {
    await this.getPin();
    this.openPopup();
    return this.pollForToken();
  }
}
