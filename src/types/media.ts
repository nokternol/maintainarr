export interface MediaFilters {
  [key: string]: string | number | boolean | undefined;
}

export interface MediaImage {
  coverType: string;
  remoteUrl: string;
}
