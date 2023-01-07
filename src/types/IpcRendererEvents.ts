export interface UpscaleFoldersEvent {
  paths: string[];
  opts: UpscaleFoldersOpts;
}

export interface UpscaleFoldersOpts {
  maxResolution: {
    height: number;
    width: number;
  };
  command: string;
}
