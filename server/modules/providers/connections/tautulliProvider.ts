import { MetadataProviderType } from '@server/database/schema';
import { type ActuatorTask, type MediaActuator, modelledRun } from '../roles';
import { BaseProviderConnection } from './baseProviderConnection';

export interface TautulliLibraryStat {
  section_id: number;
  section_name: string;
  section_type: string;
  count: number;
}

export interface TautulliHomeStatRow {
  title: string;
  total_plays: number;
}

export interface TautulliHomeStat {
  stat_id: string;
  rows: TautulliHomeStatRow[];
}

export interface TautulliHistoryItem {
  rating_key: string;
  title: string;
  user: string;
  watched_status: number;
  duration: number;
  play_duration: number;
  played_at?: number;
}

interface TautulliResponse<T> {
  response: {
    result: string;
    data: T;
  };
}

export class TautulliProvider extends BaseProviderConnection implements MediaActuator {
  public readonly actuatorType = MetadataProviderType.TAUTULLI;

  public tasks(): ActuatorTask[] {
    return [
      {
        id: 'deleteWatchHistory',
        label: 'Delete watch history',
        destructive: true,
        affects: 'media',
        run: modelledRun('deleteWatchHistory'),
      },
      {
        id: 'sendNotification',
        label: 'Send notification',
        destructive: false,
        run: modelledRun('sendNotification'),
      },
      {
        id: 'terminateStream',
        label: 'Terminate active stream',
        destructive: true,
        run: modelledRun('terminateStream'),
      },
    ];
  }

  private get baseParams() {
    return { apikey: this.provider.apiKey || '' };
  }

  private async command<T>(cmd: string, extra?: Record<string, string | number>): Promise<T> {
    const resp = await this.client
      .get('api/v2', { searchParams: { ...this.baseParams, cmd, ...extra } })
      .json<TautulliResponse<T>>();
    return resp.response.data;
  }

  public async getLibraryStats(): Promise<TautulliLibraryStat[]> {
    const data = await this.command<{ data: TautulliLibraryStat[] }>('get_libraries_table');
    return data.data;
  }

  public async getHomeStats(): Promise<TautulliHomeStat[]> {
    return this.command<TautulliHomeStat[]>('get_home_stats');
  }

  public async getHistory(): Promise<TautulliHistoryItem[]> {
    const data = await this.command<{ data: TautulliHistoryItem[] }>('get_history');
    return data.data;
  }

  public async searchHistory(title: string): Promise<TautulliHistoryItem[]> {
    const data = await this.command<{ data: TautulliHistoryItem[] }>('get_history', {
      search: title,
      length: 100,
    });
    return data.data;
  }
}
