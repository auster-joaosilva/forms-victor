export interface SourceFiles {
  list(): Promise<string[]>
  copyTo(sourceKey: string, backupKey: string): Promise<void>
}
